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
| RCJ RescueOnlineSim | drive a distance, show text | no separate physical target generator |
| Cozmo | drive a distance, raise the lift | bridge stack code |
| Apitor Robot X | run motor M1, wait, stop | bridge stack code |

The fixtures live in
`OpenRobertaServer/src/test/resources/codeonLegacyPrograms/`. Every case uses
the corresponding robot plugin's standard configuration.

The RCJ case also protects the standard configuration's colour-sensor block.
RCJ stores it as `robConf_colour`, while older robot configurations use
`robBrick_colour`; both names resolve to the same generic colour-sensor
component. A focused `RcjConfigurationDefaultTest` checks the colour and
inductive sensors in the RCJ default configuration directly.

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
contracts remain separate.
