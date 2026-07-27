from __future__ import annotations

import unittest

from codeon_robot_bridge.behavior import (
    ActuatorProposal,
    ArbitrationStatus,
    BehaviorArbiter,
    BehaviorContext,
    BehaviorScheduler,
)


def proposal(
    behavior_id: str,
    priority: int,
    *,
    resource: str = "DRIVE",
    tick_id: int = 4,
    valid_until_tick: int = 5,
    active: bool = True,
) -> ActuatorProposal:
    return ActuatorProposal(
        behavior_id=behavior_id,
        resource=resource,
        priority=priority,
        tick_id=tick_id,
        valid_until_tick=valid_until_tick,
        active=active,
        command={"name": behavior_id},
    )


class BehaviorArbiterTest(unittest.TestCase):
    def setUp(self) -> None:
        self.arbiter = BehaviorArbiter()

    def test_highest_priority_wins_independent_of_input_order(self) -> None:
        search = proposal("face-search", 10)
        follow = proposal("face-follow", 50)

        for proposals in ([search, follow], [follow, search]):
            decision = self.arbiter.resolve(proposals, current_tick=5)["DRIVE"]
            self.assertEqual(ArbitrationStatus.GRANTED, decision.status)
            self.assertEqual("face-follow", decision.winner.behavior_id)
            self.assertEqual((search,), decision.suppressed)

    def test_equal_highest_priority_is_a_conflict_without_winner(self) -> None:
        decision = self.arbiter.resolve(
            [proposal("left", 50), proposal("right", 50)], current_tick=5
        )["DRIVE"]

        self.assertEqual(ArbitrationStatus.CONFLICT, decision.status)
        self.assertIsNone(decision.winner)
        self.assertEqual({"left", "right"}, {item.behavior_id for item in decision.suppressed})

    def test_lower_priority_tie_does_not_block_unique_winner(self) -> None:
        decision = self.arbiter.resolve(
            [proposal("search-a", 10), proposal("search-b", 10), proposal("safety", 100)],
            current_tick=5,
        )["DRIVE"]

        self.assertEqual("safety", decision.winner.behavior_id)
        self.assertEqual(ArbitrationStatus.GRANTED, decision.status)

    def test_inactive_expired_and_future_proposals_are_ignored(self) -> None:
        decisions = self.arbiter.resolve(
            [
                proposal("inactive", 100, active=False),
                proposal("expired", 100, tick_id=1, valid_until_tick=2),
                proposal("future", 100, tick_id=6, valid_until_tick=7),
            ],
            current_tick=5,
        )

        self.assertEqual({}, decisions)

    def test_resources_are_arbitrated_independently(self) -> None:
        decisions = self.arbiter.resolve(
            [proposal("follow", 50), proposal("look", 20, resource="HEAD")], current_tick=5
        )

        self.assertEqual("follow", decisions["DRIVE"].winner.behavior_id)
        self.assertEqual("look", decisions["HEAD"].winner.behavior_id)

    def test_invalid_proposal_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            proposal("invalid", 10, tick_id=5, valid_until_tick=4)


class BehaviorSchedulerTest(unittest.TestCase):
    @staticmethod
    def drive(behavior_id: str, priority: int):
        def step(context: BehaviorContext):
            return [
                ActuatorProposal(
                    behavior_id=behavior_id,
                    resource="DRIVE",
                    priority=priority,
                    tick_id=context.tick_id,
                    valid_until_tick=context.tick_id,
                    command={"command": behavior_id},
                )
            ]

        return step

    def test_tick_grants_command_without_touching_hardware(self) -> None:
        scheduler = BehaviorScheduler([self.drive("face-search", 10)])

        result = scheduler.tick({"faceDetected": False})

        self.assertFalse(result.safety_latched)
        self.assertEqual({"DRIVE": {"command": "face-search"}}, result.granted_commands())

    def test_missing_required_resource_latches_stop(self) -> None:
        scheduler = BehaviorScheduler([])

        first = scheduler.tick({})
        second = scheduler.tick({})

        self.assertTrue(first.safety_latched)
        self.assertEqual(frozenset({"DRIVE"}), first.stop_resources)
        self.assertEqual({}, first.granted_commands())
        self.assertTrue(second.safety_latched)

    def test_equal_priority_conflict_latches_stop(self) -> None:
        scheduler = BehaviorScheduler([self.drive("left", 50), self.drive("right", 50)])

        result = scheduler.tick({})

        self.assertTrue(result.safety_latched)
        self.assertIn("conflicting proposals", result.error)
        self.assertEqual({}, result.granted_commands())

    def test_behavior_exception_latches_stop(self) -> None:
        def broken(_context: BehaviorContext):
            raise RuntimeError("camera unavailable")

        result = BehaviorScheduler([broken]).tick({})

        self.assertTrue(result.safety_latched)
        self.assertIn("camera unavailable", result.error)

    def test_reset_allows_a_deliberate_new_run(self) -> None:
        enabled = False

        def optional_drive(context: BehaviorContext):
            if not enabled:
                return []
            return self.drive("face-search", 10)(context)

        scheduler = BehaviorScheduler([optional_drive])
        self.assertTrue(scheduler.tick({}).safety_latched)

        enabled = True
        scheduler.reset()
        result = scheduler.tick({})

        self.assertFalse(result.safety_latched)
        self.assertEqual(1, result.tick_id)


if __name__ == "__main__":
    unittest.main()
