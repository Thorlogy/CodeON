# Cozmo hardware gate

The Cozmo adapter is **unverified** until this gate is completed on a real
robot. The host must already be connected to Cozmo's Wi-Fi network.

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

Before CodeON enables the adapter by default, repeat connection and stop tests
ten times and document:

- Cozmo firmware version
- operating system and version
- Python and PyCozmo versions
- successful connection count
- stop latency after browser close and Wi-Fi loss
- battery, head and lift results

Do not claim Windows or Linux support until the same gate passes there.
