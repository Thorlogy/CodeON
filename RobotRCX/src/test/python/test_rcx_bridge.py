import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


BRIDGE_PATH = Path(__file__).resolve().parents[3] / "rcx-bridge.py"
SPEC = importlib.util.spec_from_file_location("rcx_bridge", BRIDGE_PATH)
RCX_BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RCX_BRIDGE)


class RcxBridgeTest(unittest.TestCase):

    def test_local_origins_are_allowed(self):
        self.assertTrue(RCX_BRIDGE.origin_is_allowed(None))
        self.assertTrue(RCX_BRIDGE.origin_is_allowed("http://localhost:1999"))
        self.assertTrue(RCX_BRIDGE.origin_is_allowed("https://127.0.0.1:8443"))
        self.assertFalse(RCX_BRIDGE.origin_is_allowed("https://example.org"))

    def test_configured_origin_is_allowed(self):
        with patch.dict(os.environ, {"RCX_BRIDGE_ALLOWED_ORIGINS": "https://codeon.example.org"}):
            self.assertTrue(RCX_BRIDGE.origin_is_allowed("https://codeon.example.org"))
            self.assertFalse(RCX_BRIDGE.origin_is_allowed("https://other.example.org"))

    def test_transfer_uses_platform_connection_arguments(self):
        process = MagicMock()
        process.communicate.return_value = (b"ok", b"")
        process.returncode = 0

        with patch.object(RCX_BRIDGE, "find_nqc", return_value="/usr/bin/nqc"), \
                patch.object(RCX_BRIDGE, "nqc_serial_args", return_value=["-S/test-tower"]), \
                patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process) as popen:
            ok, _ = RCX_BRIDGE.transfer_rcx(b"program", program_slot=3, run_after=True)

        self.assertTrue(ok)
        command = popen.call_args.args[0]
        self.assertEqual("/usr/bin/nqc", command[0])
        self.assertIn("-S/test-tower", command)
        self.assertEqual("3", command[command.index("-pgm") + 1])
        self.assertIn("-run", command)


if __name__ == "__main__":
    unittest.main()
