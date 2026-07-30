import unittest

from codeon_robot_bridge.apitor_ble_probe import (
    ALL_LEDS_BLUE,
    ALL_LEDS_OFF,
    LED_COLORS,
    ROBOT_X_AUTHORIZE,
    STOP_ALL_MOTORS,
    candidate_reasons,
    diagnostic_hint,
    led_frame,
    motor_frame,
    parse_sensor_packet,
)


class ApitorBleProbeTest(unittest.TestCase):
    def test_explicit_apitor_name_is_ranked_as_candidate(self):
        self.assertIn("name contains 'apitor'", candidate_reasons("Apitor Robot X", []))

    def test_unknown_device_is_not_claimed_as_apitor(self):
        self.assertEqual(candidate_reasons("Wireless Keyboard", []), [])

    def test_advertised_service_is_reported_as_evidence_only(self):
        self.assertEqual(candidate_reasons(None, ["0000fff0-0000-1000-8000-00805f9b34fb"]), ["advertises service UUIDs"])

    def test_disabled_bluetooth_has_an_actionable_hint(self):
        self.assertIn("Turn on Bluetooth", diagnostic_hint(RuntimeError("Bluetooth device is turned off")))

    def test_write_mode_error_does_not_claim_no_write_was_attempted(self):
        hint = diagnostic_hint(RuntimeError("connection lost"), writes_enabled=True)
        self.assertIn("global stop", hint)
        self.assertNotIn("No BLE write was attempted", hint)

    def test_robot_x_authorization_matches_apitor_kit_413(self):
        self.assertEqual(ROBOT_X_AUTHORIZE.hex(), "55aa112055494d384c5679526e75706973654276")

    def test_global_stop_is_a_zero_speed_all_motor_frame(self):
        self.assertEqual(STOP_ALL_MOTORS, motor_frame(16, 0, 0))

    def test_low_speed_robot_x_drive_packets(self):
        self.assertEqual(motor_frame(6, 1, 4).hex(), "55aa03060104")
        self.assertEqual(motor_frame(7, 1, 4).hex(), "55aa03070104")
        self.assertEqual(motor_frame(6, 1, 8).hex(), "55aa03060108")
        self.assertEqual(motor_frame(8, 1, 8).hex(), "55aa03080108")

    def test_led_test_packets_match_apitor_kit_413(self):
        self.assertEqual(ALL_LEDS_BLUE, led_frame(4, 6))
        self.assertEqual(ALL_LEDS_OFF, led_frame(3, 0))
        self.assertEqual(led_frame(4, LED_COLORS["red"]).hex(), "55aa0404010000")

    def test_packet_fields_must_fit_in_one_byte(self):
        with self.assertRaises(ValueError):
            motor_frame(256, 0, 0)
        with self.assertRaises(ValueError):
            led_frame(4, -1)

    def test_sensor_packet_matches_vendor_app_field_layout(self):
        packet = parse_sensor_packet(bytes.fromhex("55aa058003112200"))
        self.assertIsNotNone(packet)
        self.assertEqual(packet.color_raw, 3)
        self.assertEqual(packet.color_group, 2)
        self.assertEqual(packet.infrared_1, 17)
        self.assertEqual(packet.infrared_2, 34)
        self.assertEqual(packet.trailing, 0)

    def test_vendor_color_grouping_is_preserved_without_guessing_names(self):
        expected = {1: 1, 3: 2, 2: 3, 4: 3, 0: 0, 9: 0}
        for raw, group in expected.items():
            packet = parse_sensor_packet(bytes((0x55, 0xAA, 0x05, 0x80, raw, 0, 0, 0)))
            self.assertEqual(packet.color_group, group)

    def test_unrelated_or_incomplete_notifications_are_ignored(self):
        self.assertIsNone(parse_sensor_packet(bytes.fromhex("55aa0580010203")))
        self.assertIsNone(parse_sensor_packet(bytes.fromhex("55aa048001020300")))


if __name__ == "__main__":
    unittest.main()
