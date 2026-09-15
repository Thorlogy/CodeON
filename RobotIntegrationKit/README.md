# CodeON Robot Integration Kit

Reusable foundation for local robot integrations. The kit separates CodeON's
stack-machine execution from vendor-specific robot libraries.

The first reference adapter is Cozmo. New integrations implement the same
adapter contract and must pass the shared conformance tests.

## Design goals

- one versioned protocol for all local robot bridges
- capability discovery instead of robot-name checks
- safe-by-default motion handling with heartbeat and emergency stop
- deterministic fake adapters for development without hardware
- optional vendor dependencies loaded only by their adapter

See `docs/PROTOCOL_V1.md` for the wire contract and `python/tests` for the
executable adapter contract.

Before starting a new integration, choose between a bridge prototype and a
complete CodeON robot system in `docs/INTEGRATION_CONTRACT.md`. The shorter
execution list is available in `docs/NEW_ROBOT_CHECKLIST.md`.

The checked reference manifests live in `manifests/`. Validate both references
without changing repository files:

```shell
npm run robot:check
```

Validate only one known robot with `npm run robot:check -- --id cozmo`. The
command accepts only an ID for an existing checked manifest and reads only
fixed repository paths. Even in this focused mode it checks ID and port
collisions across the complete manifest set. It never executes commands stored
in project metadata.

Preview a new, deliberately disconnected bridge scaffold with:

```shell
npm run robot:new -- --dry-run --id myrobot --name "My Robot" \
  --transport ble --port 2299 --host macos
```

This first generator stage has no write mode. Its normal output prints the
draft manifest plus planned paths and content hashes; `--json` additionally
contains the exact generated content. It rejects IDs already present in the
architecture graph, active robot list or manifests, existing target files, and
ports reserved by CodeON, a local launcher or another manifest. An optional
dependency name must begin with the new robot ID and must not reuse an existing
extra. The command never modifies the repository. The scaffold exposes no
actuator or sensor and refuses to connect until its hardware protocol has been
implemented and reviewed.

## Local development

The core and fake-adapter contract have no vendor runtime dependencies:

```shell
PYTHONPATH=RobotIntegrationKit/python/src python3 -m unittest discover \
  -s RobotIntegrationKit/python/tests -p 'test_bridge_contract.py' -v
```

Run the complete adapter suite from the isolated environment after installing
the robot-specific extras:

```shell
PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python -m unittest discover \
  -s RobotIntegrationKit/python/tests -v
```

Install the WebSocket transport in an isolated environment and start it with
the fake adapter:

```shell
python3 -m venv .venv
.venv/bin/pip install -e 'RobotIntegrationKit/python[server]'
.venv/bin/codeon-robot-bridge --adapter fake
```

The Cozmo adapter is deliberately optional and must not be advertised as
verified until the hardware acceptance tests have passed:

```shell
.venv/bin/pip install -e 'RobotIntegrationKit/python[server,cozmo-vision]'
.venv/bin/codeon-robot-bridge --adapter cozmo
```

The Cozmo integration supports driving, head and lift positioning, backpack
and head lights, tones, local macOS text-to-speech, status/pose sensors and
local face detection. Face detection is deliberately identity-free: camera
frames stay inside the local bridge, are not stored and are reduced to
`detected`, `count`, normalized position and size. Stopping a program or
closing the controlling browser connection stops the motors; stopping the
camera also clears the last face result. While analysis is active, CodeON
shows a persistent Privacy Mode indicator. The standard mode never identifies
people or creates biometric profiles.

The `say` block creates speech locally with the macOS system voice and sends
the resulting audio directly to Cozmo. It does not use an online speech
service and it is not Cozmo's original character voice. Tone and speech output
must still be accepted on physical hardware before the new feature set is
marked hardware-verified.

The beginner toolbox contains the safe everyday blocks. Raw pose,
accelerometer and camera measurements are kept in the expert toolbox.

Suggested first hardware program:

1. set the lift to 50 percent and the head to 50 percent;
2. play a short 440 Hz tone, then say `Hallo!`;
3. start camera analysis and wait until `face detected` is true;
4. track the face once and stop camera analysis;
5. stop the program and verify that all motors and the camera stop immediately.

## Cozmo behavior-control compatibility

User-defined parallel-task blocks are currently not exposed in the Cozmo
toolboxes because their behavior was not clear enough for learners. Some
internal scheduling support remains for compatibility and built-in behaviors,
but it is not part of the supported integration template for new robots.

## Apitor Robot X

The Apitor adapter uses local Bluetooth Low Energy and exposes the three
hardware motor ports M1, M2 and M3 independently. Install the optional
dependency with:

```shell
.venv/bin/pip install -e 'RobotIntegrationKit/python[server,apitor]'
```

`CodeON-starten.command` starts the bridge automatically on port `2224`.
Switch on the Robot X before selecting it in CodeON. The beginner and expert
toolboxes provide motor start and per-port stop blocks. Motors are stopped
globally when a program ends, the browser disconnects, the watchdog expires,
or the bridge shuts down.

The protocol and physical acceptance evidence are documented in
`docs/CodeON_Apitor_BLE_Protokoll.md`. The bridge already supports the
APK-recovered L1/L2 LED commands and caches raw colour-group and S1/S2 sensor
notifications. Blockly blocks remain hidden until those meanings have passed
hardware verification.
M1, M2 and M3 are currently controlled by direction, speed level and elapsed
time. No step-count or encoder feedback has been verified, so CodeON does not
present these ports as position-controlled motors.

The official app renders speech and sounds on the Android host. No Robot X hub
speaker command was recovered, so future Apitor audio support must be labelled
as Mac/tablet output.
