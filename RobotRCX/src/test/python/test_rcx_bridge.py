import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


BRIDGE_PATH = Path(__file__).resolve().parents[3] / "rcx-bridge.py"
SPEC = importlib.util.spec_from_file_location("rcx_bridge", BRIDGE_PATH)
RCX_BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RCX_BRIDGE)


class RcxBridgeTest(unittest.TestCase):

    def test_windows_finds_locally_installed_nqc_exe(self):
        with tempfile.TemporaryDirectory() as tmp:
            bridge_dir = Path(tmp)
            bridge_copy = bridge_dir / "rcx-bridge.py"
            bridge_copy.write_text(BRIDGE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
            binary = bridge_dir / "bin" / "nqc.exe"
            binary.parent.mkdir()
            binary.write_bytes(b"test")
            binary.chmod(0o755)

            spec = importlib.util.spec_from_file_location("rcx_bridge_windows", bridge_copy)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            with patch.object(module.platform, "system", return_value="Windows"), \
                    patch.object(module.shutil, "which", return_value=None), \
                    patch.dict(os.environ, {}, clear=True):
                self.assertEqual(str(binary), module.find_nqc())

    def test_explicit_tower_configuration_has_priority(self):
        with patch.dict(os.environ, {"RCX_TOWER": "COM3", "RCX_PORT": "COM2"}, clear=True):
            self.assertEqual(["-SCOM3"], RCX_BRIDGE.nqc_serial_args())

    def test_nqc_rcx_port_is_not_overridden(self):
        with patch.dict(os.environ, {"RCX_PORT": "COM2"}, clear=True):
            self.assertEqual([], RCX_BRIDGE.nqc_serial_args())

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
            ok, _, error = RCX_BRIDGE.transfer_rcx(b"program", program_slot=3, run_after=True)

        self.assertTrue(ok)
        self.assertIsNone(error)
        command = popen.call_args.args[0]
        self.assertEqual("/usr/bin/nqc", command[0])
        self.assertIn("-S/test-tower", command)
        self.assertEqual("3", command[command.index("-pgm") + 1])
        self.assertIn("-run", command)

    def test_transfer_reports_missing_firmware(self):
        process = MagicMock()
        process.communicate.return_value = (b"", b"No firmware installed on RCX2\n")
        process.returncode = 1

        with patch.object(RCX_BRIDGE, "find_nqc", return_value="/usr/bin/nqc"), \
                patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process):
            ok, message, error = RCX_BRIDGE.transfer_rcx(b"program")

        self.assertFalse(ok)
        self.assertEqual("firmware_missing", error)
        self.assertIn("keine Firmware", message)

    def test_configured_firmware_is_installed_with_nqc(self):
        process = MagicMock(returncode=0, stdout="done", stderr="")
        with patch.object(RCX_BRIDGE, "find_nqc", return_value="/usr/bin/nqc"), \
                patch.object(RCX_BRIDGE, "find_firmware", return_value="/tmp/FIRM0332.LGO"), \
                patch.object(RCX_BRIDGE, "nqc_serial_args", return_value=["-S/test-tower"]), \
                patch.object(RCX_BRIDGE.subprocess, "run", return_value=process) as run:
            ok, message = RCX_BRIDGE.install_firmware()

        self.assertTrue(ok)
        self.assertIn("erfolgreich", message)
        self.assertEqual(
            ["/usr/bin/nqc", "-S/test-tower", "-firmware", "/tmp/FIRM0332.LGO"],
            run.call_args.args[0],
        )
        self.assertEqual(
            RCX_BRIDGE.FIRMWARE_TRANSFER_TIMEOUT_SECONDS,
            run.call_args.kwargs["timeout"],
        )

    def test_firmware_timeout_allows_slow_ir_transfer(self):
        self.assertGreaterEqual(RCX_BRIDGE.FIRMWARE_TRANSFER_TIMEOUT_SECONDS, 300)

    def test_status_explains_missing_optional_and_required_components(self):
        with patch.object(RCX_BRIDGE, "find_nqc", return_value=None), \
                patch.object(RCX_BRIDGE, "find_firmware", return_value=None), \
                patch.dict(os.environ, {"RCX_TOWER": "COM4"}, clear=True):
            status = RCX_BRIDGE.status_payload()

        self.assertTrue(status["ok"])
        self.assertFalse(status["requirements"]["nqc"]["installed"])
        self.assertIn("github.com/BrickBot/nqc", status["requirements"]["nqc"]["download"])
        self.assertTrue(status["requirements"]["firmware"]["optional"])
        self.assertIn("RobotRCX/README.md", status["setupGuide"])
        self.assertEqual("COM4", status["tower"]["configured"])
        self.assertEqual(["-SCOM4"], status["tower"]["effectiveArgs"])


if __name__ == "__main__":
    unittest.main()
