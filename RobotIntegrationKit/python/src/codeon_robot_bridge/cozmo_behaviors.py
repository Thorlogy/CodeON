from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .behavior import ActuatorProposal, BehaviorContext, BehaviorStep


@dataclass(frozen=True)
class CozmoFaceBehaviorConfig:
    search_speed_mm_per_sec: float = 18.0
    turn_speed_mm_per_sec: float = 16.0
    approach_speed_mm_per_sec: float = 24.0
    center_tolerance: float = 0.12
    target_face_size: float = 0.055
    maximum_face_age_ms: float = 800.0
    maximum_snapshot_age_ms: float = 500.0


def cozmo_face_behaviors(config: CozmoFaceBehaviorConfig | None = None) -> tuple[BehaviorStep, ...]:
    settings = config or CozmoFaceBehaviorConfig()

    def safety_stop(context: BehaviorContext) -> list[ActuatorProposal]:
        reason = _unsafe_reason(context.sensors, settings)
        if reason is None:
            return []
        return [
            _drive(
                context,
                "safety-stop",
                100,
                0.0,
                0.0,
                reason=reason,
                latches_safety=True,
            )
        ]

    def face_follow(context: BehaviorContext) -> list[ActuatorProposal]:
        face = _face(context.sensors)
        if not face.get("detected") or _number(face.get("ageMs")) > settings.maximum_face_age_ms:
            return []

        horizontal_error = _number(face.get("x"), 0.5) - 0.5
        if horizontal_error < -settings.center_tolerance:
            return [
                _drive(
                    context,
                    "face-follow",
                    50,
                    -settings.turn_speed_mm_per_sec,
                    settings.turn_speed_mm_per_sec,
                    reason="face is left",
                )
            ]
        if horizontal_error > settings.center_tolerance:
            return [
                _drive(
                    context,
                    "face-follow",
                    50,
                    settings.turn_speed_mm_per_sec,
                    -settings.turn_speed_mm_per_sec,
                    reason="face is right",
                )
            ]
        if _number(face.get("size")) < settings.target_face_size:
            return [
                _drive(
                    context,
                    "face-follow",
                    50,
                    settings.approach_speed_mm_per_sec,
                    settings.approach_speed_mm_per_sec,
                    reason="face is centered and distant",
                )
            ]
        return [_drive(context, "face-follow", 50, 0.0, 0.0, reason="target distance reached")]

    def face_search(context: BehaviorContext) -> list[ActuatorProposal]:
        # This low-priority baseline remains active. Face-follow suppresses it
        # whenever a current face is available and the safety layer can
        # suppress both.
        return [
            _drive(
                context,
                "face-search",
                10,
                -settings.search_speed_mm_per_sec,
                settings.search_speed_mm_per_sec,
                reason="no current face",
            )
        ]

    return safety_stop, face_follow, face_search


def _unsafe_reason(sensors: Any, config: CozmoFaceBehaviorConfig) -> str | None:
    if bool(sensors.get("pickedUp")):
        return "robot is picked up"
    if sensors.get("cameraEnabled") is False:
        return "camera is disabled"
    if sensors.get("cameraError"):
        return "camera reported an error"
    if _number(sensors.get("snapshotAgeMs")) > config.maximum_snapshot_age_ms:
        return "sensor snapshot is stale"
    return None


def _face(sensors: Any) -> dict[str, Any]:
    value = sensors.get("face", {})
    return value if isinstance(value, dict) else {}


def _number(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    return float(value)


def _drive(
    context: BehaviorContext,
    behavior_id: str,
    priority: int,
    left: float,
    right: float,
    *,
    reason: str,
    latches_safety: bool = False,
) -> ActuatorProposal:
    return ActuatorProposal(
        behavior_id=behavior_id,
        resource="DRIVE",
        priority=priority,
        tick_id=context.tick_id,
        valid_until_tick=context.tick_id,
        command={"command": "drive", "params": {"left": left, "right": right}, "reason": reason},
        latches_safety=latches_safety,
    )
