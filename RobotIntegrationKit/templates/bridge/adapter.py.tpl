from __future__ import annotations

from typing import Any

from .adapter import RobotAdapter
from .capabilities import CapabilityManifest
from .errors import AdapterError, UnsupportedCommandError


class {{ADAPTER_CLASS}}(RobotAdapter):
    """Safe, disconnected scaffold for {{DISPLAY_NAME}} ({{TRANSPORT}})."""

    _manifest = CapabilityManifest(
        robot={{ROBOT_ID_LITERAL}},
        adapter_version="0.1.0",
        capabilities={"actuators": [], "sensors": []},
        limits={"heartbeatTimeoutMs": 1000},
    )

    @property
    def manifest(self) -> CapabilityManifest:
        return self._manifest

    @property
    def connected(self) -> bool:
        return False

    async def connect(self) -> dict[str, Any]:
        raise AdapterError("Hardware connection is not implemented or verified")

    async def disconnect(self) -> None:
        await self.stop_all()

    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        raise UnsupportedCommandError(f"unsupported command: {command}")

    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        raise UnsupportedCommandError(f"unsupported sensor: {sensor}")

    async def stop_all(self) -> None:
        # Keep this idempotent. Replace it only after a hardware stop command
        # has been identified and tested independently of movement commands.
        return None
