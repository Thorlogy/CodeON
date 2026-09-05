import unittest
from unittest.mock import patch

from codeon_robot_bridge.tinkerbot_ble_probe import (
    _device_report,
    candidate_generation,
    candidate_reasons,
    inspect,
)


class Device:
    address = "DEVICE-1"
    name = "fallback-name"


class Advertisement:
    local_name = "Tinkerbots PowerBrain"
    rssi = -42
    service_uuids = ["ABCD"]
    manufacturer_data = {7: b"\x01\x02"}
    service_data = {"ABCD": b"\x03"}


class TinkerbotBleProbeTest(unittest.TestCase):
    def test_candidate_name_matching_is_case_insensitive(self):
        self.assertEqual(
            candidate_reasons("TINKERBOTS PowerBrain", []),
            [
                "legacy discovery hint contains 'tinkerbot'",
                "legacy discovery hint contains 'powerbrain'",
            ],
        )

    def test_current_and_legacy_names_are_not_treated_as_the_same_generation(self):
        self.assertEqual(candidate_generation("T2BOT"), "experibot-t2-current-app")
        self.assertEqual(candidate_generation("🤖 eXperiBot ABC"), "experibot-t2-current-app")
        self.assertEqual(
            candidate_generation("TINKERBOTS PowerBrain"),
            "legacy-powerbrain-protocol-unknown",
        )

    def test_unknown_device_is_not_claimed_as_tinkerbot(self):
        self.assertEqual(candidate_reasons("Headphones", ["abcd"]), [])

    def test_device_report_is_read_only_and_serializable(self):
        report = _device_report(Device(), Advertisement())
        self.assertEqual(report["identifier"], "DEVICE-1")
        self.assertEqual(report["serviceUuids"], ["abcd"])
        self.assertEqual(report["manufacturerData"], {"7": "0102"})
        self.assertEqual(report["serviceData"], {"abcd": "03"})
        self.assertEqual(report["candidateGeneration"], "legacy-powerbrain-protocol-unknown")


class Descriptor:
    uuid = "DESC"
    description = "descriptor"
    handle = 3


class Characteristic:
    uuid = "CHAR"
    description = "characteristic"
    properties = ["notify", "write"]
    descriptors = [Descriptor()]


class Service:
    uuid = "SERVICE"
    description = "service"
    characteristics = [Characteristic()]


class ReadOnlyClient:
    read_count = 0
    write_count = 0

    def __init__(self, identifier, timeout):
        self.identifier = identifier
        self.timeout = timeout
        self.services = [Service()]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def read_gatt_char(self, *_args, **_kwargs):
        type(self).read_count += 1

    async def write_gatt_char(self, *_args, **_kwargs):
        type(self).write_count += 1


class TinkerbotBleInspectTest(unittest.IsolatedAsyncioTestCase):
    async def test_gatt_inventory_neither_reads_nor_writes_values(self):
        ReadOnlyClient.read_count = 0
        ReadOnlyClient.write_count = 0
        with patch(
            "codeon_robot_bridge.tinkerbot_ble_probe._load_bleak",
            return_value=(ReadOnlyClient, object),
        ):
            report = await inspect("DEVICE-1", 2.0)

        self.assertFalse(report["writesPerformed"])
        self.assertFalse(report["valuesRead"])
        self.assertEqual(report["services"][0]["uuid"], "service")
        self.assertEqual(ReadOnlyClient.read_count, 0)
        self.assertEqual(ReadOnlyClient.write_count, 0)


if __name__ == "__main__":
    unittest.main()
