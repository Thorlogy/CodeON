import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
PACKAGER_PATH = ROOT / "scripts" / "build-codeon-rcx-package.py"
SPEC = importlib.util.spec_from_file_location("build_codeon_rcx_installation_package", PACKAGER_PATH)
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)


class RcxInstallationTest(unittest.TestCase):

    def test_windows_nqc_download_is_pinned_and_verified(self):
        installer = (ROOT / "RCX-Werkzeuge-installieren.cmd").read_text(encoding="ascii")
        self.assertIn("/BrickBot/nqc/releases/download/v3.1-r6/nqc-win-3.1-r6.zip", installer)
        self.assertIn("fb34f75e45e60e36d4d77ff1a851869c9839c5e722a9e186e7a9d488cb7fa957", installer)
        self.assertIn("Get-FileHash", installer)
        self.assertIn("exit /b %RESULT%", installer)

    def test_linux_usb_rule_is_not_world_writable(self):
        installer = (ROOT / "RCX-Werkzeuge-installieren.sh").read_text(encoding="ascii")
        self.assertIn('MODE="0660"', installer)
        self.assertIn('TAG+="uaccess"', installer)
        self.assertNotIn('MODE="0666"', installer)

    def test_compact_package_contains_installers_but_not_nqc_or_firmware(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive_path = PACKAGER.build_package("installation-test", Path(tmp))
            with zipfile.ZipFile(archive_path) as archive:
                names = set(archive.namelist())

        prefix = "CodeON-RCX-installation-test/"
        self.assertIn(prefix + "CodeON-Installation.cmd", names)
        self.assertIn(prefix + "RCX-Werkzeuge-installieren.cmd", names)
        self.assertIn(prefix + "RCX-Werkzeuge-installieren.sh", names)
        self.assertFalse(any(name.lower().endswith("/robotrcx/bin/nqc.exe") for name in names))
        self.assertFalse(any(name.lower().endswith(".lgo") for name in names))


if __name__ == "__main__":
    unittest.main()
