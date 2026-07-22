#!/usr/bin/env python3
"""Build a compact CodeON RCX end-user ZIP from the checked-in application."""

from __future__ import annotations

import argparse
import shutil
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "dist"


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def build_package(version: str, output: Path) -> Path:
    package_name = "CodeON-RCX-" + version
    output.mkdir(parents=True, exist_ok=True)
    zip_path = output / (package_name + ".zip")

    with tempfile.TemporaryDirectory(prefix="codeon-rcx-package-") as tmp:
        package = Path(tmp) / package_name
        shutil.copytree(ROOT / "application", package / "application", ignore=shutil.ignore_patterns("db-embedded"))

        for name in (
            "start-codeon-rcx.py",
            "start-codeon.sh",
            "CodeON-Starten.command",
            "CodeON-Starten.cmd",
            "CodeON-Installation.cmd",
            "RCX-Werkzeuge-installieren.command",
            "RCX-Werkzeuge-installieren.cmd",
            "RCX-Werkzeuge-installieren.sh",
            "LICENSE",
            "NOTICE",
        ):
            copy_file(ROOT / name, package / name)

        copy_file(ROOT / "RCX-ERSTE-SCHRITTE.md", package / "README.md")
        copy_file(ROOT / "RobotRCX/README.md", package / "RobotRCX/README.md")
        copy_file(ROOT / "RobotRCX/rcx-bridge.py", package / "RobotRCX/rcx-bridge.py")
        copy_file(ROOT / "RobotRCX/firmware/.gitignore", package / "RobotRCX/firmware/.gitignore")
        (package / "RobotRCX/bin").mkdir(parents=True, exist_ok=True)
        (package / "VERSION.txt").write_text(version + "\n", encoding="utf-8")

        if zip_path.exists():
            zip_path.unlink()
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(package.rglob("*")):
                if path.is_file():
                    archive.write(path, path.relative_to(package.parent))
    return zip_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the compact CodeON RCX user package")
    parser.add_argument("--version", required=True, help="release label used in folder and ZIP name")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = build_package(args.version, args.output.resolve())
    print(result)
