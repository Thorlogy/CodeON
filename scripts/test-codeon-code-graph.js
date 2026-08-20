#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    buildGraph,
    discoverSourceFiles,
    extractCalls,
    extractImports,
    extractSymbols,
    fileContext,
    impactGraph,
    loadConfig,
    normalizeRepositoryPath,
    queryGraph,
    validateGraph,
    writeIndex
} = require('./codeon-code-graph');

const ROOT = path.resolve(__dirname, '..');
const config = loadConfig();
const files = discoverSourceFiles(config);

assert.ok(files.some((file) => file.path.endsWith('CozmoValidatorAndCollectorWorker.java')));
assert.ok(files.some((file) => file.path.endsWith('robot.cozmo.ts')));
assert.ok(files.some((file) => file.path.endsWith('codeon_robot_bridge/bridge.py')));
assert.ok(files.every((file) => !file.path.includes('/target/') && !file.path.includes('/node_modules/')));

const javaSymbols = extractSymbols(`
    // class FakeComment {}
    package example;
    public final class RealClass {
        private String text = "class FakeString {}";
        public void runTask() { helper(); }
    }
`, 'java');
assert.ok(javaSymbols.some((symbol) => symbol.kind === 'class' && symbol.name === 'RealClass'));
assert.ok(javaSymbols.some((symbol) => symbol.kind === 'method' && symbol.name === 'runTask'));
assert.ok(!javaSymbols.some((symbol) => symbol.name.startsWith('Fake')));

assert.deepStrictEqual(extractImports(`
    import RobotEv3 from 'robot.ev3';
    const helper = require('./helper');
    // import Hidden from 'secret';
`, 'typescript'), ['./helper', 'robot.ev3']);
assert.deepStrictEqual(extractImports('from .adapter import RobotAdapter\nimport json, pathlib\n', 'python'), ['.adapter', 'json', 'pathlib']);
assert.deepStrictEqual(extractCalls('if (ready()) { runTask(); } // hiddenCall()\n"stringCall()"', 'javascript'), ['ready', 'runTask']);

const graph = buildGraph(config);
assert.deepStrictEqual(validateGraph(graph, config), []);
assert.ok(graph.stats.files >= 700, 'The graph should cover the active CodeON source roots.');
assert.ok(graph.stats.symbols >= 4000, 'The graph should contain a useful symbol inventory.');
assert.ok(graph.nodes.every((node) => !['body', 'content', 'source', 'sourceCode', 'excerpt'].some((field) => field in node)));

const cozmoTestResults = queryGraph(graph, 'CozmoFixedConfigurationTest', config);
assert.ok(cozmoTestResults.some((result) => result.kind === 'class' && result.name === 'CozmoFixedConfigurationTest'));
const bridgeResults = queryGraph(graph, 'BridgeSession', config);
assert.ok(bridgeResults.some((result) => result.kind === 'class' && result.path.endsWith('codeon_robot_bridge/bridge.py')));

const cozmoWebPath = 'OpenRobertaWeb/src/app/simulation/simulationLogic/robot.cozmo.ts';
const webContext = fileContext(graph, cozmoWebPath, config);
assert.ok(webContext.outgoing.some((edge) => edge.type === 'imports' && edge.precision === 'exact' && edge.path.endsWith('robot.ev3.ts')));

const bridgeContext = fileContext(graph, 'RobotIntegrationKit/python/src/codeon_robot_bridge/bridge.py', config);
assert.ok(bridgeContext.outgoing.some((edge) => edge.type === 'imports' && edge.precision === 'exact' && edge.path.endsWith('adapter.py')));

const cozmoWorkerPath = 'RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java';
const workerImpact = impactGraph(graph, cozmoWorkerPath, config);
assert.deepStrictEqual(workerImpact.architectureImpact.affectedRobots.map((robot) => robot.id), ['robot.cozmo']);
assert.ok(workerImpact.architectureImpact.requiredChecks.some((check) => check.id === 'test.cozmo-contract'));
assert.ok(workerImpact.affectedFiles.some((file) => file.scope === 'test' && file.path.endsWith('CozmoFixedConfigurationTest.java')));

const secondGraph = buildGraph(config);
assert.strictEqual(JSON.stringify(secondGraph), JSON.stringify(graph), 'Repeated builds must be byte-for-byte deterministic.');

for (const unsafePath of ['/tmp/index.json', '../outside', 'a\\b', 'safe\0unsafe']) {
    assert.throws(() => normalizeRepositoryPath(unsafePath));
}
assert.throws(() => queryGraph(graph, '', config), /non-empty/);
assert.throws(() => queryGraph(graph, 'x'.repeat(config.limits.maxQueryLength + 1), config), /bounded/);
assert.doesNotThrow(() => queryGraph(graph, '[.*', config), 'Query text must be treated literally, not as a regular expression.');
assert.throws(() => writeIndex(graph, 'architecture/do-not-overwrite.json', config), /below \.codeon/);

const testIndexPath = '.codeon/code-graph-test.json';
assert.strictEqual(writeIndex(graph, testIndexPath, config), testIndexPath);
const generated = JSON.parse(fs.readFileSync(path.join(ROOT, testIndexPath), 'utf8'));
assert.strictEqual(generated.configSha256, graph.configSha256);
fs.unlinkSync(path.join(ROOT, testIndexPath));

console.log('CodeON local code graph checks passed.');
