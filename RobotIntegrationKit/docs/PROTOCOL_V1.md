# CodeON Robot Bridge Protocol 1.0

Status: draft implemented by the transport-neutral bridge core.

## Envelope

Every request is a JSON object with a unique string `id`, `version: "1.0"`
and a `type`. Responses repeat the request ID.

```json
{"id":"42","version":"1.0","type":"status"}
```

Successful response:

```json
{"id":"42","ok":true,"result":{"connected":false,"robot":"cozmo"}}
```

Error response:

```json
{"id":"42","ok":false,"error":{"code":"NOT_CONNECTED","message":"robot is not connected"}}
```

## Message types

| Type | Additional fields | Purpose |
| --- | --- | --- |
| `capabilities` | none | Read adapter capabilities and safety limits |
| `connect` | none | Connect to a robot already reachable by the host |
| `disconnect` | none | Stop motion and close the robot session |
| `status` | none | Read connection and diagnostic state |
| `heartbeat` | none | Renew the active motion lease |
| `command` | `command`, optional `params` | Execute an actuator command |
| `sensor` | `sensor`, optional `params` | Read a sensor value |
| `stopAll` | none | Immediately and idempotently stop all motion |

The bridge does not change the host's Wi-Fi configuration. The user connects
the host to the robot network before `connect` is requested.

## Safety requirements

- The production transport binds to loopback only.
- Browser origins are explicitly allowlisted.
- Every motion command starts a short lease renewed by `heartbeat`.
- Expired leases invoke `stopAll` without waiting behind normal commands.
- Adapters clamp physical values to the limits published in their manifest.
- Disconnect, transport loss and process shutdown invoke `stopAll`.

Exact timeouts and physical limits remain adapter configuration and require
real-hardware verification.

## Versioning

Additive capability and result fields are backward compatible. New required
fields or changed command semantics require a new protocol version.
