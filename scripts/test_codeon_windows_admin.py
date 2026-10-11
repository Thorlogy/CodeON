"""Isolated Windows admin.bat checks; never use a live CodeON database."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGED_LIB = ROOT / "application" / "lib"


class WindowsAdminSourceTest(unittest.TestCase):
    def test_exported_batch_matches_source(self):
        self.assertEqual((ROOT / "admin.bat").read_bytes(),
                         (ROOT / "application/admin.bat").read_bytes())


@unittest.skipUnless(os.name == "nt", "Windows cmd.exe is required")
class WindowsAdminRuntimeTest(unittest.TestCase):
    def run_admin(self, directory, *, version="21.0.12", fail_db=False,
                  fail_server=False, fake_java=True, mode="start-server"):
        env = dict(os.environ)
        calls = directory / "java-calls.txt"
        if fake_java:
            bin_dir = directory / "bin"
            bin_dir.mkdir()
            (bin_dir / "java.cmd").write_text(
                '@echo off\n'
                'if "%~1"=="-version" (\n'
                '  echo openjdk version "%TEST_JAVA_VERSION%" 1>&2\n'
                '  exit /b 0\n'
                ')\n'
                'echo %*>>"%TEST_JAVA_CALLS%"\n'
                'echo %*|findstr /c:"create-empty-db" >nul\n'
                'if not errorlevel 1 if "%TEST_FAIL_DB%"=="1" exit /b 23\n'
                'echo %*|findstr /c:"ServerStarter" >nul\n'
                'if not errorlevel 1 if "%TEST_FAIL_SERVER%"=="1" exit /b 24\n'
                'exit /b 0\n', encoding="utf-8")
            env["PATH"] = str(bin_dir) + os.pathsep + env.get("PATH", "")
            env.update(TEST_JAVA_VERSION=version, TEST_JAVA_CALLS=str(calls),
                       TEST_FAIL_DB=str(int(fail_db)),
                       TEST_FAIL_SERVER=str(int(fail_server)))
        db_dir = directory / "database with spaces"
        admin_dir = directory / "admin with spaces"
        cmd = ["cmd.exe", "/d", "/c", str(ROOT / "application/admin.bat"),
               "-db-parentdir", str(db_dir), "-admin-dir", str(admin_dir),
               "-java-lib-dir", str(PACKAGED_LIB), mode]
        result = subprocess.run(cmd, cwd=directory, env=env, capture_output=True,
                                text=True, timeout=40)
        return result, calls, db_dir, admin_dir

    def test_java_version_flag_and_server_error(self):
        for version, needs_open in (("1.8.0_333", False), ("11.0.24", False),
                                    ("17.0.12", True), ("21.0.12", True)):
            with self.subTest(version=version), tempfile.TemporaryDirectory(prefix="codeon-win-admin-") as tmp:
                directory = Path(tmp)
                result, calls, _, admin_dir = self.run_admin(
                    directory, version=version, fail_server=True)
                self.assertEqual(24, result.returncode, result.stdout + result.stderr)
                commands = calls.read_text(encoding="utf-8").splitlines()
                self.assertEqual(2, len(commands), commands)
                self.assertTrue(all(("--add-opens" in command) == needs_open
                                    for command in commands), commands)
                self.assertIn(str(PACKAGED_LIB), commands[0])
                self.assertIn("server.ip=127.0.0.1", commands[1])
                self.assertTrue((admin_dir / "logs" / "server.log").is_file())

    def test_database_failure_prevents_server_start(self):
        with tempfile.TemporaryDirectory(prefix="codeon-win-admin-") as tmp:
            result, calls, _, _ = self.run_admin(Path(tmp), fail_db=True)
            self.assertEqual(23, result.returncode, result.stdout + result.stderr)
            self.assertIn("Database creation failed", result.stderr)
            self.assertNotIn("ServerStarter", calls.read_text(encoding="utf-8"))

    def test_existing_incomplete_database_directory_is_not_overwritten(self):
        with tempfile.TemporaryDirectory(prefix="codeon-win-admin-") as tmp:
            directory = Path(tmp)
            (directory / "database with spaces").mkdir()
            result, calls, _, _ = self.run_admin(directory)
            self.assertEqual(12, result.returncode, result.stdout + result.stderr)
            self.assertIn("refusing to overwrite", result.stderr)
            self.assertFalse(calls.exists())

    def test_unknown_java_version_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix="codeon-win-admin-") as tmp:
            result, calls, _, _ = self.run_admin(Path(tmp), version="unknown")
            self.assertEqual(12, result.returncode, result.stdout + result.stderr)
            self.assertFalse(calls.exists())

    def test_real_java_creates_only_temporary_database(self):
        self.assertTrue((PACKAGED_LIB / "OpenRobertaServer.jar").is_file())
        with tempfile.TemporaryDirectory(prefix="codeon-win-admin-real-") as tmp:
            result, _, db_dir, admin_dir = self.run_admin(
                Path(tmp), fake_java=False, mode="create-empty-db")
            log = admin_dir / "logs" / "admin.log"
            self.assertEqual(0, result.returncode,
                             result.stdout + result.stderr +
                             (log.read_text(errors="replace")[-3000:] if log.exists() else ""))
            self.assertTrue((db_dir / "openroberta-db.script").is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
