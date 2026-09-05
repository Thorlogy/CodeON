import unittest

from codeon_robot_bridge.tinkerbot_protocol import (
    CUSTOM_SCRIPT_NAME,
    EXECUTE_SCRIPT,
    FILE_UPLOAD_CONTROL,
    FILE_UPLOAD_DATA,
    RECEIVE_FILE_DATA_PACKETS,
    START_FILE_UPLOAD,
    TERMINATE_SCRIPT,
    VERIFY_FILE_DATA,
    decode_modules,
    decode_response,
    encode_request,
    execute_script_frame,
    terminate_script_frame,
    upload_checksum_frame,
    upload_chunks,
    upload_control_frame,
    upload_header_frame,
)


class TinkerbotProtocolTest(unittest.TestCase):
    def test_script_start_and_stop_match_official_commands(self):
        self.assertEqual(execute_script_frame(), bytes((EXECUTE_SCRIPT,)))
        self.assertEqual(terminate_script_frame(), bytes((TERMINATE_SCRIPT,)))

    def test_request_rejects_the_response_follow_up_bit(self):
        with self.assertRaises(ValueError):
            encode_request(0x80)

    def test_response_uses_high_bit_as_follow_up_marker(self):
        response = decode_response(bytes((0x80 | 0x20, 1, 2)))
        self.assertEqual(response.command_or_event, 0x20)
        self.assertTrue(response.has_follow_up)
        self.assertEqual(response.payload, b"\x01\x02")

    def test_upload_control_frames_match_three_official_phases(self):
        self.assertEqual(upload_control_frame(START_FILE_UPLOAD), bytes((FILE_UPLOAD_CONTROL, 1)))
        self.assertEqual(
            upload_control_frame(RECEIVE_FILE_DATA_PACKETS), bytes((FILE_UPLOAD_CONTROL, 2))
        )
        self.assertEqual(upload_control_frame(VERIFY_FILE_DATA), bytes((FILE_UPLOAD_CONTROL, 3)))

    def test_upload_header_contains_little_endian_size_and_custom_script_name(self):
        frame = upload_header_frame(0x1234)
        self.assertEqual(frame[0], FILE_UPLOAD_DATA)
        self.assertEqual(frame[1:5], b"\x34\x12\x00\x00")
        self.assertEqual(frame[5:], CUSTOM_SCRIPT_NAME.encode("utf-8"))

    def test_upload_checksum_is_standard_unsigned_crc32(self):
        self.assertEqual(upload_checksum_frame("abc"), b"\x31\xc2\x41\x24\x35")

    def test_file_chunks_use_current_mtu_minus_four(self):
        frames = upload_chunks(b"abcdef", current_mtu=8)
        self.assertEqual(frames, [bytes((FILE_UPLOAD_DATA,)) + b"abcd", b"\x31ef"])

    def test_modules_are_five_byte_little_endian_records(self):
        modules = decode_modules(bytes.fromhex("3412070409 0200010603"))
        self.assertEqual(modules[0].module_hash, 0x1234)
        self.assertEqual(modules[0].module_type, 7)
        self.assertEqual(modules[0].led_color, 4)
        self.assertEqual(modules[1].module_hash, 2)


if __name__ == "__main__":
    unittest.main()
