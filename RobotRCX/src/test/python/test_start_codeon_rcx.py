import importlib.util
import io
import os
import subprocess
import sys
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


@unittest.skipUnless(Path("/bin/bash").is_file(), "macOS shell launcher contract")
class CozmoShellLauncherTest(unittest.TestCase):
    def run_launcher(self, launcher, *, healthy, install_fails=False):
        """Run the real shell script with fake interpreters: no network or hardware."""
        with tempfile.TemporaryDirectory(prefix="codeon launcher ") as tmp:
            root = Path(tmp)
            script = root / launcher
            script.write_bytes((STARTER_PATH.parent / launcher).read_bytes())
            fake_python = f'''#!{sys.executable}
import os, pathlib, sys, time
root = pathlib.Path(os.environ["TEST_ROOT"])
args = sys.argv[1:]
with (root / "calls").open("a") as log:
    log.write(repr(args) + "\\n")
if "--find-cozmo-python" in args:
    if os.environ["TEST_HEALTHY"] == "1":
        print(root / ".codeon-cozmo-venv/bin/python")
        sys.exit(0)
    sys.exit(1)
if args[:2] == ["-m", "pip"]:
    sys.exit(int(os.environ["TEST_INSTALL_FAILS"]))
if "codeon_robot_bridge.server" in args:
    assert os.environ.get("CODEON_COZMO_TERMINAL_LAUNCH") == "1"
    (root / "bridge-started").touch()
if args == ["start-codeon-rcx.py"]:
    if os.environ["TEST_HEALTHY"] == "1":
        deadline = time.monotonic() + 3
        while not (root / "bridge-started").exists() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert (root / "bridge-started").exists()
    (root / "application-started").touch()
'''
            for path in (root / "bin/python3", root / ".codeon-cozmo-venv/bin/python"):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(fake_python, encoding="utf-8")
                path.chmod(0o755)
            env = dict(os.environ, PATH=str(root / "bin") + os.pathsep + os.environ.get("PATH", ""),
                       TEST_ROOT=str(root), TEST_HEALTHY=str(int(healthy)), TEST_INSTALL_FAILS=str(int(install_fails)))
            result = subprocess.run(["/bin/bash", str(script)], env=env, input="\n", text=True,
                                    capture_output=True, timeout=10)
            return result, (root / "calls").read_text(), (root / "bridge-started").exists(), (root / "application-started").exists()

    def test_setup_reuses_healthy_environment_without_pip(self):
        result, calls, bridge, _ = self.run_launcher("CodeON-Cozmo-Bridge-starten.command", healthy=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertNotIn("'pip'", calls)
        self.assertTrue(bridge)

    def test_setup_repairs_existing_but_incomplete_environment(self):
        result, calls, bridge, _ = self.run_launcher("CodeON-Cozmo-Bridge-starten.command", healthy=False)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("'pip', 'install'", calls)
        self.assertIn("from websockets.asyncio.server import serve", calls)
        self.assertTrue(bridge)

    def test_failed_installation_does_not_start_bridge(self):
        result, _, bridge, _ = self.run_launcher("CodeON-Cozmo-Bridge-starten.command", healthy=False, install_fails=True)
        self.assertEqual(2, result.returncode)
        self.assertIn("Einrichtung fehlgeschlagen", result.stdout)
        self.assertFalse(bridge)

    def test_main_launcher_uses_setup_environment_in_terminal_context(self):
        result, calls, bridge, application = self.run_launcher("CodeON-Starten.command", healthy=True)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(bridge)
        self.assertTrue(application)
        self.assertNotIn("'pip'", calls)

    def test_main_launcher_starts_other_robots_without_cozmo_or_downloads(self):
        result, calls, bridge, application = self.run_launcher("CodeON-Starten.command", healthy=False)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse(bridge)
        self.assertTrue(application)
        self.assertNotIn("'pip'", calls)


class CodeOnRcxStarterTest(unittest.TestCase):

    def test_cozmo_resolver_preserves_healthy_existing_environment(self):
        with patch.object(STARTER, "executable", return_value=True), patch.object(
            STARTER.subprocess, "run", return_value=MagicMock(returncode=0)
        ) as run, patch.object(STARTER.platform, "system", return_value="Darwin"):
            self.assertEqual(STARTER.ROOT / ".venv/bin/python", STARTER.find_cozmo_python())
        self.assertEqual(1, run.call_count)
        self.assertIn("from websockets.asyncio.server import serve", run.call_args.args[0][-1])

    def test_cozmo_resolver_falls_back_to_setup_environment(self):
        failures = (MagicMock(returncode=1), OSError("broken interpreter"), subprocess.TimeoutExpired("python", 10))
        for failure in failures:
            with self.subTest(failure=failure), patch.object(STARTER, "executable", return_value=True), patch.object(
                STARTER.subprocess, "run", side_effect=[failure, MagicMock(returncode=0)]
            ), patch.object(STARTER.platform, "system", return_value="Darwin"):
                self.assertEqual(STARTER.ROOT / ".codeon-cozmo-venv/bin/python", STARTER.find_cozmo_python())

    def test_missing_cozmo_environment_does_not_block_other_robots(self):
        with patch.object(STARTER, "find_cozmo_python", return_value=None), patch.object(
            STARTER, "find_nqc", return_value=None
        ), patch.object(STARTER, "find_firmware", return_value=None), patch.object(
            STARTER, "java_major_version", return_value=11
        ), patch.object(STARTER.shutil, "which", return_value="java"), patch.object(
            STARTER, "url_json", return_value=None
        ), patch.object(STARTER, "url_reachable", return_value=False):
            checks = STARTER.preflight()
        self.assertFalse(checks["cozmo"]["ok"])
        self.assertTrue(checks["cozmo"]["optional"])
        self.assertEqual([], STARTER.required_missing(checks))
        # RCX/RCJ (user-configurable) and Edison (built-in) remain selectable.
        self.assertTrue({"rcx", "edisonv2", "rcj"}.issubset(STARTER.SUPPORTED_ROBOTS))

    def test_java_stub_is_not_displayed_as_installed_runtime(self):
        checks = {key: {"ok": True} for key in ("python", "codeon", "nqc", "cozmo", "firmware", "bridge", "server")}
        checks["java"] = {"ok": False, "value": "/usr/bin/java", "version": None}
        output = io.StringIO()
        with patch("sys.stdout", output):
            STARTER.print_preflight(checks)
        self.assertIn("keine nutzbare Java-Laufzeit", output.getvalue())
        self.assertNotIn("/usr/bin/java", output.getvalue())

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
        self.assertIn("--find-cozmo-python", launcher)
        self.assertIn('"$COZMO_PYTHON" -u -m codeon_robot_bridge.server', launcher)

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
