# CodeON LEGACY regression suite

## Purpose

This suite protects one small, representative block program for every active
CodeON robot system. It is intentionally an additional safety net around the
existing LEGACY execution path; it does not change interpreter, generator,
simulation, bridge, or hardware behavior.

For every fixture the test verifies that CodeON can:

1. load the Blockly XML with a compatible robot configuration;
2. run the server's `getsimulationcode` workflow successfully;
3. generate the expected stack-machine operations in order; and
4. regenerate semantically equivalent Blockly XML.

RCX and Edison V2 additionally run `showsource` and verify characteristic
markers in their NQC and Python target code.

## Covered programs

| Robot | Representative program | Additional target-code check |
| --- | --- | --- |
| RCX | drive continuously, wait, stop | NQC |
| Edison V2 | drive a distance, play a tone | Python |
| RCJ RescueOnlineSim | drive a distance, wait | no separate physical target generator |
| Cozmo | drive a distance, raise the lift | bridge stack code |
| Apitor Robot X | run motor M1, wait, stop | bridge stack code |

The fixtures live in
`OpenRobertaServer/src/test/resources/codeonLegacyPrograms/`. RCJ uses a
minimal test configuration containing only its differential drive and two
drive motors. This isolates the program workflow from unrelated legacy
configuration blocks.

## Run locally

```sh
mvn --batch-mode -pl OpenRobertaServer -am \
  -Dtest=CodeOnLegacyProgramRegressionTest \
  -DfailIfNoTests=false \
  -DargLine='--add-opens java.base/java.lang=ALL-UNNAMED' \
  test
```

The same focused command runs in the CodeON unit-test workflow for pull
requests and pushes to `master` or `develop`.

## Deliberate limits

The suite does not claim to execute browser physics, connect hardware, or
validate every available block. Hardware tests and the static 3D simulation
contracts remain separate. The RCJ display action is not part of this initial
baseline because its hidden configuration-port binding needs a separate,
focused compatibility test before it can become a reliable regression
fixture.
