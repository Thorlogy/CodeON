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

const robotIntegrationImpact = impactForPaths(graph, ['RobotIntegrationKit/manifests/cozmo.json']);
assert.strictEqual(robotIntegrationImpact.risk, 'medium');
assert.deepStrictEqual(robotIntegrationImpact.unknownPaths, []);
assert.deepStrictEqual(robotIntegrationImpact.affectedRobots.map((robot) => robot.id), ['robot.apitor', 'robot.cozmo']);
assert.ok(robotIntegrationImpact.requiredChecks.some((test) => test.id === 'test.robot-integration'));

const robotTemplateImpact = impactForPaths(graph, ['RobotIntegrationKit/templates/bridge/adapter.py.tpl']);
assert.strictEqual(robotTemplateImpact.risk, 'medium');
assert.deepStrictEqual(robotTemplateImpact.unknownPaths, []);
assert.ok(robotTemplateImpact.requiredChecks.some((test) => test.id === 'test.robot-integration'));

const robotBridgeImpact = impactForPaths(graph, ['RobotIntegrationKit/python/src/codeon_robot_bridge/adapter.py']);
assert.strictEqual(robotBridgeImpact.risk, 'critical');
assert.strictEqual(robotBridgeImpact.reviewRequired, true);
assert.deepStrictEqual(robotBridgeImpact.unknownPaths, []);
assert.ok(robotBridgeImpact.requiredChecks.some((test) => test.id === 'test.robot-bridge'));

const constantsImpact = impactForPaths(graph, ['scripts/generate-codeon-constants.js']);
assert.strictEqual(constantsImpact.risk, 'critical');
assert.deepStrictEqual(constantsImpact.unknownPaths, []);
assert.deepStrictEqual(constantsImpact.affectedRobots.map((robot) => robot.id), ['robot.apitor', 'robot.cozmo', 'robot.edison', 'robot.rcj', 'robot.rcx']);
assert.ok(constantsImpact.requiredChecks.some((test) => test.id === 'test.constants'));
assert.ok(constantsImpact.requiredChecks.some((test) => test.id === 'test.java-reactor'));

const ciImpact = impactForPaths(graph, ['.github/workflows/unit_test_triggered_by_develop_push.yml']);
assert.strictEqual(ciImpact.risk, 'high');
assert.strictEqual(ciImpact.reviewRequired, true);
assert.deepStrictEqual(ciImpact.unknownPaths, []);
assert.ok(ciImpact.requiredChecks.some((test) => test.id === 'test.graph'));

const unitTestWorkflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/unit_test_triggered_by_develop_push.yml'), 'utf8');
const architectureWorkflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/codeon_architecture_graph.yml'), 'utf8');

function assertActionsArePinned(workflow, workflowName) {
    const actionReferences = Array.from(workflow.matchAll(/uses:\s+([^\s#]+)/g), (match) => match[1]);
    assert.ok(actionReferences.length > 0, `${workflowName} must use at least one action.`);
    for (const actionReference of actionReferences) {
        assert.match(actionReference, /^[^@]+@[0-9a-f]{40}$/, `${workflowName} contains a mutable action reference: ${actionReference}`);
    }
}

assert.match(unitTestWorkflow, /pull_request:\s*\n\s+branches: \[ master, develop \]/);
assert.match(unitTestWorkflow, /push:\s*\n\s+branches: \[ master, develop \]/);
assert.match(unitTestWorkflow, /permissions:\s*\n\s+contents: read/);
assert.match(unitTestWorkflow, /persist-credentials: false/);
assert.match(unitTestWorkflow, /distribution: 'temurin'/);
assert.match(unitTestWorkflow, /run: npm run test:constants/);
assert.ok(unitTestWorkflow.includes("run: mvn --batch-mode -pl OpenRobertaRobot,RobotEdison,RobotSpike,RobotCozmo,RobotApitor,RobotRCX -am -DargLine='--add-opens java.base/java.lang=ALL-UNNAMED' test"));
assert.match(unitTestWorkflow, /run: mvn --batch-mode -pl OpenRobertaServer -am -DskipTests package/);
assertActionsArePinned(unitTestWorkflow, 'Unit test workflow');

assert.match(architectureWorkflow, /permissions:\s*\n\s+contents: read/);
assert.match(architectureWorkflow, /persist-credentials: false/);
assert.match(architectureWorkflow, /package-manager-cache: false/);
assert.match(architectureWorkflow, /run: npm run test:robot-integration/, 'Architecture CI must run the robot-integration developer-tooling checks.');
assertActionsArePinned(architectureWorkflow, 'Architecture workflow');

assert.strictEqual(robotSummary(graph, 'cozmo').configurationMode, 'fixed');
assert.strictEqual(robotSummary(graph, 'edison').configurationMode, 'built-in');
assert.throws(() => robotSummary(graph, 'not-a-robot'), /Unknown robot/);

for (const unsafePath of ['/tmp/outside', '../outside', 'a\\b', 'safe\0unsafe']) {
    assert.throws(() => normalizeRepositoryPath(unsafePath));
}

console.log('CodeON architecture graph checks passed.');
