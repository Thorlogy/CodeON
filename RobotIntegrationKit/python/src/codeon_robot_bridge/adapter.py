from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .capabilities import CapabilityManifest


class RobotAdapter(ABC):
    """Vendor-neutral contract implemented by every local robot adapter."""

    @property
    @abstractmethod
    def manifest(self) -> CapabilityManifest:
        raise NotImplementedError

    @property
    @abstractmethod
    def connected(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def connect(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def disconnect(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def execute(self, command: str, params: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def read_sensor(self, sensor: str, params: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def stop_all(self) -> None:
        """Stop all motion immediately; implementations must make this idempotent."""
        raise NotImplementedError

    async def status(self) -> dict[str, Any]:
        return {"connected": self.connected, "robot": self.manifest.robot}
