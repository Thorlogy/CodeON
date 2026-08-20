# CodeON Local Code Graph

## Purpose

The local code graph adds fast, repository-wide navigation to the reviewed architecture graph. It indexes allowlisted CodeON production, test, web, and bridge sources and answers questions such as:

- where a class, function, method, or file is defined;
- which imports and declarations belong to one file;
- which files may depend on a changed file;
- which tests, robots, and regression commands the reviewed architecture graph requires.

It is a development aid, not a compiler proof and not a cloud RAG service. The generated index is ignored by Git and must not be committed.

## Commands

Validate a fresh in-memory graph:

```sh
npm run graph:code:validate
```

Create the optional local JSON index below `.codeon/`:

```sh
npm run graph:code:build
```

Find symbols or files without regular-expression evaluation:

```sh
npm run graph:code:query -- CozmoValidatorAndCollectorWorker
npm run graph:code:query -- BridgeSession
```

Inspect one allowlisted file:

```sh
npm run graph:code:file -- OpenRobertaWeb/src/app/simulation/simulationLogic/robot.cozmo.ts
```

Combine dependency reachability with the reviewed robot/test impact:

```sh
npm run graph:code:impact -- RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java
```

Run the contract suite:

```sh
npm run test:code-graph
```

Run the reviewed retrieval benchmark:

```sh
npm run benchmark:code-graph
```

Create a bounded metadata-only context for local Code Buddy use:

```sh
npm run graph:code:buddy -- --query BridgeSession
npm run graph:code:buddy -- --query CozmoFixedConfigurationTest --path RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java
```

Add `--json` for machine-readable output. The adapter does not contact a model or a network service. It is the local retrieval boundary that can be handed to a separately approved Code Buddy integration.

## Retrieval benchmark and Buddy boundary

`architecture/codeon-code-graph-benchmark.json` records expectations from representative Cozmo, Apitor, robot-bridge, simulation, and shared-core changes. The benchmark fails when reviewed files, robot impact, or required checks disappear, and it limits unexpected query paths so a result cannot pass through recall alone.

The Buddy adapter builds a fresh graph in memory and selects only bounded metadata. Exact containment and import relationships may enter the packet; heuristic `name-only` references are excluded from automatic context. Architecture impact contributes robot modes and check identifiers, but stored shell commands are deliberately omitted.

The adapter does not modify the browser Code Buddy, call Ollama, call a cloud provider, or persist its packet. Any future automatic UI or model connection requires a separate review of user consent, data recipients, request-size limits, and the local trust boundary.

## Data and precision model

The index contains only bounded metadata:

- repository-relative file paths, language, module, scope, and byte size;
- symbol names, kinds, qualified names, and declaration line numbers;
- containment and resolved import edges marked `exact`;
- unresolved external dependencies marked `external`;
- uniquely resolvable call-name hints marked `name-only`.

`name-only` edges are intentionally conservative navigation hints. They may be incomplete and must not be used as proof that a change is safe. The `impact` command includes the reviewed architecture impact so robot and test requirements do not depend on heuristic symbol matching.

## Security model

- Source discovery uses the reviewed allowlist in `architecture/codeon-code-graph.config.json`.
- Generated, packaged, dependency, build, virtual-environment, and IDE directories are excluded.
- Symbol extraction uses local Node.js standard-library code and performs no network requests.
- The tool never executes repository content, graph values, stored commands, imports, or query text.
- Paths reject traversal, absolute forms, backslashes, NUL bytes, and repository/symlink escapes.
- Queries are literal, length-limited, result-limited, and never compiled as regular expressions.
- File, node, edge, query, and encoded-index sizes have hard limits.
- Generated files can only be written as JSON below ignored `.codeon/`, using an atomic replacement.
- Source bodies, comments, arbitrary string literals, user programs, runtime data, secrets, and credentials are never included in graph nodes. Only bounded module/import specifiers are retained as dependency metadata.

## Deliberate limitations and next gate

The current indexer is syntax-aware and dependency-free. Java, JavaScript, TypeScript, and Python declarations and imports are covered, but cross-language call resolution is deliberately limited. Before adding compiler-backed AST tooling, SCIP, CodeQL, embeddings, a database, an MCP server, or any network service, require:

1. an extension of the checked-in benchmark with the real CodeON changes that justify the new capability;
2. a documented threat model and dependency review;
3. a local-only prototype that keeps raw source out of generated graph records;
4. explicit approval for any new dependency or service.

This keeps the useful retrieval surface stable while allowing higher-precision parsers to replace individual extraction stages later.
