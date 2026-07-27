from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from .behavior import BehaviorScheduler, SchedulerResult

SensorReader = Callable[[], Awaitable[Mapping[str, Any]]]
CommandSender = Callable[[str, Mapping[str, Any]], Awaitable[None]]
SafeStop = Callable[[], Awaitable[None]]


class BehaviorRuntime:
    """Runs a deterministic scheduler cooperatively on one asyncio task."""

    def __init__(
        self,
        scheduler: BehaviorScheduler,
        sensor_reader: SensorReader,
        command_sender: CommandSender,
        safe_stop: SafeStop,
        *,
        interval_seconds: float = 0.15,
    ) -> None:
        if interval_seconds <= 0:
            raise ValueError("interval_seconds must be positive")
        self._scheduler = scheduler
        self._sensor_reader = sensor_reader
        self._command_sender = command_sender
        self._safe_stop = safe_stop
        self._interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None
        self._last_result: SchedulerResult | None = None
        self._error: str | None = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        if self.running:
            return
        self._scheduler.reset()
        self._last_result = None
        self._error = None
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        task = self._task
        self._task = None
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        await self._safe_stop()

    def status(self) -> dict[str, Any]:
        result = self._last_result
        decisions = {}
        if result is not None:
            decisions = {
                resource: {
                    "status": decision.status.value,
                    "owner": decision.winner.behavior_id if decision.winner else None,
                    "suppressed": [proposal.behavior_id for proposal in decision.suppressed],
                    "reason": decision.reason,
                }
                for resource, decision in result.decisions.items()
            }
        return {
            "running": self.running,
            "tickId": result.tick_id if result is not None else 0,
            "safetyLatched": result.safety_latched if result is not None else False,
            "error": self._error or (result.error if result is not None else None),
            "decisions": decisions,
        }

    async def tick_once(self) -> SchedulerResult:
        sensors = await self._sensor_reader()
        result = self._scheduler.tick(sensors)
        self._last_result = result
        if result.safety_latched:
            await self._safe_stop()
            return result
        for command in result.granted_commands().values():
            name = command.get("command")
            params = command.get("params", {})
            if not isinstance(name, str) or not isinstance(params, Mapping):
                raise ValueError("behavior produced an invalid command")
            await self._command_sender(name, params)
        return result

    async def _run(self) -> None:
        try:
            while True:
                result = await self.tick_once()
                if result.safety_latched:
                    return
                await asyncio.sleep(self._interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._error = f"{type(error).__name__}: {error}"
            await self._safe_stop()
        finally:
            if self._task is asyncio.current_task():
                self._task = None
