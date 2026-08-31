import asyncio
import socket
import threading
import unittest
import wave
from unittest.mock import patch

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
            [
                ("start", ()),
                ("connect", ()),
                ("wait_for_robot", (8.0,)),
                ("set_volume", (65535,)),
                ("stop_all_motors", ()),
            ],
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

    async def test_stop_drive_only_stops_the_wheels(self):
        await self.adapter.connect()
        await self.adapter.execute("stopDrive", {})
        self.assertEqual(("drive_wheels", (0.0, 0.0)), self.client.calls[-1])

    async def test_turn_uses_opposite_wheel_speeds(self):
        await self.adapter.connect()
        await self.adapter.execute("turn", {"speed": 40})
        self.assertEqual(("drive_wheels", (-40.0, 40.0)), self.client.calls[-1])

    async def test_battery_uses_latest_client_state(self):
        await self.adapter.connect()
        self.assertEqual(3.9, await self.adapter.read_sensor("battery", {}))

    async def test_head_and_lift_commands_keep_hardware_limits(self):
        await self.adapter.connect()
        await self.adapter.execute("setHead", {"angle": 4})
        await self.adapter.execute("setLift", {"height": 5})
        self.assertIn(("set_head_angle", (0.7,)), self.client.calls)
        self.assertIn(("set_lift_height", (32.0, 10.0, 10.0, 0.0)), self.client.calls)

    async def test_backpack_color_is_encoded_as_light_state(self):
        await self.adapter.connect()
        await self.adapter.execute("setBackpackLight", {"color": "#123456"})
        name, arguments = self.client.calls[-1]
        self.assertEqual("set_all_backpack_lights", name)
        self.assertEqual("LightState", type(arguments[0]).__name__)

    async def test_display_face_uses_cozmo_screen_dimensions(self):
        await self.adapter.connect()
        await self.adapter.execute("displayFace", {"face": "HAPPY"})
        name, arguments = self.client.calls[-1]
        self.assertEqual("display_image", name)
        self.assertEqual((128, 32), arguments[0].size)

    async def test_face_tracking_runs_until_stop_without_program_loop(self):
        await self.adapter.connect()
        await self.adapter.execute("trackFace", {})
        self.assertTrue(self.adapter._camera_enabled)
        self.assertIsNotNone(self.adapter._face_tracking_task)
        self.assertFalse(self.adapter._face_tracking_task.done())
        await self.adapter.stop_all()
        self.assertFalse(self.adapter._camera_enabled)
        self.assertIsNone(self.adapter._face_tracking_task)

    async def test_face_tracking_accepts_pycozmo_angle_objects(self):
        class Angle:
            radians = 0.2

        await self.adapter.connect()
        self.client.head_angle = Angle()
        with self.adapter._face_lock:
            self.adapter._face = {"detected": True, "x": 0.5, "y": 0.25}
        await self.adapter._track_face_once(self.client)
        self.assertIn(("set_head_angle", (0.2875,)), self.client.calls)

    async def test_prioritized_face_behavior_starts_and_stops_cooperatively(self):
        await self.adapter.connect()

        async def start_camera(_client):
            self.adapter._camera_enabled = True

        with patch.object(self.adapter, "_start_camera", side_effect=start_camera):
            await self.adapter.execute("startBehavior", {"preset": "faceSearchAndFollow"})
            await asyncio.sleep(0)
            self.assertTrue(self.adapter._behavior_runtime.running)
            self.assertIn("drive_wheels", [name for name, _ in self.client.calls])

            await self.adapter.execute("stopBehavior", {})

        self.assertFalse(self.adapter._behavior_runtime.running)
        self.assertEqual("stop_all_motors", self.client.calls[-1][0])

    async def test_unknown_behavior_preset_is_rejected(self):
        await self.adapter.connect()
        with self.assertRaisesRegex(Exception, "unsupported behavior preset"):
            await self.adapter.execute("startBehavior", {"preset": "unknown"})

    async def test_direct_drive_stops_behavior_before_taking_wheel_control(self):
        await self.adapter.connect()

        async def start_camera(_client):
            self.adapter._camera_enabled = True

        with patch.object(self.adapter, "_start_camera", side_effect=start_camera):
            await self.adapter.execute("startBehavior", {"preset": "faceSearchAndFollow"})
            await asyncio.sleep(0)
            await self.adapter.execute("drive", {"left": 30, "right": 30})

        self.assertFalse(self.adapter._behavior_runtime.running)
        self.assertEqual(
            ["stop_all_motors", "drive_wheels"],
            [name for name, _ in self.client.calls[-2:]],
        )

    async def test_tone_is_rendered_locally_and_sent_as_audio(self):
        await self.adapter.connect()
        await self.adapter.execute("tone", {"frequency": 440, "duration": 20})
        await asyncio.gather(*tuple(self.adapter._audio_tasks))
        self.assertEqual("play_audio", self.client.calls[-1][0])

    async def test_audio_command_acknowledges_while_rendering_continues(self):
        await self.adapter.connect()
        release = threading.Event()

        def slow_audio(*_args):
            release.wait(1)

        with patch.object(self.adapter, "_play_tone", slow_audio):
            await asyncio.wait_for(self.adapter.execute("tone", {"frequency": 440, "duration": 20}), 0.1)
            self.assertTrue(self.adapter._audio_tasks)
            release.set()
            await asyncio.gather(*tuple(self.adapter._audio_tasks))

    async def test_speech_is_generated_locally_on_macos(self):
        await self.adapter.connect()

        def synthesize(command, **_kwargs):
            output = command[command.index("-o") + 1]
            with wave.open(output, "wb") as audio_file:
                audio_file.setparams((1, 2, 22050, 1, "NONE", "not compressed"))
                audio_file.writeframes(b"\x00\x00")

        with patch("codeon_robot_bridge.cozmo_adapter.platform.system", return_value="Darwin"), patch(
            "codeon_robot_bridge.cozmo_adapter.subprocess.run", side_effect=synthesize
        ) as run:
            await self.adapter.execute("speak", {"text": "Hallo", "speed": 50})
            await asyncio.gather(*tuple(self.adapter._audio_tasks))
        self.assertEqual(1, run.call_count)
        self.assertIn("--file-format=WAVE", run.call_args.args[0])
        self.assertIn("--data-format=LEI16@22050", run.call_args.args[0])
        self.assertEqual("play_audio", self.client.calls[-1][0])

    async def test_snapshot_contains_only_abstract_sensor_data(self):
        await self.adapter.connect()
        snapshot = await self.adapter.read_sensor("snapshot", {})
        self.assertEqual(3.9, snapshot["battery"])
        self.assertIn("face", snapshot)
        self.assertEqual(0, snapshot["cameraFrames"])
        self.assertEqual(0, snapshot["faceDetections"])
        self.assertNotIn("image", snapshot)
        self.assertNotIn("frame", snapshot)

    async def test_camera_capability_promises_no_image_transfer(self):
        self.assertTrue(self.adapter.manifest.capabilities["camera"]["localFaceDetection"])
        self.assertFalse(self.adapter.manifest.capabilities["camera"]["imagesLeaveBridge"])

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

    def test_macos_cozmo_transport_is_pinned_to_wifi(self):
        class StubSocket:
            def __init__(self):
                self.options = []

            def setsockopt(self, *args):
                self.options.append(args)

        robot_socket = StubSocket()
        with patch("codeon_robot_bridge.cozmo_adapter.platform.system", return_value="Darwin"), patch(
            "codeon_robot_bridge.cozmo_adapter.socket.if_nametoindex", return_value=7
        ):
            CozmoAdapter._pin_socket_to_macos_wifi(robot_socket)

        self.assertEqual([(socket.IPPROTO_IP, 25, 7)], robot_socket.options)

    def test_non_macos_cozmo_transport_is_not_interface_pinned(self):
        class StubSocket:
            def __init__(self):
                self.options = []

            def setsockopt(self, *args):
                self.options.append(args)

        robot_socket = StubSocket()
        with patch("codeon_robot_bridge.cozmo_adapter.platform.system", return_value="Linux"):
            CozmoAdapter._pin_socket_to_macos_wifi(robot_socket)

        self.assertEqual([], robot_socket.options)


if __name__ == "__main__":
    unittest.main()
