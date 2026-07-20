from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from .adapter import RobotAdapter
from .capabilities import CapabilityManifest
from .errors import AdapterError, NotConnectedError, UnsupportedCommandError


def _default_client_factory():
    try:
        import pycozmo
    except ImportError as error:
        raise AdapterError("PyCozmo is not installed; install the 'cozmo' extra") from error
    return pycozmo.Client(enable_animations=False, enable_procedural_face=False)


class CozmoAdapter(RobotAdapter):
    """Minimal PyCozmo adapter. Physical limits require hardware verification."""

    _manifest = CapabilityManifest(
        robot="cozmo",
        adapter_version="0.1.0",
        capabilities={
            "differentialDrive": True,
            "head": True,
            "lift": True,
            "lights": [],
            "sensors": ["battery"],
        },
        limits={
            "wheelSpeedMmPerSec": 150,
            "headAngleRadians": {"min": -0.40, "max": 0.70},
            "liftHeightMm": {"min": 32.0, "max": 92.0},
            "heartbeatTimeoutMs": 1000,
            "connectionMayMoveActuators": True,
            "verification": "hardware-required",
        },
    )

    def __init__(self, client_factory: Callable[[], Any] = _default_client_factory) -> None:
        self._client_factory = client_factory
        self._client = None
        self._connected = False

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> dict[str, Any]:
        if self.connected:
            return self._connection_result()
        client = self._client_factory()
        try:
            await asyncio.to_thread(client.start)
            await asyncio.to_thread(client.connect)
            await asyncio.to_thread(client.wait_for_robot, 8.0)
        except Exception as error:
            diagnostics = self._connection_diagnostics(client)
            await self._close_failed_client(client)
            raise AdapterError(f"failed to connect to Cozmo; transport={diagnostics}") from error
        self._client = client
        self._connected = True
        return self._connection_result()

    async def disconnect(self) -> None:
        client = self._client
        if client is None:
            return
        try:
            try:
                await asyncio.to_thread(client.stop_all_motors)
            finally:
                await asyncio.to_thread(client.disconnect)
        finally:
            try:
                await asyncio.to_thread(client.stop)
            finally:
                self._client = None
                self._connected = False

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if command == "drive":
            left = self._clamp_number(params, "left", -150.0, 150.0)
            right = self._clamp_number(params, "right", -150.0, 150.0)
            await asyncio.to_thread(client.drive_wheels, left, right)
        elif command == "turn":
            speed = self._clamp_number(params, "speed", -150.0, 150.0)
            await asyncio.to_thread(client.drive_wheels, -speed, speed)
        elif command == "setHead":
            angle = self._clamp_number(params, "angle", -0.40, 0.70)
            await asyncio.to_thread(client.set_head_angle, angle)
        elif command == "setLift":
            height = self._clamp_number(params, "height", 32.0, 92.0)
            await asyncio.to_thread(client.set_lift_height, height)
        else:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        client = self._require_client()
        if sensor == "battery":
            for _ in range(20):
                value = float(client.battery_voltage)
                if value > 0.0:
                    return value
                await asyncio.sleep(0.05)
            return float(client.battery_voltage)
        raise UnsupportedCommandError(f"unsupported sensor: {sensor}")

    async def stop_all(self) -> None:
        if self._client is not None:
            await asyncio.to_thread(self._client.stop_all_motors)

    def _require_client(self):
        if not self.connected or self._client is None:
            raise NotConnectedError("Cozmo is not connected")
        return self._client

    def _connection_result(self) -> dict[str, Any]:
        serial = getattr(self._client, "serial_number", None)
        return {"connected": self.connected, "serial": str(serial) if serial is not None else None}

    @staticmethod
    def _clamp_number(params: dict[str, Any], key: str, minimum: float, maximum: float) -> float:
        value = params.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise AdapterError(f"{key} must be a number")
        return max(minimum, min(maximum, float(value)))

    @staticmethod
    async def _close_failed_client(client) -> None:
        try:
            await asyncio.to_thread(client.disconnect)
        except Exception:
            pass
        try:
            await asyncio.to_thread(client.stop)
        except Exception:
            pass

    @staticmethod
    def _connection_diagnostics(client) -> dict[str, Any]:
        connection = getattr(client, "conn", None)
        receiver = getattr(connection, "recv_thread", None)
        sender = getattr(connection, "send_thread", None)
        return {
            "state": getattr(connection, "state", None),
            "receivedFrames": getattr(receiver, "received_frames", None),
            "receivedPackets": getattr(receiver, "received_packets", None),
            "discardedFrames": getattr(receiver, "discarded_frames", None),
            "sentFrames": getattr(sender, "sent_frames", None),
            "firmware": getattr(client, "robot_fw_sig", None),
            "headSerialSeen": getattr(client, "serial_number_head", None) is not None,
            "bodySerialSeen": getattr(client, "serial_number", None) is not None,
        }
