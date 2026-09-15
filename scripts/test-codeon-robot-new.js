#!/usr/bin/env node

'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./codeon-robot-manifest');
const {
    adapterClassFor,
    buildPlan,
    formatPlan,
    parseArguments,
    validateOptions
} = require('./codeon-robot-new');

function options(values = {}) {
    return {
        dryRun: true,
        json: false,
        help: false,
        id: 'dryrunbot',
        name: 'Dry Run Bot',
        transport: 'ble',
        port: '2299',
        hosts: ['macos'],
        ...values
    };
}

const targets = [
    'RobotIntegrationKit/manifests/dryrunbot.json',
    'RobotIntegrationKit/python/src/codeon_robot_bridge/dryrunbot_adapter.py',
    'RobotIntegrationKit/python/tests/test_dryrunbot_adapter.py',
    'RobotIntegrationKit/docs/acceptance/dryrunbot.md'
];
targets.forEach((target) => assert.strictEqual(fs.existsSync(path.join(ROOT, target)), false, `Test target must start absent: ${target}`));

const first = buildPlan(options());
const second = buildPlan(options());
assert.deepStrictEqual(first, second, 'Dry-run output must be deterministic.');
assert.strictEqual(first.writePerformed, false);
assert.deepStrictEqual(first.files.map((file) => file.path), targets);
assert.strictEqual(first.manifest.scope, 'bridge');
assert.strictEqual(first.manifest.activation, 'draft');
assert.strictEqual(first.manifest.hardwareStatus, 'experimental');
assert.strictEqual(first.manifest.bridge.autoStart, false);
assert.deepStrictEqual(first.manifest.capabilities, { actuators: [], sensors: [] });
assert.ok(first.files.every((file) => file.bytes > 0 && /^[0-9a-f]{64}$/.test(file.sha256)));
assert.ok(first.files.every((file) => !/\{\{[A-Z_]+\}\}/.test(file.content)));
assert.match(formatPlan(first), /No files were written\./);
assert.match(first.files[1].content, /raise AdapterError/);
assert.match(first.files[1].content, /async def stop_all/);
assert.match(first.files[2].content, /test_repeated_stop_is_safe/);
targets.forEach((target) => assert.strictEqual(fs.existsSync(path.join(ROOT, target)), false, `Dry run wrote a file: ${target}`));

for (const pythonFile of first.files.filter((file) => file.path.endsWith('.py'))) {
    const parsed = childProcess.spawnSync(
        'python3',
        ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
        { input: pythonFile.content, encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 }
    );
    assert.strictEqual(parsed.status, 0, `${pythonFile.path} must be valid Python: ${parsed.stderr}`);
}

assert.strictEqual(adapterClassFor('robot2'), 'Robot2Adapter');
assert.deepStrictEqual(
    parseArguments(['--dry-run', '--id', 'robot2', '--name', 'Robot 2', '--transport', 'usb', '--port', '2300', '--host', 'linux', '--host', 'windows', '--json']),
    { dryRun: true, json: true, help: false, hosts: ['linux', 'windows'], id: 'robot2', name: 'Robot 2', transport: 'usb', port: '2300' }
);
assert.throws(() => parseArguments(['--output', '/tmp/out']), /Unknown argument/);
assert.throws(() => parseArguments(['--id', 'one', '--id', 'two']), /Duplicate option/);
assert.throws(() => parseArguments(['--name']), /Missing value/);
assert.throws(() => validateOptions(options({ dryRun: false })), /--dry-run is required/);
assert.throws(() => validateOptions(options({ id: '../escape' })), /Robot id/);
assert.throws(() => validateOptions(options({ name: 'Unsafe\nName' })), /single/);
assert.throws(() => validateOptions(options({ transport: 'internet' })), /transport/);
assert.throws(() => validateOptions(options({ port: '80' })), /Port/);
assert.throws(() => validateOptions(options({ hosts: ['macos', 'macos'] })), /Duplicate host/);
assert.throws(() => validateOptions(options({ hosts: ['other'] })), /Unsupported host/);
assert.throws(() => validateOptions(options({ optionalDependency: '../vendor' })), /dependency/);
assert.throws(() => validateOptions(options({ unexpected: true })), /Unknown option property/);
assert.throws(() => buildPlan(options({ id: 'cozmo', port: '2299' })), /duplicate robot id/);
assert.throws(() => buildPlan(options({ port: '2223' })), /already used/);

const productionSource = fs.readFileSync(path.join(ROOT, 'scripts/codeon-robot-new.js'), 'utf8');
assert.doesNotMatch(productionSource, /require\(['"]child_process['"]\)/, 'Generator must not execute child processes.');
assert.doesNotMatch(productionSource, /\b(?:writeFile|appendFile|unlink|rename|rm|rmdir|mkdir|copyFile)Sync?\b/, 'Dry-run generator must not contain filesystem mutation calls.');

console.log('CodeON robot scaffold dry-run checks passed.');
