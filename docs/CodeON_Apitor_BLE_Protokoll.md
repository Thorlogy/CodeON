# CodeON Apitor Robot X BLE protocol

Status: BLE transport, authorization, all three motor-port commands and global
stop verified on a physical Robot X. LED control remains unverified.

## Evidence policy

Every protocol claim must reference either:

- an Apitor Kit APK version and decompiled class/method;
- an Android Bluetooth HCI capture with timestamp; or
- a read-only/macOS hardware observation recorded below.

Values inferred only from device names or generic BLE conventions remain
`candidate`, never `verified`.

## Known facts

- The official Apitor Kit application controls supported Apitor products over
  Bluetooth and exposes motors, sensors and lights.
- CodeON will use the existing Robot Bridge 1.0 contract. The BLE protocol
  described here is the separate vendor transport between the future
  `ApitorAdapter` and the Robot X.
- Scan and GATT-inventory modes are deliberately read-only. Explicit
  `--led-test` and `--motor-test` modes perform the documented, bounded writes.
- On 2026-07-27, a powered Robot X advertised as `ApitorTXAA0080955`.
- Its vendor service is `F0FF`; `F001` accepts writes and `F002` emits
  notifications. These observations identify the transport channels, not the
  packet format.

## Discovery commands

Install the optional diagnostic dependency:

```shell
.venv/bin/pip install -e 'RobotIntegrationKit/python[apitor]'
```

List nearby BLE advertisements without connecting:

```shell
PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python \
  RobotIntegrationKit/python/tools/apitor_ble_probe.py
```

After a candidate identifier has been confirmed, inventory only its GATT
metadata:

```shell
PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python \
  RobotIntegrationKit/python/tools/apitor_ble_probe.py \
  --inspect 'MACOS-COREBLUETOOTH-IDENTIFIER'
```

On macOS the identifier is a CoreBluetooth UUID local to that Mac, not the
Bluetooth MAC address printed by Android.

## Evidence inventory

| Item | Value | Status | Source |
| --- | --- | --- | --- |
| Android package | `com.robot.apitor` | candidate | Apitor Kit store listing |
| Advertisement name | `ApitorTXAA0080955` | observed | macOS scan, 2026-07-27 |
| Service UUID | `0000f0ff-0000-1000-8000-00805f9b34fb` | observed | read-only GATT inventory, 2026-07-27 |
| Write characteristic | `0000f001-0000-1000-8000-00805f9b34fb`; write and write-without-response | observed | read-only GATT inventory, 2026-07-27 |
| Notify characteristic | `0000f002-0000-1000-8000-00805f9b34fb`; notify, CCCD `2902` | observed | read-only GATT inventory, 2026-07-27 |
| Robot X authorization | `55 aa 11 20 55 49 4d 38 4c 56 59 52 6e 75 70 69 73 65 42 76` | recovered | Apitor Kit 4.1.3, `Robot.authorize()` |
| Heartbeat | unknown | open | APK and idle capture required |
| Global motor stop | `55 aa 03 10 00 00` | recovered | Apitor Kit 4.1.3, `Robot.stopAllMotor()` |
| Motor frame | `55 aa 03 INDEX DIRECTION SPEED` | recovered | Apitor Kit 4.1.3, `Robot.runMotor()` |
| LED frame | `55 aa 04 INDEX COLOR 00 00` | recovered | Apitor Kit 4.1.3, `Robot.turnOnLed()` |
| Sensor frames | unknown | open | APK and hardware verification required |

`recovered` means that two cooperating methods in the official APK establish
the packet semantics. Hardware verification is recorded separately below.

## First hardware write

The first permitted write test is intentionally limited to authorization,
global stop and LEDs. It never requests motor motion. Cleanup switches the LEDs
off and sends global stop twice, including after exceptions:

```shell
PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python \
  RobotIntegrationKit/python/tools/apitor_ble_probe.py \
  --led-test 'MACOS-COREBLUETOOTH-IDENTIFIER'
```

The JSON result must contain `"motorMotionRequested": false` and
`"safetyStopSent": true`. On 2026-07-28, both blue and red commands were
successfully written, but no visual change from the Robot X's existing blue
blinking was observed. LED control is therefore **not hardware-verified**.

## Bounded motor verification

After explicit user authorization, both drive motors were commanded at low
speed for 0.5 seconds:

```shell
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/apitor_ble_probe.py \
  --motor-test 'MACOS-COREBLUETOOTH-IDENTIFIER' --motor-duration 0.5
```

Observed on 2026-07-28: the motor turned and stopped. Packets were M1
`55 aa 03 06 01 04`, M2 `55 aa 03 07 01 04`, followed by the global-stop
packet three times. This verifies authorization, motor writes and the bounded
stop path on the physical Robot X.

On 2026-07-30, the three hardware indices were tested sequentially with a
one-second pause. The two connected motors on M2 and M3 moved independently;
the unoccupied M1 port produced no movement, as expected. CodeON therefore
exposes generic M1, M2 and M3 blocks rather than assuming a particular model
or wheel assignment. A motor block starts one port in direction 1 or 2 at one
of the twelve hardware speed levels. A wait block determines its running time,
and a per-port stop block stops it. Program end, the global Stop button,
browser disconnect and bridge shutdown all send the global-stop packet.

The same M2 and M3 mapping was subsequently verified through the complete
CodeON user path: select Apitor Robot X, connect the local bridge, create a
block program and start it with the Run button. The initial disabled Run button
was caused by a missing Blockly configuration definition for the three fixed
Apitor motor ports. Registering M1, M2 and M3 and refreshing the static-resource
cache fixed the selection and connection path.

## Motor and encoder classification

The verified `runMotor()` packet contains only motor index, direction and
speed. Neither the recovered Apitor Kit 4.1.3 motor API nor the hardware
notifications observed so far provide a target angle, step count, wheel
position or encoder value. The official Robot X material lists three motors and
lists its infrared and colour sensors separately; it does not document a wheel
encoder.

Consequently, CodeON currently treats M1, M2 and M3 as open-loop motors, not as
stepper or encoder motors. Distance and angle must not be inferred from the
current protocol. Position-controlled blocks may only be added if a future APK
analysis or hardware capture identifies and verifies explicit position
feedback.

## CodeON integration

The productive implementation consists of:

- the `RobotApitor` server plugin and its beginner/expert toolboxes;
- the local `ApitorAdapter` on WebSocket port `2224`;
- automatic bridge startup through `CodeON-starten.command`; and
- a browser-side stack-machine behaviour for independent M1/M2/M3 control.

The current scope intentionally contains motors only. LED control and sensor
support remain hidden until their packets and semantics have been verified on
hardware.

## Safety gate

Further or longer motion tests require:

1. the write and notify characteristics are identified from two independent
   sources where possible;
2. the stop command remains part of normal and exceptional cleanup;
3. connection loss behavior is understood; and
4. the robot stands on a clear test surface and the user explicitly authorizes
   motion.
