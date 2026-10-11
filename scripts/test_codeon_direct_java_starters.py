#!/usr/bin/env python3
"""Exercise the legacy Unix launchers without starting a robot or live server."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "application" / "lib"


@unittest.skipUnless(Path("/bin/bash").is_file(), "Unix shell launchers")
class DirectJavaStarterTest(unittest.TestCase):
    def fake_runtime(self, directory, version="21.0.12", fail_db=False, fail_server=False):
        bin_dir = directory / "bin"
        bin_dir.mkdir()
        java = bin_dir / "java"
        java.write_text(
            '#!/bin/sh\n'
            'if [ "$1" = "-version" ]; then\n'
            '  printf \'openjdk version "%s"\\n\' "$TEST_JAVA_VERSION" >&2\n'
            '  exit 0\n'
            'fi\n'
            'printf \'%s|%s\\n\' "$#" "$*" >> "$TEST_JAVA_CALLS"\n'
            'case "$*" in\n'
            '  *create-empty-db*) [ "$TEST_FAIL_DB" = 1 ] && exit 23 ;;\n'
            '  *ServerStarter*) [ "$TEST_FAIL_SERVER" = 1 ] && exit 24 ;;\n'
            'esac\n'
            'exit 0\n',
            encoding="utf-8",
        )
        java.chmod(0o755)
        python = bin_dir / "python3"
        python.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        python.chmod(0o755)
        calls = directory / "java-calls"
        env = dict(os.environ)
        env.update(
            PATH=str(bin_dir) + os.pathsep + env.get("PATH", ""),
            TEST_JAVA_VERSION=version,
            TEST_JAVA_CALLS=str(calls),
            TEST_FAIL_DB=str(int(fail_db)),
            TEST_FAIL_SERVER=str(int(fail_server)),
        )
        return env, calls

    def admin(self, directory, env, command="version", launcher="admin.sh", lib_dir=LIB):
        return subprocess.run(
            ["/bin/bash", str(ROOT / launcher), "-q", "-java-lib-dir", str(lib_dir),
             "-db-parentdir", str(directory / "db"), "-admin-dir", str(directory / "admin"), command],
            cwd=directory, env=env, capture_output=True, text=True, timeout=30,
        )

    def ora(self, directory, env):
        (directory / "OpenRobertaServer").mkdir()
        (directory / "RobotRCX" / "target").mkdir(parents=True)
        shutil.copy2(ROOT / "ora.sh", directory / "ora.sh")
        return subprocess.run(
            ["/bin/bash", "ora.sh", "-dbParentdir", str(directory / "db"),
             "-admin-dir", str(directory / "admin"), "start-from-git"],
            cwd=directory, env=env, capture_output=True, text=True, timeout=15,
        )

    def test_source_and_packaged_admin_scripts_are_identical(self):
        self.assertEqual((ROOT / "admin.sh").read_bytes(), (ROOT / "application/admin.sh").read_bytes())

    def test_java_8_and_11_do_not_receive_module_flag_but_17_and_21_do(self):
        for version, expected_flag in (("1.8.0_333", False), ("11.0.24", False),
                                       ("17.0.12", True), ("21.0.12", True)):
            with self.subTest(version=version), tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
                directory = Path(tmp)
                env, calls = self.fake_runtime(directory, version)
                result = self.admin(directory, env)
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertEqual(expected_flag, "--add-opens java.base/java.lang=ALL-UNNAMED" in calls.read_text())

    def test_admin_failure_is_reported_and_does_not_start_server(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
            directory = Path(tmp)
            env, calls = self.fake_runtime(directory, fail_db=True)
            result = self.admin(directory, env, "start-server")
            self.assertEqual(23, result.returncode, result.stdout + result.stderr)
            self.assertIn("Database creation failed", result.stderr)
            self.assertNotIn("ServerStarter", calls.read_text())

    def test_admin_uses_configured_classpath_and_propagates_server_failure(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
            directory = Path(tmp)
            env, calls = self.fake_runtime(directory, fail_server=True)
            lib_dir = directory / "lib with spaces"
            result = self.admin(directory, env, "start-server", lib_dir=lib_dir)
            self.assertEqual(24, result.returncode, result.stdout + result.stderr)
            commands = calls.read_text().splitlines()
            self.assertEqual(2, len(commands), commands)
            self.assertIn(str(lib_dir / "*"), commands[0])
            self.assertIn(str(lib_dir / "*"), commands[1])
            self.assertTrue(all("--add-opens java.base/java.lang=ALL-UNNAMED" in command for command in commands))
            self.assertTrue(commands[0].startswith("7|"), commands[0])

    def test_unknown_java_version_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
            directory = Path(tmp)
            env, calls = self.fake_runtime(directory, version="unknown")
            result = self.admin(directory, env)
            self.assertEqual(12, result.returncode, result.stdout + result.stderr)
            self.assertFalse(calls.exists())

    def test_ora_uses_java_version_flag_and_propagates_server_failure(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
            directory = Path(tmp)
            env, calls = self.fake_runtime(directory, fail_server=True)
            result = self.ora(directory, env)
            self.assertEqual(24, result.returncode, result.stdout + result.stderr)
            commands = calls.read_text().splitlines()
            self.assertEqual(2, len(commands), commands)
            self.assertTrue(all("--add-opens java.base/java.lang=ALL-UNNAMED" in command for command in commands))
            self.assertIn("server.ip=127.0.0.1", commands[-1])

    def test_ora_does_not_start_server_after_database_failure(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-") as tmp:
            directory = Path(tmp)
            env, calls = self.fake_runtime(directory, fail_db=True)
            result = self.ora(directory, env)
            self.assertEqual(23, result.returncode, result.stdout + result.stderr)
            self.assertNotIn("ServerStarter", calls.read_text())

    @unittest.skipUnless(shutil.which("java") and (LIB / "OpenRobertaServer.jar").is_file(),
                         "Java runtime and packaged CodeON libraries are required")
    def test_real_java_creates_fresh_database_without_touching_live_data(self):
        with tempfile.TemporaryDirectory(prefix="codeon-direct-db-") as tmp:
            directory = Path(tmp)
            result = self.admin(directory, dict(os.environ), "create-empty-db")
            self.assertEqual(0, result.returncode,
                             result.stdout + result.stderr + (directory / "admin/logs/admin.log").read_text())
            self.assertTrue((directory / "db/openroberta-db.script").is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
