#!/usr/bin/env python3
"""Run Cozmo adapter contracts; CI refuses missing optional coverage."""

import argparse
import unittest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-all", action="store_true", help="Fail when any Cozmo test is skipped")
    args = parser.parse_args()

    suite = unittest.defaultTestLoader.discover(
        "RobotIntegrationKit/python/tests", pattern="test_cozmo*.py"
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful() or result.testsRun == 0:
        return 1
    if args.require_all and result.skipped:
        print(f"Cozmo CI coverage incomplete: {len(result.skipped)} skipped test(s)")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
