#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { buildGraph, loadConfig } = require('./codeon-code-graph');
const { assertMetadataOnly, buildBuddyContext, formatBuddyContext, parseArguments } = require('./codeon-code-buddy-context');

const config = loadConfig();
const graph = buildGraph(config);
const changedPath = 'RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java';
const packet = buildBuddyContext(graph, { query: 'CozmoFixedConfigurationTest', path: changedPath }, config);

assert.strictEqual(packet.purpose, 'code-buddy-local-retrieval');
assert.strictEqual(packet.trust, 'untrusted-metadata');
assert.ok(packet.matches.some((match) => match.path.endsWith('CozmoFixedConfigurationTest.java')));
assert.ok(packet.files.every((file) => file.exactRelations.every((relation) => !relation.precision && relation.direction)));
assert.ok(packet.impact.affectedRobots.some((robot) => robot.id === 'robot.cozmo'));
assert.ok(packet.impact.requiredChecks.some((check) => check.id === 'test.cozmo-contract'));
assert.ok(packet.impact.affectedFiles.some((file) => file.path.endsWith('CozmoFixedConfigurationTest.java')));
assert.doesNotThrow(() => assertMetadataOnly(packet));

const encoded = JSON.stringify(packet);
['sourceCode', 'excerpt', 'CozmoValidatorAndCollectorWorker extends'].forEach((forbidden) => assert.ok(!encoded.includes(forbidden), `Forbidden source material found: ${forbidden}`));
const formatted = formatBuddyContext(packet);
assert.ok(formatted.includes('unvertrauenswürdige Metadaten'));
assert.ok(formatted.includes('test.cozmo-contract'));
assert.ok(formatted.length <= 7000);

assert.deepStrictEqual(parseArguments(['--query', 'BridgeSession', '--json']), { request: { query: 'BridgeSession' }, json: true });
assert.throws(() => parseArguments(['--query']), /Invalid/);
assert.throws(() => parseArguments(['--query', 'one', '--query', 'two']), /duplicate/);
assert.throws(() => parseArguments(['--remote', 'https:\/\/example.com']), /Usage/);
assert.throws(() => buildBuddyContext(graph, { query: '' }, config), /Provide|non-empty/);
assert.throws(() => buildBuddyContext(graph, { path: '../outside' }, config), /inside/);
assert.throws(() => buildBuddyContext(graph, { query: 'safe', extra: 'not allowed' }, config), /Provide/);
assert.throws(() => assertMetadataOnly({ source: 'hidden' }), /forbidden/);

console.log('CodeON Code Buddy graph-context checks passed.');
