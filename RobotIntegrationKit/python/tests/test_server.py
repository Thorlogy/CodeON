import argparse
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from codeon_robot_bridge.server import RotatingTextStream, _validate_launch_context


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


if __name__ == "__main__":
    unittest.main()
