#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    impactForPaths,
    loadGraph,
    normalizeRepositoryPath,
    robotSummary,
    validateGraph
} = require('./codeon-architecture-graph');

const graph = loadGraph();
assert.deepStrictEqual(validateGraph(graph), [], 'Architecture graph must match repository structure and plugin properties.');

const coreImpact = impactForPaths(graph, ['OpenRobertaRobot/src/main/java/de/fhg/iais/roberta/factory/RobotFactory.java']);
assert.strictEqual(coreImpact.risk, 'critical');
assert.deepStrictEqual(coreImpact.affectedRobots.map((robot) => robot.id), ['robot.apitor', 'robot.cozmo', 'robot.edison', 'robot.rcj', 'robot.rcx']);
assert.ok(coreImpact.requiredChecks.some((test) => test.id === 'test.java-reactor'));

const spikeImpact = impactForPaths(graph, ['RobotSpike/src/main/java/example.java']);
assert.deepStrictEqual(spikeImpact.affectedRobots.map((robot) => robot.id), ['robot.apitor', 'robot.cozmo', 'robot.rcj']);
assert.ok(spikeImpact.requiredChecks.some((test) => test.id === 'test.cozmo-contract'));

const cozmoImpact = impactForPaths(graph, ['RobotCozmo/src/main/resources/cozmo.properties']);
assert.deepStrictEqual(cozmoImpact.affectedRobots.map((robot) => robot.id), ['robot.cozmo']);
assert.ok(cozmoImpact.requiredChecks.some((test) => test.id === 'test.cozmo-contract'));

const unknownImpact = impactForPaths(graph, ['docs/new-unmapped-area.md']);
assert.strictEqual(unknownImpact.risk, 'unknown');
assert.strictEqual(unknownImpact.reviewRequired, true);
assert.deepStrictEqual(unknownImpact.unknownPaths, ['docs/new-unmapped-area.md']);

const buddyRetrievalImpact = impactForPaths(graph, ['scripts/codeon-code-buddy-context.js']);
assert.strictEqual(buddyRetrievalImpact.risk, 'medium');
assert.deepStrictEqual(buddyRetrievalImpact.unknownPaths, []);
assert.ok(buddyRetrievalImpact.requiredChecks.some((test) => test.id === 'test.code-graph'));
assert.ok(buddyRetrievalImpact.requiredChecks.some((test) => test.id === 'test.buddy-security'));

const changePlannerImpact = impactForPaths(graph, ['scripts/codeon-change-planner.js']);
assert.strictEqual(changePlannerImpact.risk, 'medium');
assert.deepStrictEqual(changePlannerImpact.unknownPaths, []);
assert.ok(changePlannerImpact.requiredChecks.some((test) => test.id === 'test.code-graph'));

const ciImpact = impactForPaths(graph, ['.github/workflows/unit_test_triggered_by_develop_push.yml']);
assert.strictEqual(ciImpact.risk, 'high');
assert.strictEqual(ciImpact.reviewRequired, true);
assert.deepStrictEqual(ciImpact.unknownPaths, []);
assert.ok(ciImpact.requiredChecks.some((test) => test.id === 'test.graph'));

const unitTestWorkflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/unit_test_triggered_by_develop_push.yml'), 'utf8');
assert.match(unitTestWorkflow, /pull_request:\s*\n\s+branches: \[ master, develop \]/);
assert.match(unitTestWorkflow, /push:\s*\n\s+branches: \[ master, develop \]/);
assert.match(unitTestWorkflow, /permissions:\s*\n\s+contents: read/);
assert.match(unitTestWorkflow, /run: mvn --batch-mode clean install/);

assert.strictEqual(robotSummary(graph, 'cozmo').configurationMode, 'fixed');
assert.strictEqual(robotSummary(graph, 'edison').configurationMode, 'built-in');
assert.throws(() => robotSummary(graph, 'not-a-robot'), /Unknown robot/);

for (const unsafePath of ['/tmp/outside', '../outside', 'a\\b', 'safe\0unsafe']) {
    assert.throws(() => normalizeRepositoryPath(unsafePath));
}

console.log('CodeON architecture graph checks passed.');
