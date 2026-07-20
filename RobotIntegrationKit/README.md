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

## Local development

The core and fake adapter have no runtime dependencies:

```shell
PYTHONPATH=RobotIntegrationKit/python/src python3 -m unittest discover \
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
.venv/bin/pip install -e 'RobotIntegrationKit/python[server,cozmo]'
.venv/bin/codeon-robot-bridge --adapter cozmo
```
