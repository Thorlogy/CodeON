#!/usr/bin/env python3
"""Conservative hardware gate for the unverified Cozmo adapter."""

import argparse
import asyncio
import json
import socket
import time

from codeon_robot_bridge import BridgeSession, CozmoAdapter


def network_route():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("172.31.1.1", 5551))
        local_address = sock.getsockname()[0]
    except OSError as error:
        return {"robotAddress": "172.31.1.1", "localAddress": None, "onCozmoNetwork": False, "error": str(error)}
    finally:
        sock.close()
    return {
        "robotAddress": "172.31.1.1",
        "localAddress": local_address,
        "onCozmoNetwork": local_address.startswith("172.31.1."),
    }


def error_chain(error):
    chain = []
    current = error
    while current is not None and len(chain) < 5:
        chain.append({"type": type(current).__name__, "message": str(current)})
        current = current.__cause__
    return chain


async def probe(enable_motion: bool, enable_watchdog_test: bool) -> int:
    adapter = CozmoAdapter()
    route = network_route()
    report = {
        "adapter": adapter.manifest.to_dict(),
        "network": route,
        "hardwareVerified": False,
        "safetyNotice": "Connecting may initialize and move Cozmo's head or lift; always use a clear floor.",
        "checks": [],
    }
    try:
        if not route["onCozmoNetwork"]:
            raise RuntimeError("Mac is not connected to Cozmo's Wi-Fi network")
        connection = await adapter.connect()
        report["checks"].append({"name": "connect", "ok": True, "result": connection})
        battery = await adapter.read_sensor("battery", {})
        report["checks"].append({"name": "battery", "ok": True, "value": battery})
        if enable_motion:
            await adapter.execute("drive", {"left": 25, "right": 25})
            await asyncio.sleep(0.25)
            await adapter.stop_all()
            report["checks"].append({"name": "shortMotionAndStop", "ok": True})
        if enable_watchdog_test:
            session = BridgeSession(adapter)
            response = await session.handle(
                {
                    "id": "hardware-watchdog",
                    "version": "1.0",
                    "type": "command",
                    "command": "drive",
                    "params": {"left": 25, "right": 25},
                }
            )
            if not response["ok"]:
                raise RuntimeError(f"watchdog drive command failed: {response}")
            started = time.monotonic()
            stopped = False
            while time.monotonic() - started < 2.0:
                await asyncio.sleep(0.05)
                if await session.watchdog_tick():
                    stopped = True
                    break
            await adapter.stop_all()
            if not stopped:
                raise RuntimeError("watchdog did not stop motion within two seconds")
            report["checks"].append(
                {"name": "watchdogStop", "ok": True, "elapsedSeconds": round(time.monotonic() - started, 3)}
            )
        report["hardwareVerified"] = enable_motion or enable_watchdog_test
        return_code = 0
    except Exception as error:
        report["checks"].append({"name": "probe", "ok": False, "errors": error_chain(error)})
        return_code = 1
    finally:
        try:
            await adapter.stop_all()
            await adapter.disconnect()
        finally:
            print(json.dumps(report, indent=2, sort_keys=True))
    return return_code


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the CodeON Cozmo hardware acceptance probe")
    parser.add_argument(
        "--enable-motion",
        action="store_true",
        help="briefly move Cozmo at low speed; place it on a clear floor first",
    )
    parser.add_argument(
        "--enable-watchdog-test",
        action="store_true",
        help="drive slowly without heartbeat and verify automatic stop after about one second",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(probe(args.enable_motion, args.enable_watchdog_test)))


if __name__ == "__main__":
    main()
