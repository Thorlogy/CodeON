from __future__ import annotations

import time
from collections.abc import Callable


class MotionWatchdog:
    def __init__(self, timeout_seconds: float = 1.0, clock: Callable[[], float] = time.monotonic) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self.timeout_seconds = timeout_seconds
        self._clock = clock
        self._last_heartbeat = clock()
        self._motion_active = False

    def heartbeat(self) -> None:
        self._last_heartbeat = self._clock()

    def motion_started(self) -> None:
        self._motion_active = True
        self.heartbeat()

    def motion_stopped(self) -> None:
        self._motion_active = False

    def expired(self) -> bool:
        return self._motion_active and self._clock() - self._last_heartbeat >= self.timeout_seconds
