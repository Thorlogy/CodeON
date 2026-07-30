import unittest

from codeon_robot_bridge.apitor_adapter import ApitorAdapter
from codeon_robot_bridge.apitor_ble_probe import (
    APITOR_WRITE_UUID,
    ROBOT_X_AUTHORIZE,
    STOP_ALL_MOTORS,
)
from codeon_robot_bridge.errors import AdapterError, UnsupportedCommandError


class FakeScanner:
    @staticmethod
    async def discover(timeout):
        return []


class FakeClient:
    instances = []

    def __init__(self, identifier, timeout):
        self.identifier = identifier
        self.timeout = timeout
        self.is_connected = False
        self.writes = []
        FakeClient.instances.append(self)

    async def connect(self):
        self.is_connected = True

    async def disconnect(self):
        self.is_connected = False

    async def write_gatt_char(self, characteristic, packet, response):
        self.writes.append((characteristic, packet, response))


class ApitorAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeClient.instances.clear()
        self.adapter = ApitorAdapter("DEVICE-1", lambda: (FakeClient, FakeScanner))
        await self.adapter.connect()
        self.client = FakeClient.instances[-1]

    async def asyncTearDown(self):
        await self.adapter.disconnect()

    async def test_connect_authorizes_and_stops_before_accepting_commands(self):
        self.assertEqual(self.client.writes[0], (APITOR_WRITE_UUID, ROBOT_X_AUTHORIZE, True))
        self.assertEqual(self.client.writes[1], (APITOR_WRITE_UUID, STOP_ALL_MOTORS, True))

    async def test_each_motor_port_uses_verified_protocol_index(self):
        expected = {"M1": 6, "M2": 7, "M3": 8}
        for port, index in expected.items():
            await self.adapter.execute("setMotor", {"port": port, "direction": 1, "speed": 8})
            self.assertEqual(self.client.writes[-1][1].hex(), f"55aa03{index:02x}0108")

    async def test_stop_motor_addresses_only_selected_port(self):
        await self.adapter.execute("stopMotor", {"port": "M3"})
        self.assertEqual(self.client.writes[-1][1].hex(), "55aa03080000")

    async def test_invalid_port_is_rejected_without_motor_write(self):
        count = len(self.client.writes)
        with self.assertRaises(AdapterError):
            await self.adapter.execute("setMotor", {"port": "M4", "direction": 1, "speed": 8})
        self.assertEqual(len(self.client.writes), count)

    async def test_unknown_command_is_rejected(self):
        with self.assertRaises(UnsupportedCommandError):
            await self.adapter.execute("setLight", {})

    async def test_disconnect_sends_redundant_global_stop(self):
        await self.adapter.disconnect()
        self.assertEqual([packet for _, packet, _ in self.client.writes[-3:]], [STOP_ALL_MOTORS] * 3)


if __name__ == "__main__":
    unittest.main()
