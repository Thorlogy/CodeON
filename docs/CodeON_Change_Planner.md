# CodeON Change Planner

## Purpose

The Change Planner turns a task description and either explicit paths or a reviewed Git comparison into a bounded development map. It helps Codex and contributors find the smallest relevant source set before editing and shows robot impact and test recommendations before implementation.

It does not edit files, execute tests, call a model, access a network service, or claim that heuristic relationships are exact.

## Commands

Plan from a feature-branch comparison:

```sh
npm run graph:plan -- --base master --query "Cozmo configuration validation"
```

Plan before editing from one or more candidate files:

```sh
npm run graph:plan -- \
  --query "optimize Cozmo validation" \
  --path RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java
```

Use `--json` for machine-readable output:

```sh
npm run graph:plan -- --base origin/master --json
```

`--base` and `--path` are mutually exclusive. A task query may be combined with either mode. Git comparison resolves the merge base and compares it with the complete working tree. This includes committed, staged, unstaged, and non-ignored untracked paths as well as added, copied, deleted, modified, renamed, type-changed, unmerged, unknown, and broken-pair records without reading file bodies.

## Output model

- `summary` provides risk, review status, counts, and the split between exact and heuristic context.
- `changedFiles` records the reviewed Git or explicit input paths and whether the current code graph covers them.
- `affectedRobots` comes only from the reviewed architecture graph.
- `requiredChecks` contains informational recommendations with `automaticExecution: false`.
- `readFirst` ranks changed files, literal task matches, impact neighbors, and exact imports/containment targets.
- `exactRelationships` may guide automatic file reading.
- `heuristicHints` contains `name-only` references with `automaticallySelected: false`.
- unknown architecture paths and paths outside the source allowlist remain visible instead of being treated as safe.

## Security model

- Git is invoked with `spawnSync`, fixed argument arrays, `shell: false`, terminal `--` markers, bounded output buffers, and a strictly validated base revision and merge-base identifier.
- Repository paths reject traversal, absolute paths, backslashes, NUL bytes, and oversized values through the existing graph path validator.
- Task text is literal, bounded, token-limited, and never compiled as a regular expression or evaluated as code.
- The planner builds a fresh in-memory graph and emits metadata only. Source bodies, comments, arbitrary string literals, credentials, user programs, and generated indexes are excluded.
- Result counts and the encoded plan size have hard limits.
- Commands stored in the reviewed architecture graph are displayed only as recommendations. The planner never executes them.
- A changed path that is outside the source allowlist or architecture rules is reported explicitly.

## Recommended Codex workflow

1. Run the planner with the task and initial candidate path, or with `--base master` after a first small working-tree change.
2. Review affected robots, unknown paths, `readFirst`, exact relationships, and required checks.
3. Read only the selected sources needed to confirm the implementation pattern.
4. Implement the smallest coherent change.
5. Run the planner again against the branch to catch newly introduced impact.
6. Review each recommended command before running the checks that are relevant to the actual diff.

The planner narrows investigation; it is not a compiler proof, security proof, or substitute for code review.
