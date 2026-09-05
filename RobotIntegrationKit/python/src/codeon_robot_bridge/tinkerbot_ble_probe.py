from __future__ import annotations

import argparse
import asyncio
import json
import platform
from collections.abc import Iterable
from typing import Any


def candidate_reasons(name: str | None, service_uuids: Iterable[str]) -> list[str]:
    """Return discovery hints without claiming protocol compatibility."""
    # Keep the advertised UUIDs in the signature for future *verified* matching.
    # An arbitrary BLE service is not identity evidence by itself.
    _ = tuple(service_uuids)
    normalized_name = (name or "").strip().lower()
    reasons = []
    if normalized_name == "t2bot":
        reasons.append("verified current-app name 'T2BOT'")
    if normalized_name.startswith("🤖 experibot") or normalized_name.startswith(
        "experibot"
    ):
        reasons.append("verified current-app eXperiBot name prefix")
    if "tinkerbot" in normalized_name:
        reasons.append("legacy discovery hint contains 'tinkerbot'")
    if "powerbrain" in normalized_name or "power brain" in normalized_name:
        reasons.append("legacy discovery hint contains 'powerbrain'")
    return reasons


def candidate_generation(name: str | None) -> str | None:
    """Classify names only where the generation distinction is explicit."""
    normalized_name = (name or "").strip().lower()
    if (
        normalized_name == "t2bot"
        or normalized_name.startswith("🤖 experibot")
        or normalized_name.startswith("experibot")
    ):
        return "experibot-t2-current-app"
    if "tinkerbot" in normalized_name or "powerbrain" in normalized_name or "power brain" in normalized_name:
        return "legacy-powerbrain-protocol-unknown"
    return None


def _load_bleak():
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as error:
        raise RuntimeError(
            "Bleak is not installed. Install the Tinkerbot diagnostic extra with "
            "'.venv/bin/pip install -e \"RobotIntegrationKit/python[experibot-research]\"'."
        ) from error
    return BleakClient, BleakScanner


def _device_report(device: Any, advertisement: Any) -> dict[str, Any]:
    service_uuids = sorted(str(uuid).lower() for uuid in (advertisement.service_uuids or []))
    name = advertisement.local_name or device.name
    return {
        "identifier": device.address,
        "name": name,
        "rssi": advertisement.rssi,
        "serviceUuids": service_uuids,
        "manufacturerData": {
            str(company_id): bytes(value).hex()
            for company_id, value in sorted(advertisement.manufacturer_data.items())
        },
        "serviceData": {
            str(uuid).lower(): bytes(value).hex()
            for uuid, value in sorted(advertisement.service_data.items())
        },
        "candidateReasons": candidate_reasons(name, service_uuids),
        "candidateGeneration": candidate_generation(name),
    }


async def scan(timeout: float) -> dict[str, Any]:
    _, scanner_type = _load_bleak()
    discovered = await scanner_type.discover(timeout=timeout, return_adv=True)
    devices = [_device_report(device, advertisement) for device, advertisement in discovered.values()]
    devices.sort(
        key=lambda item: (
            not bool(item["candidateReasons"]),
            -(item["rssi"] or -999),
            item["name"] or "",
        )
    )
    return {
        "mode": "scan-only",
        "platform": platform.platform(),
        "writesPerformed": False,
        "deviceCount": len(devices),
        "devices": devices,
    }


async def inspect(identifier: str, timeout: float) -> dict[str, Any]:
    client_type, _ = _load_bleak()
    services_report = []
    async with client_type(identifier, timeout=timeout) as client:
        for service in client.services:
            characteristics = []
            for characteristic in service.characteristics:
                characteristics.append(
                    {
                        "uuid": str(characteristic.uuid).lower(),
                        "description": characteristic.description,
                        "properties": sorted(characteristic.properties),
                        "descriptors": [
                            {
                                "uuid": str(descriptor.uuid).lower(),
                                "description": descriptor.description,
                                "handle": descriptor.handle,
                            }
                            for descriptor in characteristic.descriptors
                        ],
                    }
                )
            services_report.append(
                {
                    "uuid": str(service.uuid).lower(),
                    "description": service.description,
                    "characteristics": characteristics,
                }
            )
    return {
        "mode": "gatt-inventory",
        "platform": platform.platform(),
        "identifier": identifier,
        "writesPerformed": False,
        "valuesRead": False,
        "services": services_report,
    }


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only eXperiBot/Tinkerbots BLE discovery; this tool never writes to a device"
    )
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument(
        "--inspect",
        metavar="IDENTIFIER",
        help="connect read-only and list the selected device's GATT services",
    )
    return parser.parse_args()


def main() -> None:
    args = _arguments()
    try:
        report = asyncio.run(
            inspect(args.inspect, args.timeout) if args.inspect else scan(args.timeout)
        )
    except Exception as error:
        raise SystemExit(f"Tinkerbot BLE probe failed without writing data: {error}") from error
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
