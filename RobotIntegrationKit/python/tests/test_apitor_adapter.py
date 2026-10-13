import asyncio
import unittest
from unittest.mock import patch

from codeon_robot_bridge.apitor_adapter import ApitorAdapter
from codeon_robot_bridge.bridge import BridgeSession
from codeon_robot_bridge.apitor_ble_probe import (
    APITOR_NOTIFY_UUID,
    APITOR_WRITE_UUID,
    ROBOT_X_AUTHORIZE,
    STOP_ALL_MOTORS,
    motor_frame,
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

    async def test_disconnect_after_motion_does_not_claim_stopped_without_ble(self):
        await self.adapter.execute("setMotor", {"port": "M1", "direction": 1, "speed": 8})
        self.client.is_connected = False
        self.client.disconnected_callback(self.client)

        session = BridgeSession(self.adapter)
        response = await session.handle({"id": "stop-disconnected", "version": "1.0", "type": "stopAll"})
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "ADAPTER_ERROR")

        await self.adapter.connect()
        self.assertTrue((await session.handle({"id": "stop-reconnected", "version": "1.0", "type": "stopAll"}))["ok"])

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

    async def test_unacknowledged_stop_is_not_reported_as_success(self):
        """A BLE exception must not become a positive stopAll acknowledgement."""
        original_write = self.client.write_gatt_char

        async def fail_stops(characteristic, packet, response):
            if packet == STOP_ALL_MOTORS:
                raise RuntimeError("simulated stop write failure")
            await original_write(characteristic, packet, response)

        self.client.write_gatt_char = fail_stops
        try:
            with self.assertRaises(AdapterError):
                await self.adapter.stop_all()
        finally:
            self.client.write_gatt_char = original_write
        # The same session remains unsafe even if a later write would succeed.
        with self.assertRaises(AdapterError):
            await self.adapter.disconnect()
        self.assertFalse(self.adapter.connected)

    async def test_timed_out_motor_write_attempts_stop_and_invalidates_session(self):
        original_write = self.client.write_gatt_char
        motion_packet = motor_frame(6, 1, 8)
        attempted_writes = []
        self.adapter._gatt_write_timeout = 0.02

        async def stalled_motor(characteristic, packet, response):
            attempted_writes.append((packet, response))
            if packet == motion_packet:
                await asyncio.Event().wait()
            else:
                await original_write(characteristic, packet, response)

        self.client.write_gatt_char = stalled_motor
        with self.assertRaisesRegex(AdapterError, "motor stop could not be confirmed; switch off the hub"):
            await self.adapter.execute("setMotor", {"port": "M1", "direction": 1, "speed": 8})

        self.assertIn((STOP_ALL_MOTORS, False), attempted_writes)
        self.assertFalse(any(packet == STOP_ALL_MOTORS and response for packet, response in attempted_writes))
        self.assertFalse(self.adapter.connected)
        with self.assertRaises(AdapterError):
            await self.adapter.execute("setMotor", {"port": "M1", "direction": 1, "speed": 8})

    async def test_stalled_stop_returns_bridge_error_not_stopped_true(self):
        original_write = self.client.write_gatt_char
        attempted_writes = []
        self.adapter._gatt_write_timeout = 0.02

        async def stalled_stop(characteristic, packet, response):
            attempted_writes.append((packet, response))
            if packet == STOP_ALL_MOTORS and response:
                await asyncio.Event().wait()
            else:
                await original_write(characteristic, packet, response)

        self.client.write_gatt_char = stalled_stop
        session = BridgeSession(self.adapter)
        response = await session.handle({"id": "stop-test", "version": "1.0", "type": "stopAll"})
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "ADAPTER_ERROR")
        self.assertIn((STOP_ALL_MOTORS, False), attempted_writes)

        self.client.write_gatt_char = original_write
        with self.assertRaises(AdapterError):
            await self.adapter.disconnect()

    async def test_unsafe_ble_ack_is_not_reported_as_connected(self):
        original_write = self.client.write_gatt_char
        self.adapter._gatt_write_timeout = 0.02

        async def stalled_stop(characteristic, packet, response):
            if packet == STOP_ALL_MOTORS and response:
                await asyncio.Event().wait()
            await original_write(characteristic, packet, response)

        self.client.write_gatt_char = stalled_stop
        with self.assertRaises(AdapterError):
            await self.adapter.stop_all()
        self.assertFalse((await self.adapter.status())["connected"])

        self.client.write_gatt_char = original_write
        await self.adapter.connect()
        self.assertIsNot(self.adapter._client, self.client)
        self.assertTrue((await self.adapter.status())["connected"])

    async def test_overlapping_stops_do_not_overlap_confirmed_gatt_writes(self):
        """Two stop callers must not replace one CoreBluetooth write future."""
        original_write = self.client.write_gatt_char
        first_started = asyncio.Event()
        second_stop_attempted = asyncio.Event()
        release_first = asyncio.Event()
        active_confirmed = 0
        max_active_confirmed = 0

        async def controlled_write(characteristic, packet, response):
            nonlocal active_confirmed, max_active_confirmed
            if packet == STOP_ALL_MOTORS and response:
                active_confirmed += 1
                max_active_confirmed = max(max_active_confirmed, active_confirmed)
                if not first_started.is_set():
                    first_started.set()
                    try:
                        await release_first.wait()
                    finally:
                        active_confirmed -= 1
                else:
                    active_confirmed -= 1
            elif packet == STOP_ALL_MOTORS:
                second_stop_attempted.set()
            await original_write(characteristic, packet, response)

        self.client.write_gatt_char = controlled_write
        first = asyncio.create_task(self.adapter.stop_all())
        second = None
        try:
            await asyncio.wait_for(first_started.wait(), 0.5)
            second = asyncio.create_task(self.adapter.stop_all())
            await asyncio.wait_for(second_stop_attempted.wait(), 0.2)
            release_first.set()
            await asyncio.wait_for(asyncio.gather(first, second), 1.0)
            self.assertEqual(max_active_confirmed, 1)
        finally:
            release_first.set()
            if second is not None:
                await asyncio.gather(first, second, return_exceptions=True)
            self.client.write_gatt_char = original_write

    async def test_stalled_stop_allows_prompt_noncolliding_emergency_attempt(self):
        """A queued lock alone is unsafe: another stop must not wait for a stuck ACK."""
        original_write = self.client.write_gatt_char
        first_started = asyncio.Event()
        emergency_attempted = asyncio.Event()
        release_first = asyncio.Event()
        active_confirmed = 0
        max_active_confirmed = 0

        async def controlled_write(characteristic, packet, response):
            nonlocal active_confirmed, max_active_confirmed
            if packet == STOP_ALL_MOTORS and response:
                active_confirmed += 1
                max_active_confirmed = max(max_active_confirmed, active_confirmed)
            if packet == STOP_ALL_MOTORS and not first_started.is_set():
                first_started.set()
                try:
                    await release_first.wait()
                finally:
                    if response:
                        active_confirmed -= 1
            elif packet == STOP_ALL_MOTORS:
                emergency_attempted.set()
                if response:
                    active_confirmed -= 1
            await original_write(characteristic, packet, response)

        self.client.write_gatt_char = controlled_write
        first = asyncio.create_task(self.adapter.stop_all())
        second = None
        try:
            await asyncio.wait_for(first_started.wait(), 0.5)
            second = asyncio.create_task(self.adapter.stop_all())
            await asyncio.wait_for(emergency_attempted.wait(), 0.2)
            self.assertEqual(max_active_confirmed, 1)
        finally:
            release_first.set()
            if second is not None:
                await asyncio.wait_for(asyncio.gather(first, second, return_exceptions=True), 1.0)
            else:
                await asyncio.wait_for(asyncio.gather(first, return_exceptions=True), 1.0)
            self.client.write_gatt_char = original_write

    async def test_cancelled_motor_write_attempts_stop_and_disconnects(self):
        original_write = self.client.write_gatt_char
        started = asyncio.Event()
        attempted_writes = []
        motion_packet = motor_frame(6, 1, 4)

        async def cancelled_motor(characteristic, packet, response):
            attempted_writes.append((packet, response))
            if packet == motion_packet:
                started.set()
                await asyncio.Event().wait()
            else:
                await original_write(characteristic, packet, response)

        self.client.write_gatt_char = cancelled_motor
        task = asyncio.create_task(self.adapter.execute("setMotor", {"port": "M1", "direction": 1, "speed": 4}))
        try:
            await asyncio.wait_for(started.wait(), 0.5)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await asyncio.wait_for(task, 1.0)
            self.assertIn((STOP_ALL_MOTORS, False), attempted_writes)
            self.assertFalse(self.adapter.connected)
            self.assertTrue(self.adapter._stop_unconfirmed)
        finally:
            self.client.write_gatt_char = original_write
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    async def test_cancelled_connect_releases_ble_client(self):
        await self.adapter.disconnect()
        original_write = FakeClient.write_gatt_char
        started = asyncio.Event()

        async def stalled_authorization(client, characteristic, packet, response):
            if packet == ROBOT_X_AUTHORIZE:
                started.set()
                await asyncio.Event().wait()
            await original_write(client, characteristic, packet, response)

        with patch.object(FakeClient, "write_gatt_char", stalled_authorization):
            task = asyncio.create_task(self.adapter.connect())
            try:
                await asyncio.wait_for(started.wait(), 0.5)
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await asyncio.wait_for(task, 1.0)
            finally:
                if not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)

        attempted_client = FakeClient.instances[-1]
        self.assertFalse(attempted_client.is_connected)
        self.assertIsNone(self.adapter._client)

    async def test_cancelled_confirmed_stop_attempts_unconfirmed_stop(self):
        original_write = self.client.write_gatt_char
        started = asyncio.Event()
        attempted_writes = []

        async def cancelled_stop(characteristic, packet, response):
            attempted_writes.append((packet, response))
            if packet == STOP_ALL_MOTORS and response:
                started.set()
                await asyncio.Event().wait()
            else:
                await original_write(characteristic, packet, response)

        self.client.write_gatt_char = cancelled_stop
        task = asyncio.create_task(self.adapter.stop_all())
        try:
            await asyncio.wait_for(started.wait(), 0.5)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await asyncio.wait_for(task, 1.0)
            self.assertIn((STOP_ALL_MOTORS, False), attempted_writes)
            self.assertTrue(self.adapter._stop_unconfirmed)
        finally:
            self.client.write_gatt_char = original_write
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            with self.assertRaises(AdapterError):
                await self.adapter.disconnect()


if __name__ == "__main__":
    unittest.main()
