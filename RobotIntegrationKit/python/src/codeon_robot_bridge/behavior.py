from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from collections.abc import Callable, Iterable, Mapping
from typing import Any


class BehaviorLifecycle(str, Enum):
    INACTIVE = "inactive"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class ArbitrationStatus(str, Enum):
    NONE = "none"
    GRANTED = "granted"
    SUPPRESSED = "suppressed"
    CONFLICT = "conflict"


@dataclass(frozen=True)
class ActuatorProposal:
    """A short-lived request to control one actuator resource."""

    behavior_id: str
    resource: str
    priority: int
    tick_id: int
    valid_until_tick: int
    command: dict[str, Any] = field(default_factory=dict)
    active: bool = True
    latches_safety: bool = False

    def __post_init__(self) -> None:
        if not self.behavior_id:
            raise ValueError("behavior_id must not be empty")
        if not self.resource:
            raise ValueError("resource must not be empty")
        if self.priority < 0:
            raise ValueError("priority must not be negative")
        if self.tick_id < 0:
            raise ValueError("tick_id must not be negative")
        if self.valid_until_tick < self.tick_id:
            raise ValueError("valid_until_tick must not precede tick_id")


@dataclass(frozen=True)
class ArbitrationDecision:
    resource: str
    status: ArbitrationStatus
    winner: ActuatorProposal | None = None
    suppressed: tuple[ActuatorProposal, ...] = ()
    reason: str | None = None


@dataclass(frozen=True)
class BehaviorContext:
    tick_id: int
    sensors: Mapping[str, Any]


BehaviorStep = Callable[[BehaviorContext], Iterable[ActuatorProposal]]


@dataclass(frozen=True)
class SchedulerResult:
    tick_id: int
    decisions: Mapping[str, ArbitrationDecision]
    safety_latched: bool
    stop_resources: frozenset[str] = frozenset()
    error: str | None = None

    def granted_commands(self) -> dict[str, dict[str, Any]]:
        if self.safety_latched:
            return {}
        return {
            resource: dict(decision.winner.command)
            for resource, decision in self.decisions.items()
            if decision.status == ArbitrationStatus.GRANTED and decision.winner is not None
        }


class BehaviorArbiter:
    """Deterministically selects at most one proposal per resource and tick."""

    def resolve(
        self, proposals: Iterable[ActuatorProposal], current_tick: int
    ) -> dict[str, ArbitrationDecision]:
        if current_tick < 0:
            raise ValueError("current_tick must not be negative")

        by_resource: dict[str, list[ActuatorProposal]] = {}
        for proposal in proposals:
            if not proposal.active:
                continue
            if proposal.tick_id > current_tick or proposal.valid_until_tick < current_tick:
                continue
            by_resource.setdefault(proposal.resource, []).append(proposal)

        decisions: dict[str, ArbitrationDecision] = {}
        for resource, candidates in by_resource.items():
            highest_priority = max(candidate.priority for candidate in candidates)
            leaders = [candidate for candidate in candidates if candidate.priority == highest_priority]
            lower = tuple(candidate for candidate in candidates if candidate.priority < highest_priority)

            if len(leaders) > 1:
                decisions[resource] = ArbitrationDecision(
                    resource=resource,
                    status=ArbitrationStatus.CONFLICT,
                    suppressed=tuple(sorted(candidates, key=self._stable_key)),
                    reason=f"multiple active proposals have priority {highest_priority}",
                )
                continue

            winner = leaders[0]
            decisions[resource] = ArbitrationDecision(
                resource=resource,
                status=ArbitrationStatus.GRANTED,
                winner=winner,
                suppressed=tuple(sorted(lower, key=self._stable_key)),
            )

        return decisions

    @staticmethod
    def _stable_key(proposal: ActuatorProposal) -> tuple[int, str, int]:
        return (-proposal.priority, proposal.behavior_id, proposal.tick_id)


class BehaviorScheduler:
    """Runs small behavior steps and latches safe-stop conditions.

    The scheduler only computes decisions. Sending commands to a robot is a
    separate integration step so this class remains deterministic and safe to
    test without hardware.
    """

    def __init__(
        self,
        behaviors: Iterable[BehaviorStep],
        *,
        required_resources: Iterable[str] = ("DRIVE",),
        arbiter: BehaviorArbiter | None = None,
    ) -> None:
        self._behaviors = tuple(behaviors)
        self._required_resources = frozenset(required_resources)
        self._arbiter = arbiter or BehaviorArbiter()
        self._tick_id = 0
        self._safety_error: str | None = None

    @property
    def safety_latched(self) -> bool:
        return self._safety_error is not None

    def reset(self) -> None:
        """Clear the latch for a deliberate new program run."""
        self._safety_error = None
        self._tick_id = 0

    def tick(self, sensors: Mapping[str, Any]) -> SchedulerResult:
        self._tick_id += 1
        if self.safety_latched:
            return self._latched_result()

        context = BehaviorContext(tick_id=self._tick_id, sensors=sensors)
        proposals: list[ActuatorProposal] = []
        try:
            for behavior in self._behaviors:
                proposals.extend(behavior(context))
        except Exception as exc:
            self._latch(f"behavior failed: {type(exc).__name__}: {exc}")
            return self._latched_result()

        decisions = self._arbiter.resolve(proposals, current_tick=self._tick_id)
        conflicts = sorted(
            resource
            for resource, decision in decisions.items()
            if decision.status == ArbitrationStatus.CONFLICT
        )
        if conflicts:
            self._latch("conflicting proposals for: " + ", ".join(conflicts))
            return SchedulerResult(
                tick_id=self._tick_id,
                decisions=decisions,
                safety_latched=True,
                stop_resources=self._required_resources,
                error=self._safety_error,
            )

        missing = sorted(resource for resource in self._required_resources if resource not in decisions)
        if missing:
            self._latch("no valid proposal for: " + ", ".join(missing))
            return SchedulerResult(
                tick_id=self._tick_id,
                decisions=decisions,
                safety_latched=True,
                stop_resources=self._required_resources,
                error=self._safety_error,
            )

        safety_winners = [
            decision.winner
            for decision in decisions.values()
            if decision.winner is not None and decision.winner.latches_safety
        ]
        if safety_winners:
            reasons = sorted(
                str(winner.command.get("reason", winner.behavior_id)) for winner in safety_winners
            )
            self._latch("safety behavior active: " + ", ".join(reasons))
            return SchedulerResult(
                tick_id=self._tick_id,
                decisions=decisions,
                safety_latched=True,
                stop_resources=self._required_resources,
                error=self._safety_error,
            )

        return SchedulerResult(
            tick_id=self._tick_id,
            decisions=decisions,
            safety_latched=False,
        )

    def _latch(self, message: str) -> None:
        self._safety_error = message

    def _latched_result(self) -> SchedulerResult:
        return SchedulerResult(
            tick_id=self._tick_id,
            decisions={},
            safety_latched=True,
            stop_resources=self._required_resources,
            error=self._safety_error,
        )
