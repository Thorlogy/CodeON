import asyncio
import unittest

from codeon_robot_bridge import BridgeSession, FakeRobotAdapter
from codeon_robot_bridge.safety import MotionWatchdog


def request(message_type, **values):
    return {"id": "test-1", "version": "1.0", "type": message_type, **values}


class ManualClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class BridgeContractTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.adapter = FakeRobotAdapter()
        self.clock = ManualClock()
        self.session = BridgeSession(self.adapter, MotionWatchdog(1.0, self.clock))

    async def test_capability_discovery_does_not_require_connection(self):
        response = await self.session.handle(request("capabilities"))
        self.assertTrue(response["ok"])
        self.assertEqual("1.0", response["result"]["protocolVersion"])
        self.assertTrue(response["result"]["capabilities"]["differentialDrive"])

    async def test_command_requires_connection(self):
        response = await self.session.handle(
            request("command", command="drive", params={"left": 50, "right": 50})
        )
        self.assertFalse(response["ok"])
        self.assertEqual("NOT_CONNECTED", response["error"]["code"])

    async def test_connected_adapter_executes_command_and_reads_sensor(self):
        await self.session.handle(request("connect"))
        command = await self.session.handle(
            request("command", command="drive", params={"left": 50, "right": 50})
        )
        sensor = await self.session.handle(request("sensor", sensor="battery"))
        self.assertTrue(command["ok"])
        self.assertEqual(4.0, sensor["result"]["value"])

    async def test_stop_all_is_idempotent(self):
        await self.session.handle(request("stopAll"))
        await self.session.handle(request("stopAll"))
        self.assertEqual(2, self.adapter.stop_count)

    async def test_watchdog_stops_expired_motion(self):
        await self.session.handle(request("connect"))
        await self.session.handle(request("command", command="drive", params={}))
        self.clock.now = 1.1
        self.assertTrue(await self.session.watchdog_tick())
        self.assertEqual(1, self.adapter.stop_count)
        self.assertFalse(await self.session.watchdog_tick())

    async def test_heartbeat_renews_motion_lease(self):
        await self.session.handle(request("connect"))
        await self.session.handle(request("command", command="drive", params={}))
        self.clock.now = 0.8
        await self.session.handle(request("heartbeat"))
        self.clock.now = 1.5
        self.assertFalse(await self.session.watchdog_tick())

    async def test_invalid_messages_return_stable_protocol_error(self):
        response = await self.session.handle({"id": "x", "version": "2.0", "type": "status"})
        self.assertFalse(response["ok"])
        self.assertEqual("PROTOCOL_ERROR", response["error"]["code"])


if __name__ == "__main__":
    unittest.main()
