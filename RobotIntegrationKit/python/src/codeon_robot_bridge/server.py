from __future__ import annotations

import argparse
import asyncio
import json
import signal
from contextlib import suppress

from .bridge import BridgeSession
from .cozmo_adapter import CozmoAdapter
from .fake_adapter import FakeRobotAdapter


DEFAULT_ORIGINS = ("http://localhost:1999", "http://127.0.0.1:1999")


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
    active_connection = None

    async def handler(connection) -> None:
        nonlocal active_connection
        if active_connection is not None:
            await connection.close(code=1013, reason="another CodeON session is active")
            return
        active_connection = connection
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
                    response = await session.handle(message)
                await connection.send(json.dumps(response, separators=(",", ":")))
        finally:
            await adapter.stop_all()
            active_connection = None

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
            print(f"CodeON robot bridge ({args.adapter}) listening on ws://{args.host}:{args.port}")
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
    return parser.parse_args()


def main() -> None:
    asyncio.run(_serve(_arguments()))


if __name__ == "__main__":
    main()
