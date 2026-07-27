from __future__ import annotations

import asyncio
import unittest

from codeon_robot_bridge.behavior import BehaviorScheduler
from codeon_robot_bridge.behavior_runtime import BehaviorRuntime
from codeon_robot_bridge.cozmo_behaviors import cozmo_face_behaviors


class BehaviorRuntimeTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.sensors = {
            "pickedUp": False,
            "cameraEnabled": True,
            "cameraError": None,
            "snapshotAgeMs": 0,
            "face": {"detected": False, "x": 0.5, "size": 0.0, "ageMs": 0},
        }
        self.commands = []
        self.stops = 0

        async def read_sensors():
            return dict(self.sensors)

        async def send(command, params):
            self.commands.append((command, dict(params)))

        async def stop():
            self.stops += 1

        self.runtime = BehaviorRuntime(
            BehaviorScheduler(cozmo_face_behaviors()),
            read_sensors,
            send,
            stop,
            interval_seconds=0.01,
        )

    async def test_parallel_face_behaviors_are_arbitrated_each_tick(self) -> None:
        result = await self.runtime.tick_once()
        self.assertEqual("face-search", result.decisions["DRIVE"].winner.behavior_id)

        self.sensors["face"] = {"detected": True, "x": 0.2, "size": 0.02, "ageMs": 0}
        result = await self.runtime.tick_once()

        self.assertEqual("face-follow", result.decisions["DRIVE"].winner.behavior_id)
        self.assertEqual(["face-search"], [item.behavior_id for item in result.decisions["DRIVE"].suppressed])
        self.assertEqual("drive", self.commands[-1][0])

    async def test_safety_behavior_stops_and_latches(self) -> None:
        self.sensors["pickedUp"] = True
        result = await self.runtime.tick_once()

        self.assertTrue(result.safety_latched)
        self.assertEqual(1, self.stops)
        self.assertEqual("safety-stop", result.decisions["DRIVE"].winner.behavior_id)

    async def test_stop_cancels_cooperative_task_and_stops_drive(self) -> None:
        await self.runtime.start()
        await asyncio.sleep(0)
        self.assertTrue(self.runtime.running)

        await self.runtime.stop()

        self.assertFalse(self.runtime.running)
        self.assertGreaterEqual(self.stops, 1)


if __name__ == "__main__":
    unittest.main()
