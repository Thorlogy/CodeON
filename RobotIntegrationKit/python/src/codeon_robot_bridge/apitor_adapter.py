from __future__ import annotations

import asyncio
import contextlib
import time
from collections.abc import Callable
from typing import Any

from .adapter import RobotAdapter
from .apitor_ble_probe import (
    APITOR_NOTIFY_UUID,
    APITOR_WRITE_UUID,
    LED_COLORS,
    ROBOT_X_AUTHORIZE,
    STOP_ALL_MOTORS,
    ApitorSensorPacket,
    led_frame,
    motor_frame,
    parse_sensor_packet,
)
from .capabilities import CapabilityManifest
from .errors import AdapterError, NotConnectedError, UnsupportedCommandError


def _default_ble_factory():
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as error:
        raise AdapterError(
            f"Bleak konnte nicht geladen werden ({error}). "
            "Apitor-Unterstützung über das 'apitor'-Extra einrichten/reparieren."
        ) from error
    return BleakClient, BleakScanner


class ApitorAdapter(RobotAdapter):
    """Apitor Robot X adapter with verified motors and APK-recovered I/O."""

    # Keep each write below the browser's three-second request limit. A timed
    # out confirmed write poisons this BLE session: a late CoreBluetooth ACK
    # must never be mistaken for an ACK to a later command on the same F001.
    _gatt_write_timeout = 0.75
    _emergency_write_timeout = 0.2

    _manifest = CapabilityManifest(
        robot="apitor",
        adapter_version="0.2.1",
        capabilities={
            "motorPorts": ["M1", "M2", "M3"],
            "individualMotorControl": True,
            "lights": ["L1", "L2"],
            "lightColors": list(LED_COLORS),
            "sensors": ["colorRaw", "colorGroup", "infrared1", "infrared2", "sensorSnapshot"],
            "soundOutput": "host-only",
        },
        limits={
            "motorSpeedLevel": {"min": 1, "max": 12},
            "motorDirections": [1, 2],
            "heartbeatTimeoutMs": 1000,
            "verification": {
                "motors": "hardware-verified",
                "lights": "apk-recovered-hardware-pending",
                "sensors": "apk-recovered-hardware-pending",
            },
        },
    )
    _motor_indices = {"M1": 6, "M2": 7, "M3": 8}

    def __init__(
        self,
        identifier: str | None = None,
        ble_factory: Callable[[], tuple[Any, Any]] = _default_ble_factory,
    ) -> None:
        self._identifier = identifier
        self._ble_factory = ble_factory
        self._client = None
        self._connected = False
        self._connect_lock = asyncio.Lock()
        self._write_lock = asyncio.Lock()
        self._unsafe_client = None
        self._stop_epoch = 0
        self._active_stops = 0
        self._motion_may_be_active = False
        self._stop_unconfirmed = False
        self._sensor_packet: ApitorSensorPacket | None = None
        self._sensor_timestamp: float | None = None

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return bool(
            self._connected
            and self._client is not None
            and self._unsafe_client is not self._client
            and getattr(self._client, "is_connected", False)
        )

    async def connect(self) -> dict[str, Any]:
        async with self._connect_lock:
            if self.connected:
                return self._connection_result()
            # A BLE disconnect may leave the adapter object alive. Never reuse
            # that stale client: macOS then reports that service discovery has
            # not been performed and an otherwise endless program is stopped.
            stale_client = self._client
            if stale_client is not None:
                with contextlib.suppress(Exception):
                    if getattr(stale_client, "is_connected", False):
                        await stale_client.disconnect()
                self._reset_connection()
            client_type, scanner_type = self._ble_factory()
            identifier = self._identifier or await self._find_robot(scanner_type)
            client = client_type(identifier, timeout=8.0, disconnected_callback=self._on_disconnect)
            self._client = client
            try:
                await client.connect()
                await self._confirmed_write(client, ROBOT_X_AUTHORIZE)
                await client.start_notify(APITOR_NOTIFY_UUID, self._on_notification)
                await asyncio.sleep(0.5)
                await self._confirmed_write(client, STOP_ALL_MOTORS)
            except (Exception, asyncio.CancelledError) as error:
                if getattr(client, "is_connected", False):
                    with contextlib.suppress(Exception):
                        await self._safe_stop(client)
                    with contextlib.suppress(Exception):
                        await asyncio.wait_for(client.disconnect(), timeout=1.0)
                self._reset_connection()
                if isinstance(error, asyncio.CancelledError):
                    raise
                raise AdapterError(f"failed to connect to Apitor Robot X: {error}") from error
            self._identifier = identifier
            self._connected = True
            self._motion_may_be_active = False
            self._stop_unconfirmed = False
            return self._connection_result()

    async def disconnect(self) -> None:
        client = self._client
        if client is None:
            return
        try:
            await self._safe_stop(client)
        finally:
            try:
                if getattr(client, "is_connected", False):
                    try:
                        await client.stop_notify(APITOR_NOTIFY_UUID)
                    except Exception:
                        pass
                    await client.disconnect()
            finally:
                self._reset_connection()

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if command == "setMotor":
            port = self._motor_port(params)
            direction = self._integer(params, "direction", 1, 2)
            speed = self._integer(params, "speed", 1, 12)
            packet = motor_frame(self._motor_indices[port], direction, speed)
            # The motor write may reach the hub even if its ACK never arrives.
            self._motion_may_be_active = True
            await self._write(client, packet)
        elif command == "stopMotor":
            port = self._motor_port(params)
            await self._write(client, motor_frame(self._motor_indices[port], 0, 0))
        elif command == "setLight":
            port = str(params.get("port", "")).upper()
            if port not in {"L1", "L2"}:
                raise AdapterError("light port must be L1 or L2")
            color_value = params.get("color", "off")
            if isinstance(color_value, str):
                color_name = color_value.lower()
                if color_name == "off":
                    color = 0
                elif color_name in LED_COLORS:
                    color = LED_COLORS[color_name]
                else:
                    raise AdapterError(f"unsupported light color: {color_value}")
            else:
                color = self._integer(params, "color", 0, 255)
            await self._write(client, led_frame(int(port[1]), color))
        else:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        self._require_client()
        packet = self._sensor_packet
        if packet is None:
            return None
        values = {
            "colorRaw": packet.color_raw,
            "colorGroup": packet.color_group,
            "infrared1": packet.infrared_1,
            "infrared2": packet.infrared_2,
        }
        if sensor == "sensorSnapshot":
            return {
                **values,
                "trailing": packet.trailing,
                "ageMs": round((time.monotonic() - (self._sensor_timestamp or time.monotonic())) * 1000),
            }
        if sensor in values:
            return values[sensor]
        raise UnsupportedCommandError(f"unsupported sensor: {sensor}")

    async def stop_all(self) -> None:
        if self._client is None:
            if self._stop_unconfirmed:
                raise AdapterError("Apitor stop is unconfirmed after BLE disconnect; check the hub")
            return
        await self._safe_stop(self._client)

    def _require_client(self):
        if not self.connected or self._client is None:
            raise NotConnectedError("Apitor Robot X is not connected")
        return self._client

    def _connection_result(self) -> dict[str, Any]:
        return {"connected": True, "identifier": self._identifier}

    def _on_notification(self, _: Any, data: bytearray) -> None:
        packet = parse_sensor_packet(data)
        if packet is not None:
            self._sensor_packet = packet
            self._sensor_timestamp = time.monotonic()

    def _on_disconnect(self, client: Any) -> None:
        """Invalidate a dropped Bleak client so the next connect is real."""
        if client is self._client:
            if self._motion_may_be_active:
                self._stop_unconfirmed = True
            self._reset_connection()

    def _reset_connection(self) -> None:
        self._client = None
        self._connected = False
        self._unsafe_client = None
        self._stop_epoch += 1
        self._sensor_packet = None
        self._sensor_timestamp = None

    @staticmethod
    async def _find_robot(scanner_type) -> str:
        devices = await scanner_type.discover(timeout=8.0)
        for device in devices:
            if "apitor" in str(getattr(device, "name", "") or "").lower():
                return str(getattr(device, "address", None) or getattr(device, "identifier", ""))
        raise AdapterError("no powered Apitor Robot X was found over Bluetooth")

    @staticmethod
    def _motor_port(params: dict[str, Any]) -> str:
        port = str(params.get("port", "")).upper()
        if port not in ApitorAdapter._motor_indices:
            raise AdapterError("port must be M1, M2 or M3")
        return port

    @staticmethod
    def _integer(params: dict[str, Any], name: str, minimum: int, maximum: int) -> int:
        try:
            value = int(params[name])
        except (KeyError, TypeError, ValueError) as error:
            raise AdapterError(f"{name} must be an integer") from error
        if not minimum <= value <= maximum:
            raise AdapterError(f"{name} must be between {minimum} and {maximum}")
        return value

    async def _write(self, client, packet: bytes) -> None:
        epoch = self._stop_epoch
        if self._active_stops:
            raise AdapterError("Apitor stop is in progress; command was not sent")
        try:
            await self._confirmed_write(client, packet, command_epoch=epoch)
        except AdapterError:
            raise
        except (Exception, asyncio.CancelledError) as error:
            with contextlib.suppress(Exception):
                await self._safe_stop(client)
            with contextlib.suppress(Exception):
                if getattr(client, "is_connected", False):
                    await asyncio.wait_for(client.disconnect(), timeout=1.0)
            if client is self._client:
                self._reset_connection()
            if isinstance(error, asyncio.CancelledError):
                raise
            if self._stop_unconfirmed:
                raise AdapterError(
                    f"Apitor BLE write failed: {error}; motor stop could not be confirmed; "
                    "switch off the hub if a motor is moving"
                ) from error
            raise AdapterError(f"Apitor BLE write failed: {error}") from error

    async def _confirmed_write(self, client, packet: bytes, command_epoch: int | None = None) -> None:
        async with self._write_lock:
            if self._unsafe_client is client:
                raise AdapterError("Apitor BLE acknowledgement is unsafe; reconnect before further commands")
            if command_epoch is not None and (command_epoch != self._stop_epoch or self._active_stops):
                raise AdapterError("Apitor command was superseded by an emergency stop")
            try:
                await asyncio.wait_for(
                    client.write_gatt_char(APITOR_WRITE_UUID, packet, response=True),
                    timeout=self._gatt_write_timeout,
                )
            except (Exception, asyncio.CancelledError):
                if client is self._client:
                    self._unsafe_client = client
                raise

    async def _unconfirmed_emergency_stop(self, client) -> None:
        # F001 advertises write-without-response. This is an immediate attempt,
        # never evidence that the motor physically stopped. Hardware acceptance
        # is required before this candidate can be released.
        await asyncio.wait_for(
            client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=False),
            timeout=self._emergency_write_timeout,
        )

    async def _safe_stop(self, client) -> None:
        if not getattr(client, "is_connected", False):
            self._stop_unconfirmed = True
            raise AdapterError("Apitor stop could not be confirmed: BLE client is disconnected")
        self._stop_epoch += 1
        self._active_stops += 1
        fallback_attempted = False
        try:
            if self._write_lock.locked() or self._unsafe_client is client:
                fallback_attempted = True
                with contextlib.suppress(Exception):
                    await self._unconfirmed_emergency_stop(client)
            for _ in range(3):
                await self._confirmed_write(client, STOP_ALL_MOTORS)
                await asyncio.sleep(0.05)
            self._motion_may_be_active = False
            self._stop_unconfirmed = False
        except (Exception, asyncio.CancelledError) as error:
            self._stop_unconfirmed = True
            if (not fallback_attempted or isinstance(error, asyncio.CancelledError)) and getattr(
                client, "is_connected", False
            ):
                with contextlib.suppress(Exception):
                    await self._unconfirmed_emergency_stop(client)
            if isinstance(error, asyncio.CancelledError):
                raise
            raise AdapterError(
                "Apitor stop was attempted, but BLE delivery is unconfirmed; switch off the hub if it moves"
            ) from error
        finally:
            self._active_stops -= 1
