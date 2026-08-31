# Cozmo hardware gate

## Verification status

The adapter and the complete CodeON execution path were successfully verified
with real Cozmo hardware on macOS on 22 July 2026. The verified checks are:

- connection and battery query;
- head and lift initialization/motion;
- short, low-speed wheel motion followed by direct stop;
- watchdog stop after the heartbeat expires;
- a CodeON block program containing straight and turning movements;
- stopping the running block program with the Run/Stop toggle.

The checks below remain the repeatable acceptance procedure for changes to the
adapter, bridge or Cozmo program path. The host must already be connected to
Cozmo's Wi-Fi network.

Place Cozmo on a clear floor even for the connection-only probe. PyCozmo's
connection initialization can calibrate and move the head or lift. Do not
promise a completely motionless connection test.

Run the non-moving probe first:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/cozmo_hardware_probe.py
```

Only on a clear floor with room around the robot, run the low-speed motion and
stop check:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/cozmo_hardware_probe.py --enable-motion
```

After direct stop succeeds, verify the motion lease. This drives slowly without
a heartbeat; the watchdog must stop the wheels after approximately one second:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/cozmo_hardware_probe.py --enable-watchdog-test
```

For a release candidate, repeat connection and stop tests ten times and
document:

- Cozmo firmware version
- operating system and version
- Python and PyCozmo versions
- successful connection count
- stop latency after browser close and Wi-Fi loss
- battery, head and lift results

Windows and Linux hardware support remains unverified until the same gate
passes on those platforms.

## Confirmed motor-configuration regression — 31 August 2026

The complete browser-to-robot path was verified again with real Cozmo hardware
on macOS 26.5.1. A CodeON block program drove the robot successfully and the
Run/Stop control stopped it safely. The bridge log confirmed `connect`, `drive`
and repeated `stopAll` requests without adapter errors.

This test specifically verifies that Cozmo does not need configurable motor or
differential-drive components. The plugin default contains only the robot board;
the validator recognizes Cozmo's built-in drive and accepts both programs with
no actor port and legacy programs carrying `_D`.

Verified host versions:

- Python 3.12.8
- PyCozmo 0.8.0
- websockets 16.1.1

The detailed checkpoint is recorded in
`docs/CodeON_Cozmo_Durchbruch_2026-08-31.md`.
