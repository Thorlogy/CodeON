#!/usr/bin/env python3
"""Einsteigerfreundlicher Startassistent für CodeON und lokale Roboter-Bridges."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import signal
import socket
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
COZMO_BRIDGE_HOST = "127.0.0.1"
COZMO_BRIDGE_PORT = 2223
COZMO_BRIDGE_PID_FILE = RUNTIME / "cozmo-bridge.pid"
APITOR_BRIDGE_PORT = 2224
APITOR_BRIDGE_PID_FILE = RUNTIME / "apitor-bridge.pid"
CODEON_URL = "http://localhost:1999"
CODEON_SERVER_PID_FILE = RUNTIME / "codeon-server.pid"
SUPPORTED_ROBOTS = ("rcx", "edisonv2", "rcj", "cozmo", "apitor")

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


def codeon_browser_url() -> str:
    """Open the current frontend entry point without reusing stale index HTML."""
    index = APPLICATION / "staticResources" / "index.html"
    try:
        version = index.stat().st_mtime_ns
    except OSError:
        version = time.time_ns()
    return f"{CODEON_URL}/?v={version}"


def tcp_reachable(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def websocket_reachable(host: str, port: int, timeout: float = 0.5) -> bool:
    """Probe a local WebSocket without producing an invalid-handshake traceback."""
    request = (
        f"GET / HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\n"
        "Connection: Upgrade\r\nSec-WebSocket-Key: MDEyMzQ1Njc4OWFiY2RlZg==\r\n"
        "Sec-WebSocket-Version: 13\r\nOrigin: http://localhost:1999\r\n\r\n"
    ).encode("ascii")
    try:
        with socket.create_connection((host, port), timeout=timeout) as connection:
            connection.sendall(request)
            response = connection.recv(512)
            if not response.startswith(b"HTTP/1.1 101"):
                return False
            connection.sendall(b"\x88\x80\x00\x00\x00\x00")
            return True
    except OSError:
        return False


def find_cozmo_python() -> Path | None:
    candidates = [
        ROOT / ".venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python"),
        ROOT / ".codeon-cozmo-venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python"),
        Path(sys.executable),
    ]
    for candidate in candidates:
        if not executable(candidate):
            continue
        check = subprocess.run(
            [str(candidate), "-c", "import pycozmo, websockets"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if check.returncode == 0:
            return candidate
    return None


def find_apitor_python() -> Path | None:
    candidates = [
        ROOT / ".venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python"),
        Path(sys.executable),
    ]
    for candidate in candidates:
        if not executable(candidate):
            continue
        check = subprocess.run(
            [str(candidate), "-c", "import bleak, websockets"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if check.returncode == 0:
            return candidate
    return None


def wait_for_websocket(host: str, port: int, process: subprocess.Popen | None, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if websocket_reachable(host, port):
            return True
        if process and process.poll() is not None:
            return False
        time.sleep(0.2)
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
            "optional": True,
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
    print("\nCodeON – Startprüfung")
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
        optional = " (für RCX)" if key == "nqc" else (" (nur bei RCX ohne Firmware)" if item.get("optional") else "")
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
    return [key for key in ("python", "java", "codeon") if not checks[key]["ok"]]


def prepare_environment(nqc: Path | None, firmware: Path | None) -> tuple[dict, Path]:
    env = os.environ.copy()
    if nqc:
        env["NQC_PATH"] = str(nqc)
    if firmware:
        env["RCX_FIRMWARE_PATH"] = str(firmware)

    compiler_base = RUNTIME / "crosscompiler"
    system = platform.system()
    if not nqc:
        compiler_target = None
    elif system == "Darwin":
        compiler_target = compiler_base / "RobotRCX" / "osx" / "nqc"
    elif system == "Windows":
        compiler_target = compiler_base / "RobotRCX" / "windows" / "nqc.exe"
    else:
        compiler_target = None
        env["PATH"] = str(nqc.parent) + os.pathsep + env.get("PATH", "")

    if nqc and compiler_target:
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


def process_command(pid: int) -> str:
    """Return a best-effort command line for a process without extra dependencies."""
    if platform.system() == "Windows":
        command = [
            "powershell",
            "-NoProfile",
            "-Command",
            f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine",
        ]
    else:
        command = ["ps", "-p", str(pid), "-o", "command="]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=3, check=False)
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout.strip()


def stop_previous_cozmo_bridge() -> None:
    """Stop only a bridge previously started and recorded by this launcher."""
    try:
        pid = int(COZMO_BRIDGE_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return

    command = process_command(pid)
    if "codeon_robot_bridge.server" not in command or "--adapter cozmo" not in command:
        COZMO_BRIDGE_PID_FILE.unlink(missing_ok=True)
        return

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    except OSError:
        return

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and websocket_reachable(COZMO_BRIDGE_HOST, COZMO_BRIDGE_PORT):
        time.sleep(0.1)
    COZMO_BRIDGE_PID_FILE.unlink(missing_ok=True)


def stop_previous_apitor_bridge() -> None:
    """Stop only an Apitor bridge previously started by this launcher."""
    try:
        pid = int(APITOR_BRIDGE_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return
    command = process_command(pid)
    if "codeon_robot_bridge.server" not in command or "--adapter apitor" not in command:
        APITOR_BRIDGE_PID_FILE.unlink(missing_ok=True)
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    except OSError:
        return
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and websocket_reachable(COZMO_BRIDGE_HOST, APITOR_BRIDGE_PORT):
        time.sleep(0.1)
    APITOR_BRIDGE_PID_FILE.unlink(missing_ok=True)


def stop_previous_codeon_server() -> None:
    """Stop only a CodeON server previously recorded by this launcher."""
    try:
        pid = int(CODEON_SERVER_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        pid = None

    # Older launcher versions did not record the server PID. Recover it from
    # the local listening port once, then apply the same strict command check.
    if pid is None and platform.system() != "Windows" and shutil.which("lsof"):
        try:
            result = subprocess.run(
                ["lsof", "-nP", "-iTCP:1999", "-sTCP:LISTEN", "-t"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            candidates = [int(value) for value in result.stdout.split() if value.isdigit()]
            pid = candidates[0] if len(candidates) == 1 else None
        except (OSError, ValueError, subprocess.SubprocessError):
            pid = None
    if pid is None:
        return

    command = process_command(pid)
    expected_application = str(APPLICATION.resolve())
    if "de.fhg.iais.roberta.main.ServerStarter" not in command or expected_application not in command:
        CODEON_SERVER_PID_FILE.unlink(missing_ok=True)
        return

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    except OSError:
        return

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and url_reachable(CODEON_URL, timeout=0.2):
        time.sleep(0.1)
    CODEON_SERVER_PID_FILE.unlink(missing_ok=True)


def restart_owned_codeon_server(bridge_only: bool) -> None:
    """Restart the recorded local server only for a full launcher start."""
    if not bridge_only:
        stop_previous_codeon_server()


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
    nqc = Path(checks["nqc"]["value"]) if checks["nqc"]["value"] else None
    firmware = Path(checks["firmware"]["value"]) if checks["firmware"]["value"] else None
    env, compiler_base = prepare_environment(nqc, firmware)

    bridge_process = None
    cozmo_bridge_process = None
    apitor_bridge_process = None
    server_process = None
    bridge_log_path = logs / "rcx-bridge.log"
    cozmo_bridge_log_path = logs / "cozmo-bridge.log"
    apitor_bridge_log_path = logs / "apitor-bridge.log"
    server_log_path = logs / "codeon-server.log"

    try:
        # A second launch is an explicit restart request. This ensures updated
        # robot plug-ins are actually reloaded instead of silently reusing an
        # older Java process.
        restart_owned_codeon_server(args.bridge_only)
        checks["server"]["ok"] = url_reachable(CODEON_URL)

        if not nqc:
            print("\nRCX-Bridge wird nicht gestartet, weil NQC fehlt. Cozmo und die übrigen Systeme sind verfügbar.")
        elif not checks["bridge"]["ok"]:
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

        external_cozmo_bridge = os.environ.get("CODEON_COZMO_BRIDGE_EXTERNAL") == "1"
        if not external_cozmo_bridge:
            stop_previous_cozmo_bridge()
        if websocket_reachable(COZMO_BRIDGE_HOST, COZMO_BRIDGE_PORT):
            if external_cozmo_bridge:
                print(f"Cozmo-Bridge läuft: ws://{COZMO_BRIDGE_HOST}:{COZMO_BRIDGE_PORT}")
            else:
                print(
                    "Cozmo-Bridge läuft bereits, wurde aber nicht von diesem Startfenster gestartet. "
                    "Sie wird aus Sicherheitsgründen nicht beendet."
                )
        elif external_cozmo_bridge:
            print(
                "Cozmo-Bridge konnte im Terminal-Kontext nicht gestartet werden. "
                f"Protokoll: {cozmo_bridge_log_path}"
            )
        elif platform.system() == "Darwin":
            print(
                "Cozmo-Bridge wurde auf macOS nicht im Hintergrund gestartet. "
                "Bitte CodeON über CodeON-Starten.command öffnen, damit macOS den Zugriff "
                "auf Cozmos lokales WLAN dem richtigen Terminal-Kontext erlaubt."
            )
        else:
            cozmo_python = find_cozmo_python()
            if cozmo_python:
                cozmo_env = env.copy()
                source_path = str(ROOT / "RobotIntegrationKit" / "python" / "src")
                cozmo_env["PYTHONPATH"] = source_path + os.pathsep + cozmo_env.get("PYTHONPATH", "")
                cozmo_bridge_process = subprocess.Popen(
                    [
                        str(cozmo_python),
                        "-u",
                        "-m",
                        "codeon_robot_bridge.server",
                        "--adapter",
                        "cozmo",
                        "--pid-file",
                        str(COZMO_BRIDGE_PID_FILE),
                        "--log-file",
                        str(cozmo_bridge_log_path),
                    ],
                    cwd=ROOT,
                    env=cozmo_env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.STDOUT,
                )
                COZMO_BRIDGE_PID_FILE.write_text(str(cozmo_bridge_process.pid), encoding="utf-8")
                if wait_for_websocket(COZMO_BRIDGE_HOST, COZMO_BRIDGE_PORT, cozmo_bridge_process, 8):
                    print(f"Cozmo-Bridge läuft: ws://{COZMO_BRIDGE_HOST}:{COZMO_BRIDGE_PORT}")
                else:
                    stop_process(cozmo_bridge_process)
                    cozmo_bridge_process = None
                    print(f"Cozmo-Bridge konnte nicht gestartet werden. Protokoll: {cozmo_bridge_log_path}")
            else:
                print("Hinweis: Cozmo-Unterstützung ist noch nicht installiert; die übrigen Roboter bleiben verfügbar.")

        stop_previous_apitor_bridge()
        if websocket_reachable(COZMO_BRIDGE_HOST, APITOR_BRIDGE_PORT):
            print(f"Apitor-Bridge läuft bereits: ws://{COZMO_BRIDGE_HOST}:{APITOR_BRIDGE_PORT}")
        else:
            apitor_python = find_apitor_python()
            if apitor_python:
                apitor_env = env.copy()
                source_path = str(ROOT / "RobotIntegrationKit" / "python" / "src")
                apitor_env["PYTHONPATH"] = source_path + os.pathsep + apitor_env.get("PYTHONPATH", "")
                apitor_bridge_process = subprocess.Popen(
                    [
                        str(apitor_python), "-u", "-m", "codeon_robot_bridge.server",
                        "--adapter", "apitor", "--port", str(APITOR_BRIDGE_PORT),
                        "--pid-file", str(APITOR_BRIDGE_PID_FILE),
                        "--log-file", str(apitor_bridge_log_path),
                    ],
                    cwd=ROOT, env=apitor_env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
                )
                APITOR_BRIDGE_PID_FILE.write_text(str(apitor_bridge_process.pid), encoding="utf-8")
                if wait_for_websocket(COZMO_BRIDGE_HOST, APITOR_BRIDGE_PORT, apitor_bridge_process, 8):
                    print(f"Apitor-Bridge läuft: ws://{COZMO_BRIDGE_HOST}:{APITOR_BRIDGE_PORT}")
                else:
                    stop_process(apitor_bridge_process)
                    apitor_bridge_process = None
                    print(f"Apitor-Bridge konnte nicht gestartet werden. Protokoll: {apitor_bridge_log_path}")
            else:
                print("Hinweis: Apitor-Unterstützung ist nicht installiert; installiere bleak und websockets in .venv.")

        if args.bridge_only:
            print("Bridge-Modus aktiv. Zum Beenden Strg+C drücken.")
            while any(process and process.poll() is None for process in (bridge_process, cozmo_bridge_process, apitor_bridge_process)) or (
                external_cozmo_bridge and websocket_reachable(COZMO_BRIDGE_HOST, COZMO_BRIDGE_PORT)
            ):
                time.sleep(0.5)
            return 0

        if checks["server"]["ok"]:
            print(f"CodeON läuft bereits: {CODEON_URL}")
            if not args.no_browser:
                webbrowser.open(codeon_browser_url())
            if bridge_process or cozmo_bridge_process or apitor_bridge_process or external_cozmo_bridge:
                print("Dieses Fenster offen lassen. Zum Beenden der Bridges Strg+C drücken.")
                while any(process and process.poll() is None for process in (bridge_process, cozmo_bridge_process, apitor_bridge_process)) or (
                    external_cozmo_bridge and websocket_reachable(COZMO_BRIDGE_HOST, COZMO_BRIDGE_PORT)
                ):
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
            "server.ip=127.0.0.1",
            "-d",
            "server.admin.dir=" + str(RUNTIME / "admin"),
            "-d",
            "robot.crosscompiler.resourcebase=" + str(compiler_base),
            "-d",
            "robot.whitelist=" + ",".join(SUPPORTED_ROBOTS),
            "-d",
            "robot.default=rcx",
        ]
        server_process = subprocess.Popen(
            server_command,
            cwd=APPLICATION,
            env=env,
            stdout=server_log,
            stderr=subprocess.STDOUT,
        )
        CODEON_SERVER_PID_FILE.write_text(str(server_process.pid), encoding="utf-8")
        if not wait_for(CODEON_URL, server_process, 30, expect_json=False):
            print(f"\nCodeON konnte nicht gestartet werden. Protokoll: {server_log_path}")
            return 5

        print(f"CodeON ist bereit: {CODEON_URL}")
        print("Dieses Fenster offen lassen. RCX-, Cozmo- und Apitor-Bridge laufen automatisch im Hintergrund.")
        if not firmware:
            print("Hinweis: Eine Firmwaredatei wird nur benötigt, falls auf dem RCX keine Firmware installiert ist.")
        if not args.no_browser:
            webbrowser.open(codeon_browser_url())
        return server_process.wait()
    except KeyboardInterrupt:
        print("\nCodeON und die Roboter-Bridges werden beendet …")
        return 0
    finally:
        stop_process(server_process)
        if server_process:
            try:
                recorded_server_pid = int(CODEON_SERVER_PID_FILE.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                recorded_server_pid = None
            if recorded_server_pid == server_process.pid:
                CODEON_SERVER_PID_FILE.unlink(missing_ok=True)
        stop_process(cozmo_bridge_process)
        if cozmo_bridge_process:
            try:
                recorded_pid = int(COZMO_BRIDGE_PID_FILE.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                recorded_pid = None
            if recorded_pid == cozmo_bridge_process.pid:
                COZMO_BRIDGE_PID_FILE.unlink(missing_ok=True)
        stop_process(apitor_bridge_process)
        if apitor_bridge_process:
            try:
                recorded_pid = int(APITOR_BRIDGE_PID_FILE.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                recorded_pid = None
            if recorded_pid == apitor_bridge_process.pid:
                APITOR_BRIDGE_PID_FILE.unlink(missing_ok=True)
        stop_process(bridge_process)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CodeON und die lokalen Roboter-Bridges einfach starten")
    parser.add_argument("--check", action="store_true", help="nur prüfen, nichts starten")
    parser.add_argument("--bridge-only", action="store_true", help="nur die lokalen Roboter-Bridges starten")
    parser.add_argument("--no-browser", action="store_true", help="Browser nicht automatisch öffnen")
    parser.add_argument("--json", action="store_true", help="Prüfergebnis als JSON ausgeben")
    parser.add_argument("--stop-running-server", action="store_true", help=argparse.SUPPRESS)
    return parser.parse_args()


def raise_keyboard_interrupt() -> None:
    raise KeyboardInterrupt


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.stop_running_server:
        stop_previous_codeon_server()
        stop_previous_cozmo_bridge()
        stop_previous_apitor_bridge()
        raise SystemExit(0)
    if arguments.json:
        print(json.dumps(preflight(), indent=2, ensure_ascii=False))
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, lambda _signum, _frame: raise_keyboard_interrupt())
    raise SystemExit(start(arguments))
