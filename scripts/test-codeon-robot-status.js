#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT, listManifestPaths, readManifestFile } = require('./codeon-robot-manifest');
const { buildStatus, formatStatus, parseArguments } = require('./codeon-robot-status');

const loaded = listManifestPaths().map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
const cozmo = buildStatus(loaded, 'cozmo');
assert.strictEqual(cozmo.staticallyConsistent, true);
assert.strictEqual(cozmo.phases.find((item) => item.id === 'manifest').state, 'complete');
assert.strictEqual(cozmo.phases.find((item) => item.id === 'bridge').state, 'complete');
assert.strictEqual(cozmo.phases.find((item) => item.id === 'system').state, 'complete');
assert.strictEqual(cozmo.phases.find((item) => item.id === 'verification').state, 'pending');
assert.strictEqual(cozmo.phases.find((item) => item.id === 'hardware').state, 'attention');
assert.ok(cozmo.requiredChecks.every(({ command }) => typeof command === 'string' && command.length > 0));
assert.ok(cozmo.requiredChecks.every(({ command }) => /^[^\u0000-\u001f\u007f]{1,2000}$/u.test(command)), 'Displayed commands must be bounded single-line text.');
assert.match(formatStatus(cozmo), /no tests were executed and no files were changed/);

const bridgeManifest = {
    schemaVersion: 1,
    id: 'guidebot',
    displayName: 'Guide Bot',
    scope: 'bridge',
    activation: 'draft',
    transport: 'ble',
    bridge: { adapter: 'guidebot', adapterClass: 'GuidebotAdapter', port: 2299, autoStart: false },
    capabilities: { actuators: [], sensors: [] },
    limits: { heartbeatTimeoutMs: 1000 },
    supportedHosts: ['macos'],
    hardwareStatus: 'experimental',
    requiredChecks: ['test.robot-bridge'],
    knownLimitations: ['Hardware protocol is not verified.']
};
const bridgeLoaded = [{ fileName: 'guidebot.json', manifest: bridgeManifest }];
const pending = buildStatus(
    bridgeLoaded,
    'guidebot',
    () => ({ errors: ['registration missing'], warnings: [], bridgeErrors: ['registration missing'], completeErrors: [] }),
    () => [{ id: 'test.robot-bridge', command: 'test command' }]
);
assert.strictEqual(pending.staticallyConsistent, false);
assert.strictEqual(pending.phases.find((item) => item.id === 'bridge').state, 'pending');
assert.strictEqual(pending.phases.find((item) => item.id === 'system').state, 'pending');
assert.ok(pending.nextActions.some((action) => action.includes('registration missing')));
assert.ok(pending.nextActions.some((action) => action.includes('never executes')));

const completeManifest = {
    ...bridgeManifest,
    scope: 'complete',
    activation: 'active',
    configurationMode: 'fixed',
    module: 'RobotGuidebot',
    browserConnectionClass: 'GuidebotConnection',
    browserBehaviourClass: 'GuidebotBehaviour',
    previewImage: 'guidebot.png',
    simulation: 'none'
};
const systemPending = buildStatus(
    [{ fileName: 'guidebot.json', manifest: completeManifest }],
    'guidebot',
    () => ({ errors: ['plugin missing'], warnings: [], bridgeErrors: [], completeErrors: ['plugin missing'] }),
    () => []
);
assert.strictEqual(systemPending.phases.find((item) => item.id === 'bridge').state, 'complete');
assert.strictEqual(systemPending.phases.find((item) => item.id === 'system').state, 'pending');

const invalid = JSON.parse(JSON.stringify(bridgeManifest));
invalid.bridge.port = 80;
const blocked = buildStatus([{ fileName: 'guidebot.json', manifest: invalid }], 'guidebot', () => { throw new Error('must not run'); }, () => []);
assert.strictEqual(blocked.phases.find((item) => item.id === 'manifest').state, 'blocked');
assert.strictEqual(blocked.phases.find((item) => item.id === 'bridge').state, 'blocked');

assert.deepStrictEqual(parseArguments(['--id', 'cozmo', '--json']), { id: 'cozmo', json: true, help: false });
assert.throws(() => parseArguments([]), /--id is required/);
assert.throws(() => parseArguments(['--id', 'cozmo', '--id', 'apitor']), /Duplicate option/);
assert.throws(() => parseArguments(['--id', '--json']), /incomplete/);
assert.throws(() => parseArguments(['--json', '--json', '--id', 'cozmo']), /Duplicate option/);
assert.throws(() => buildStatus(loaded, 'unknown'), /No robot integration manifest/);

const source = fs.readFileSync(path.join(ROOT, 'scripts/codeon-robot-status.js'), 'utf8');
assert.doesNotMatch(source, /require\(['"]child_process['"]\)/, 'Status must not execute child processes.');
assert.doesNotMatch(source, /\b(?:writeFile|appendFile|unlink|rename|rm|rmdir|mkdir)Sync?\b/, 'Status must remain read-only.');

console.log('CodeON robot integration status checks passed.');
