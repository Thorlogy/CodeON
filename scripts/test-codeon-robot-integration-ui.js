#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sourcePath = path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/controller/robotIntegrationAssistant.controller.ts');
const runtimePath = path.join(ROOT, 'OpenRobertaServer/staticResources/js/app/roberta/controller/robotIntegrationAssistant.controller.js');
const packagedRuntimePath = path.join(ROOT, 'application/staticResources/js/app/roberta/controller/robotIntegrationAssistant.controller.js');

function loadAmdModule(filePath) {
    let moduleExports = null;
    const sandbox = {
        URL,
        URLSearchParams,
        window: { location: { hostname: 'localhost', search: '?robotIntegrationAssistant=1', port: '1999' } },
        define(dependencies, factory) {
            const exports = {};
            const values = dependencies.map((dependency) => {
                if (dependency === 'require') return () => { throw new Error('The passive module must not load dependencies dynamically.'); };
                if (dependency === 'exports') return exports;
                if (dependency === 'jquery') return function jqueryNotUsedByPureChecks() { throw new Error('Pure preview checks must not access the DOM.'); };
                throw new Error(`Unexpected AMD dependency: ${dependency}`);
            });
            factory(...values);
            moduleExports = exports;
        },
    };
    vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
    assert.ok(moduleExports, 'Compiled assistant module must register through AMD.');
    return moduleExports;
}

assert.ok(fs.existsSync(runtimePath), 'The browser runtime must be generated from the maintained TypeScript source.');
assert.ok(fs.existsSync(packagedRuntimePath), 'The packaged browser runtime must contain the passive assistant.');
assert.strictEqual(
    fs.readFileSync(packagedRuntimePath, 'utf8'),
    fs.readFileSync(runtimePath, 'utf8'),
    'Maintained and packaged assistant runtimes must be byte-identical.'
);
const assistant = loadAmdModule(runtimePath);

assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: 'localhost', search: '?robotIntegrationAssistant=1' }), true);
assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: '127.0.0.1', search: '?robotIntegrationAssistant=1' }), true);
assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: '[::1]', search: '?robotIntegrationAssistant=1' }), true);
assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: 'localhost', search: '' }), false);
assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: 'codeon.example', search: '?robotIntegrationAssistant=1' }), false);
assert.strictEqual(assistant.isRobotIntegrationAssistantEnabled({ hostname: 'localhost.example', search: '?robotIntegrationAssistant=1' }), false);

const wellSuited = assistant.assessRobotIntegrationFeasibility({
    specificationUrl: 'https://example.org/robot-sdk',
    protocolEvidence: 'sdk',
    localControl: 'yes',
    actuatorControl: 'yes',
    sensorAccess: 'yes',
    safeStop: 'yes',
    hardwareAvailable: 'yes',
});
assert.strictEqual(wellSuited.valid, true);
assert.strictEqual(wellSuited.status, 'well-suited');
assert.strictEqual(wellSuited.canContinue, true);
assert.strictEqual(wellSuited.specificationUrl, 'https://example.org/robot-sdk');
assert.ok(Array.from(wellSuited.signals).includes('safe-stop-confirmed'));

const researchRequired = assistant.assessRobotIntegrationFeasibility({
    specificationUrl: '',
    protocolEvidence: 'examples-only',
    localControl: 'partial',
    actuatorControl: 'unknown',
    sensorAccess: 'unknown',
    safeStop: 'unknown',
    hardwareAvailable: 'no',
});
assert.strictEqual(researchRequired.valid, true);
assert.strictEqual(researchRequired.status, 'research-required');
assert.strictEqual(researchRequired.canContinue, true);
assert.ok(Array.from(researchRequired.signals).includes('protocol-research'));
assert.ok(Array.from(researchRequired.signals).includes('hardware-open'));

for (const blockingChange of [
    { protocolEvidence: 'locked' },
    { localControl: 'no' },
    { actuatorControl: 'no' },
    { safeStop: 'no' },
]) {
    const blocked = assistant.assessRobotIntegrationFeasibility({
        specificationUrl: 'https://example.org/spec',
        protocolEvidence: 'documented-protocol',
        localControl: 'yes',
        actuatorControl: 'yes',
        sensorAccess: 'yes',
        safeStop: 'yes',
        hardwareAvailable: 'yes',
        ...blockingChange,
    });
    assert.strictEqual(blocked.status, 'not-ready');
    assert.strictEqual(blocked.canContinue, false);
}

const invalidFeasibility = assistant.assessRobotIntegrationFeasibility({
    specificationUrl: 'https://user:secret@example.org/spec',
    protocolEvidence: 'invented',
    localControl: '',
    actuatorControl: 'yes',
    sensorAccess: 'yes',
    safeStop: 'yes',
    hardwareAvailable: 'yes',
});
assert.strictEqual(invalidFeasibility.valid, false);
assert.strictEqual(invalidFeasibility.status, null);
assert.strictEqual(invalidFeasibility.canContinue, false);
assert.deepStrictEqual(
    Array.from(invalidFeasibility.errors, (error) => error.code).sort(),
    ['answer', 'protocol-evidence', 'specification-url'].sort()
);
assert.ok(!JSON.stringify(invalidFeasibility).includes('secret'), 'Invalid documentation URLs must not be repeated in assessment output.');

const valid = assistant.buildRobotIntegrationDraftPreview(
    { id: 'demobot', displayName: 'Demo Bot', transport: 'ble', port: '2300', host: 'macos' },
    ['cozmo', 'apitor'],
    '1999'
);
assert.strictEqual(valid.valid, true);
assert.strictEqual(valid.manifest.id, 'demobot');
assert.strictEqual(valid.manifest.scope, 'bridge');
assert.strictEqual(valid.manifest.activation, 'draft');
assert.strictEqual(valid.manifest.hardwareStatus, 'experimental');
assert.strictEqual(valid.manifest.bridge.autoStart, false);
assert.strictEqual(valid.manifest.bridge.port, 2300);
assert.strictEqual(Array.from(valid.manifest.capabilities.actuators).length, 0);
assert.strictEqual(Array.from(valid.manifest.capabilities.sensors).length, 0);
assert.deepStrictEqual(Array.from(valid.paths), [
    'RobotIntegrationKit/manifests/demobot.json',
    'RobotIntegrationKit/python/src/codeon_robot_bridge/demobot_adapter.py',
    'RobotIntegrationKit/python/tests/test_demobot_adapter.py',
    'RobotIntegrationKit/docs/acceptance/demobot.md',
]);

const invalid = assistant.buildRobotIntegrationDraftPreview(
    { id: 'cozmo', displayName: 'Unsafe\u001b[2J', transport: 'network', port: '1999', host: 'other' },
    ['cozmo'],
    '1999'
);
assert.strictEqual(invalid.valid, false);
assert.strictEqual(invalid.manifest, null);
assert.strictEqual(Array.from(invalid.paths).length, 0);
assert.deepStrictEqual(
    Array.from(invalid.errors, (error) => error.code).sort(),
    ['host', 'id-used', 'name-format', 'port-used', 'transport'].sort()
);
assert.ok(!JSON.stringify(invalid).includes('\u001b'), 'Validation output must not repeat unsafe display text.');

const existingRobotIds = ['cozmo', 'edisonv2', 'rcx'];
const existingRobotIdsBefore = JSON.stringify(existingRobotIds);
for (const id of existingRobotIds) {
    const preview = assistant.buildRobotIntegrationDraftPreview(
        { id, displayName: 'Existing Robot', transport: 'usb', port: '2301', host: 'linux' },
        existingRobotIds
    );
    assert.ok(Array.from(preview.errors, (error) => error.code).includes('id-used'), `Existing robot ${id} must remain unavailable to the assistant.`);
}
assert.strictEqual(JSON.stringify(existingRobotIds), existingRobotIdsBefore, 'The assistant must not mutate the existing fixed, built-in or user-configurable robot list.');

for (const badPort of ['1023', '65536', '2300.5', 'not-a-port', '']) {
    const preview = assistant.buildRobotIntegrationDraftPreview(
        { id: 'demobot', displayName: 'Demo Bot', transport: 'usb', port: badPort, host: 'linux' }
    );
    assert.ok(Array.from(preview.errors, (error) => error.code).includes('port'), `Port ${badPort || '<empty>'} must be rejected.`);
}

const unsupportedDisplayName = assistant.buildRobotIntegrationDraftPreview(
    { id: 'demobot', displayName: 'Demo Bot 🤖', transport: 'usb', port: '2301', host: 'linux' }
);
assert.ok(
    Array.from(unsupportedDisplayName.errors, (error) => error.code).includes('name-format'),
    'The browser preview must apply the same bounded display-name alphabet as robot:new.'
);

const trackedHardware = assistant.buildRobotIntegrationHardwarePreview({
    robotId: 'demobot',
    locomotion: 'tracks',
    kinematics: 'skid-steer',
    wheelDiameterMm: '30',
    trackWidthMm: '80',
    maxLinearSpeedMmPerSec: '150',
    actuators: [
        { id: 'leftmotor', type: 'drive-motor', controlMode: 'power', unit: 'percent', minimum: '-100', maximum: '100', safeState: 'brake', completion: 'both' },
        { id: 'rightmotor', type: 'drive-motor', controlMode: 'power', unit: 'percent', minimum: '-100', maximum: '100', safeState: 'brake', completion: 'both' },
        { id: 'lift', type: 'lift', controlMode: 'position', unit: 'mm', minimum: '32', maximum: '92', safeState: 'hold', completion: 'wait-until-complete' },
    ],
    sensors: [
        { id: 'range', type: 'distance', valueType: 'number', unit: 'cm', minimum: '0', maximum: '300', access: 'sample' },
        { id: 'cliff', type: 'cliff', valueType: 'boolean', unit: 'boolean', minimum: '', maximum: '', access: 'both' },
    ],
});
assert.strictEqual(trackedHardware.valid, true);
assert.strictEqual(trackedHardware.profile.reviewStatus, 'draft');
assert.strictEqual(trackedHardware.profile.hardwareTested, false);
assert.strictEqual(trackedHardware.profile.drive.locomotion, 'tracks');
assert.strictEqual(trackedHardware.profile.drive.kinematics, 'skid-steer');
assert.deepStrictEqual(Array.from(trackedHardware.profile.actuators, (component) => component.id), ['leftmotor', 'rightmotor', 'lift']);
assert.deepStrictEqual(Array.from(trackedHardware.profile.sensors, (component) => component.id), ['range', 'cliff']);
const trackedMappings = Array.from(trackedHardware.blockMapping.mappings);
assert.strictEqual(trackedHardware.blockMapping.reviewStatus, 'expert-review-required');
assert.strictEqual(trackedMappings[0].capability, 'differentialDrive');
assert.strictEqual(trackedMappings[0].confidence, 'existing-generic');
assert.ok(trackedMappings.find((mapping) => mapping.componentId === 'cliff').suggestedBlocks.includes('wait until condition'));
assert.ok(trackedMappings.every((mapping) => mapping.expertReviewRequired === true));

const stationaryHardware = assistant.buildRobotIntegrationHardwarePreview({
    robotId: 'sensorbox',
    locomotion: 'stationary',
    kinematics: 'none',
    wheelDiameterMm: '',
    trackWidthMm: '',
    maxLinearSpeedMmPerSec: '',
    actuators: [],
    sensors: [{ id: 'button', type: 'touch', valueType: 'boolean', unit: 'boolean', minimum: '', maximum: '', access: 'event' }],
});
assert.strictEqual(stationaryHardware.valid, true, 'A sensor-only stationary system must be describable.');
assert.strictEqual(Array.from(stationaryHardware.blockMapping.mappings).length, 1);

const baseHardware = {
    robotId: 'demobot',
    locomotion: 'wheels',
    kinematics: 'differential',
    wheelDiameterMm: '',
    trackWidthMm: '',
    maxLinearSpeedMmPerSec: '',
    actuators: [{ id: 'motor', type: 'drive-motor', controlMode: 'power', unit: 'percent', minimum: '-100', maximum: '100', safeState: 'unknown', completion: 'both' }],
    sensors: [],
};
for (const [label, changes, expectedCode] of [
    ['stationary drive mismatch', { locomotion: 'stationary' }, 'drive-kinematics'],
    ['invalid geometry', { wheelDiameterMm: '-1' }, 'drive-geometry'],
    ['missing component', { actuators: [] }, 'component-count'],
    ['unrecognised locomotion', { locomotion: 'hovercraft' }, 'hardware-choice'],
]) {
    const preview = assistant.buildRobotIntegrationHardwarePreview({ ...baseHardware, ...changes });
    assert.strictEqual(preview.valid, false, `${label} must be rejected.`);
    assert.strictEqual(preview.profile, null);
    assert.strictEqual(preview.blockMapping, null);
    assert.ok(Array.from(preview.errors, (error) => error.code).includes(expectedCode));
}

const invalidComponents = assistant.buildRobotIntegrationHardwarePreview({
    ...baseHardware,
    actuators: [{ ...baseHardware.actuators[0], id: 'same', minimum: '100', maximum: '-100' }],
    sensors: [{ id: 'same', type: 'invented', valueType: 'number', unit: 'raw', minimum: '0', maximum: '', access: 'sample' }],
});
assert.strictEqual(invalidComponents.valid, false);
assert.strictEqual(invalidComponents.profile, null);
assert.strictEqual(invalidComponents.blockMapping, null);
assert.ok(Array.from(invalidComponents.errors, (error) => error.code).includes('component-id-used'));
assert.ok(Array.from(invalidComponents.errors, (error) => error.code).includes('hardware-choice'));
assert.ok(Array.from(invalidComponents.errors, (error) => error.code).includes('range'));

const unsafeHardware = assistant.buildRobotIntegrationHardwarePreview({
    ...baseHardware,
    actuators: [{ ...baseHardware.actuators[0], id: 'unsafe<script>' }],
});
assert.strictEqual(unsafeHardware.valid, false);
assert.ok(!JSON.stringify(unsafeHardware).includes('<script>'), 'Invalid component input must not be reflected in preview output.');

const tooManyActuators = Array.from({ length: 13 }, (_, index) => ({
    ...baseHardware.actuators[0],
    id: `motor${index}`,
}));
const oversizedHardware = assistant.buildRobotIntegrationHardwarePreview({ ...baseHardware, actuators: tooManyActuators });
assert.ok(Array.from(oversizedHardware.errors, (error) => error.code).includes('component-count'));

const source = fs.readFileSync(sourcePath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const packagedRuntime = fs.readFileSync(packagedRuntimePath, 'utf8');
for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /\bWebSocket\b/,
    /localStorage/,
    /sessionStorage/,
    /document\.cookie/,
    /navigator\.clipboard/,
    /\bBlob\b/,
    /FileSystem/,
]) {
    assert.doesNotMatch(source, forbidden, `Passive assistant contains forbidden browser capability: ${forbidden}`);
    assert.doesNotMatch(runtime, forbidden, `Generated passive assistant contains forbidden browser capability: ${forbidden}`);
    assert.doesNotMatch(packagedRuntime, forbidden, `Packaged passive assistant contains forbidden browser capability: ${forbidden}`);
}
assert.match(source, /robotIntegrationManifestPreview'\)\.text\(JSON\.stringify/);
assert.match(source, /robotIntegrationHardwareProfilePreview'\)\.text\(JSON\.stringify/);
assert.match(source, /robotIntegrationBlockMappingPreview'\)\.text\(JSON\.stringify/);
assert.match(source, /item\.textContent = plannedPath/);
assert.match(source, /item\.textContent = feasibilityText\[signal\]/);
assert.match(source, /robotIntegrationScaffoldStep.*d-none/);
assert.match(source, /robotIntegrationHardwareStep.*d-none/);
assert.match(source, /expertReviewRequired: true/);

const startView = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/app/roberta/controller/startView.controller.ts'), 'utf8');
assert.match(startView, /ROBOT_INTEGRATION_ASSISTANT\.init\(/);
const mainSource = fs.readFileSync(path.join(ROOT, 'OpenRobertaWeb/src/main.js'), 'utf8');
const mainRuntime = fs.readFileSync(path.join(ROOT, 'OpenRobertaServer/staticResources/js/main.js'), 'utf8');
const packagedMainRuntime = fs.readFileSync(path.join(ROOT, 'application/staticResources/js/main.js'), 'utf8');
for (const main of [mainSource, mainRuntime, packagedMainRuntime]) {
    assert.match(main, /'robotIntegrationAssistant\.controller': 'js\/app\/roberta\/controller\/robotIntegrationAssistant\.controller'/);
}
assert.strictEqual(packagedMainRuntime, mainRuntime, 'Maintained and packaged RequireJS configurations must be byte-identical.');

const serverStartView = fs.readFileSync(path.join(ROOT, 'OpenRobertaServer/staticResources/js/app/roberta/controller/startView.controller.js'), 'utf8');
const packagedStartView = fs.readFileSync(path.join(ROOT, 'application/staticResources/js/app/roberta/controller/startView.controller.js'), 'utf8');
assert.strictEqual(packagedStartView, serverStartView, 'Maintained and packaged start-view runtimes must be byte-identical.');

const serverIndex = fs.readFileSync(path.join(ROOT, 'OpenRobertaServer/staticResources/index.html'), 'utf8');
const packagedIndex = fs.readFileSync(path.join(ROOT, 'application/staticResources/index.html'), 'utf8');
assert.strictEqual(packagedIndex, serverIndex, 'Maintained and packaged entry pages must be byte-identical.');
for (const index of [serverIndex, packagedIndex]) {
    assert.match(index, /codeon-live-20260915-38/, 'Entry page must invalidate the previous frontend cache generation.');
}

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['test:robot-integration'], /scripts\/test-codeon-robot-integration-ui\.js/, 'The passive UI test must remain in the robot-integration CI group.');

console.log('CodeON passive robot integration UI checks passed.');
