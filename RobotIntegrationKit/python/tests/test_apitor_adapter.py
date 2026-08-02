import unittest

from codeon_robot_bridge.apitor_adapter import ApitorAdapter
from codeon_robot_bridge.apitor_ble_probe import (
    APITOR_NOTIFY_UUID,
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

    def __init__(self, identifier, timeout, disconnected_callback=None):
        self.identifier = identifier
        self.timeout = timeout
        self.is_connected = False
        self.writes = []
        self.notify_callbacks = {}
        self.disconnected_callback = disconnected_callback
        FakeClient.instances.append(self)

    async def connect(self):
        self.is_connected = True

    async def disconnect(self):
        self.is_connected = False
        if self.disconnected_callback:
            self.disconnected_callback(self)

    async def write_gatt_char(self, characteristic, packet, response):
        self.writes.append((characteristic, packet, response))

    async def start_notify(self, characteristic, callback):
        self.notify_callbacks[characteristic] = callback

    async def stop_notify(self, characteristic):
        self.notify_callbacks.pop(characteristic, None)


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
        self.assertIn(APITOR_NOTIFY_UUID, self.client.notify_callbacks)

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

    async def test_led_ports_use_recovered_robot_x_indices(self):
        await self.adapter.execute("setLight", {"port": "L1", "color": "red"})
        self.assertEqual(self.client.writes[-1][1].hex(), "55aa0401010000")
        await self.adapter.execute("setLight", {"port": "L2", "color": "off"})
        self.assertEqual(self.client.writes[-1][1].hex(), "55aa0402000000")

    async def test_sensor_notification_is_cached_for_all_sensor_reads(self):
        callback = self.client.notify_callbacks[APITOR_NOTIFY_UUID]
        callback(None, bytearray.fromhex("55aa058003112200"))
        self.assertEqual(await self.adapter.read_sensor("colorRaw", {}), 3)
        self.assertEqual(await self.adapter.read_sensor("colorGroup", {}), 2)
        self.assertEqual(await self.adapter.read_sensor("infrared1", {}), 17)
        self.assertEqual(await self.adapter.read_sensor("infrared2", {}), 34)
        snapshot = await self.adapter.read_sensor("sensorSnapshot", {})
        self.assertEqual(snapshot["trailing"], 0)
        self.assertGreaterEqual(snapshot["ageMs"], 0)

    async def test_sensor_read_before_first_notification_is_unavailable(self):
        self.assertIsNone(await self.adapter.read_sensor("infrared1", {}))

    async def test_unexpected_ble_disconnect_forces_a_real_reconnect(self):
        self.client.is_connected = False
        self.client.disconnected_callback(self.client)
        self.assertFalse(self.adapter.connected)

        result = await self.adapter.connect()

        self.assertTrue(result["connected"])
        self.assertIsNot(self.adapter._client, self.client)
        self.assertEqual(len(FakeClient.instances), 2)

    async def test_gatt_write_failure_invalidates_stale_connected_client(self):
        async def fail_write(*_args, **_kwargs):
            raise RuntimeError("Service Discovery has not been performed yet")

        self.client.write_gatt_char = fail_write
        with self.assertRaisesRegex(AdapterError, "Service Discovery"):
            await self.adapter.execute("stopMotor", {"port": "M3"})

        self.assertFalse(self.adapter.connected)
        self.assertIsNone(self.adapter._client)

    async def test_unknown_command_is_rejected(self):
        with self.assertRaises(UnsupportedCommandError):
            await self.adapter.execute("dance", {})

    async def test_disconnect_sends_redundant_global_stop(self):
        await self.adapter.disconnect()
        self.assertEqual([packet for _, packet, _ in self.client.writes[-3:]], [STOP_ALL_MOTORS] * 3)


if __name__ == "__main__":
    unittest.main()
