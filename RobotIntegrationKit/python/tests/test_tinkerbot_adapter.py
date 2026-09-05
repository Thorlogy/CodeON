import unittest

from codeon_robot_bridge.errors import UnsupportedCommandError
from codeon_robot_bridge.tinkerbot_adapter import TinkerbotAdapter
from codeon_robot_bridge.tinkerbot_protocol import (
    FILE_UPLOAD_CONTROL,
    GET_BATTERY_LEVEL,
    GET_CURRENT_MTU,
    GET_FIRMWARE_VERSION,
    TINKERBOT_CHARACTERISTIC_UUID,
    execute_script_frame,
    terminate_script_frame,
)


class FakeScanner:
    @staticmethod
    async def discover(timeout):
        return []


class FakeClient:
    instances = []

    def __init__(self, identifier, timeout, disconnected_callback=None):
        self.identifier = identifier
        self.timeout = timeout
        self.disconnected_callback = disconnected_callback
        self.is_connected = False
        self.writes = []
        self.notify_callback = None
        FakeClient.instances.append(self)

    async def connect(self):
        self.is_connected = True

    async def disconnect(self):
        self.is_connected = False

    async def start_notify(self, characteristic, callback):
        self.notify_callback = callback

    async def stop_notify(self, characteristic):
        self.notify_callback = None

    async def write_gatt_char(self, characteristic, packet, response):
        raw = bytes(packet)
        self.writes.append((characteristic, raw, response))
        replies = {
            GET_FIRMWARE_VERSION: bytes((GET_FIRMWARE_VERSION, 3, 2, 1)),
            GET_BATTERY_LEVEL: bytes((GET_BATTERY_LEVEL, 87)),
            GET_CURRENT_MTU: bytes((GET_CURRENT_MTU, 23)),
        }
        if raw and raw[0] in replies:
            self.notify_callback(None, bytearray(replies[raw[0]]))
        elif raw[:1] == bytes((FILE_UPLOAD_CONTROL,)):
            control = raw[1]
            self.notify_callback(None, bytearray((FILE_UPLOAD_CONTROL, control, 0)))


class TinkerbotAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeClient.instances.clear()
        self.adapter = TinkerbotAdapter("DEVICE-1", lambda: (FakeClient, FakeScanner))
        await self.adapter.connect()
        self.client = FakeClient.instances[-1]

    async def asyncTearDown(self):
        await self.adapter.disconnect()

    async def test_connect_establishes_stopped_state_before_status_queries(self):
        self.assertEqual(self.client.writes[0][1], terminate_script_frame())
        self.assertEqual(await self.adapter.read_sensor("firmwareVersion", {}), "1.2.3")
        self.assertEqual(await self.adapter.read_sensor("battery", {}), 87)
        self.assertEqual(await self.adapter.read_sensor("currentMtu", {}), 23)

    async def test_run_program_uploads_custom_python_then_starts_it(self):
        await self.adapter.execute("runProgram", {"source": "print('Hallo')\n"})
        packets = [packet for characteristic, packet, response in self.client.writes]
        self.assertIn(b"\x31\x0f\x00\x00\x00custom.py", packets)
        self.assertEqual(packets[-1], execute_script_frame())

    async def test_stop_all_is_idempotent_and_uses_script_termination(self):
        await self.adapter.stop_all()
        await self.adapter.stop_all()
        self.assertEqual([packet for _, packet, _ in self.client.writes[-2:]], [b"\x06", b"\x06"])

    async def test_disconnect_stops_before_closing_transport(self):
        await self.adapter.disconnect()
        self.assertEqual(self.client.writes[-1][1], terminate_script_frame())
        self.assertFalse(self.adapter.connected)

    async def test_unknown_direct_motor_command_is_not_guessed(self):
        with self.assertRaises(UnsupportedCommandError):
            await self.adapter.execute("setMotor", {"speed": 50})

    async def test_manifest_is_explicitly_hardware_pending(self):
        manifest = self.adapter.manifest.to_dict()
        self.assertEqual(manifest["robot"], "experibot-t2bot-research")
        self.assertEqual(manifest["limits"]["verification"]["hardware"], "pending")
        self.assertEqual(
            manifest["limits"]["verification"]["legacyPowerbrain"],
            "not-compatible-unverified",
        )
        self.assertEqual(self.client.writes[0][0], TINKERBOT_CHARACTERISTIC_UUID)


if __name__ == "__main__":
    unittest.main()
