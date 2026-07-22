import asyncio
import socket
import unittest

from codeon_robot_bridge import CozmoAdapter


class StubClient:
    def __init__(self):
        self.calls = []
        self.serial_number = 1234
        self.battery_voltage = 3.9

    def __getattr__(self, name):
        def call(*args):
            self.calls.append((name, args))
        return call


class CozmoAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = StubClient()
        self.adapter = CozmoAdapter(lambda: self.client)

    async def test_connect_uses_documented_pycozmo_sequence(self):
        result = await self.adapter.connect()
        self.assertTrue(result["connected"])
        self.assertEqual(
            [("start", ()), ("connect", ()), ("wait_for_robot", (8.0,))],
            self.client.calls,
        )

    async def test_parallel_connect_requests_initialize_hardware_only_once(self):
        results = await asyncio.gather(self.adapter.connect(), self.adapter.connect())
        self.assertTrue(all(result["connected"] for result in results))
        self.assertEqual(1, sum(name == "start" for name, _ in self.client.calls))
        self.assertEqual(1, sum(name == "connect" for name, _ in self.client.calls))
        self.assertEqual(1, sum(name == "wait_for_robot" for name, _ in self.client.calls))

    async def test_drive_values_are_clamped_to_manifest_limit(self):
        await self.adapter.connect()
        await self.adapter.execute("drive", {"left": 500, "right": -500})
        self.assertEqual(("drive_wheels", (150.0, -150.0)), self.client.calls[-1])

    async def test_turn_uses_opposite_wheel_speeds(self):
        await self.adapter.connect()
        await self.adapter.execute("turn", {"speed": 40})
        self.assertEqual(("drive_wheels", (-40.0, 40.0)), self.client.calls[-1])

    async def test_battery_uses_latest_client_state(self):
        await self.adapter.connect()
        self.assertEqual(3.9, await self.adapter.read_sensor("battery", {}))

    async def test_disconnect_stops_before_closing_transport(self):
        await self.adapter.connect()
        await self.adapter.disconnect()
        self.assertEqual(
            ["stop_all_motors", "disconnect", "stop"],
            [name for name, _ in self.client.calls[-3:]],
        )
        self.assertFalse(self.adapter.connected)

    async def test_failed_unstarted_transport_socket_is_closed(self):
        class Connection:
            def __init__(self):
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

        class Client:
            def __init__(self):
                self.conn = Connection()

            def disconnect(self):
                pass

            def stop(self):
                raise RuntimeError("threads were not started")

        client = Client()
        file_descriptor = client.conn.sock.fileno()
        await CozmoAdapter._close_failed_client(client)
        self.assertGreaterEqual(file_descriptor, 0)
        self.assertEqual(-1, client.conn.sock.fileno())


if __name__ == "__main__":
    unittest.main()
