# CodeON robot integration contract

This document describes the current, reviewed contract for adding a robot to a
local CodeON fork. It records the manual integration points that exist today.
The integration checker, guarded scaffold generator and read-only progress
guide implement this contract rather than inventing a second path through the
codebase.

CodeON remains usable while an integration is incomplete. A new integration
must be developed on a separate branch and must not be added to the active
robot list until its safety and build gates pass.

## Choose the integration scope first

### Bridge prototype

Use this path to discover and test hardware without adding a robot card or new
Blockly system to CodeON. It consists of:

- a vendor-specific `RobotAdapter` implementation;
- an optional, isolated vendor dependency;
- a fake or recorded test double;
- adapter and shared bridge-contract tests;
- a hardware acceptance record.

The prototype can be driven through Robot Bridge Protocol 1.0. It is the safe
starting point for an unknown Wi-Fi, BLE or USB protocol. It does not require a
Maven module, server whitelist entry, toolbox, browser card or simulation.

### Complete CodeON robot system

Choose this path only after the bridge prototype can connect, report status and
stop the hardware reliably. A complete system additionally provides the robot
plugin, program representation, browser connection, toolbox, preview image and
all registrations needed to make the robot selectable in CodeON.

## Non-negotiable safety and compatibility rules

- Production bridges bind only to `127.0.0.1` or `::1` and allowlist browser
  origins.
- `stop_all` is immediate, idempotent and safe before, during and after a
  connection.
- Disconnect, transport loss, watchdog expiry and process shutdown stop every
  actuator.
- Physical values are clamped to conservative, hardware-verified limits.
- Vendor libraries remain optional and are imported only by their adapter.
- Manifests, logs and tests contain no credentials, Wi-Fi passwords, tokens,
  biometric identities or captured user programs.
- Existing robot modules and generated runtime files are not used as a scratch
  area. Generated files are rebuilt from their maintained sources.
- Hardware support is never described as verified before the corresponding
  physical acceptance gate has passed.
- Third-party licenses, copyright notices and trademark boundaries are kept.

## Current bridge integration points

These paths are authoritative until a checked manifest replaces the manual
registrations:

| Concern | Current location | Requirement |
| --- | --- | --- |
| Adapter contract | `RobotIntegrationKit/python/src/codeon_robot_bridge/adapter.py` | Implement every abstract method. |
| Capabilities and limits | `capabilities.py` and the adapter manifest | Use a stable lowercase robot identifier and conservative limits. |
| Vendor adapter | `RobotIntegrationKit/python/src/codeon_robot_bridge/<id>_adapter.py` | Keep vendor imports isolated and failures explicit. |
| Adapter selection | `RobotIntegrationKit/python/src/codeon_robot_bridge/server.py` | Register the adapter without weakening host, origin or size limits. |
| Optional dependency | `RobotIntegrationKit/python/pyproject.toml` | Put vendor packages in a new robot-specific extra named `<id>` or `<id>-<purpose>`. |
| Shared contract | `RobotIntegrationKit/python/tests/test_bridge_contract.py` | Preserve protocol, heartbeat and stop behavior. |
| Robot tests | `RobotIntegrationKit/python/tests/test_<id>_adapter.py` | Cover success, failure, limits and repeated stop. |
| Local launch | platform launcher and its tests | Add only after manual startup works; use a unique loopback port. |

`FakeRobotAdapter` is a deterministic test double, not a production adapter to
copy without review. New adapters should share the neutral protocol but expose
only capabilities that the real hardware has demonstrated.

## Additional complete-system integration points

| Concern | Current location | Requirement |
| --- | --- | --- |
| Maven module | `Robot<Id>/pom.xml` and root `pom.xml` | Add the module and its managed dependency explicitly. |
| Server packaging | `OpenRobertaServer/pom.xml` | Package the plugin with the local server. |
| Active robot list | `OpenRobertaServer/src/main/resources/openRoberta.properties` | Add the ID only after all pre-activation gates pass. |
| Plugin descriptor | `Robot<Id>/src/main/resources/<id>.properties` | Declare resources, configuration mode, workers and workflows. |
| Program resources | `Robot<Id>/src/main/resources/<id>/` | Provide default program, toolboxes and configuration resources. |
| Java pipeline | `Robot<Id>/src/main/java/` | Add syntax, validation and stack-machine generation only where neutral operations are insufficient. |
| Browser connection | `OpenRobertaWeb/src/app/roberta/controller/connections/connections.ts` | Export the connection class expected by the current name resolver. |
| Hardware behavior | `OpenRobertaWeb/src/app/nepostackmachine/` | Map neutral stack-machine operations to bridge commands. |
| Robot card image | maintained `OpenRobertaServer/staticResources/css/img/system_preview/` source | Supply a licensed image and let the normal packaging process synchronize runtime copies. |
| Optional simulation | maintained `OpenRobertaWeb/src/app/simulation/` sources and aliases | Use the same stack-machine program as hardware. |
| Architecture model | `architecture/codeon-architecture-graph.json` and code-graph configuration | Declare module, dependencies, robot impact and required tests. |
| Regression checks | `scripts/` and module tests | Cover toolbox, connection, generation, simulation and safety contracts. |

The browser currently resolves a robot ID by uppercasing only its first
character and appending `Connection`. For example, `cozmo` requires an exported
`CozmoConnection`. Until the future manifest supplies an explicit class name,
new identifiers should contain only lowercase ASCII letters and digits and the
connection class must follow this exact rule.

Files below `application/staticResources` and compiled JavaScript below
`OpenRobertaServer/staticResources/js` are packaged outputs. They must be
produced by the documented frontend and packaging builds, not edited as the
primary implementation.

## Integration gates

### Gate 0: protocol and legal evidence

- Identify the exact model, firmware and supported host operating systems.
- Record how the protocol was obtained and whether redistribution is allowed.
- Do not commit captured credentials, private application data or vendor
  binaries without a verified redistribution right.

### Gate 1: adapter without hardware

- Define capabilities and conservative limits.
- Implement a deterministic fake or recorded test double.
- Pass all shared bridge tests without installing the vendor library.

### Gate 2: safe hardware connection

- Verify connect, status, repeated disconnect and repeated `stop_all`.
- Verify startup with hardware absent and vendor dependency absent.
- Verify watchdog, transport loss and process shutdown on real hardware.

No movement command is enabled before this gate passes.

### Gate 3: actuators and sensors

- Introduce one actuator or sensor family at a time.
- Test minimum, nominal and maximum values with conservative physical limits.
- Test interruption while moving and reconnection after failure.
- Distinguish raw values from calibrated physical units.

### Gate 4: complete CodeON system

- Add the Maven plugin, resources, browser connection and robot card.
- Prefer neutral stack-machine operations; document every robot-specific one.
- Pass the active robot reactor and server package build before activation.

### Gate 5: simulation and usability

- Run the same generated stack-machine program on hardware and simulation.
- Make intentional differences explicit, especially program-end behavior.
- Verify first selection, source view, program transfer, start and stop.

### Gate 6: hardware acceptance

- Execute the documented beginner program repeatedly.
- Test emergency stop and connection loss during every moving actuator.
- Record verified functions and known limitations separately.
- Only then change the integration from experimental to hardware-verified.

## Definition of done

A complete integration is ready when a fresh local clone can build it, its
vendor dependency remains optional, the fake path works without hardware, all
required checks pass, every stop path has been physically verified, and the
documentation allows another person to reproduce both setup and acceptance.

## Automation boundary

`npm run robot:check` validates every manifest and its repository registrations
without modifying files. Use `npm run robot:check -- --id <robot-id>` for one
known manifest. A focused check still detects ID and port collisions across all
manifests. The checker accepts no arbitrary manifest path, does not invoke shell
commands and treats commands in the architecture graph as informational.

The JSON Schema checks portable structure and the cross-field rules it can
express. `robot:check` is authoritative for relationships that standard JSON
Schema cannot express here, including ordered ranges, ID-derived adapter,
preview and browser class names, robot-specific dependency names, repository
registrations and global uniqueness. Repository checks are deliberately static
consistency checks: finding a capability name, connection construction or 3D
registration does not prove runtime behavior or replace adapter, browser,
simulation and physical hardware tests.

`npm run robot:status -- --id <robot-id>` presents the same integration as a
read-only sequence of manifest, bridge, complete-system, verification and
hardware phases. It is an orientation aid, not a test runner or CI replacement:
declared test commands are always displayed as pending and must be run and
recorded separately through the normal workflow.

The graphical assistant enabled with `robotIntegrationAssistant=1` on an exact
loopback host is an additional passive preview of the first integration phase.
It has no network, repository, storage, download or hardware capability. It may
reject obviously invalid or already active robot identifiers, but its browser
checks do not replace the repository-aware command-line preflight. The normal
start page remains unchanged when the explicit parameter is absent.

Before exposing its scaffold preview, the assistant performs a deterministic
feasibility assessment. A locked protocol, unavailable local control, missing
actuator control or a missing safe-stop command produces `not-ready` and keeps
the next step closed. Partial or unknown evidence produces `research-required`;
documented local control, direct actuator control, a safe stop and available
test hardware produce `well-suited`. Sensor access may remain unavailable for
robots whose declared capabilities do not include sensors. A supplied HTTP(S)
reference is displayed as evidence only and is never fetched or interpreted.

After a valid scaffold preview, the assistant can also describe a bounded
hardware profile: stationary, wheeled or tracked construction; kinematics;
optional wheel/track geometry and speed; up to twelve actuators and twelve
sensors; control/value types; units; numeric ranges; safe states; command
completion and sampled/event access. Component identifiers are unique across
both categories. Invalid values produce neither profile nor block mapping.

The resulting hardware profile and block mapping are deliberately separate
preview documents, not extensions of the authoritative integration manifest.
The profile is always `draft` and `hardwareTested: false`. Suggested mappings
refer to semantic block concepts such as drive, stop, motor, distance, touch or
wait-until; they do not assert that a concrete Blockly block supports the new
device. Every mapping carries `expertReviewRequired: true`, and unfamiliar
drive, actuator or sensor types are classified as custom work. A later expert
must reconcile the suggestions with the robot's protocol, CodeON AST/runtime,
toolbox and generator before any block is exposed.

`npm run robot:new -- --dry-run ...` previews a fail-closed bridge scaffold,
including exact paths and hashes in normal output. Add `--json` when the exact
generated content is required. Only a separate invocation with `--write`,
`--confirm <robot-id>` and `--plan-hash <reviewed-sha256>` may create the four
fixed scaffold files. The plan hash binds the write to the exact preview. The
writer verifies the paths, byte counts and hashes again, creates files
exclusively and rolls its own files back after an ordinary failure. It accepts
no output or template path, does not create directories, never overwrites and
makes no registrations.

An abrupt process or operating-system termination cannot guarantee rollback;
inspect the four reported paths before retrying. Both modes reject identifiers
and local ports already reserved by active CodeON systems, launchers or
manifests. Neither mode infers a proprietary protocol, invents safe motor limits
or claims hardware verification.
