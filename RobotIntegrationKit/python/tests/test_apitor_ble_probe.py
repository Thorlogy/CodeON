import unittest
from unittest.mock import patch

import codeon_robot_bridge.apitor_ble_probe as probe

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


class FakeBleClient:
    def __init__(self, notification=None, fail_on=None):
        self.notification = notification
        self.fail_on = fail_on
        self.is_connected = False
        self.writes = []
        self.notify_stopped = False

    async def connect(self):
        self.is_connected = True

    async def write_gatt_char(self, uuid, packet, response=False):
        self.writes.append((uuid, bytes(packet), response))
        if packet == self.fail_on:
            raise RuntimeError("simulated GATT failure")

    async def start_notify(self, uuid, callback):
        if self.notification is not None:
            callback(uuid, bytearray(self.notification))

    async def stop_notify(self, uuid):
        self.notify_stopped = True

    async def disconnect(self):
        self.is_connected = False


class ApitorBleProbeSafetyTest(unittest.IsolatedAsyncioTestCase):
    async def test_sensor_capture_parses_notification_without_motor_motion(self):
        client = FakeBleClient(notification=bytes.fromhex("55aa058003112200"))
        with patch.object(probe, "_load_bleak", return_value=(lambda *args, **kwargs: client, None)):
            report = await probe.sensor_test("test-device", timeout=1, duration=0)

        self.assertEqual(report["sampleCount"], 1)
        self.assertEqual(report["samples"][0]["infrared1"], 17)
        self.assertEqual(report["samples"][0]["infrared2"], 34)
        self.assertFalse(report["motorMotionRequested"])
        self.assertTrue(report["safetyStopSent"])
        self.assertEqual([write[1] for write in client.writes], [ROBOT_X_AUTHORIZE] + [STOP_ALL_MOTORS] * 3)
        self.assertTrue(all(uuid == probe.APITOR_WRITE_UUID and response for uuid, _, response in client.writes))
        self.assertTrue(client.notify_stopped)
        self.assertFalse(client.is_connected)

    async def test_led_capture_clears_both_leds_and_stops_motors(self):
        client = FakeBleClient()
        with patch.object(probe, "_load_bleak", return_value=(lambda *args, **kwargs: client, None)):
            report = await probe.led_test("test-device", timeout=1, duration=0, color="red", port="l1")

        writes = [write[1] for write in client.writes]
        self.assertEqual(
            writes,
            [ROBOT_X_AUTHORIZE, STOP_ALL_MOTORS, led_frame(1, LED_COLORS["red"]),
             led_frame(1, 0), led_frame(2, 0), ALL_LEDS_OFF] + [STOP_ALL_MOTORS] * 2,
        )
        self.assertTrue(all(uuid == probe.APITOR_WRITE_UUID and response for uuid, _, response in client.writes))
        self.assertFalse(report["motorMotionRequested"])
        self.assertTrue(report["safetyStopSent"])
        self.assertTrue(client.notify_stopped)
        self.assertFalse(client.is_connected)

    async def test_led_write_failure_still_attempts_cleanup(self):
        selected = led_frame(1, LED_COLORS["red"])
        client = FakeBleClient(fail_on=selected)
        with patch.object(probe, "_load_bleak", return_value=(lambda *args, **kwargs: client, None)):
            with self.assertRaisesRegex(RuntimeError, "simulated GATT failure"):
                await probe.led_test("test-device", timeout=1, duration=0, color="red", port="l1")

        writes = [write[1] for write in client.writes]
        self.assertEqual(
            writes,
            [ROBOT_X_AUTHORIZE, STOP_ALL_MOTORS, selected,
             led_frame(1, 0), led_frame(2, 0), ALL_LEDS_OFF] + [STOP_ALL_MOTORS] * 2,
        )
        self.assertTrue(client.notify_stopped)
        self.assertFalse(client.is_connected)


if __name__ == "__main__":
    unittest.main()
