#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { buildGraph, loadConfig } = require('./codeon-code-graph');
const {
    assertMetadataOnly,
    buildChangePlan,
    formatChangePlan,
    gitChangesSince,
    parseArguments,
    parseGitNameStatus,
    parseGitPaths,
    queryTerms,
    validateGitRevision
} = require('./codeon-change-planner');

const config = loadConfig();
const graph = buildGraph(config);
const cozmoWorker = 'RobotCozmo/src/main/java/de/fhg/iais/roberta/worker/cozmo/CozmoValidatorAndCollectorWorker.java';
const plan = buildChangePlan(graph, {
    query: 'CozmoFixedConfigurationTest optimieren',
    changes: [{ status: 'M', path: cozmoWorker }]
}, config);

assert.strictEqual(plan.purpose, 'codeon-change-plan');
assert.strictEqual(plan.summary.risk, 'high');
assert.strictEqual(plan.summary.reviewRequired, true);
assert.ok(plan.affectedRobots.some((robot) => robot.id === 'robot.cozmo'));
assert.ok(plan.requiredChecks.some((check) => check.id === 'test.cozmo-contract' && check.automaticExecution === false));
assert.ok(plan.readFirst.some((file) => file.path === cozmoWorker));
assert.ok(plan.readFirst.some((file) => file.path.endsWith('CozmoFixedConfigurationTest.java')));
assert.ok(plan.exactRelationships.every((edge) => edge.precision === 'exact'));
assert.ok(plan.heuristicHints.every((edge) => edge.precision === 'name-only' && edge.automaticallySelected === false));
assert.deepStrictEqual(plan.codeGraphUnavailablePaths, []);
assert.doesNotThrow(() => assertMetadataOnly(plan));
assert.ok(!JSON.stringify(plan).includes('CozmoValidatorAndCollectorWorker extends'));
assert.ok(formatChangePlan(plan).includes('nur nach Review ausführen'));

const docsPlan = buildChangePlan(graph, { changes: [{ status: 'M', path: 'docs/example.md' }] }, config);
assert.deepStrictEqual(docsPlan.codeGraphUnavailablePaths, ['docs/example.md']);
assert.deepStrictEqual(docsPlan.unknownArchitecturePaths, ['docs/example.md']);

assert.deepStrictEqual(
    parseGitNameStatus(Buffer.from('M\0README.md\0R100\0old/path.js\0new/path.js\0')),
    [{ status: 'M', path: 'README.md' }, { status: 'R', path: 'new/path.js', previousPath: 'old/path.js' }]
);
assert.throws(() => parseGitNameStatus(Buffer.from('M\0../outside\0')), /inside/);
assert.throws(() => parseGitNameStatus(Buffer.from('Q\0README.md\0')), /unsupported/);
assert.deepStrictEqual(parseGitPaths(Buffer.from('new/file.js\0docs/new.md\0')), ['new/file.js', 'docs/new.md']);
assert.throws(() => parseGitPaths(Buffer.from('../outside\0')), /inside/);

const capturedGitCalls = [];
const fakeSpawn = (command, args, options) => {
    capturedGitCalls.push({ command, args, options });
    if (args[0] === 'merge-base') return { status: 0, stdout: Buffer.from('0123456789abcdef0123456789abcdef01234567\n') };
    if (args[0] === 'diff') return { status: 0, stdout: Buffer.from('M\0README.md\0') };
    return { status: 0, stdout: Buffer.from('new/file.js\0') };
};
assert.deepStrictEqual(gitChangesSince('origin/master', fakeSpawn), [{ status: 'M', path: 'README.md' }, { status: 'A', path: 'new/file.js' }]);
assert.deepStrictEqual(capturedGitCalls.map((call) => call.command), ['git', 'git', 'git']);
assert.deepStrictEqual(capturedGitCalls.map((call) => call.args), [
    ['merge-base', 'origin/master', 'HEAD'],
    ['diff', '--name-status', '-z', '--find-renames=90%', '0123456789abcdef0123456789abcdef01234567', '--'],
    ['ls-files', '--others', '--exclude-standard', '-z', '--']
]);
assert.ok(capturedGitCalls.every((call) => call.options.shell === false));

assert.strictEqual(validateGitRevision('origin/master'), 'origin/master');
['--output=/tmp/leak', '../master', 'main..other', 'main@{1}', 'main//other'].forEach((revision) => assert.throws(() => validateGitRevision(revision)));
assert.deepStrictEqual(queryTerms('Cozmo und BridgeSession optimieren', config), ['Cozmo', 'BridgeSession', 'optimieren']);
assert.deepStrictEqual(parseArguments(['--base', 'master', '--query', 'Cozmo', '--json']), { paths: [], json: true, base: 'master', query: 'Cozmo' });
assert.throws(() => parseArguments(['--base', 'master', '--path', 'README.md']), /mutually exclusive/);
assert.throws(() => parseArguments(['--unknown']), /Usage/);
assert.throws(() => buildChangePlan(graph, { query: 'safe', changes: [], extra: true }, config), /unknown field/);
assert.throws(() => assertMetadataOnly({ content: 'hidden' }), /forbidden/);

console.log('CodeON change planner checks passed.');
