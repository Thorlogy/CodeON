from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from .errors import ProtocolError


@dataclass(frozen=True)
class CapabilityManifest:
    robot: str
    adapter_version: str
    capabilities: Mapping[str, Any]
    limits: Mapping[str, Any] = field(default_factory=dict)
    protocol_version: str = "1.0"

    def __post_init__(self) -> None:
        if not self.robot or not isinstance(self.robot, str):
            raise ProtocolError("manifest.robot must be a non-empty string")
        if self.protocol_version != "1.0":
            raise ProtocolError("only protocol version 1.0 is supported")
        if not isinstance(self.capabilities, Mapping):
            raise ProtocolError("manifest.capabilities must be an object")

    def to_dict(self) -> dict[str, Any]:
        return {
            "robot": self.robot,
            "adapterVersion": self.adapter_version,
            "protocolVersion": self.protocol_version,
            "capabilities": dict(self.capabilities),
            "limits": dict(self.limits),
        }
