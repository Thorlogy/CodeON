import unittest

from codeon_robot_bridge.{{ROBOT_ID}}_adapter import {{ADAPTER_CLASS}}
from codeon_robot_bridge.errors import AdapterError, UnsupportedCommandError


class {{ADAPTER_CLASS}}Test(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.adapter = {{ADAPTER_CLASS}}()

    async def test_scaffold_starts_disconnected(self):
        self.assertFalse(self.adapter.connected)
        self.assertEqual(self.adapter.manifest.robot, {{ROBOT_ID_LITERAL}})
        self.assertEqual(self.adapter.manifest.capabilities["actuators"], [])

    async def test_connection_is_fail_closed_until_implemented(self):
        with self.assertRaises(AdapterError):
            await self.adapter.connect()

    async def test_commands_and_sensors_are_rejected_until_verified(self):
        with self.assertRaises(UnsupportedCommandError):
            await self.adapter.execute("move", {})
        with self.assertRaises(UnsupportedCommandError):
            await self.adapter.read_sensor("unknown", {})

    async def test_repeated_stop_is_safe(self):
        await self.adapter.stop_all()
        await self.adapter.stop_all()


if __name__ == "__main__":
    unittest.main()
