from __future__ import annotations

import argparse
import asyncio
import json
import os
import signal
from contextlib import suppress
from datetime import datetime
from pathlib import Path

from .bridge import BridgeSession
from .cozmo_adapter import CozmoAdapter
from .fake_adapter import FakeRobotAdapter


DEFAULT_ORIGINS = ("http://localhost:1999", "http://127.0.0.1:1999")


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

    adapter = FakeRobotAdapter() if args.adapter == "fake" else CozmoAdapter()
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
                                "message": "a newer CodeON view controls the Cozmo bridge",
                            },
                        }
                    else:
                        response = await session.handle(message)
                message_type = message.get("type", "invalid") if isinstance(message, dict) else "invalid"
                if message_type != "heartbeat":
                    if response.get("ok"):
                        _log(f"request {message_type}: ok")
                    else:
                        error = response.get("error", {})
                        _log(
                            f"request {message_type}: {error.get('code', 'ERROR')} - "
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
    parser.add_argument("--adapter", choices=("fake", "cozmo"), default="fake")
    parser.add_argument("--host", default="127.0.0.1", choices=("127.0.0.1", "::1"))
    parser.add_argument("--port", default=2223, type=int)
    parser.add_argument("--origin", action="append", default=list(DEFAULT_ORIGINS))
    parser.add_argument("--pid-file", type=Path)
    return parser.parse_args()


def main() -> None:
    args = _arguments()
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


if __name__ == "__main__":
    main()
