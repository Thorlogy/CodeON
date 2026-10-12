# CodeON Apitor Robot X BLE protocol

Status: BLE transport, authorization, all three motor-port commands and global
stop verified on a physical Robot X. L1/L2 LED commands and the sensor packet
layout are recovered from Apitor Kit 4.1.3; hardware verification is pending.

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
| LED frame | `55 aa 04 INDEX COLOR 00 00`; L1=`01`, L2=`02` | recovered | Apitor Kit 4.1.3, `Robot.turnOnLed()` and `JsInterface.ledStatus()` |
| Sensor frame | `55 aa 05 80 COLOR S1 S2 TRAILING` (exactly 8 bytes) | recovered | Apitor Kit 4.1.3, embedded `apitor_jsbridge.js` |

`recovered` means that two cooperating methods in the official APK establish
the packet semantics. Hardware verification is recorded separately below.

### Sensor notification layout

The adapter subscribes to F002 notifications after authorization and accepts
only exact eight-byte sensor packets beginning with `55 aa 05 80`. It exposes:

- `colorRaw`: the unmodified byte at offset 4. The official Apitor Kit 4.1.3
  maps `1=red`, `2=green`, `3=blue`, `4=white`; all other values mean that no
  supported colour was identified;
- `colorGroup`: the official application's grouping
  (`1→1`, `3→2`, `2|4→3`, otherwise `0`);
- `infrared1`: byte 5;
- `infrared2`: byte 6; and
- `sensorSnapshot`: all values plus packet age for diagnostics.

The colour byte is a classification code, not an independent ambient-light
measurement. CodeON therefore does not label it as brightness. The two
infrared bytes are exposed in the expert toolbox as relative reflected-light
values from `0` to `255`. They are suitable for experiments and calibration,
but are not calibrated distances in centimetres. The beginner block compares
them with the official app's threshold (`>= 5`) and reports whether an object
or line was detected.

The group numbers are intentionally not given colour names until their physical
meaning has been verified with the Robot X sensors.

For a bounded five-second hardware capture:

```shell
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/apitor_ble_probe.py \
  --sensor-test 'MACOS-COREBLUETOOTH-IDENTIFIER'
```

This authorizes the hub and subscribes to notifications, but never requests
motor motion. The report preserves both parsed samples and unrecognized raw
notifications.

## First hardware write

The first permitted write test is intentionally limited to authorization,
global stop and LEDs. It never requests motor motion. Cleanup switches the LEDs
off and sends global stop twice, including after exceptions:

```shell
PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python \
  RobotIntegrationKit/python/tools/apitor_ble_probe.py \
  --led-test 'MACOS-COREBLUETOOTH-IDENTIFIER' --led-port l1 --led-color red
```

The JSON result must contain `"motorMotionRequested": false` and
`"safetyStopSent": true`. On 2026-07-28, both blue and red commands were
successfully written, but no visual change from the Robot X's existing blue
blinking was observed. LED control is therefore **not hardware-verified**.

### Pending infrared/LED hardware acceptance

Use the diagnostic probe only when no CodeON program or vendor app is connected
to the hub. Leave the normal CodeON server and bridge running, but do not start
a program during the probe: two BLE clients must not contend for this device.
Identify the hub by its local macOS CoreBluetooth identifier from a fresh scan;
do not assume that a previously recorded identifier belongs to this hub.

1. Run the five-second `--sensor-test` above with the sensor unobstructed, then
   repeat with a light and a dark surface close to each infrared sensor. Record
   `sampleCount` and the observed `infrared1`/`infrared2` ranges for each
   condition. A parsed packet alone verifies transport, **not** that the
   intended physical sensor changes or that the provisional threshold `5` is
   suitable. Do not report distance in centimetres.
2. Test an LED only if an actual controllable LED is fitted to L1 or L2 and the
   port is known. Use the bounded `--led-test` above, observe whether that LED
   visibly changes during the one-second command, and confirm it is off after
   cleanup. A successful GATT write without a visible change is not LED
   hardware verification; the hub's connection/status blink is not an L1/L2
   observation.
3. For every run, record the date, hub/port configuration, surface or LED
   observation, relevant parsed values, command success/failure, and whether
   `safetyStopSent` is true. Never record the full CoreBluetooth identifier in
   a public issue or commit. Keep infrared and LED marked *pending* if their
   respective physical observation is missing.

Neither test requests motor motion. An unexpected BLE error ends the sequence;
do not retry writes or proceed to a motor test until the hub's state is checked.

Checkpoint on 2026-10-12: with Bluetooth enabled, a fresh scan identified
`ApitorTXAA0080955` advertising F0FF. Read-only GATT inventory confirmed F001
write and F002 notify. One five-second sensor capture completed and produced
many correctly shaped notifications; the displayed samples had zero infrared
values, but the terminal output was truncated, so no complete value range can
be claimed. A subsequent three-second capture lost the BLE connection while
writing the initial global stop. The probe attempted its cleanup stops, but
their delivery could not be confirmed after disconnection. No motor-motion
command was requested. At this checkpoint the user had reported one motor
connected; whether S1/S2 infrared modules were connected was not established.
Therefore infrared hardware behavior and the threshold remain **unverified**.
No LED test was run because no separate L1/L2 LED was confirmed. Before any
further probe write, verify that the physical motor is stationary and clarify
the sensor/LED wiring; do not treat notification transport as sensor acceptance.

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

Checkpoint on 2026-10-12: the hub was already BLE-connected to the local
CodeON bridge, so a second direct BLE client could not discover or open it.
With no browser client controlling that bridge, M1, M2 and M3 were commanded
sequentially at speed level 4 for 0.25 seconds each. The bridge acknowledged
each `setMotor`, each intervening `stopAll`, the final `stopAll`, and another
stop when the test client closed. The user observed movement and stopping for
all three commands. However, the user had previously reported only one motor
connected; its physical socket was not yet confirmed. This run verifies the
bounded bridge command/stop path, but does **not** by itself establish port
isolation or supersede the earlier M2/M3 isolation test. Clarify the actual
wiring before interpreting the three observed movements.

Safety hold on 2026-10-12: the user clarified that two motors were attached
and requested a separate one-second M1 test with feedback before M2. The bridge
reported `setMotor(M1)` accepted, but both subsequent `stopAll` responses timed
out. The requested one-second *command interval* therefore does not establish
the physical motor's running time. A separate emergency `stopAll` request was
acknowledged as stopped; the bridge log also recorded a stop on client close.
The timeout's cause is not established; a later successful stop cannot explain
or erase it.

Subsequent user-led check on 2026-10-12: the user reported testing all three
motor channels and stopping them, and finally confirmed that the motors were
stationary. The bridge log recorded later `setMotor` and `stopAll` requests with
successful acknowledgements. No additional motor command was sent by the
assistant after this confirmation. This is a user-reported functional check,
not a measured run-time or a documented mapping between physical motors and
M1/M2/M3. The earlier stop-response timeout remains an open reliability
finding; investigate it in software before scheduling any further automated
motor test. Infrared and LED hardware acceptance remain separate and pending.

Software-only follow-up on 2026-10-12: `BridgeSession.watchdog_tick()` and an
incoming `stopAll` request can both call the same adapter's `stop_all()` at the
one-second watchdog boundary. A deterministic fake-adapter run observed two
simultaneous `stop_all()` calls. The Apitor adapter then issues three BLE writes
with responses for each stop, without serializing these calls or bounding an
individual write. The live bridge used byte-identical versions of these bridge,
server and Apitor-adapter source files. This establishes a concurrency hazard,
**not** that it caused the earlier timeout or that the motor kept moving. The
test client's three-second response timeout and the later acknowledged
emergency stop also cannot determine physical motion duration. No production
motor-control change or further hardware command was made in this follow-up.
Before changing the stop path, add deterministic regression coverage for
overlapping watchdog/manual stops, review the effect on Cozmo's shared bridge
contract, and arrange a separate hardware acceptance for any proposed fix.

Safety review of a candidate fix on 2026-10-12: a simple asynchronous lock
prevented overlapping watchdog/manual stop calls in fake-adapter tests, and
all targeted Apitor, Cozmo, WebSocket, behavior, Java and static checks passed.
The candidate was **not retained**: if the watchdog is already stuck in a BLE
write, the lock would also make a manual emergency `stopAll` wait behind it.
The observed live timeout lasted longer than the test client's three-second
response limit, so this is a material safety trade-off, not an acceptable
verified fix. The bridge source and live process remain unchanged. A future
design must cover both normal overlap and a stalled first stop, without
preventing a second emergency stop attempt. It also needs hardware acceptance
before release. The earlier timeout's root cause remains unproven.

Local dependency inspection strengthens the concurrency hypothesis: in the
installed Bleak 1.1.1 CoreBluetooth backend, `PeripheralDelegate` stores one
pending write-with-response future per characteristic handle. Two concurrent
response writes to Apitor's same F001 characteristic can replace that future,
leaving one caller without its expected acknowledgement. F001 also advertises
`write-without-response`, but its delivery and stop effect have **not** been
verified for this emergency path. A safe replacement should serialize normal
response writes, bound a stalled write, preserve a second emergency-stop
attempt, and explicitly report when physical delivery is unconfirmed. Fake
tests must cover the normal race and the stalled-first-write case; the
hardware stop behavior must then be checked separately before release.

Baseline regression checkpoint on 2026-10-12: three hardware-free tests in
`test_apitor_adapter.py` first reproduced the stop-path defects as expected
failures: (1) overlapping confirmed F001 writes, (2) a second stop colliding
with a stalled first one, and (3) a success acknowledgement after failed
stop writes. The baseline `OK (expected failures=3)` was **not** a safety pass.

Unreleased software candidate on local branch `fix/apitor-stop-safety-draft`:
all three tests now pass normally. The Apitor adapter serializes confirmed
F001 writes, bounds them to 0.75 seconds, and marks a timed-out session unsafe
so a late ACK cannot be accepted as confirmation of a later command. If a
confirmed write is already in flight, a second stop attempts F001 without
response immediately, then still requires confirmed stop writes before
returning success. An unconfirmed or disconnected stop returns an error;
subsequent motor commands are rejected until a fresh connection completes.
The server watchdog logs a failed stop and remains alive to retry it. Fake
tests cover collision, stalled/failed writes, timeout, disconnect after
motion, and the bridge's error response. The unchanged normal stop path still
sends three confirmed stop frames. The running CodeON bridge has **not** been
restarted or updated with this candidate; no motor command was sent.

This is **not yet hardware-approved**. F001 write-without-response is
advertised, but its delivery and actual motor-stop effect are unverified. A
same-WebSocket `stopAll` still waits for the previous request handler; the
0.75-second write bound limits that delay but is not an instantaneous physical
stop guarantee. A GATT acknowledgement is not proof of motor standstill.
Before merging or deploying, review the entire candidate and perform a
separately approved, one-motor-at-a-time stop test with immediate hub power-off
available. If that test fails, keep the prior version and revisit the design.

Follow-up review on 2026-10-12: if a motor write times out or fails, the hub
may still have received it. The candidate now reports both the original BLE
error and that the motor stop could not be confirmed, including an instruction
to switch off the hub if a motor is moving. The focused Apitor adapter suite
passed (17/17); the first run exposed an outdated assertion which was adjusted
without weakening the stale-client check. This remains a local, unreleased
draft. The running bridge was not changed and no motor command was sent.

First supervised acceptance attempt later on 2026-10-12: the user approved a
single short M1 test with the hub safely placed, but could not identify the
connected motor port. The unchanged Apitor bridge was stopped gracefully to
avoid a competing BLE client. The candidate adapter's initial eight-second
scan found no advertising Apitor and failed **before any motor command**. A
separate passive scan listed no Apitor advertisement either. The unchanged
bridge was restarted and confirmed listening again on 127.0.0.1:2224. No
physical stop behavior was verified; do not mark the candidate accepted. Ask
the user to power-cycle or otherwise make the hub advertise again before a
new, separately observed single-port attempt. Do not infer the missing M1/M2/M3
wiring from this aborted run.

After the user made the hub advertise again, a passive scan found the expected
`ApitorTXAA...` advertisement with F0FF. The user confirmed that the hub could
be switched off immediately. With the unchanged bridge listening but having
no browser client, a one-shot test against the **local candidate adapter**
connected and sent exactly one low-speed M1 motor command. Its GATT write was
acknowledged; 0.4 seconds later, an F001 global STOP without response was
attempted; after a further 0.6 seconds, the adapter completed its redundant
confirmed global STOP writes and disconnected. No M2/M3 motor command was sent.
The user then reported that one motor moved, stopped at the early stop attempt
before the later confirmed STOP, and was stationary afterward. This is one
positive physical observation for the F001 write-without-response global STOP
on M1; it does **not** prove delivery when CoreBluetooth itself stalls, nor
does it verify the unknown wiring of M2/M3. The test script also completed the
redundant confirmed STOP and disconnect cleanup. Do not run further motor
tests automatically. The candidate remains local and unreleased pending final
review and regression checks; the running bridge source was not updated.

Software-only final review on 2026-10-12 found three additional cancellation
and state-reporting gaps in the local candidate. Deterministic fake-BLE tests
first reproduced them: cancelling a motor write made no emergency STOP attempt,
cancelling a confirmed STOP made no unconfirmed STOP attempt, and an unsafe
acknowledgement still appeared as `connected: true`. A fourth test reproduced
a cancelled connect leaving its BLE client open. The candidate now makes a
best-effort unconfirmed STOP and disconnect on cancelled motor writes, makes
a best-effort unconfirmed STOP when a confirmed stop is cancelled, excludes an
unsafe client from connected status, and releases the client on cancelled
connect. Cancellation still propagates to the caller; neither cancellation
nor a write-without-response is treated as physical stop confirmation. No
new hardware commands or live-bridge changes were made for these fixes.

Regression checkpoint after these final Apitor-only changes: the complete
RobotIntegrationKit Python suite passed (124 tests, no skips), including the
Apitor, bridge, WebSocket, behavior and Cozmo adapter cases. The dedicated
Cozmo `--require-all` run passed 41 tests; the active Cozmo Java contract
passed 14 tests; Apitor/Cozmo simulation static checks and the architecture
graph check passed. `git diff --check` is clean. The Java and static checks
preceded only the final Apitor-adapter cancellation/status adjustments, which
do not change Java, web resources or shared simulation. No live deployment or
physical stalled-CoreBluetooth test was performed. A PR should therefore be
reviewed as a safety change and merged only after its checks pass; the user's
known-working live installation must remain the rollback path until then.

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

The bridge contains the recovered L1/L2 LED commands and a notification cache
for the sensor values above. CodeON exposes the verified colour classes as a
beginner-friendly colour-sensor block. The colour picker is deliberately
limited to red, green, blue and white; unsupported Blockly colours no longer
cause a server error. The infrared inputs are available as simple
`detected`/`clear` choices in the beginner toolbox and as numerical reflected-
light values (`0..255`) for S1 and S2 in the expert toolbox. Existing line-mode
programs remain compatible.

The APK's speech and sound functions use Android `TextToSpeech` and
`MediaPlayer`. No command for a speaker in the Robot X hub was found. CodeON
must therefore describe future Apitor sound blocks as output from the
Mac/tablet, not as sound from the robot.

## Endless-program disconnect fix

Hardware testing on 2026-07-30 confirmed the colour-sensor workflow and the
new infrared-sensor block is available for testing. The bridge log then showed
that the observed termination of a Blockly `repeat forever` program wasn't an
interpreter exit: macOS had dropped the BLE GATT services while the adapter's
cached connection flag still reported success. The next motor transition
failed with `Service Discovery has not been performed yet`, and CodeON invoked
its safety stop.

Adapter 0.2.1 now checks the physical Bleak connection, invalidates the client
through Bleak's disconnect callback and performs a real connection setup on
the next CodeON connection attempt. The safety stop remains unchanged. A
hardware acceptance run must verify that an endless sensor program continues
until the user presses Stop.

Checkpoint on 2026-08-01: all 72 Robot Integration Kit tests pass, including
new regression tests for an unexpected BLE disconnect and the macOS stale-GATT
write error. The subsequent hardware acceptance run was successful: the
verified colour-sensor program continued inside `repeat forever` and was ended
deliberately with CodeON's Play/Stop button. The unexpected program termination
is therefore considered fixed. The infrared-sensor hardware test remains the
next integration step.

Checkpoint on 2026-08-02: the beginner and expert infrared blocks, their stack-
machine mapping and the four-colour validation were rebuilt into the packaged
CodeON application. All 72 integration-kit tests pass and `git diff --check`
reports no whitespace errors. Physical Robot X validation is still required;
in particular, the provisional threshold of `5` and the response to nearby
objects must be checked with different distances, surfaces and ambient light.

## Simulation MVP

The first Apitor simulation reuses CodeON's established two-dimensional
differential-drive physics and its optional 2D-to-3D visual adapter. It does
not copy RCX branding, fixed RCX ports or RCX-specific sensor assumptions.
Instead, `robot.apitor` supplies an Apitor Robot X profile with its own orange
appearance and approximate chassis dimensions.

For the Robot X standard driving model, M2 is mapped to the left drive and M3
to the right drive. This agrees with the verified hardware model used during
the CodeON motor tests. M1 remains an independent auxiliary motor and is not
silently treated as a wheel. The native Apitor speed levels from `-12` to `12`
are scaled to the simulation's percentage range without changing the values
sent to physical hardware.

The existing 2D simulation remains the authoritative source for pose and
motion. The 3D view mirrors that state and renders an Apitor-specific body; it
does not introduce a second physics engine. Exact dimensions, wheel calibration,
sensor physics, M1 attachment animation and further Apitor construction models
remain separate hardware-validation steps.

## Safety gate

Further or longer motion tests require:

1. the write and notify characteristics are identified from two independent
   sources where possible;
2. the stop command remains part of normal and exceptional cleanup;
3. connection loss behavior is understood; and
4. the robot stands on a clear test surface and the user explicitly authorizes
   motion.
