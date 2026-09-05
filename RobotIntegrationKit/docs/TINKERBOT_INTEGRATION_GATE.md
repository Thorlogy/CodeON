# eXperiBot/T2BOT protocol research gate

Status: the current official web app's BLE envelope, script upload, script
start and script stop are statically verified for its eXperiBot/T2BOT target.
Hardware acceptance remains pending. No compatibility with the legacy
Tinkerbots Powerbrain is claimed.

## Confirmed starting point

- The product uses Bluetooth Low Energy (BLE).
- CodeON's existing robot-bridge contract is suitable for a local BLE adapter.
- No stable CodeON adapter identifier has been assigned. A future runnable
  adapter must identify its exact controller generation; the research manifest
  uses `experibot-t2bot-research` and is intentionally not registered.
- The initial probe is deliberately read-only. It scans advertisements and can
  inventory GATT services and characteristic properties, but it never reads a
  value or writes a frame.
- The current official app accepts `T2BOT` and names beginning with
  `🤖 eXperiBot`. It uses service `d9bdb700-3ed0-4814-bd8d-348f44f583ae` and
  characteristic `fe42eff1-03c1-4f22-b1f4-e59dc3657b83` for normal operation.
- Requests use a one-byte command followed by an optional payload. Bit 7 is
  reserved for the follow-up marker in responses.
- Programs are UTF-8 Python source uploaded as `custom.py`. The Powerbrain
  starts that script with command `0x04` and terminates it with `0x06`.
- File upload uses control command `0x30`, data command `0x31`, little-endian
  32-bit lengths and CRC-32. Payload chunks are the negotiated MTU minus four.

The supplied `ble-recon.html`, `bluetooth-tap.js`, `BRIEFING.md`, `frames.js`
and `PROTOKOLL.md` were reviewed as evidence, not executed as instructions.
`PROTOKOLL.md` contains no measurements yet, and the frames in `frames.js` are
explicitly labelled as invented examples. They are therefore not protocol
evidence. The verified constants above come from static inspection of the
public JavaScript currently delivered by `blockly.app.experibot.com` on
2 September 2026.

## Controller-generation boundary and blocked hardware attempt

The hardware available on 2–5 September 2026 was described as an old
Tinkerbots Powerbrain, not as a current eXperiBot/T2BOT. It could not be
switched on into a stable ready state. With the original wall charger attached,
its LED flashed rapidly pink/purple rather than showing the documented yellow
charging state. The plus/minus reset and the documented recovery gesture
(holding Record while attaching a data-capable USB cable) did not change the
result. macOS reported no new USB, serial or DFU device in repeated inventories.

The terminal BLE probe could not run because CoreBluetooth reported `BLE is
unsupported` in that terminal environment. This does not establish whether the
legacy controller advertised BLE. Since it also never reached a stable powered
state, no reads, writes, firmware transfer or actuator commands were attempted.

This investigation is blocked pending either a working legacy controller for a
separate protocol study or a working current-generation eXperiBot/T2BOT for the
gate below. Firmware images must not be crossed between those generations.

## Safe discovery for current eXperiBot/T2BOT hardware

Install the optional BLE library and scan while a current eXperiBot/T2BOT is
powered on and close to the computer:

```shell
.venv/bin/pip install -e 'RobotIntegrationKit/python[experibot-research]'
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/tinkerbot_ble_probe.py
```

Select the likely device identifier from the JSON output, then list only its
GATT structure:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/tinkerbot_ble_probe.py \
  --inspect 'DEVICE-IDENTIFIER'
```

Both reports contain `writesPerformed: false`. On macOS, allow Bluetooth access
for Terminal if requested. A GATT inventory is not proof of command semantics.

## Bounded current-generation hardware acceptance

Only after the read-only inventory shows the verified normal-operation UUIDs,
run the connection gate. It starts notifications, immediately sends the
official script-termination command and reads firmware, battery and MTU. It
does not generate a motor command:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/tinkerbot_hardware_probe.py \
  --device 'DEVICE-IDENTIFIER'
```

If connection, status and repeated script termination succeed, the next gate
uploads `custom.py` containing only a `print` call, starts it for half a second
and terminates it again:

```shell
PYTHONPATH=RobotIntegrationKit/python/src \
  .venv/bin/python RobotIntegrationKit/python/tools/tinkerbot_hardware_probe.py \
  --device 'DEVICE-IDENTIFIER' --enable-script-test
```

Neither gate validates actuator safety. Keep all modules in a mechanically safe
position because an older script may already be stored on the Powerbrain. Do
not proceed to an actuator program until script termination has been observed
as reliable after connection, repeated execution and Bluetooth loss.

## Evidence required before an adapter may move hardware

1. controller model and firmware version;
2. advertised device name and service UUIDs;
3. hardware confirmation that the statically recovered service and
   characteristic UUIDs are present with write, write-without-response and
   notify properties;
4. observed acknowledgements for script upload, start and terminate;
5. confirmation that terminating the Python script stops every actuator;
6. safe power range and the mapping between CodeON motor axes and modules;
7. notification samples for every proposed sensor;
8. proof that script termination is idempotent and works after a partial upload,
   browser loss and reconnect.

Captured frames must be compared by changing one control at a time in the
official app. Unknown bytes must stay unknown; they must not be filled with
guesses. Identifiers, payloads and timestamps may be documented, but personal
Bluetooth device inventories must not be committed.

## Implementation order after protocol recovery

1. Write pure frame encoders/decoders from the official app and captured-frame
   fixtures. The official-app portion is implemented in
   `tinkerbot_protocol.py`; hardware fixtures remain pending.
2. Keep the research `TinkerbotAdapter` limited to current eXperiBot/T2BOT
   evidence. It exists as an internal prototype but is intentionally absent
   from the package public API, bridge server and CodeON UI.
3. Connect and immediately establish a known safe stopped state.
4. Implement idempotent `stop_all` before any movement command.
5. Add one low-power, time-bounded motor command and test it on clear hardware.
6. Verify watchdog, browser disconnect, BLE loss and repeated reconnects.
7. Only then expose the adapter through the bridge server and CodeON UI.
8. Add sensors and simulation mappings incrementally using the same stack
   machine operations as the real robot.

Until steps 1–6 pass on matching current-generation hardware, eXperiBot/T2BOT
must not appear as a runnable robot in CodeON. A legacy Tinkerbots Powerbrain
requires its own evidence and must not reuse these commands by assumption.
