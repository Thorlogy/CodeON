# CodeON Apitor Robot X BLE protocol

Status: BLE transport, authorization, drive-motor commands and global stop
verified on a physical Robot X. LED control remains unverified.

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
stop path on the physical Robot X. Direction and wheel assignment still need
calibration before exposing normal CodeON movement blocks.

## Safety gate

Further or longer motion tests require:

1. the write and notify characteristics are identified from two independent
   sources where possible;
2. the stop command remains part of normal and exceptional cleanup;
3. connection loss behavior is understood; and
4. the robot stands on a clear test surface and the user explicitly authorizes
   motion.
