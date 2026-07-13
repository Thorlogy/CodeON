#!/usr/bin/env python3
"""Einsteigerfreundlicher Startassistent fuer CodeON mit LEGO RCX."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
APPLICATION = ROOT / "application"
RUNTIME = ROOT / ".codeon-runtime"
BRIDGE_URL = "http://127.0.0.1:2222"
CODEON_URL = "http://localhost:1999"

HELP_URLS = {
    "python": "https://www.python.org/downloads/",
    "java": "https://adoptium.net/temurin/releases/?version=11",
    "nqc": "https://github.com/BrickBot/nqc",
    "codeon": "https://github.com/Thorlogy/CodeON",
    "firmware": "RobotRCX/README.md#fehlende-rcx-firmware-automatisch-behandeln",
}


def executable(path: Path | None) -> bool:
    return bool(path and path.is_file() and os.access(path, os.X_OK))


def find_nqc() -> Path | None:
    configured = os.environ.get("NQC_PATH")
    candidates = [Path(configured).expanduser()] if configured else []
    binary_name = "nqc.exe" if platform.system() == "Windows" else "nqc"
    candidates.extend(
        [
            ROOT / "RobotRCX" / "bin" / binary_name,
            ROOT.parent / "ora-cc-rsc" / "RobotRCX" / "osx" / "nqc",
            ROOT.parent / "ora-cc-rsc" / "RobotRCX" / "windows" / "nqc.exe",
        ]
    )
    in_path = shutil.which("nqc") or shutil.which("nqc.exe")
    if in_path:
        candidates.append(Path(in_path))
    return next((candidate.resolve() for candidate in candidates if executable(candidate)), None)


def find_firmware() -> Path | None:
    configured = os.environ.get("RCX_FIRMWARE_PATH")
    candidates = [Path(configured).expanduser()] if configured else []
    candidates.extend(
        ROOT / "RobotRCX" / "firmware" / name
        for name in ("FIRM0332.LGO", "FIRM0328.LGO", "firm0332.lgo", "firm0328.lgo")
    )
    return next((candidate.resolve() for candidate in candidates if candidate.is_file()), None)


def java_major_version(java: str | None) -> int | None:
    if not java:
        return None
    try:
        result = subprocess.run(
            [java, "-version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r'version\s+"([0-9]+)(?:\.([0-9]+))?', result.stderr + result.stdout)
    if not match:
        return None
    first = int(match.group(1))
    return int(match.group(2)) if first == 1 and match.group(2) else first


def url_json(url: str, timeout: float = 1.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError, urllib.error.URLError):
        return None


def url_reachable(url: str, timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 500
    except (OSError, urllib.error.URLError):
        return False


def preflight() -> dict:
    nqc = find_nqc()
    firmware = find_firmware()
    java = shutil.which("java")
    java_version = java_major_version(java)
    return {
        "platform": platform.system(),
        "python": {
            "ok": sys.version_info >= (3, 10),
            "value": sys.executable,
            "help": HELP_URLS["python"],
        },
        "java": {
            "ok": bool(java and java_version and java_version >= 8),
            "value": java,
            "version": java_version,
            "help": HELP_URLS["java"],
        },
        "codeon": {
            "ok": (APPLICATION / "lib" / "OpenRobertaServer.jar").is_file()
            and (APPLICATION / "staticResources" / "index.html").is_file(),
            "value": str(APPLICATION),
            "help": HELP_URLS["codeon"],
        },
        "nqc": {
            "ok": nqc is not None,
            "value": str(nqc) if nqc else None,
            "help": HELP_URLS["nqc"],
        },
        "firmware": {
            "ok": firmware is not None,
            "optional": True,
            "value": str(firmware) if firmware else None,
            "help": HELP_URLS["firmware"],
        },
        "bridge": {
            "ok": url_json(BRIDGE_URL + "/status") is not None,
            "value": BRIDGE_URL,
        },
        "server": {
            "ok": url_reachable(CODEON_URL),
            "value": CODEON_URL,
        },
    }


def print_preflight(checks: dict) -> None:
    print("\nCodeON RCX – Startprüfung")
    print("=" * 56)
    labels = {
        "python": "Python 3",
        "java": "Java",
        "codeon": "CodeON-Anwendung",
        "nqc": "NQC-Compiler",
        "firmware": "RCX-Firmwaredatei",
        "bridge": "RCX-Bridge",
        "server": "CodeON-Server",
    }
    for key in labels:
        item = checks[key]
        optional = " (nur bei RCX ohne Firmware)" if item.get("optional") else ""
        if key in ("bridge", "server"):
            state = "LÄUFT" if item["ok"] else "AUS"
        else:
            state = "OK" if item["ok"] else ("HINWEIS" if item.get("optional") else "FEHLT")
        value = " – " + str(item["value"]) if item.get("value") else ""
        if key == "java" and item.get("version"):
            value += f" (Version {item['version']})"
        print(f"[{state:7}] {labels[key]}{optional}{value}")
        if not item["ok"] and item.get("help"):
            print(f"          Hilfe/Download: {item['help']}")
    print("=" * 56)


def required_missing(checks: dict) -> list[str]:
    return [key for key in ("python", "java", "codeon", "nqc") if not checks[key]["ok"]]


def prepare_environment(nqc: Path, firmware: Path | None) -> tuple[dict, Path]:
    env = os.environ.copy()
    env["NQC_PATH"] = str(nqc)
    if firmware:
        env["RCX_FIRMWARE_PATH"] = str(firmware)

    compiler_base = RUNTIME / "crosscompiler"
    system = platform.system()
    if system == "Darwin":
        compiler_target = compiler_base / "RobotRCX" / "osx" / "nqc"
    elif system == "Windows":
        compiler_target = compiler_base / "RobotRCX" / "windows" / "nqc.exe"
    else:
        compiler_target = None
        env["PATH"] = str(nqc.parent) + os.pathsep + env.get("PATH", "")

    if compiler_target:
        compiler_target.parent.mkdir(parents=True, exist_ok=True)
        if not compiler_target.exists() or compiler_target.stat().st_mtime_ns != nqc.stat().st_mtime_ns:
            shutil.copy2(nqc, compiler_target)
            compiler_target.chmod(compiler_target.stat().st_mode | 0o111)
    return env, compiler_base


def wait_for(url: str, process: subprocess.Popen | None, timeout: float, expect_json: bool = True) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        ready = url_json(url, timeout=0.5) is not None if expect_json else url_reachable(url, timeout=0.5)
        if ready:
            return True
        if process and process.poll() is not None:
            return False
        time.sleep(0.25)
    return False


def create_database(java: str, classpath: str, env: dict, log) -> bool:
    db_dir = RUNTIME / "db"
    if (db_dir / "openroberta-db.script").exists():
        return True
    db_dir.mkdir(parents=True, exist_ok=True)
    uri = "jdbc:hsqldb:file:" + str(db_dir / "openroberta-db")
    result = subprocess.run(
        [java, "-cp", classpath, "de.fhg.iais.roberta.main.Administration", "create-empty-db", uri],
        cwd=APPLICATION,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        check=False,
    )
    return result.returncode == 0


def stop_process(process: subprocess.Popen | None) -> None:
    if not process or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def start(args: argparse.Namespace) -> int:
    checks = preflight()
    print_preflight(checks)
    missing = required_missing(checks)
    if missing:
        print("\nCodeON wurde noch nicht gestartet. Installiere bitte die als FEHLT markierten Komponenten.")
        print("Starte danach diese Datei erneut; die Prüfung läuft automatisch noch einmal.")
        return 2
    if args.check:
        print("\nAlle zwingend benötigten Komponenten sind vorhanden.")
        return 0

    RUNTIME.mkdir(parents=True, exist_ok=True)
    logs = RUNTIME / "logs"
    logs.mkdir(exist_ok=True)
    nqc = Path(checks["nqc"]["value"])
    firmware = Path(checks["firmware"]["value"]) if checks["firmware"]["value"] else None
    env, compiler_base = prepare_environment(nqc, firmware)

    bridge_process = None
    server_process = None
    bridge_log_path = logs / "rcx-bridge.log"
    server_log_path = logs / "codeon-server.log"

    try:
        if not checks["bridge"]["ok"]:
            bridge_log = bridge_log_path.open("a", encoding="utf-8")
            bridge_process = subprocess.Popen(
                [sys.executable, "-u", str(ROOT / "RobotRCX" / "rcx-bridge.py")],
                cwd=ROOT,
                env=env,
                stdout=bridge_log,
                stderr=subprocess.STDOUT,
            )
            if not wait_for(BRIDGE_URL + "/status", bridge_process, 8):
                print(f"\nDie RCX-Bridge konnte nicht gestartet werden. Protokoll: {bridge_log_path}")
                return 3
            print(f"\nRCX-Bridge läuft: {BRIDGE_URL}")
        else:
            print(f"\nRCX-Bridge läuft bereits: {BRIDGE_URL}")

        if args.bridge_only:
            print("Bridge-Modus aktiv. Zum Beenden Strg+C drücken.")
            while bridge_process and bridge_process.poll() is None:
                time.sleep(0.5)
            return 0

        if checks["server"]["ok"]:
            print(f"CodeON läuft bereits: {CODEON_URL}")
            if not args.no_browser:
                webbrowser.open(CODEON_URL)
            if bridge_process:
                print("Dieses Fenster offen lassen. Zum Beenden der Bridge Strg+C drücken.")
                while bridge_process.poll() is None:
                    time.sleep(0.5)
            return 0

        java = checks["java"]["value"]
        classpath = str(APPLICATION / "lib" / "*")
        server_log = server_log_path.open("a", encoding="utf-8")
        if not create_database(java, classpath, env, server_log):
            print(f"Die lokale CodeON-Datenbank konnte nicht vorbereitet werden. Protokoll: {server_log_path}")
            return 4

        server_command = [
            java,
            "-cp",
            classpath,
            "de.fhg.iais.roberta.main.ServerStarter",
            "-d",
            "database.mode=embedded",
            "-d",
            "database.parentdir=" + str(RUNTIME / "db"),
            "-d",
            "database.name=openroberta-db",
            "-d",
            "server.staticresources.dir=" + str(APPLICATION / "staticResources"),
            "-d",
            "server.admin.dir=" + str(RUNTIME / "admin"),
            "-d",
            "robot.crosscompiler.resourcebase=" + str(compiler_base),
        ]
        server_process = subprocess.Popen(
            server_command,
            cwd=APPLICATION,
            env=env,
            stdout=server_log,
            stderr=subprocess.STDOUT,
        )
        if not wait_for(CODEON_URL, server_process, 30, expect_json=False):
            print(f"\nCodeON konnte nicht gestartet werden. Protokoll: {server_log_path}")
            return 5

        print(f"CodeON ist bereit: {CODEON_URL}")
        print("Dieses Fenster offen lassen. Zum Beenden von CodeON Strg+C drücken.")
        if not firmware:
            print("Hinweis: Eine Firmwaredatei wird nur benötigt, falls auf dem RCX keine Firmware installiert ist.")
        if not args.no_browser:
            webbrowser.open(CODEON_URL)
        return server_process.wait()
    except KeyboardInterrupt:
        print("\nCodeON und RCX-Bridge werden beendet …")
        return 0
    finally:
        stop_process(server_process)
        stop_process(bridge_process)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CodeON und die lokale RCX-Bridge einfach starten")
    parser.add_argument("--check", action="store_true", help="nur prüfen, nichts starten")
    parser.add_argument("--bridge-only", action="store_true", help="nur die RCX-Bridge starten")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch öffnen")
    parser.add_argument("--json", action="store_true", help="Prüfergebnis als JSON ausgeben")
    return parser.parse_args()


def raise_keyboard_interrupt() -> None:
    raise KeyboardInterrupt


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.json:
        print(json.dumps(preflight(), indent=2, ensure_ascii=False))
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, lambda _signum, _frame: raise_keyboard_interrupt())
    raise SystemExit(start(arguments))
