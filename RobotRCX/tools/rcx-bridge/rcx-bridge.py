#!/usr/bin/env python3
"""Compatibility launcher for the canonical RCX bridge."""

import runpy
from pathlib import Path


if __name__ == "__main__":
    bridge = Path(__file__).resolve().parents[2] / "rcx-bridge.py"
    runpy.run_path(str(bridge), run_name="__main__")
