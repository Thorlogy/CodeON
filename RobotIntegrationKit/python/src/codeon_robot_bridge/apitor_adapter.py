from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from .adapter import RobotAdapter
from .apitor_ble_probe import (
    APITOR_WRITE_UUID,
    ROBOT_X_AUTHORIZE,
    STOP_ALL_MOTORS,
    motor_frame,
)
from .capabilities import CapabilityManifest
from .errors import AdapterError, NotConnectedError, UnsupportedCommandError


def _default_ble_factory():
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as error:
        raise AdapterError("Bleak is not installed; install the 'apitor' extra") from error
    return BleakClient, BleakScanner


class ApitorAdapter(RobotAdapter):
    """Hardware-verified Apitor Robot X motor adapter."""

    _manifest = CapabilityManifest(
        robot="apitor",
        adapter_version="0.1.0",
        capabilities={
            "motorPorts": ["M1", "M2", "M3"],
            "individualMotorControl": True,
            "sensors": [],
        },
        limits={
            "motorSpeedLevel": {"min": 1, "max": 12},
            "motorDirections": [1, 2],
            "heartbeatTimeoutMs": 1000,
            "verification": "motor-hardware-verified",
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

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> dict[str, Any]:
        async with self._connect_lock:
            if self.connected:
                return self._connection_result()
            client_type, scanner_type = self._ble_factory()
            identifier = self._identifier or await self._find_robot(scanner_type)
            client = client_type(identifier, timeout=8.0)
            try:
                await client.connect()
                await client.write_gatt_char(APITOR_WRITE_UUID, ROBOT_X_AUTHORIZE, response=True)
                await asyncio.sleep(0.5)
                await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
            except Exception as error:
                if getattr(client, "is_connected", False):
                    await self._safe_stop(client)
                    await client.disconnect()
                raise AdapterError(f"failed to connect to Apitor Robot X: {error}") from error
            self._identifier = identifier
            self._client = client
            self._connected = True
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
                    await client.disconnect()
            finally:
                self._client = None
                self._connected = False

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if command == "setMotor":
            port = self._motor_port(params)
            direction = self._integer(params, "direction", 1, 2)
            speed = self._integer(params, "speed", 1, 12)
            packet = motor_frame(self._motor_indices[port], direction, speed)
            await self._write(client, packet)
        elif command == "stopMotor":
            port = self._motor_port(params)
            await self._write(client, motor_frame(self._motor_indices[port], 0, 0))
        else:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        self._require_client()
        raise UnsupportedCommandError(f"unsupported sensor: {sensor}")

    async def stop_all(self) -> None:
        if self._client is not None:
            await self._safe_stop(self._client)

    def _require_client(self):
        if not self.connected or self._client is None:
            raise NotConnectedError("Apitor Robot X is not connected")
        return self._client

    def _connection_result(self) -> dict[str, Any]:
        return {"connected": True, "identifier": self._identifier}

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

    @staticmethod
    async def _write(client, packet: bytes) -> None:
        try:
            await client.write_gatt_char(APITOR_WRITE_UUID, packet, response=True)
        except Exception as error:
            await ApitorAdapter._safe_stop(client)
            raise AdapterError(f"Apitor BLE write failed: {error}") from error

    @staticmethod
    async def _safe_stop(client) -> None:
        if not getattr(client, "is_connected", False):
            return
        for _ in range(3):
            try:
                await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
                await asyncio.sleep(0.05)
            except Exception:
                pass
