import importlib.util
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch


STARTER_PATH = Path(__file__).resolve().parents[4] / "start-codeon-rcx.py"
SPEC = importlib.util.spec_from_file_location("start_codeon_rcx", STARTER_PATH)
STARTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STARTER)

PACKAGER_PATH = STARTER_PATH.parent / "scripts/build-codeon-rcx-package.py"
PACKAGER_SPEC = importlib.util.spec_from_file_location("build_codeon_rcx_package", PACKAGER_PATH)
PACKAGER = importlib.util.module_from_spec(PACKAGER_SPEC)
PACKAGER_SPEC.loader.exec_module(PACKAGER)


class CodeOnRcxStarterTest(unittest.TestCase):

    def test_java_version_supports_modern_and_legacy_formats(self):
        modern = MagicMock(stderr='openjdk version "17.0.12"', stdout="")
        legacy = MagicMock(stderr='java version "1.8.0_402"', stdout="")
        with patch.object(STARTER.subprocess, "run", side_effect=[modern, legacy]):
            self.assertEqual(17, STARTER.java_major_version("java"))
            self.assertEqual(8, STARTER.java_major_version("java"))

    def test_configured_nqc_has_priority(self):
        with tempfile.TemporaryDirectory() as tmp:
            nqc = Path(tmp) / "nqc"
            nqc.write_text("test", encoding="utf-8")
            nqc.chmod(0o755)
            with patch.dict(os.environ, {"NQC_PATH": str(nqc)}):
                self.assertEqual(nqc.resolve(), STARTER.find_nqc())

    def test_optional_firmware_does_not_block_start(self):
        checks = {
            "python": {"ok": True},
            "java": {"ok": True},
            "codeon": {"ok": True},
            "nqc": {"ok": True},
            "firmware": {"ok": False, "optional": True},
        }
        self.assertEqual([], STARTER.required_missing(checks))

    def test_missing_optional_nqc_does_not_block_non_rcx_use(self):
        checks = {
            "python": {"ok": True},
            "java": {"ok": True},
            "codeon": {"ok": True},
            "nqc": {"ok": False, "optional": True},
        }
        self.assertEqual([], STARTER.required_missing(checks))

    def test_mac_environment_copies_user_nqc_for_server_and_bridge(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            nqc = tmp_path / "source" / "nqc"
            nqc.parent.mkdir()
            nqc.write_text("test", encoding="utf-8")
            nqc.chmod(0o755)
            runtime = tmp_path / "runtime"
            with patch.object(STARTER, "RUNTIME", runtime), patch.object(STARTER.platform, "system", return_value="Darwin"):
                env, compiler_base = STARTER.prepare_environment(nqc, None)

            self.assertEqual(str(nqc), env["NQC_PATH"])
            self.assertEqual(runtime / "crosscompiler", compiler_base)
            copied = compiler_base / "RobotRCX" / "osx" / "nqc"
            self.assertTrue(copied.is_file())
            self.assertTrue(os.access(copied, os.X_OK))

    def test_ready_to_run_application_contains_rcx_setup_help(self):
        root = STARTER_PATH.parent
        source_js = root / "OpenRobertaServer/staticResources/js/app/roberta/controller/connections/connections.js"
        application_js = root / "application/staticResources/js/app/roberta/controller/connections/connections.js"
        for javascript in (source_js, application_js):
            text = javascript.read_text(encoding="utf-8")
            self.assertIn("CodeON-Starten.command", text)
            self.assertIn("feature/sim-3d-toggle/RobotRCX/README.md", text)

    def test_ready_to_run_application_uses_nqc_path_from_assistant(self):
        jar = STARTER_PATH.parent / "application/lib/RobotRCX.jar"
        with zipfile.ZipFile(jar) as archive:
            compiler = archive.read("de/fhg/iais/roberta/worker/compile/RcxCompilerWorker.class")
        self.assertIn(b"NQC_PATH", compiler)

    def test_clickable_launchers_are_present(self):
        root = STARTER_PATH.parent
        for name in ("CodeON-Starten.command", "CodeON-Starten.cmd", "start-codeon.sh"):
            self.assertTrue((root / name).is_file(), name)

    def test_macos_cozmo_launcher_marks_context_and_uses_rotating_log(self):
        launcher = (STARTER_PATH.parent / "CodeON-Starten.command").read_text(encoding="utf-8")
        self.assertIn("CODEON_COZMO_TERMINAL_LAUNCH=1", launcher)
        self.assertIn("--log-file .codeon-runtime/logs/cozmo-bridge.log", launcher)
        self.assertNotIn(">>.codeon-runtime/logs/cozmo-bridge.log", launcher)

    def test_python_starter_does_not_spawn_cozmo_on_macos(self):
        source = STARTER_PATH.read_text(encoding="utf-8")
        self.assertIn('elif platform.system() == "Darwin":', source)
        self.assertIn("Bitte CodeON über CodeON-Starten.command öffnen", source)

    def test_only_supported_robot_plugins_are_enabled(self):
        self.assertEqual(("rcx", "edisonv2", "rcj", "cozmo", "apitor"), STARTER.SUPPORTED_ROBOTS)
        source = STARTER_PATH.read_text(encoding="utf-8")
        self.assertIn('"robot.whitelist=" + ",".join(SUPPORTED_ROBOTS)', source)
        self.assertIn('"robot.default=rcx"', source)

    def test_bridge_only_mode_never_stops_the_codeon_server(self):
        with patch.object(STARTER, "stop_previous_codeon_server") as stop_server:
            STARTER.restart_owned_codeon_server(bridge_only=True)
            stop_server.assert_not_called()

    def test_full_launcher_restart_stops_only_the_owned_codeon_server(self):
        with patch.object(STARTER, "stop_previous_codeon_server") as stop_server:
            STARTER.restart_owned_codeon_server(bridge_only=False)
            stop_server.assert_called_once_with()

    def test_development_start_uses_the_central_robot_bridge_launcher(self):
        source = (STARTER_PATH.parent / "ora.sh").read_text(encoding="utf-8")
        self.assertIn("./start-codeon-rcx.py --bridge-only", source)
        self.assertNotIn("_startRcxBridge", source)
        self.assertIn("server.ip=127.0.0.1", source)

    def test_packaged_launcher_binds_the_server_to_loopback(self):
        source = STARTER_PATH.read_text(encoding="utf-8")
        self.assertIn('"server.ip=127.0.0.1"', source)

    def test_browser_url_versions_the_frontend_entry_point(self):
        with tempfile.TemporaryDirectory() as tmp:
            application = Path(tmp) / "application"
            index = application / "staticResources" / "index.html"
            index.parent.mkdir(parents=True)
            index.write_text("CodeON", encoding="utf-8")
            expected_url = f"{STARTER.CODEON_URL}/?v={index.stat().st_mtime_ns}"
            with patch.object(STARTER, "APPLICATION", application):
                url = STARTER.codeon_browser_url()

        self.assertEqual(expected_url, url)

    def test_compact_user_package_contains_runtime_but_no_proprietary_tools(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive_path = PACKAGER.build_package("test", Path(tmp))
            with zipfile.ZipFile(archive_path) as archive:
                names = set(archive.namelist())

        self.assertIn("CodeON-RCX-test/CodeON-Starten.command", names)
        self.assertIn("CodeON-RCX-test/application/lib/RobotRCX.jar", names)
        self.assertIn("CodeON-RCX-test/application/lib/RobotEdison.jar", names)
        self.assertIn("CodeON-RCX-test/application/lib/RobotSpike.jar", names)
        self.assertIn("CodeON-RCX-test/application/lib/RobotCozmo.jar", names)
        robot_jars = {
            name.rsplit("/", 1)[-1]
            for name in names
            if "/application/lib/Robot" in name and name.endswith(".jar")
        }
        self.assertEqual({"RobotRCX.jar", "RobotEdison.jar", "RobotSpike.jar", "RobotCozmo.jar", "RobotApitor.jar"}, robot_jars)
        self.assertFalse(any("/application/db-embedded/" in name for name in names))
        self.assertIn("CodeON-RCX-test/RobotRCX/rcx-bridge.py", names)
        self.assertNotIn("CodeON-RCX-test/RobotRCX/bin/nqc", names)
        self.assertFalse(any(name.lower().endswith(".lgo") for name in names))


if __name__ == "__main__":
    unittest.main()
