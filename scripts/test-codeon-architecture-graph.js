#!/usr/bin/env node

'use strict';

const assert = require('assert');
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

assert.strictEqual(robotSummary(graph, 'cozmo').configurationMode, 'fixed');
assert.strictEqual(robotSummary(graph, 'edison').configurationMode, 'built-in');
assert.throws(() => robotSummary(graph, 'not-a-robot'), /Unknown robot/);

for (const unsafePath of ['/tmp/outside', '../outside', 'a\\b', 'safe\0unsafe']) {
    assert.throws(() => normalizeRepositoryPath(unsafePath));
}

console.log('CodeON architecture graph checks passed.');
