#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    ROOT,
    listManifestPaths,
    readManifestFile,
    repositoryChecks,
    resolveManifestPath,
    validateManifest,
    validateManifestSet
} = require('./codeon-robot-manifest');
const { parseArguments } = require('./codeon-robot-check');

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'RobotIntegrationKit/schema/robot-integration.schema.json'), 'utf8'));
assert.strictEqual(schema.additionalProperties, false);
assert.strictEqual(schema.properties.schemaVersion.const, 1);
assert.deepStrictEqual(
    [...new Set(schema.required)].sort(),
    ['schemaVersion', 'id', 'displayName', 'scope', 'activation', 'transport', 'bridge', 'capabilities', 'limits', 'supportedHosts', 'hardwareStatus', 'requiredChecks', 'knownLimitations'].sort(),
    'Schema and executable validator must share the required manifest fields.'
);

const items = listManifestPaths().map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
assert.ok(items.length >= 2, 'Reference manifests must exist.');
for (const item of items) {
    assert.deepStrictEqual(validateManifest(item.manifest, item.fileName), [], `${item.fileName} must satisfy the manifest contract.`);
    assert.deepStrictEqual(repositoryChecks(item.manifest).errors, [], `${item.fileName} must match the repository.`);
}
assert.deepStrictEqual(validateManifestSet(items), []);

const base = JSON.parse(JSON.stringify(items.find((item) => item.manifest.id === 'cozmo').manifest));
function errorsFor(mutator) {
    const candidate = JSON.parse(JSON.stringify(base));
    mutator(candidate);
    return validateManifest(candidate, `${candidate.id || 'invalid'}.json`);
}
assert.ok(errorsFor((value) => { value.unknown = true; }).some((error) => error.includes('Unknown top-level')));
assert.ok(errorsFor((value) => { value.capabilities.actuators.push(value.capabilities.actuators[0]); }).some((error) => error.includes('duplicate')));
assert.ok(errorsFor((value) => { value.limits.wheelSpeedMmPerSec = { min: 4, max: 3 }; }).some((error) => error.includes('range')));
assert.ok(errorsFor((value) => { delete value.module; }).some((error) => error.includes('module')));
assert.ok(errorsFor((value) => { value.scope = 'bridge'; }).some((error) => error.includes('Bridge-only')));
assert.ok(errorsFor((value) => { value.knownLimitations = []; }).some((error) => error.includes('at least one')));
assert.ok(errorsFor((value) => { value.bridge.adapter = 'other'; }).some((error) => error.includes('must equal')));

assert.throws(() => resolveManifestPath('../cozmo'), /unsafe/);
assert.throws(() => resolveManifestPath('/tmp/cozmo'), /unsafe/);
assert.throws(() => readManifestFile(path.join(ROOT, 'package.json')), /outside/);
assert.throws(() => parseArguments(['--manifest', '/tmp/a.json']), /Unknown/);
assert.deepStrictEqual(parseArguments(['--id', 'cozmo', '--json']), { id: 'cozmo', json: true, help: false });

const collision = JSON.parse(JSON.stringify(base));
collision.id = 'second';
assert.ok(validateManifestSet([base, collision]).some((error) => error.includes('already used')));

for (const script of ['scripts/codeon-robot-manifest.js', 'scripts/codeon-robot-check.js']) {
    const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
    assert.doesNotMatch(source, /require\(['"]child_process['"]\)/, `${script} must not execute child processes.`);
    assert.doesNotMatch(source, /\b(?:writeFile|appendFile|unlink|rename|rm|rmdir|mkdir)Sync?\b/, `${script} must remain read-only.`);
}

console.log('CodeON read-only robot integration checks passed.');
