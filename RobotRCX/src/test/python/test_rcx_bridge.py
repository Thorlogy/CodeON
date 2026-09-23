import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


BRIDGE_PATH = Path(__file__).resolve().parents[3] / "rcx-bridge.py"
SPEC = importlib.util.spec_from_file_location("rcx_bridge", BRIDGE_PATH)
RCX_BRIDGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RCX_BRIDGE)


class RcxBridgeTest(unittest.TestCase):

    def diagnose(self, responses):
        with patch.object(RCX_BRIDGE, "find_nqc", return_value="/test/nqc"), \
                patch.object(RCX_BRIDGE, "nqc_serial_args", return_value=["-SCOM4"]), \
                patch.object(RCX_BRIDGE.subprocess, "run", side_effect=responses) as run:
            result = RCX_BRIDGE.probe_rcx()
        for call in run.call_args_list:
            self.assertEqual(["/test/nqc", "-SCOM4", "-getversion"], call.args[0])
            self.assertEqual(3, call.kwargs["timeout"])
        return result, run.call_count

    def test_probe_retries_no_reply_then_recognizes_explicit_missing_firmware(self):
        result, count = self.diagnose([
            MagicMock(returncode=253, stdout="", stderr="No reply"),
            MagicMock(returncode=1, stdout="", stderr="No firmware installed on RCX2"),
        ])
        self.assertEqual(2, count)
        self.assertFalse(result[0])
        self.assertIn("keine Firmware", result[1])

    def test_probe_parses_rom_and_firmware_separately(self):
        for rom, firmware, present in (("00030001", "00000000", False), ("00000000", "00030302", True),
                                      ("00030001", "0003ABCD", True)):
            with self.subTest(rom=rom, firmware=firmware):
                result, count = self.diagnose([MagicMock(returncode=0, stdout="", stderr=
                    f"Current Version [ROM/Firmware]: {rom}/{firmware}\n")])
                self.assertEqual(present, result[0])
                self.assertEqual(1, count)
                self.assertIn("RCX-Firmware erkannt" if present else "keine Firmware", result[1])

    def test_unknown_output_never_becomes_missing_firmware(self):
        for output in ("No reply", "", "00000000", "Battery: 00000000", "Firmware file missing",
                       "Current Version [ROM/Firmware]: 00030001/000000000"):
            with self.subTest(output=output):
                result, count = self.diagnose([MagicMock(returncode=0, stdout=output, stderr="")] * 3)
                self.assertEqual(3, count)
                self.assertFalse(result[0])
                self.assertIn("konnte nicht ermittelt", result[1])

    def test_probe_does_not_trust_version_from_failed_command(self):
        result, count = self.diagnose([MagicMock(returncode=1,
            stdout="Current Version [ROM/Firmware]: 00030001/00000000", stderr="")] * 3)
        self.assertEqual(3, count)
        self.assertIn("konnte nicht ermittelt", result[1])

    def test_probe_timeouts_are_bounded_and_may_recover(self):
        timeout = subprocess.TimeoutExpired("nqc", 3)
        result, count = self.diagnose([timeout] * 3)
        self.assertEqual(3, count)
        self.assertFalse(result[0])
        self.assertIn("konnte nicht ermittelt", result[1])
        result, count = self.diagnose([timeout, MagicMock(returncode=0, stderr="",
            stdout="Current Version [ROM/Firmware]: 00030001/00030302")])
        self.assertTrue(result[0])
        self.assertEqual(2, count)

    def test_probe_os_error_stops_without_retry(self):
        result, count = self.diagnose([OSError("not executable")])
        self.assertEqual(1, count)
        self.assertFalse(result[0])
        self.assertIn("not executable", result[1])
        self.assertFalse(RCX_BRIDGE._tower_lock.locked())

    def test_no_reply_only_retries_reads_never_upload_or_run(self):
        for output, expected_error in (
            ("Current Version [ROM/Firmware]: 00030001/00000000", "firmware_missing"),
            ("Current Version [ROM/Firmware]: 00030001/00030302", "no_reply"),
            ("No reply", "no_reply"),
        ):
            process = MagicMock(returncode=253)
            process.communicate.return_value = (b"", b"No reply")
            with self.subTest(output=output), patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                    patch.object(RCX_BRIDGE, "nqc_serial_args", return_value=["-Susb"]), \
                    patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process) as popen, \
                    patch.object(RCX_BRIDGE.subprocess, "run", return_value=MagicMock(returncode=0,
                        stdout=output, stderr="")) as run:
                ok, message, error = RCX_BRIDGE.transfer_rcx(b"program", run_after=True)
            self.assertFalse(ok)
            self.assertEqual(expected_error, error)
            popen.assert_called_once()
            self.assertIn("-run", popen.call_args.args[0])
            self.assertFalse(Path(popen.call_args.args[0][3]).exists())  # temporary program removed
            for call in run.call_args_list:
                self.assertEqual(["nqc", "-Susb", "-getversion"], call.args[0])
            if expected_error == "no_reply":
                self.assertIn("nicht automatisch wiederholt", message)

    def test_success_direct_missing_and_other_errors_do_not_trigger_diagnosis(self):
        for code, output, error in ((0, b"ok", None), (1, b"No firmware installed", "firmware_missing"),
                                     (2, b"bad program", "transfer_failed")):
            process = MagicMock(returncode=code)
            process.communicate.return_value = (output, b"")
            with self.subTest(code=code), patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                    patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process) as popen, \
                    patch.object(RCX_BRIDGE.subprocess, "run") as run:
                result = RCX_BRIDGE.transfer_rcx(b"program")
            self.assertEqual(error, result[2])
            popen.assert_called_once()
            run.assert_not_called()

    def test_killed_upload_is_reaped_before_read_only_diagnosis(self):
        process = MagicMock(returncode=-9)
        process.communicate.side_effect = [subprocess.TimeoutExpired("nqc", 20), (b"", b"")]

        def version(*args, **kwargs):
            process.kill.assert_called_once()
            self.assertEqual(2, process.communicate.call_count)
            return MagicMock(returncode=0, stdout="Current Version [ROM/Firmware]: 00030001/00000000", stderr="")

        with patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process) as popen, \
                patch.object(RCX_BRIDGE.subprocess, "run", side_effect=version):
            self.assertEqual("firmware_missing", RCX_BRIDGE.transfer_rcx(b"program")[2])
        popen.assert_called_once()

    def test_busy_tower_rejects_all_operations_without_process_or_queue(self):
        with RCX_BRIDGE._tower_lock, patch.object(RCX_BRIDGE.subprocess, "run") as run, \
                patch.object(RCX_BRIDGE.subprocess, "Popen") as popen:
            self.assertEqual((False, RCX_BRIDGE.TOWER_BUSY_MESSAGE), RCX_BRIDGE.probe_rcx())
            self.assertEqual((False, RCX_BRIDGE.TOWER_BUSY_MESSAGE), RCX_BRIDGE.install_firmware())
            self.assertEqual((False, RCX_BRIDGE.TOWER_BUSY_MESSAGE, "tower_busy"), RCX_BRIDGE.transfer_rcx(b"x"))
            run.assert_not_called()
            popen.assert_not_called()

    def test_operations_hold_and_release_tower_lock(self):
        def check_locked(*args, **kwargs):
            self.assertTrue(RCX_BRIDGE._tower_lock.locked())
            raise OSError("fixture failure")

        with patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                patch.object(RCX_BRIDGE, "find_firmware", return_value="test.lgo"), \
                patch.object(RCX_BRIDGE.subprocess, "run", side_effect=check_locked), \
                patch.object(RCX_BRIDGE.subprocess, "Popen", side_effect=check_locked):
            for operation in (RCX_BRIDGE.probe_rcx, RCX_BRIDGE.install_firmware,
                              lambda: RCX_BRIDGE.transfer_rcx(b"program")):
                self.assertFalse(operation()[0])
                self.assertFalse(RCX_BRIDGE._tower_lock.locked())

    def test_firmware_failure_or_timeout_is_never_retried(self):
        for response in (MagicMock(returncode=253, stdout="", stderr="No reply"),
                         subprocess.TimeoutExpired("nqc", 600)):
            with self.subTest(response=response), patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                    patch.object(RCX_BRIDGE, "find_firmware", return_value="test.lgo"), \
                    patch.object(RCX_BRIDGE.subprocess, "run", side_effect=[response]) as run:
                self.assertFalse(RCX_BRIDGE.install_firmware()[0])
            run.assert_called_once()
            self.assertIn("-firmware", run.call_args.args[0])
            self.assertFalse(RCX_BRIDGE._tower_lock.locked())

    def test_upload_returns_existing_firmware_offer_contract_without_installing(self):
        body = json.dumps({"compiledCode": "cHJvZ3JhbQ==", "slot": 1, "run": False}).encode()
        handler = RCX_BRIDGE.BridgeHandler.__new__(RCX_BRIDGE.BridgeHandler)
        handler.path = "/upload"
        handler.headers = {"Content-Length": str(len(body)), "Origin": "http://localhost:1999"}
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        handler.send_response = MagicMock()
        handler.send_header = MagicMock()
        handler.end_headers = MagicMock()
        process = MagicMock(returncode=253)
        process.communicate.return_value = (b"No reply", b"")
        with patch.object(RCX_BRIDGE, "find_nqc", return_value="nqc"), \
                patch.object(RCX_BRIDGE.subprocess, "Popen", return_value=process), \
                patch.object(RCX_BRIDGE.subprocess, "run", return_value=MagicMock(returncode=0,
                    stdout="Current Version [ROM/Firmware]: 00030001/00000000", stderr="")), \
                patch.object(RCX_BRIDGE, "install_firmware") as install, \
                patch.object(RCX_BRIDGE, "start_firmware_job") as start_job:
            handler.do_POST()
        payload = json.loads(handler.wfile.getvalue())
        self.assertFalse(payload["ok"])
        self.assertEqual("firmware_missing", payload["error"])
        handler.send_response.assert_called_once_with(200)
        install.assert_not_called()
        start_job.assert_not_called()

    def test_status_and_progress_remain_readable_while_tower_busy(self):
        with RCX_BRIDGE._tower_lock, patch.object(RCX_BRIDGE.subprocess, "run") as run, \
                patch.object(RCX_BRIDGE.subprocess, "Popen") as popen:
            self.assertTrue(RCX_BRIDGE.status_payload()["ok"])
            self.assertTrue(RCX_BRIDGE.firmware_progress_payload()["ok"])
            run.assert_not_called()
            popen.assert_not_called()

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
