from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass


TINKERBOT_SERVICE_UUID = "d9bdb700-3ed0-4814-bd8d-348f44f583ae"
TINKERBOT_CHARACTERISTIC_UUID = "fe42eff1-03c1-4f22-b1f4-e59dc3657b83"
TINKERBOT_DEVICE_NAMES = ("T2BOT",)
TINKERBOT_DEVICE_PREFIXES = ("🤖 eXperiBot",)

CUSTOM_SCRIPT_NAME = "custom.py"

GET_FREE_MEMORY_SIZE = 0x01
EXECUTE_SCRIPT = 0x04
TERMINATE_SCRIPT = 0x06
GET_FILES = 0x0D
GET_MODULES = 0x10
GET_MODULE_LIVE_DATA = 0x16
START_MODULE_LIVE_DATA_STREAM = 0x17
STOP_MODULE_LIVE_DATA_STREAM = 0x18
GET_FIRMWARE_VERSION = 0x20
GET_BATTERY_LEVEL = 0x21
GET_CURRENT_MTU = 0x22
GET_MAC_ADDRESS = 0x23
FILE_UPLOAD_CONTROL = 0x30
FILE_UPLOAD_DATA = 0x31

START_FILE_UPLOAD = 0x01
RECEIVE_FILE_DATA_PACKETS = 0x02
VERIFY_FILE_DATA = 0x03


@dataclass(frozen=True)
class TinkerbotResponse:
    command_or_event: int
    has_follow_up: bool
    payload: bytes


@dataclass(frozen=True)
class TinkerbotModule:
    module_hash: int
    module_type: int
    led_color: int
    firmware_version: int


def encode_request(command: int, payload: bytes = b"") -> bytes:
    """Encode the Powerbrain request envelope used by the official app."""
    if not 0 <= command <= 0x7F:
        raise ValueError("command must fit in the low seven bits")
    return bytes((command,)) + bytes(payload)


def decode_response(frame: bytes | bytearray) -> TinkerbotResponse:
    data = bytes(frame)
    if not data:
        raise ValueError("response frame must not be empty")
    return TinkerbotResponse(
        command_or_event=data[0] & 0x7F,
        has_follow_up=bool(data[0] & 0x80),
        payload=data[1:],
    )


def execute_script_frame() -> bytes:
    return encode_request(EXECUTE_SCRIPT)


def terminate_script_frame() -> bytes:
    return encode_request(TERMINATE_SCRIPT)


def upload_control_frame(control: int) -> bytes:
    if control not in {START_FILE_UPLOAD, RECEIVE_FILE_DATA_PACKETS, VERIFY_FILE_DATA}:
        raise ValueError("unknown file upload control command")
    return encode_request(FILE_UPLOAD_CONTROL, bytes((control,)))


def upload_data_frame(payload: bytes) -> bytes:
    return encode_request(FILE_UPLOAD_DATA, payload)


def upload_header_frame(content_size: int, file_name: str = CUSTOM_SCRIPT_NAME) -> bytes:
    if not 0 <= content_size <= 0xFFFFFFFF:
        raise ValueError("content size must fit in an unsigned 32-bit integer")
    encoded_name = file_name.encode("utf-8")
    if not encoded_name:
        raise ValueError("file name must not be empty")
    return upload_data_frame(struct.pack("<I", content_size) + encoded_name)


def upload_checksum_frame(content: bytes | str) -> bytes:
    raw = content.encode("utf-8") if isinstance(content, str) else bytes(content)
    return upload_data_frame(struct.pack("<I", zlib.crc32(raw) & 0xFFFFFFFF))


def upload_chunks(content: bytes, current_mtu: int) -> list[bytes]:
    """Split file bytes as the official app does: current MTU minus four bytes."""
    chunk_size = current_mtu - 4
    if chunk_size < 1:
        raise ValueError("current MTU must be at least 5")
    return [upload_data_frame(content[index : index + chunk_size]) for index in range(0, len(content), chunk_size)]


def decode_modules(payload: bytes | bytearray) -> list[TinkerbotModule]:
    data = bytes(payload)
    if len(data) % 5:
        raise ValueError("module payload length must be divisible by five")
    return [
        TinkerbotModule(
            module_hash=int.from_bytes(data[index : index + 2], "little"),
            module_type=data[index + 2],
            led_color=data[index + 3],
            firmware_version=data[index + 4],
        )
        for index in range(0, len(data), 5)
    ]
