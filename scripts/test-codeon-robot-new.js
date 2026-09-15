#!/usr/bin/env node

'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    ROOT,
    optionalDependencyGroups,
    registeredRobotIds,
    reservedLocalPorts
} = require('./codeon-robot-manifest');
const {
    adapterClassFor,
    buildPlan,
    formatPlan,
    isStrictlyContainedPath,
    parseArguments,
    validateOptions,
    verifyWritePlan,
    writePlan
} = require('./codeon-robot-new');

function options(values = {}) {
    return {
        dryRun: true,
        write: false,
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
assert.strictEqual(first.mode, 'dry-run');
assert.strictEqual(first.writePerformed, false);
assert.match(first.planHash, /^[0-9a-f]{64}$/);
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
assert.strictEqual(isStrictlyContainedPath('C:\\codeon', 'C:\\codeon\\RobotIntegrationKit\\file.json', path.win32), true);
assert.strictEqual(isStrictlyContainedPath('C:\\codeon', 'C:\\outside\\file.json', path.win32), false);
assert.strictEqual(isStrictlyContainedPath('/codeon', '/codeon-other/file.json', path.posix), false);
const testHash = 'a'.repeat(64);
assert.deepStrictEqual(
    parseArguments(['--dry-run', '--id', 'robot2', '--name', 'Robot 2', '--transport', 'usb', '--port', '2300', '--host', 'linux', '--host', 'windows', '--json']),
    { dryRun: true, write: false, json: true, help: false, hosts: ['linux', 'windows'], id: 'robot2', name: 'Robot 2', transport: 'usb', port: '2300' }
);
assert.deepStrictEqual(
    parseArguments(['--write', '--confirm', 'robot2', '--plan-hash', testHash, '--id', 'robot2', '--name', 'Robot 2', '--transport', 'usb', '--port', '2300', '--host', 'linux']),
    { dryRun: false, write: true, json: false, help: false, hosts: ['linux'], confirm: 'robot2', planHash: testHash, id: 'robot2', name: 'Robot 2', transport: 'usb', port: '2300' }
);
assert.throws(() => parseArguments(['--output', '/tmp/out']), /Unknown argument/);
assert.throws(() => parseArguments(['--id', 'one', '--id', 'two']), /Duplicate option/);
assert.throws(() => parseArguments(['--write', '--write']), /Duplicate option/);
assert.throws(() => parseArguments(['--name']), /Missing value/);
assert.throws(() => validateOptions(options({ dryRun: false })), /exactly one/);
assert.throws(() => validateOptions(options({ write: true, confirm: 'dryrunbot' })), /exactly one/);
assert.throws(() => validateOptions(options({ dryRun: false, write: true })), /requires --confirm/);
assert.throws(() => validateOptions(options({ dryRun: false, write: true, confirm: 'otherbot', planHash: testHash })), /exact robot id/);
assert.throws(() => validateOptions(options({ dryRun: false, write: true, confirm: 'dryrunbot' })), /requires the exact SHA-256/);
assert.throws(() => validateOptions(options({ dryRun: false, write: true, confirm: 'dryrunbot', planHash: 'short' })), /requires the exact SHA-256/);
assert.doesNotThrow(() => validateOptions(options({ dryRun: false, write: true, confirm: 'dryrunbot', planHash: testHash })));
assert.throws(() => validateOptions(options({ confirm: 'dryrunbot' })), /only with --write/);
assert.throws(() => validateOptions(options({ planHash: testHash })), /only with --write/);
assert.throws(() => validateOptions(options({ id: '../escape' })), /Robot id/);
assert.throws(() => validateOptions(options({ name: 'Unsafe\nName' })), /single/);
assert.throws(() => validateOptions(options({ transport: 'internet' })), /transport/);
assert.throws(() => validateOptions(options({ port: '80' })), /Port/);
assert.throws(() => validateOptions(options({ hosts: ['macos', 'macos'] })), /Duplicate host/);
assert.throws(() => validateOptions(options({ hosts: ['other'] })), /Unsupported host/);
assert.throws(() => validateOptions(options({ optionalDependency: '../vendor' })), /dependency/);
assert.throws(() => validateOptions(options({ optionalDependency: 'server' })), /robot-specific/);
assert.doesNotThrow(() => validateOptions(options({ optionalDependency: 'dryrunbot-vendor' })));
assert.throws(() => validateOptions(options({ unexpected: true })), /Unknown option property/);
for (const id of ['rcx', 'edison', 'edisonv2', 'rcj', 'cozmo', 'apitor']) {
    assert.throws(() => buildPlan(options({ id })), /already registered/, `Registered robot id must be rejected: ${id}`);
}
for (const port of ['1999', '2222', '2223', '2224']) {
    assert.throws(() => buildPlan(options({ port })), /already reserved/, `Reserved local port must be rejected: ${port}`);
}
assert.ok(['rcx', 'edison', 'edisonv2', 'rcj', 'cozmo', 'apitor'].every((id) => registeredRobotIds().has(id)));
assert.ok([1999, 2222, 2223, 2224].every((port) => reservedLocalPorts().has(port)));
assert.ok(['server', 'cozmo', 'cozmo-vision', 'apitor'].every((group) => optionalDependencyGroups().has(group)));
assert.strictEqual(buildPlan(options({ optionalDependency: 'dryrunbot-vendor' })).manifest.bridge.optionalDependency, 'dryrunbot-vendor');
targets.forEach((target) => assert.strictEqual(fs.existsSync(path.join(ROOT, target)), false, `Dry run wrote a file after validation checks: ${target}`));

assert.throws(() => buildPlan(options({ dryRun: false, write: true, confirm: 'dryrunbot', planHash: testHash })), /Plan hash does not match/);
assert.throws(
    () => buildPlan(options({ dryRun: false, write: true, confirm: 'dryrunbot', planHash: first.planHash, name: 'Changed Bot' })),
    /Plan hash does not match/,
    'A changed scaffold input must invalidate the reviewed plan hash.'
);
const writeOptions = options({ dryRun: false, write: true, confirm: 'dryrunbot', planHash: first.planHash });
const writePreview = buildPlan(writeOptions);
assert.strictEqual(writePreview.mode, 'write');
assert.strictEqual(writePreview.writePerformed, false);
assert.strictEqual(writePreview.planHash, first.planHash);
assert.doesNotThrow(() => verifyWritePlan(writePreview));
assert.throws(() => writePlan(first), /write-mode plan/);
const tamperedPlan = JSON.parse(JSON.stringify(writePreview));
tamperedPlan.files[0].content += 'tampered';
assert.throws(() => verifyWritePlan(tamperedPlan), /byte count changed/);
const mismatchedManifestPlan = JSON.parse(JSON.stringify(writePreview));
mismatchedManifestPlan.manifest.displayName = 'Changed Bot';
assert.throws(() => verifyWritePlan(mismatchedManifestPlan), /differs from the reviewed manifest/);
const mismatchedHashPlan = JSON.parse(JSON.stringify(writePreview));
mismatchedHashPlan.planHash = testHash;
assert.throws(() => verifyWritePlan(mismatchedHashPlan), /plan hash differs/);
const unsafeTargetPlan = JSON.parse(JSON.stringify(writePreview));
unsafeTargetPlan.files[0].path = '../outside.json';
assert.throws(() => verifyWritePlan(unsafeTargetPlan), /Unexpected scaffold target/);

function temporaryScaffoldRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codeon-scaffold-'));
    for (const target of targets) fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    return root;
}

const successRoot = temporaryScaffoldRoot();
try {
    const result = writePlan(writePreview, successRoot);
    assert.strictEqual(result.writePerformed, true);
    assert.deepStrictEqual(result.writtenFiles, targets);
    assert.match(formatPlan(result), /Exactly four fail-closed scaffold files were created/);
    for (const file of writePreview.files) {
        assert.strictEqual(fs.readFileSync(path.join(successRoot, file.path), 'utf8'), file.content, `Written content differs: ${file.path}`);
    }
    assert.throws(() => writePlan(writePreview, successRoot), /already exists/, 'Write mode must never overwrite an existing target.');
} finally {
    fs.rmSync(successRoot, { recursive: true, force: true });
}

const rollbackRoot = temporaryScaffoldRoot();
try {
    let opens = 0;
    const failingIo = Object.create(fs);
    failingIo.openSync = (...args) => {
        opens += 1;
        if (opens === 2) {
            const error = new Error('injected write failure');
            error.code = 'EIO';
            throw error;
        }
        return fs.openSync(...args);
    };
    assert.throws(() => writePlan(writePreview, rollbackRoot, failingIo), /Created files were rolled back/);
    targets.forEach((target) => assert.strictEqual(fs.existsSync(path.join(rollbackRoot, target)), false, `Rollback left a file: ${target}`));
} finally {
    fs.rmSync(rollbackRoot, { recursive: true, force: true });
}

const productionSource = fs.readFileSync(path.join(ROOT, 'scripts/codeon-robot-new.js'), 'utf8');
assert.doesNotMatch(productionSource, /require\(['"]child_process['"]\)/, 'Generator must not execute child processes.');
assert.doesNotMatch(productionSource, /\b(?:appendFile|rename|rm|rmdir|mkdir|copyFile)Sync?\b/, 'Writer must not create directories, rename, copy or broadly remove files.');
assert.match(productionSource, /O_EXCL/, 'Writer must create every target exclusively.');
assert.match(productionSource, /--write --confirm/, 'Write mode must retain explicit ID confirmation.');
assert.match(productionSource, /--plan-hash/, 'Write mode must be bound to the reviewed plan hash.');

console.log('CodeON robot scaffold dry-run and transactional write checks passed.');
