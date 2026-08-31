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
adapter, bridge or Cozmo program path. Start CodeON while the computer is still
on its normal Wi-Fi, then switch to Cozmo's Wi-Fi for the hardware test. CodeON,
the browser and the bridge communicate locally and do not require internet
access after startup.

The Cozmo bridge must remain running across Wi-Fi changes. While Cozmo's Wi-Fi
is unavailable, the Run button is disabled. After returning to Cozmo's Wi-Fi,
the existing CodeON page retries locally and should enable Run automatically;
`CodeON-Starten.command` must not be started again.

This exact transition was verified with real hardware on 31 August 2026: the
bridge was started once on normal Wi-Fi, the Mac joined Cozmo's Wi-Fi, and the
disabled triangular Run button became enabled without restarting CodeON. On
macOS the starter must launch the bridge from Terminal, because Local Network
permission is associated with the launching application. Keep that Terminal
window open and allow Terminal's Local Network permission if macOS asks.
The bridge rejects an unmarked direct Cozmo start on macOS so that an unusable
process cannot silently occupy the local WebSocket port. Its runtime log rotates
at 10 MiB with three backups; successful high-frequency status and sensor reads
are omitted while commands and errors remain available.

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

Cozmo has no ultrasonic, infrared ranging or time-of-flight sensor that can
return an obstacle distance in centimeters. Its downward cliff sensing can
report an edge, but not the distance to an object in front of the robot.
Wheel odometry, face size and the pose of a recognized cube can only provide
task-specific estimates and must not be presented as a general distance
measurement.

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

## Follow-up gate after the 31 August exploratory test

The following corrections prompted by the exploratory test were verified with
real hardware on 31 August 2026:

- the lift arm moved visibly with the corrected direct velocity command;
- local face detection received camera frames and recognized a face.

The visible emergency-stop path was subsequently verified with real hardware:
during continuous motion, pressing the visible Stop control stopped Cozmo
immediately. The toolbox naming distinction between user-defined
`Parallel task` headers and the built-in `Automatic face following` action is
covered by the delivered static regression check but should also be confirmed
visually during final acceptance.

The detailed checkpoint is recorded in
`docs/CodeON_Cozmo_Durchbruch_2026-08-31.md`.
