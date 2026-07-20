from __future__ import annotations

from typing import Any

from .adapter import RobotAdapter
from .capabilities import CapabilityManifest
from .errors import NotConnectedError, UnsupportedCommandError


class FakeRobotAdapter(RobotAdapter):
    """Deterministic adapter used by UI development and conformance tests."""

    _manifest = CapabilityManifest(
        robot="fake",
        adapter_version="1.0.0",
        capabilities={
            "differentialDrive": True,
            "head": True,
            "lift": True,
            "lights": ["backpack"],
            "sensors": ["battery", "cliff"],
        },
        limits={"wheelSpeedMmPerSec": 200, "heartbeatTimeoutMs": 1000},
    )

    def __init__(self) -> None:
        self._connected = False
        self.commands: list[tuple[str, dict[str, Any]]] = []
        self.sensors: dict[str, Any] = {"battery": 4.0, "cliff": False}
        self.stop_count = 0

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return self._connected

    async def connect(self) -> dict[str, Any]:
        self._connected = True
        return {"connected": True, "serial": "FAKE-0001"}

    async def disconnect(self) -> None:
        await self.stop_all()
        self._connected = False

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        if not self.connected:
            raise NotConnectedError("robot is not connected")
        supported = {"drive", "turn", "setHead", "setLift", "setLight"}
        if command not in supported:
            raise UnsupportedCommandError(f"unsupported command: {command}")
        self.commands.append((command, dict(params)))
        return {"accepted": True}

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        if not self.connected:
            raise NotConnectedError("robot is not connected")
        if sensor not in self.sensors:
            raise UnsupportedCommandError(f"unsupported sensor: {sensor}")
        return self.sensors[sensor]

    async def stop_all(self) -> None:
        self.stop_count += 1
        self.commands.append(("stopAll", {}))
