#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    ROOT,
    adapterDeclaresRobot,
    exportedClassBody,
    listManifestPaths,
    readManifestFile,
    repositoryChecks,
    resolveManifestPath,
    validateManifest,
    validateManifestSet
} = require('./codeon-robot-manifest');
const { buildReport, parseArguments } = require('./codeon-robot-check');

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'RobotIntegrationKit/schema/robot-integration.schema.json'), 'utf8'));
assert.strictEqual(schema.additionalProperties, false);
assert.strictEqual(schema.properties.schemaVersion.const, 1);
assert.strictEqual(schema.properties.knownLimitations.uniqueItems, true);
const numericLimit = schema.properties.limits.additionalProperties.oneOf[0];
assert.deepStrictEqual([numericLimit.minimum, numericLimit.maximum], [-1000000000, 1000000000]);
const rangeLimit = schema.properties.limits.additionalProperties.oneOf[1].properties;
assert.deepStrictEqual([rangeLimit.min.minimum, rangeLimit.min.maximum], [-1000000000, 1000000000]);
assert.deepStrictEqual([rangeLimit.max.minimum, rangeLimit.max.maximum], [-1000000000, 1000000000]);
assert.ok(schema.allOf.some((rule) => rule.if?.properties?.scope?.const === 'bridge' && rule.then?.not?.anyOf), 'Schema must forbid complete-system fields on bridge manifests.');
assert.ok(schema.allOf.some((rule) => rule.if?.properties?.hardwareStatus?.const === 'verified-with-limitations' && rule.then?.properties?.knownLimitations?.minItems === 1), 'Schema must require a limitation for verified-with-limitations.');
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
assert.ok(errorsFor((value) => { value.bridge.optionalDependency = 'server'; }).some((error) => error.includes('robot-specific')));

assert.strictEqual(adapterDeclaresRobot('value = CapabilityManifest(robot="cozmo")', 'cozmo'), true);
assert.strictEqual(adapterDeclaresRobot('value = CapabilityManifest(robot="other")', 'cozmo'), false);
assert.strictEqual(adapterDeclaresRobot('robot="cozmo"', 'cozmo'), false);
const connectionFixture = 'export class FirstConnection { new FirstBehaviour(); }\nexport class SecondConnection { new SecondBehaviour(); }';
assert.match(exportedClassBody(connectionFixture, 'FirstConnection'), /FirstBehaviour/);
assert.doesNotMatch(exportedClassBody(connectionFixture, 'FirstConnection'), /SecondBehaviour/);
assert.strictEqual(exportedClassBody(connectionFixture, 'MissingConnection'), null);
assert.strictEqual(exportedClassBody('export class FirstConnectionSuffix {}', 'FirstConnection'), null);

assert.throws(() => resolveManifestPath('../cozmo'), /unsafe/);
assert.throws(() => resolveManifestPath('/tmp/cozmo'), /unsafe/);
assert.throws(() => readManifestFile(path.join(ROOT, 'package.json')), /outside/);
assert.throws(() => parseArguments(['--manifest', '/tmp/a.json']), /Unknown/);
assert.throws(() => parseArguments(['--id', 'cozmo', '--id', 'apitor']), /Duplicate option/);
assert.throws(() => parseArguments(['--id', '--json']), /incomplete/);
assert.throws(() => parseArguments(['--json', '--json']), /Duplicate option/);
assert.deepStrictEqual(parseArguments(['--id', 'cozmo', '--json']), { id: 'cozmo', json: true, help: false });

const collision = JSON.parse(JSON.stringify(base));
collision.id = 'second';
assert.ok(validateManifestSet([base, collision]).some((error) => error.includes('already used')));
assert.ok(validateManifestSet([{ fileName: 'broken.json', manifest: null }]).some((error) => error.includes('root is invalid')));

const bridgeBase = {
    schemaVersion: 1,
    id: 'onebot',
    displayName: 'One Bot',
    scope: 'bridge',
    activation: 'draft',
    transport: 'ble',
    bridge: { adapter: 'onebot', adapterClass: 'OnebotAdapter', port: 2299, autoStart: false },
    capabilities: { actuators: [], sensors: [] },
    limits: { heartbeatTimeoutMs: 1000 },
    supportedHosts: ['macos'],
    hardwareStatus: 'experimental',
    requiredChecks: ['test.robot-bridge'],
    knownLimitations: ['Hardware protocol is not verified.']
};
const bridgeCollision = JSON.parse(JSON.stringify(bridgeBase));
bridgeCollision.id = 'twobot';
bridgeCollision.displayName = 'Two Bot';
bridgeCollision.bridge.adapter = 'twobot';
bridgeCollision.bridge.adapterClass = 'TwobotAdapter';
const collisionReport = buildReport(
    [
        { fileName: 'onebot.json', manifest: bridgeBase },
        { fileName: 'twobot.json', manifest: bridgeCollision }
    ],
    'onebot',
    () => ({ errors: [], warnings: [] })
);
assert.strictEqual(collisionReport.checked, 1);
assert.strictEqual(collisionReport.manifestSetChecked, 2);
assert.strictEqual(collisionReport.ok, false);
assert.ok(collisionReport.setErrors.some((error) => error.includes('already used')), 'A selected check must still detect collisions in the complete manifest set.');
const mismatchedId = JSON.parse(JSON.stringify(bridgeBase));
mismatchedId.id = 'twobot';
mismatchedId.bridge.adapter = 'twobot';
mismatchedId.bridge.adapterClass = 'TwobotAdapter';
const mismatchedReport = buildReport(
    [{ fileName: 'onebot.json', manifest: mismatchedId }],
    'onebot',
    () => ({ errors: [], warnings: [] })
);
assert.ok(mismatchedReport.results[0].errors.some((error) => error.includes('filename')), 'Focused checks must report an ID mismatch in the selected manifest file.');

for (const script of ['scripts/codeon-robot-manifest.js', 'scripts/codeon-robot-check.js']) {
    const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
    assert.doesNotMatch(source, /require\(['"]child_process['"]\)/, `${script} must not execute child processes.`);
    assert.doesNotMatch(source, /\b(?:writeFile|appendFile|unlink|rename|rm|rmdir|mkdir)Sync?\b/, `${script} must remain read-only.`);
}

console.log('CodeON read-only robot integration checks passed.');
