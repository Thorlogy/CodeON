"""Import failures must expose the missing subdependency, without hardware access."""
import builtins
import unittest
from unittest.mock import patch

from codeon_robot_bridge.apitor_adapter import _default_ble_factory
from codeon_robot_bridge.cozmo_adapter import _default_client_factory
from codeon_robot_bridge.errors import AdapterError


class DependencyErrorTest(unittest.TestCase):
    def test_missing_library_and_missing_subdependency_are_distinguishable(self):
        for library, factory, missing in (
            ("pycozmo", _default_client_factory, "pycozmo"),
            ("pycozmo", _default_client_factory, "chunk"),
            ("bleak", _default_ble_factory, "bleak"),
            ("bleak", _default_ble_factory, "CoreBluetooth"),
        ):
            original_import = builtins.__import__
            cause = ModuleNotFoundError(f"No module named '{missing}'", name=missing)

            def failing_import(name, *args, **kwargs):
                if name == library:
                    raise cause
                return original_import(name, *args, **kwargs)

            with self.subTest(library=library, missing=missing), patch("builtins.__import__", failing_import):
                with self.assertRaises(AdapterError) as raised:
                    factory()
                self.assertIn(str(cause), str(raised.exception))
                self.assertIn("einrichten/reparieren", str(raised.exception))
                self.assertIs(cause, raised.exception.__cause__)


if __name__ == "__main__":
    unittest.main()
