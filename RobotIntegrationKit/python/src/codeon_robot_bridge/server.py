from __future__ import annotations

import argparse
import asyncio
import json
import os
import platform
import signal
import sys
import threading
from contextlib import suppress
from datetime import datetime
from pathlib import Path
from typing import TextIO

from .bridge import BridgeSession
from .apitor_adapter import ApitorAdapter
from .cozmo_adapter import CozmoAdapter
from .fake_adapter import FakeRobotAdapter


DEFAULT_ORIGINS = ("http://localhost:1999", "http://127.0.0.1:1999")
DEFAULT_LOG_MAX_BYTES = 10 * 1024 * 1024
DEFAULT_LOG_BACKUP_COUNT = 3


class RotatingTextStream:
    """Thread-safe text stream with bounded numbered log backups."""

    def __init__(self, path: Path, max_bytes: int, backup_count: int) -> None:
        if max_bytes < 1:
            raise ValueError("max_bytes must be positive")
        if backup_count < 1:
            raise ValueError("backup_count must be positive")
        self.path = path
        self.max_bytes = max_bytes
        self.backup_count = backup_count
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._stream: TextIO = self.path.open("a", encoding="utf-8")

    @property
    def encoding(self) -> str:
        return "utf-8"

    def isatty(self) -> bool:
        return False

    def writable(self) -> bool:
        return True

    def write(self, text: str) -> int:
        if not text:
            return 0
        encoded_size = len(text.encode(self.encoding, errors="replace"))
        with self._lock:
            self._stream.flush()
            current_size = self.path.stat().st_size if self.path.exists() else 0
            if current_size and current_size + encoded_size > self.max_bytes:
                self._rotate()
            written = self._stream.write(text)
            self._stream.flush()
            return written

    def flush(self) -> None:
        with self._lock:
            self._stream.flush()

    def close(self) -> None:
        with self._lock:
            if not self._stream.closed:
                self._stream.flush()
                self._stream.close()

    def _rotate(self) -> None:
        self._stream.close()
        oldest = self.path.with_name(f"{self.path.name}.{self.backup_count}")
        oldest.unlink(missing_ok=True)
        for index in range(self.backup_count - 1, 0, -1):
            source = self.path.with_name(f"{self.path.name}.{index}")
            if source.exists():
                source.replace(self.path.with_name(f"{self.path.name}.{index + 1}"))
        if self.path.exists():
            self.path.replace(self.path.with_name(f"{self.path.name}.1"))
        self._stream = self.path.open("a", encoding="utf-8")


def _log(message: str) -> None:
    """Write concise diagnostics to the starter-managed bridge log."""
    timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
    print(f"[{timestamp}] {message}", flush=True)


async def _watchdog(session: BridgeSession, stop: asyncio.Event) -> None:
    while not stop.is_set():
        await asyncio.sleep(0.1)
        await session.watchdog_tick()


async def _serve(args: argparse.Namespace) -> None:
    try:
        from websockets.asyncio.server import serve
    except ImportError as error:
        raise SystemExit("Install the server extra: pip install -e '.[server]'") from error

    if args.adapter == "fake":
        adapter = FakeRobotAdapter()
    elif args.adapter == "apitor":
        adapter = ApitorAdapter(args.device)
    else:
        adapter = CozmoAdapter()
    session = BridgeSession(adapter)
    stopped = asyncio.Event()
    watchdog_task = asyncio.create_task(_watchdog(session, stopped))
    connections = set()
    active_connection = None

    async def handler(connection) -> None:
        nonlocal active_connection
        connections.add(connection)
        active_connection = connection
        _log(f"browser connection opened; newest session selected ({len(connections)} open)")
        try:
            async for raw_message in connection:
                try:
                    message = json.loads(raw_message)
                except (json.JSONDecodeError, TypeError):
                    response = {
                        "id": None,
                        "ok": False,
                        "error": {"code": "PROTOCOL_ERROR", "message": "message must be valid JSON"},
                    }
                else:
                    if message.get("type") == "connect" and connection is not active_connection:
                        response = {
                            "id": message.get("id"),
                            "ok": False,
                            "error": {
                                "code": "SESSION_REPLACED",
                                "message": "a newer CodeON view controls this robot bridge",
                            },
                        }
                    else:
                        response = await session.handle(message)
                message_type = message.get("type", "invalid") if isinstance(message, dict) else "invalid"
                if not response.get("ok") or message_type not in {"heartbeat", "sensor", "status"}:
                    request_name = message_type
                    if message_type == "command":
                        request_name += f"/{message.get('command', 'unknown')}"
                    elif message_type == "sensor":
                        request_name += f"/{message.get('sensor', 'unknown')}"
                    if response.get("ok"):
                        _log(f"request {request_name}: ok")
                    else:
                        error = response.get("error", {})
                        _log(
                            f"request {request_name}: {error.get('code', 'ERROR')} - "
                            f"{error.get('message', 'unknown error')}"
                        )
                await connection.send(json.dumps(response, separators=(",", ":")))
        finally:
            connections.discard(connection)
            if connection is active_connection:
                active_connection = None
                await adapter.stop_all()
                _log(f"controlling browser connection closed; motors stopped ({len(connections)} open)")
            else:
                _log(f"superseded browser connection closed ({len(connections)} open)")

    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        with suppress(NotImplementedError):
            loop.add_signal_handler(signal_name, stopped.set)

    try:
        async with serve(
            handler,
            args.host,
            args.port,
            origins=args.origin,
            max_size=64 * 1024,
            max_queue=16,
            ping_interval=20,
            ping_timeout=10,
        ):
            _log(f"CodeON robot bridge ({args.adapter}) listening on ws://{args.host}:{args.port}")
            await stopped.wait()
    finally:
        stopped.set()
        await adapter.stop_all()
        await adapter.disconnect()
        watchdog_task.cancel()
        with suppress(asyncio.CancelledError):
            await watchdog_task


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CodeON local robot bridge")
    parser.add_argument("--adapter", choices=("fake", "cozmo", "apitor"), default="fake")
    parser.add_argument("--device", help="optional vendor device identifier (for example macOS BLE UUID)")
    parser.add_argument("--host", default="127.0.0.1", choices=("127.0.0.1", "::1"))
    parser.add_argument("--port", default=2223, type=int)
    parser.add_argument("--origin", action="append", default=list(DEFAULT_ORIGINS))
    parser.add_argument("--pid-file", type=Path)
    parser.add_argument("--log-file", type=Path)
    parser.add_argument("--log-max-bytes", type=int, default=DEFAULT_LOG_MAX_BYTES)
    parser.add_argument("--log-backup-count", type=int, default=DEFAULT_LOG_BACKUP_COUNT)
    return parser.parse_args()


def _validate_launch_context(args: argparse.Namespace) -> None:
    if (
        args.adapter == "cozmo"
        and platform.system() == "Darwin"
        and os.environ.get("CODEON_COZMO_TERMINAL_LAUNCH") != "1"
    ):
        raise SystemExit(
            "Cozmo-Bridge auf macOS bitte über CodeON-Starten.command oder "
            "CodeON-Cozmo-Bridge-starten.command öffnen. Nur dieser Terminal-Start "
            "erhält zuverlässig die Berechtigung für Cozmos lokales WLAN."
        )


def main() -> None:
    args = _arguments()
    _validate_launch_context(args)
    log_stream = None
    previous_stdout = sys.stdout
    previous_stderr = sys.stderr
    if args.log_file:
        try:
            log_stream = RotatingTextStream(args.log_file, args.log_max_bytes, args.log_backup_count)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        sys.stdout = log_stream
        sys.stderr = log_stream
    if args.pid_file:
        args.pid_file.parent.mkdir(parents=True, exist_ok=True)
        args.pid_file.write_text(str(os.getpid()), encoding="utf-8")
    try:
        asyncio.run(_serve(args))
    finally:
        if args.pid_file:
            try:
                recorded_pid = int(args.pid_file.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                recorded_pid = None
            if recorded_pid == os.getpid():
                args.pid_file.unlink(missing_ok=True)
        if log_stream:
            sys.stdout = previous_stdout
            sys.stderr = previous_stderr
            log_stream.close()


if __name__ == "__main__":
    main()
