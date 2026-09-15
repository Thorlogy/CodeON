# {{DISPLAY_NAME}} hardware acceptance

This record starts unverified. Do not change the integration manifest from
`experimental` or add the robot to CodeON's active whitelist until the relevant
checks below have passed on physical hardware.

## Identity and evidence

- Robot ID: `{{ROBOT_ID}}`
- Transport: `{{TRANSPORT}}`
- Tested hosts: {{HOSTS}}
- Exact model and hardware revision:
- Firmware version:
- Protocol source and redistribution status:
- Tester and date:

## Fail-closed bridge prototype

- [ ] Missing vendor dependency produces an actionable error without movement.
- [ ] Missing or powered-off hardware produces an actionable error.
- [ ] Repeated connect and disconnect do not leave actuators powered.
- [ ] `stop_all` is immediate and idempotent.
- [ ] Transport loss stops every actuator.
- [ ] Watchdog expiry stops every actuator.
- [ ] Process shutdown stops every actuator.

## Capabilities and limits

For each actuator or sensor, record the evidence, conservative limit and test
result before adding it to the manifest.

| Capability | Evidence | Conservative limit/unit | Result |
| --- | --- | --- | --- |
| _not yet verified_ |  |  |  |

## Known limitations

- Hardware protocol and safety limits are not yet verified.
