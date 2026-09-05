from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Callable
from typing import Any

from .adapter import RobotAdapter
from .capabilities import CapabilityManifest
from .errors import AdapterError, NotConnectedError, UnsupportedCommandError
from .tinkerbot_protocol import (
    FILE_UPLOAD_CONTROL,
    GET_BATTERY_LEVEL,
    GET_CURRENT_MTU,
    GET_FIRMWARE_VERSION,
    RECEIVE_FILE_DATA_PACKETS,
    START_FILE_UPLOAD,
    TINKERBOT_CHARACTERISTIC_UUID,
    TERMINATE_SCRIPT,
    VERIFY_FILE_DATA,
    decode_response,
    encode_request,
    execute_script_frame,
    terminate_script_frame,
    upload_checksum_frame,
    upload_chunks,
    upload_control_frame,
    upload_header_frame,
)


def _default_ble_factory():
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as error:
        raise AdapterError("Bleak is not installed; install the 'experibot-research' extra") from error
    return BleakClient, BleakScanner


class TinkerbotAdapter(RobotAdapter):
    """Current eXperiBot/T2BOT research adapter; not registered in CodeON."""

    _manifest = CapabilityManifest(
        robot="experibot-t2bot-research",
        adapter_version="0.1.0-hardware-pending",
        capabilities={
            "executionModel": "python-upload",
            "programFile": "custom.py",
            "programUpload": True,
            "programStart": True,
            "programStop": True,
            "sensors": ["battery", "firmwareVersion", "currentMtu"],
        },
        limits={
            "verification": {
                "protocol": "official-web-app-static-analysis",
                "hardware": "pending",
                "targetGeneration": "current-experibot-t2bot",
                "legacyPowerbrain": "not-compatible-unverified",
            }
        },
    )

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
        self._pending: dict[int, asyncio.Future] = {}
        self._partial_payloads: dict[int, list[bytes]] = {}
        self._battery: int | None = None
        self._firmware_version: str | None = None
        self._current_mtu = 23

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return bool(
            self._connected
            and self._client is not None
            and getattr(self._client, "is_connected", False)
        )

    async def connect(self) -> dict[str, Any]:
        async with self._connect_lock:
            if self.connected:
                return self._connection_result()
            client_type, scanner_type = self._ble_factory()
            identifier = self._identifier or await self._find_robot(scanner_type)
            client = client_type(identifier, timeout=8.0, disconnected_callback=self._on_disconnect)
            self._client = client
            try:
                await client.connect()
                await client.start_notify(TINKERBOT_CHARACTERISTIC_UUID, self._on_notification)
                self._connected = True
                # A previously uploaded script can outlive an app session. Establish
                # the bridge's safe stopped state before querying device details.
                await self._write(terminate_script_frame(), response=True)
                await self._read_device_status()
            except Exception as error:
                await self._close_failed_client(client)
                raise AdapterError(f"failed to connect to eXperiBot/T2BOT Powerbrain: {error}") from error
            self._identifier = identifier
            return self._connection_result()

    async def disconnect(self) -> None:
        client = self._client
        if client is None:
            return
        try:
            await self.stop_all()
        finally:
            with contextlib.suppress(Exception):
                if getattr(client, "is_connected", False):
                    await client.stop_notify(TINKERBOT_CHARACTERISTIC_UUID)
                    await client.disconnect()
            self._reset_connection()

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        self._require_client()
        if command == "uploadProgram":
            source = self._source(params)
            await self._upload_program(source)
        elif command == "startProgram":
            await self._write(execute_script_frame(), response=True)
        elif command == "runProgram":
            source = self._source(params)
            await self._upload_program(source)
            await self._write(execute_script_frame(), response=True)
        elif command in {"stopProgram", "stop"}:
            await self.stop_all()
        else:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        self._require_client()
        values = {
            "battery": self._battery,
            "firmwareVersion": self._firmware_version,
            "currentMtu": self._current_mtu,
        }
        if sensor not in values:
            raise UnsupportedCommandError(f"unsupported sensor: {sensor}")
        return values[sensor]

    async def stop_all(self) -> None:
        if self.connected:
            await self._write(terminate_script_frame(), response=True)

    async def status(self) -> dict[str, Any]:
        return {
            **await super().status(),
            "identifier": self._identifier,
            "battery": self._battery,
            "firmwareVersion": self._firmware_version,
            "currentMtu": self._current_mtu,
            "hardwareVerified": False,
        }

    async def _read_device_status(self) -> None:
        firmware = await self._request(GET_FIRMWARE_VERSION)
        if len(firmware) >= 3:
            self._firmware_version = f"{firmware[2]}.{firmware[1]}.{firmware[0]}"
        battery = await self._request(GET_BATTERY_LEVEL)
        if battery:
            self._battery = battery[0]
        mtu = await self._request(GET_CURRENT_MTU)
        if mtu and mtu[0] >= 5:
            self._current_mtu = mtu[0]

    async def _upload_program(self, source: str) -> None:
        raw = source.encode("utf-8")

        start_ack = self._expect(FILE_UPLOAD_CONTROL)
        await self._write(upload_control_frame(START_FILE_UPLOAD), response=True)
        await self._write(upload_header_frame(len(raw)), response=False)
        self._validate_upload_ack(await asyncio.wait_for(start_ack, timeout=5.0), START_FILE_UPLOAD)

        receive_ack = self._expect(FILE_UPLOAD_CONTROL)
        await self._write(upload_control_frame(RECEIVE_FILE_DATA_PACKETS), response=True)
        for frame in upload_chunks(raw, self._current_mtu):
            await self._write(frame, response=False)
            await asyncio.sleep(0.015)
        self._validate_upload_ack(
            await asyncio.wait_for(receive_ack, timeout=5.0), RECEIVE_FILE_DATA_PACKETS
        )

        verify_ack = self._expect(FILE_UPLOAD_CONTROL)
        await self._write(upload_checksum_frame(raw), response=False)
        await self._write(upload_control_frame(VERIFY_FILE_DATA), response=True)
        self._validate_upload_ack(await asyncio.wait_for(verify_ack, timeout=5.0), VERIFY_FILE_DATA)

    async def _request(self, command: int) -> bytes:
        future = self._expect(command)
        await self._write(encode_request(command), response=True)
        return await asyncio.wait_for(future, timeout=5.0)

    def _expect(self, command: int) -> asyncio.Future:
        if command in self._pending:
            raise AdapterError(f"request 0x{command:02x} is already pending")
        future = asyncio.get_running_loop().create_future()
        self._pending[command] = future
        return future

    def _on_notification(self, _: Any, data: bytearray) -> None:
        try:
            response = decode_response(data)
        except ValueError:
            return
        command = response.command_or_event
        partials = self._partial_payloads.setdefault(command, [])
        partials.append(response.payload)
        if response.has_follow_up:
            return
        payload = b"".join(self._partial_payloads.pop(command, []))
        future = self._pending.pop(command, None)
        if future is not None and not future.done():
            future.set_result(payload)

    @staticmethod
    def _validate_upload_ack(payload: bytes, control: int) -> None:
        if len(payload) < 2 or payload[0] != control or payload[1] != 0:
            raise AdapterError(f"file upload phase {control} was not acknowledged successfully")

    async def _write(self, packet: bytes, response: bool) -> None:
        client = self._require_client()
        try:
            await client.write_gatt_char(
                TINKERBOT_CHARACTERISTIC_UUID,
                packet,
                response=response,
            )
        except Exception as error:
            await self._close_failed_client(client)
            raise AdapterError(f"eXperiBot/T2BOT BLE write failed: {error}") from error

    def _require_client(self):
        if not self.connected or self._client is None:
            raise NotConnectedError("eXperiBot/T2BOT Powerbrain is not connected")
        return self._client

    def _connection_result(self) -> dict[str, Any]:
        return {
            "connected": True,
            "identifier": self._identifier,
            "firmwareVersion": self._firmware_version,
        }

    def _on_disconnect(self, client: Any) -> None:
        if client is self._client:
            self._reset_connection()

    async def _close_failed_client(self, client: Any) -> None:
        with contextlib.suppress(Exception):
            if getattr(client, "is_connected", False):
                await client.disconnect()
        if client is self._client:
            self._reset_connection()

    def _reset_connection(self) -> None:
        for future in self._pending.values():
            if not future.done():
                future.cancel()
        self._pending.clear()
        self._partial_payloads.clear()
        self._client = None
        self._connected = False

    @staticmethod
    async def _find_robot(scanner_type) -> str:
        devices = await scanner_type.discover(timeout=8.0)
        for device in devices:
            name = str(getattr(device, "name", "") or "")
            if name == "T2BOT" or name.startswith("🤖 eXperiBot"):
                return str(getattr(device, "address", None) or getattr(device, "identifier", ""))
        raise AdapterError("no powered current-generation eXperiBot/T2BOT was found over Bluetooth")

    @staticmethod
    def _source(params: dict[str, Any]) -> str:
        source = params.get("source")
        if not isinstance(source, str) or not source.strip():
            raise AdapterError("source must be a non-empty Python program")
        return source
