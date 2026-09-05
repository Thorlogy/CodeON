#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json

from codeon_robot_bridge.tinkerbot_adapter import TinkerbotAdapter


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bounded current eXperiBot/T2BOT hardware gate; no motor command is generated"
    )
    parser.add_argument("--device", help="optional BLE device identifier from the read-only probe")
    parser.add_argument(
        "--enable-script-test",
        action="store_true",
        help="upload and start a print-only Python program, then terminate it",
    )
    return parser.parse_args()


async def _run(args: argparse.Namespace) -> dict:
    adapter = TinkerbotAdapter(args.device)
    report = {
        "motorCommandsGenerated": False,
        "scriptUploaded": False,
        "scriptStarted": False,
        "scriptStopped": False,
    }
    try:
        report["connection"] = await adapter.connect()
        report["status"] = await adapter.status()
        if args.enable_script_test:
            source = "print('CodeON eXperiBot/T2BOT bridge test')\n"
            await adapter.execute("runProgram", {"source": source})
            report["scriptUploaded"] = True
            report["scriptStarted"] = True
            await asyncio.sleep(0.5)
            await adapter.stop_all()
            report["scriptStopped"] = True
    finally:
        await adapter.disconnect()
    return report


def main() -> None:
    args = _arguments()
    try:
        report = asyncio.run(_run(args))
    except Exception as error:
        raise SystemExit(f"eXperiBot/T2BOT hardware gate failed: {type(error).__name__}: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
