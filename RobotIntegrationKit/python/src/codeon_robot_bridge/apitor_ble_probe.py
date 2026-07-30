from __future__ import annotations

import argparse
import asyncio
import json
import platform
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

APITOR_SERVICE_UUID = "0000f0ff-0000-1000-8000-00805f9b34fb"
APITOR_WRITE_UUID = "0000f001-0000-1000-8000-00805f9b34fb"
APITOR_NOTIFY_UUID = "0000f002-0000-1000-8000-00805f9b34fb"

# Apitor Kit 4.1.3, Robot.authorize(), Robot.runMotor() and Robot.turnOnLed().
ROBOT_X_AUTHORIZE = bytes.fromhex("55aa112055494d384c5679526e75706973654276")
STOP_ALL_MOTORS = bytes.fromhex("55aa03100000")
ALL_LEDS_BLUE = bytes.fromhex("55aa0404060000")
ALL_LEDS_OFF = bytes.fromhex("55aa0403000000")
LED_COLORS = {
    "red": 1,
    "orange": 2,
    "yellow": 3,
    "green": 4,
    "cyan": 5,
    "blue": 6,
    "purple": 7,
    "white": 10,
}
SENSOR_PREFIX = bytes.fromhex("55aa0580")


@dataclass(frozen=True)
class ApitorSensorPacket:
    """Decoded Robot X notification as exposed by Apitor Kit 4.1.3."""

    color_raw: int
    color_group: int
    infrared_1: int
    infrared_2: int
    trailing: int


def parse_sensor_packet(packet: bytes | bytearray) -> ApitorSensorPacket | None:
    """Decode one complete eight-byte Robot X sensor notification.

    The vendor app maps raw colour values into three groups but does not name
    those groups. CodeON therefore preserves both values until hardware
    calibration can attach reliable colour names.
    """
    data = bytes(packet)
    if len(data) != 8 or not data.startswith(SENSOR_PREFIX):
        return None
    color_raw = data[4]
    color_group = {1: 1, 3: 2, 2: 3, 4: 3}.get(color_raw, 0)
    return ApitorSensorPacket(
        color_raw=color_raw,
        color_group=color_group,
        infrared_1=data[5],
        infrared_2=data[6],
        trailing=data[7],
    )


def motor_frame(index: int, direction: int, speed: int) -> bytes:
    """Build an Apitor motor frame without performing a BLE write."""
    values = (index, direction, speed)
    if any(value < 0 or value > 255 for value in values):
        raise ValueError("motor fields must be bytes")
    return bytes((0x55, 0xAA, 0x03, *values))


def led_frame(index: int, color: int) -> bytes:
    """Build an Apitor LED frame without performing a BLE write."""
    values = (index, color)
    if any(value < 0 or value > 255 for value in values):
        raise ValueError("LED fields must be bytes")
    return bytes((0x55, 0xAA, 0x04, *values, 0x00, 0x00))


def candidate_reasons(name: str | None, service_uuids: Iterable[str]) -> list[str]:
    """Return transparent hints, never a claim that a device is an Apitor."""
    normalized_name = (name or "").strip().lower()
    reasons = []
    if "apitor" in normalized_name:
        reasons.append("name contains 'apitor'")
    if "robot x" in normalized_name or "robotx" in normalized_name:
        reasons.append("name contains 'robot x'")
    if any(token in normalized_name for token in ("robot", "motor", "smartbot")):
        reasons.append("name looks robot-related")
    if tuple(service_uuids):
        reasons.append("advertises service UUIDs")
    return reasons


def diagnostic_hint(error: BaseException, writes_enabled: bool = False) -> str:
    message = str(error).lower()
    if "turned off" in message:
        return "Turn on Bluetooth on the Mac, then run the scan again."
    if "unsupported" in message or "not authorized" in message:
        return (
            "Allow Bluetooth access for Terminal or Python in "
            "System Settings > Privacy & Security > Bluetooth."
        )
    if writes_enabled:
        return (
            "The LED test cleanup attempted LED-off and global stop before disconnecting. "
            "Do not proceed to a motion test; check the connection and retry the LED test."
        )
    return "No BLE write was attempted. Check Bluetooth permission and retry."


def _load_bleak():
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as error:
        raise RuntimeError(
            "Bleak is not installed. Install the Apitor diagnostic extra with "
            "'.venv/bin/pip install -e \"RobotIntegrationKit/python[apitor]\"'."
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
            str(company_id): bytes(value).hex() for company_id, value in sorted(advertisement.manufacturer_data.items())
        },
        "serviceData": {str(uuid).lower(): bytes(value).hex() for uuid, value in sorted(advertisement.service_data.items())},
        "candidateReasons": candidate_reasons(name, service_uuids),
    }


async def scan(timeout: float) -> dict[str, Any]:
    _, scanner_type = _load_bleak()
    discovered = await scanner_type.discover(timeout=timeout, return_adv=True)
    devices = [_device_report(device, advertisement) for device, advertisement in discovered.values()]
    devices.sort(key=lambda item: (not bool(item["candidateReasons"]), -(item["rssi"] or -999), item["name"] or ""))
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


async def led_test(
    identifier: str,
    timeout: float,
    duration: float,
    color: str = "blue",
    port: str = "l1",
) -> dict[str, Any]:
    """Run the first deliberately non-motion hardware test.

    The official Robot X authorization is followed by a global motor stop
    before the LED changes. Cleanup always turns LEDs off and sends stop twice.
    """
    client_type, _ = _load_bleak()
    notifications: list[str] = []
    writes: list[str] = []
    led_index = {"l1": 1, "l2": 2}[port]
    selected_led_frame = led_frame(led_index, LED_COLORS[color])

    def record_notification(_: Any, data: bytearray) -> None:
        notifications.append(bytes(data).hex())

    client = client_type(identifier, timeout=timeout)
    connected = False
    try:
        await client.connect()
        connected = True
        await client.write_gatt_char(APITOR_WRITE_UUID, ROBOT_X_AUTHORIZE, response=True)
        writes.append(ROBOT_X_AUTHORIZE.hex())
        await client.start_notify(APITOR_NOTIFY_UUID, record_notification)
        await asyncio.sleep(0.15)

        await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
        writes.append(STOP_ALL_MOTORS.hex())
        await asyncio.sleep(0.1)
        await client.write_gatt_char(APITOR_WRITE_UUID, selected_led_frame, response=True)
        writes.append(selected_led_frame.hex())
        await asyncio.sleep(duration)
    finally:
        if connected and client.is_connected:
            for packet in (
                led_frame(1, 0),
                led_frame(2, 0),
                ALL_LEDS_OFF,
                STOP_ALL_MOTORS,
                STOP_ALL_MOTORS,
            ):
                try:
                    await client.write_gatt_char(APITOR_WRITE_UUID, packet, response=True)
                    writes.append(packet.hex())
                    await asyncio.sleep(0.1)
                except Exception:
                    pass
            try:
                await client.stop_notify(APITOR_NOTIFY_UUID)
            except Exception:
                pass
            await client.disconnect()

    return {
        "mode": "confirmed-led-only-test",
        "platform": platform.platform(),
        "identifier": identifier,
        "ledPort": port.upper(),
        "ledColor": color,
        "ok": True,
        "motorMotionRequested": False,
        "safetyStopSent": STOP_ALL_MOTORS.hex() in writes,
        "writes": writes,
        "notifications": notifications,
    }


async def sensor_test(identifier: str, timeout: float, duration: float) -> dict[str, Any]:
    """Collect Robot X sensor notifications without requesting motor motion."""
    client_type, _ = _load_bleak()
    notifications: list[str] = []
    samples: list[dict[str, int]] = []
    writes: list[str] = []

    def record_notification(_: Any, data: bytearray) -> None:
        raw = bytes(data)
        notifications.append(raw.hex())
        packet = parse_sensor_packet(raw)
        if packet is not None:
            samples.append(
                {
                    "colorRaw": packet.color_raw,
                    "colorGroup": packet.color_group,
                    "infrared1": packet.infrared_1,
                    "infrared2": packet.infrared_2,
                    "trailing": packet.trailing,
                }
            )

    client = client_type(identifier, timeout=timeout)
    connected = False
    try:
        await client.connect()
        connected = True
        await client.write_gatt_char(APITOR_WRITE_UUID, ROBOT_X_AUTHORIZE, response=True)
        writes.append(ROBOT_X_AUTHORIZE.hex())
        await client.start_notify(APITOR_NOTIFY_UUID, record_notification)
        await asyncio.sleep(0.15)
        await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
        writes.append(STOP_ALL_MOTORS.hex())
        await asyncio.sleep(duration)
    finally:
        if connected and client.is_connected:
            for _ in range(2):
                try:
                    await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
                    writes.append(STOP_ALL_MOTORS.hex())
                except Exception:
                    pass
            try:
                await client.stop_notify(APITOR_NOTIFY_UUID)
            except Exception:
                pass
            await client.disconnect()

    return {
        "mode": "confirmed-sensor-notification-test",
        "platform": platform.platform(),
        "identifier": identifier,
        "ok": bool(samples),
        "motorMotionRequested": False,
        "durationSeconds": duration,
        "sampleCount": len(samples),
        "samples": samples,
        "notifications": notifications,
        "safetyStopSent": STOP_ALL_MOTORS.hex() in writes,
        "writes": writes,
    }


async def motor_test(
    identifier: str,
    timeout: float,
    duration: float,
    motor: str = "both",
    direction: int = 1,
    speed: int = 4,
) -> dict[str, Any]:
    """Run selected Robot X motor ports briefly at low speed, then stop safely."""
    client_type, _ = _load_bleak()
    writes: list[str] = []
    motor_indices = {"m1": (6,), "m2": (7,), "m3": (8,), "both": (6, 7)}
    drive_packets = tuple(motor_frame(index, direction, speed) for index in motor_indices[motor])
    client = client_type(identifier, timeout=timeout)
    connected = False
    try:
        await client.connect()
        connected = True
        await client.write_gatt_char(APITOR_WRITE_UUID, ROBOT_X_AUTHORIZE, response=True)
        writes.append(ROBOT_X_AUTHORIZE.hex())
        await asyncio.sleep(0.5)
        await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
        writes.append(STOP_ALL_MOTORS.hex())
        await asyncio.sleep(0.2)
        for packet in drive_packets:
            await client.write_gatt_char(APITOR_WRITE_UUID, packet, response=True)
            writes.append(packet.hex())
            await asyncio.sleep(0.05)
        await asyncio.sleep(duration)
    finally:
        if connected and client.is_connected:
            for _ in range(3):
                try:
                    await client.write_gatt_char(APITOR_WRITE_UUID, STOP_ALL_MOTORS, response=True)
                    writes.append(STOP_ALL_MOTORS.hex())
                    await asyncio.sleep(0.1)
                except Exception:
                    pass
            await client.disconnect()

    return {
        "mode": "confirmed-short-motor-test",
        "platform": platform.platform(),
        "identifier": identifier,
        "ok": True,
        "motorMotionRequested": True,
        "durationSeconds": duration,
        "motor": motor,
        "direction": direction,
        "speedLevel": speed,
        "safetyStopSent": STOP_ALL_MOTORS.hex() in writes,
        "writes": writes,
    }


async def _run(args: argparse.Namespace) -> int:
    try:
        if args.motor_test:
            report = await motor_test(
                args.motor_test,
                args.timeout,
                args.motor_duration,
                args.motor,
                args.motor_direction,
                args.motor_speed,
            )
        elif args.led_test:
            report = await led_test(args.led_test, args.timeout, args.led_duration, args.led_color, args.led_port)
        elif args.sensor_test:
            report = await sensor_test(args.sensor_test, args.timeout, args.sensor_duration)
        elif args.inspect:
            report = await inspect(args.inspect, args.timeout)
        else:
            report = await scan(args.timeout)
    except Exception as error:
        writes_enabled = bool(args.led_test or args.sensor_test or args.motor_test)
        report = {
            "mode": (
                "short-motor-test"
                if args.motor_test
                else (
                    "led-only-test"
                    if args.led_test
                    else (
                        "sensor-notification-test"
                        if args.sensor_test
                        else ("gatt-inventory" if args.inspect else "scan-only")
                    )
                )
            ),
            "writesPerformed": writes_enabled,
            "ok": False,
            "error": {"type": type(error).__name__, "message": str(error)},
            "nextStep": diagnostic_hint(error, writes_enabled=writes_enabled),
        }
        print(json.dumps(report, indent=2, sort_keys=True))
        return 2
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report.get("ok", True) else 2


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apitor BLE discovery, GATT inventory and explicit non-motion LED test"
    )
    parser.add_argument("--timeout", type=float, default=8.0, help="scan or connection timeout in seconds")
    parser.add_argument(
        "--inspect",
        metavar="IDENTIFIER",
        help="connect to one explicit identifier and list GATT metadata; never writes or reads values",
    )
    parser.add_argument(
        "--led-test",
        metavar="IDENTIFIER",
        help="explicitly run the non-motion Robot X authorization and LED test",
    )
    parser.add_argument(
        "--led-duration",
        type=float,
        default=1.0,
        help="LED duration in seconds (default: 1.0; maximum: 5.0)",
    )
    parser.add_argument(
        "--led-color",
        choices=tuple(LED_COLORS),
        default="blue",
        help="LED test color (default: blue)",
    )
    parser.add_argument(
        "--led-port",
        choices=("l1", "l2"),
        default="l1",
        help="LED port used by --led-test (default: l1)",
    )
    parser.add_argument(
        "--sensor-test",
        metavar="IDENTIFIER",
        help="collect Robot X sensor notifications without requesting motor motion",
    )
    parser.add_argument(
        "--sensor-duration",
        type=float,
        default=5.0,
        help="sensor collection duration in seconds (default: 5.0; maximum: 30.0)",
    )
    parser.add_argument(
        "--motor-test",
        metavar="IDENTIFIER",
        help="explicitly run both Robot X drive motors briefly at low speed",
    )
    parser.add_argument(
        "--motor-duration",
        type=float,
        default=0.5,
        help="motor duration in seconds (default: 0.5; maximum: 1.0)",
    )
    parser.add_argument(
        "--motor",
        choices=("m1", "m2", "m3", "both"),
        default="both",
        help="motor port used by --motor-test (default: both)",
    )
    parser.add_argument(
        "--motor-direction",
        type=int,
        choices=(1, 2),
        default=1,
        help="motor direction used by --motor-test (default: 1)",
    )
    parser.add_argument(
        "--motor-speed",
        type=int,
        choices=range(1, 13),
        default=4,
        help="motor speed level from 1 to 12 (default: 4)",
    )
    args = parser.parse_args()
    selected_modes = sum(bool(value) for value in (args.inspect, args.led_test, args.sensor_test, args.motor_test))
    if selected_modes > 1:
        parser.error("--inspect, --led-test, --sensor-test and --motor-test are mutually exclusive")
    if not 0.1 <= args.led_duration <= 5.0:
        parser.error("--led-duration must be between 0.1 and 5.0 seconds")
    if not 0.1 <= args.motor_duration <= 1.0:
        parser.error("--motor-duration must be between 0.1 and 1.0 seconds")
    if not 0.5 <= args.sensor_duration <= 30.0:
        parser.error("--sensor-duration must be between 0.5 and 30.0 seconds")
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
