from __future__ import annotations

import unittest

from codeon_robot_bridge.behavior import BehaviorScheduler
from codeon_robot_bridge.cozmo_behaviors import cozmo_face_behaviors


def snapshot(**values):
    result = {
        "pickedUp": False,
        "cameraEnabled": True,
        "cameraError": None,
        "snapshotAgeMs": 0,
        "face": {"detected": False, "x": 0.5, "size": 0.0, "ageMs": 0},
    }
    result.update(values)
    return result


class CozmoFaceBehaviorsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.scheduler = BehaviorScheduler(cozmo_face_behaviors())

    def drive(self, sensors):
        return self.scheduler.tick(sensors).granted_commands()["DRIVE"]

    def test_searches_slowly_when_no_face_is_visible(self) -> None:
        command = self.drive(snapshot())

        self.assertEqual("no current face", command["reason"])
        self.assertLess(command["params"]["left"], 0)
        self.assertGreater(command["params"]["right"], 0)

    def test_turns_towards_a_face_on_the_left(self) -> None:
        command = self.drive(
            snapshot(face={"detected": True, "x": 0.2, "size": 0.02, "ageMs": 0})
        )

        self.assertEqual("face is left", command["reason"])
        self.assertLess(command["params"]["left"], command["params"]["right"])

    def test_approaches_a_centered_distant_face(self) -> None:
        command = self.drive(
            snapshot(face={"detected": True, "x": 0.5, "size": 0.02, "ageMs": 0})
        )

        self.assertEqual(command["params"]["left"], command["params"]["right"])
        self.assertGreater(command["params"]["left"], 0)

    def test_stops_at_target_distance(self) -> None:
        command = self.drive(
            snapshot(face={"detected": True, "x": 0.5, "size": 0.08, "ageMs": 0})
        )

        self.assertEqual({"left": 0.0, "right": 0.0}, command["params"])

    def test_picked_up_has_priority_over_face_following(self) -> None:
        result = self.scheduler.tick(
            snapshot(
                pickedUp=True,
                face={"detected": True, "x": 0.2, "size": 0.02, "ageMs": 0},
            )
        )

        decision = result.decisions["DRIVE"]
        self.assertTrue(result.safety_latched)
        self.assertEqual({}, result.granted_commands())
        self.assertEqual("safety-stop", decision.winner.behavior_id)
        self.assertEqual({"left": 0.0, "right": 0.0}, decision.winner.command["params"])

    def test_stale_snapshot_has_priority_over_search(self) -> None:
        result = self.scheduler.tick(snapshot(snapshotAgeMs=501))

        self.assertTrue(result.safety_latched)
        self.assertEqual("safety-stop", result.decisions["DRIVE"].winner.behavior_id)


if __name__ == "__main__":
    unittest.main()
