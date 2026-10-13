import argparse
import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from codeon_robot_bridge.bridge import BridgeSession
from codeon_robot_bridge.errors import AdapterError
from codeon_robot_bridge.fake_adapter import FakeRobotAdapter
from codeon_robot_bridge.safety import MotionWatchdog
from codeon_robot_bridge.server import RotatingTextStream, _validate_launch_context, _watchdog


class RotatingTextStreamTest(unittest.TestCase):

    def test_rotates_and_limits_numbered_backups(self):
        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "bridge.log"
            stream = RotatingTextStream(log_path, max_bytes=10, backup_count=2)
            for value in ("first\n", "second\n", "third\n", "fourth\n"):
                stream.write(value)
            stream.close()

            self.assertEqual("fourth\n", log_path.read_text(encoding="utf-8"))
            self.assertEqual("third\n", (Path(tmp) / "bridge.log.1").read_text(encoding="utf-8"))
            self.assertEqual("second\n", (Path(tmp) / "bridge.log.2").read_text(encoding="utf-8"))
            self.assertNotIn("first", "".join(path.read_text(encoding="utf-8") for path in Path(tmp).iterdir()))


class CozmoLaunchContextTest(unittest.TestCase):

    def test_macos_rejects_cozmo_bridge_without_terminal_launcher(self):
        args = argparse.Namespace(adapter="cozmo")
        with patch("codeon_robot_bridge.server.platform.system", return_value="Darwin"), patch.dict(
            os.environ, {}, clear=True
        ):
            with self.assertRaisesRegex(SystemExit, "CodeON-Starten.command"):
                _validate_launch_context(args)

    def test_macos_accepts_marked_terminal_launcher(self):
        args = argparse.Namespace(adapter="cozmo")
        with patch("codeon_robot_bridge.server.platform.system", return_value="Darwin"), patch.dict(
            os.environ, {"CODEON_COZMO_TERMINAL_LAUNCH": "1"}, clear=True
        ):
            _validate_launch_context(args)

    def test_other_adapters_remain_available_without_marker(self):
        args = argparse.Namespace(adapter="apitor")
        with patch("codeon_robot_bridge.server.platform.system", return_value="Darwin"), patch.dict(
            os.environ, {}, clear=True
        ):
            _validate_launch_context(args)


class WatchdogRecoveryTest(unittest.IsolatedAsyncioTestCase):

    async def test_failed_stop_is_logged_and_retried_without_killing_watchdog(self):
        class FailOnceAdapter(FakeRobotAdapter):
            def __init__(self):
                super().__init__()
                self.attempts = 0
                self.retried = asyncio.Event()

            async def stop_all(self):
                self.attempts += 1
                if self.attempts == 1:
                    raise AdapterError("simulated unconfirmed stop")
                await super().stop_all()
                self.retried.set()

        adapter = FailOnceAdapter()
        now = [0.0]
        session = BridgeSession(adapter, MotionWatchdog(1.0, lambda: now[0]))
        session.watchdog.motion_started()
        now[0] = 1.1
        stop = asyncio.Event()
        messages = []
        with patch("codeon_robot_bridge.server._log", messages.append):
            task = asyncio.create_task(_watchdog(session, stop))
            try:
                await asyncio.wait_for(adapter.retried.wait(), 2.0)
            finally:
                stop.set()
                await asyncio.wait_for(task, 1.0)
        self.assertEqual(adapter.attempts, 2)
        self.assertEqual(adapter.stop_count, 1)
        self.assertTrue(any("watchdog stop unconfirmed" in message for message in messages))

    async def test_normal_stop_does_not_retry_for_unaffected_adapter(self):
        class ObservedAdapter(FakeRobotAdapter):
            def __init__(self):
                super().__init__()
                self.stopped = asyncio.Event()

            async def stop_all(self):
                await super().stop_all()
                self.stopped.set()

        adapter = ObservedAdapter()
        now = [0.0]
        session = BridgeSession(adapter, MotionWatchdog(1.0, lambda: now[0]))
        session.watchdog.motion_started()
        now[0] = 1.1
        stop = asyncio.Event()
        task = asyncio.create_task(_watchdog(session, stop))
        try:
            await asyncio.wait_for(adapter.stopped.wait(), 0.5)
            await asyncio.sleep(0.2)
        finally:
            stop.set()
            await asyncio.wait_for(task, 1.0)
        self.assertEqual(adapter.stop_count, 1)

if __name__ == "__main__":
    unittest.main()
