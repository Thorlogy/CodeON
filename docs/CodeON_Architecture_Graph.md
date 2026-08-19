# CodeON Architecture and Impact Graph

## Purpose

The graph in `architecture/codeon-architecture-graph.json` records the small set of architecture relationships that matter most for safe CodeON changes:

- which module implements each active robot;
- which robot modules depend on shared modules;
- which regression checks protect a robot;
- which robots and checks are affected by a changed path;
- whether a robot uses a fixed, user-configurable, or built-in configuration.

It is intentionally separate from the generated local symbol graph and is not a vector RAG index. Source code and plugin property files remain authoritative. The validator fails if reviewed graph metadata disagrees with repository paths, Maven module dependencies, or robot configuration properties. The complementary local code graph is documented in `docs/CodeON_Local_Code_Graph.md`.

## Usage

Validate the graph:

```sh
npm run test:architecture-graph
```

Calculate change impact before editing shared code:

```sh
npm run graph:impact -- OpenRobertaRobot/src/main/java/de/fhg/iais/roberta/factory/RobotFactory.java
```

Query one robot:

```sh
npm run graph:robot -- cozmo
```

For the JAXB-based Cozmo contract on Java 17 or newer, use the exact command printed by the impact tool. It includes only the required `java.lang` module opening for the forked test JVM.

The reduced CodeON parent reactor contains RCX, Edison, RCJ/RobotSpike, Cozmo, Apitor, the shared robot core, and the server. Some historical server tests still enumerate upstream plugins that are not part of this reactor and therefore fail on missing resources such as `ev3dev.properties`, `bob3.properties`, or `microbitv2.properties`. The impact graph consequently reports two honest checks for shared Java changes: active robot reactor tests and a test-skipping server package build. Reconciliation of the historical server test inventory is separate technical debt; it is not silently ignored or represented as green.

The impact command prints machine-readable JSON containing risk, affected robots, required checks, matched reasons, and any unknown paths. Unknown paths deliberately require manual review; they are never reported as safe.

## Security model

- The tool is local and read-only.
- It performs no network requests and starts no services.
- It uses only the Node.js standard library and adds no production dependency.
- It never executes the informational commands stored in the graph.
- Query paths must be repository-relative and may not contain traversal, absolute paths, backslashes, NUL bytes, or symlink escapes.
- The graph file has a size limit and strict allowlists for node, edge, configuration, and risk types.
- Graph data must not contain secrets, runtime database contents, program contents, user data, or generated code indexes.

These controls keep a manipulated graph or hostile filename from becoming a shell-command or filesystem traversal path.

## Deliberate limitations

This reviewed graph does not index functions, classes, calls, or runtime traces. The local code graph provides bounded symbol and dependency navigation, while keeping exact and heuristic relationships visibly distinct. A compiler-based SCIP or CodeQL proof of concept should only be added after a benchmark demonstrates additional value. Any future Codex adapter must remain read-only, expose a narrow allowlist of queries, bind locally, have no shell execution, and treat all repository-derived text as untrusted output.
