#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_DIR = path.join(ROOT, 'RobotIntegrationKit', 'manifests');
const MAX_MANIFEST_BYTES = 64 * 1024;
const TOP_LEVEL_KEYS = new Set([
    '$schema', 'schemaVersion', 'id', 'displayName', 'scope', 'activation', 'transport',
    'configurationMode', 'module', 'browserConnectionClass', 'browserBehaviourClass',
    'previewImage', 'simulation', 'bridge', 'capabilities', 'limits', 'supportedHosts',
    'hardwareStatus', 'requiredChecks', 'knownLimitations'
]);
const REQUIRED_KEYS = [
    'schemaVersion', 'id', 'displayName', 'scope', 'activation', 'transport', 'bridge',
    'capabilities', 'limits', 'supportedHosts', 'hardwareStatus', 'requiredChecks', 'knownLimitations'
];
const COMPLETE_KEYS = [
    'configurationMode', 'module', 'browserConnectionClass', 'browserBehaviourClass',
    'previewImage', 'simulation'
];
const ENUMS = {
    scope: ['bridge', 'complete'],
    activation: ['draft', 'active'],
    transport: ['wifi', 'ble', 'usb', 'serial', 'other-local'],
    configurationMode: ['fixed', 'user-configurable', 'built-in'],
    simulation: ['none', 'planned', '2d', '3d', '2d-3d'],
    hardwareStatus: ['experimental', 'hardware-pending', 'verified', 'verified-with-limitations']
};

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function safeId(value) {
    return typeof value === 'string' && /^[a-z][a-z0-9]{1,31}$/.test(value);
}

function push(errors, condition, message) {
    if (!condition) errors.push(message);
}

function validateStringList(errors, value, label, pattern, maxItems, allowEmpty = true) {
    push(errors, Array.isArray(value), `${label} must be an array.`);
    if (!Array.isArray(value)) return;
    push(errors, allowEmpty || value.length > 0, `${label} must not be empty.`);
    push(errors, value.length <= maxItems, `${label} exceeds ${maxItems} entries.`);
    const seen = new Set();
    for (const item of value) {
        push(errors, typeof item === 'string' && pattern.test(item), `${label} contains an invalid value: ${String(item)}`);
        push(errors, !seen.has(item), `${label} contains a duplicate: ${String(item)}`);
        seen.add(item);
    }
}

function validateManifest(manifest, fileName = '') {
    const errors = [];
    if (!isPlainObject(manifest)) return ['Manifest root must be a plain JSON object.'];
    for (const key of Object.keys(manifest)) push(errors, TOP_LEVEL_KEYS.has(key), `Unknown top-level property: ${key}`);
    for (const key of REQUIRED_KEYS) push(errors, Object.hasOwn(manifest, key), `Missing required property: ${key}`);
    if (Object.hasOwn(manifest, '$schema')) push(errors, typeof manifest.$schema === 'string' && manifest.$schema.length <= 200, '$schema must be a string of at most 200 characters.');
    push(errors, manifest.schemaVersion === 1, 'schemaVersion must be 1.');
    push(errors, safeId(manifest.id), 'id must match ^[a-z][a-z0-9]{1,31}$.');
    push(errors, typeof manifest.displayName === 'string' && manifest.displayName.trim() === manifest.displayName && manifest.displayName.length >= 1 && manifest.displayName.length <= 80, 'displayName must be a trimmed string of 1 to 80 characters.');
    for (const [key, values] of Object.entries(ENUMS)) {
        if (Object.hasOwn(manifest, key)) push(errors, values.includes(manifest[key]), `${key} has an unsupported value.`);
    }
    if (fileName && safeId(manifest.id)) push(errors, path.basename(fileName, '.json') === manifest.id, 'Manifest filename must equal id plus .json.');

    if (manifest.scope === 'complete') for (const key of COMPLETE_KEYS) push(errors, Object.hasOwn(manifest, key), `Complete integration is missing: ${key}`);
    if (manifest.scope === 'bridge') for (const key of COMPLETE_KEYS) push(errors, !Object.hasOwn(manifest, key), `Bridge-only integration must not declare: ${key}`);
    if (manifest.activation === 'active') push(errors, manifest.scope === 'complete', 'Only complete integrations may be active.');

    if (Object.hasOwn(manifest, 'module')) push(errors, typeof manifest.module === 'string' && /^Robot[A-Z][A-Za-z0-9]{1,47}$/.test(manifest.module), 'module has an invalid name.');
    if (Object.hasOwn(manifest, 'browserConnectionClass')) push(errors, typeof manifest.browserConnectionClass === 'string' && /^[A-Z][A-Za-z0-9]{1,79}Connection$/.test(manifest.browserConnectionClass), 'browserConnectionClass has an invalid name.');
    if (Object.hasOwn(manifest, 'browserBehaviourClass')) push(errors, typeof manifest.browserBehaviourClass === 'string' && /^[A-Z][A-Za-z0-9]{1,79}$/.test(manifest.browserBehaviourClass), 'browserBehaviourClass has an invalid name.');
    if (Object.hasOwn(manifest, 'previewImage')) push(errors, typeof manifest.previewImage === 'string' && /^[a-z][a-z0-9]{1,31}\.(png|jpg)$/.test(manifest.previewImage), 'previewImage has an invalid name.');
    if (safeId(manifest.id) && manifest.previewImage) push(errors, manifest.previewImage === `${manifest.id}.png` || manifest.previewImage === `${manifest.id}.jpg`, 'previewImage basename must equal the robot id.');
    if (safeId(manifest.id) && manifest.browserConnectionClass) {
        const expected = manifest.id[0].toUpperCase() + manifest.id.slice(1) + 'Connection';
        push(errors, manifest.browserConnectionClass === expected, `browserConnectionClass must be ${expected} for the current resolver.`);
    }

    push(errors, isPlainObject(manifest.bridge), 'bridge must be a plain object.');
    if (isPlainObject(manifest.bridge)) {
        const allowed = new Set(['adapter', 'adapterClass', 'port', 'autoStart', 'optionalDependency']);
        for (const key of Object.keys(manifest.bridge)) push(errors, allowed.has(key), `Unknown bridge property: ${key}`);
        for (const key of ['adapter', 'adapterClass', 'port', 'autoStart']) push(errors, Object.hasOwn(manifest.bridge, key), `bridge is missing: ${key}`);
        push(errors, safeId(manifest.bridge.adapter), 'bridge.adapter has an invalid name.');
        if (safeId(manifest.id) && safeId(manifest.bridge.adapter)) push(errors, manifest.bridge.adapter === manifest.id, 'bridge.adapter must equal the robot id.');
        push(errors, typeof manifest.bridge.adapterClass === 'string' && /^[A-Z][A-Za-z0-9]{1,79}Adapter$/.test(manifest.bridge.adapterClass), 'bridge.adapterClass has an invalid name.');
        push(errors, Number.isInteger(manifest.bridge.port) && manifest.bridge.port >= 1024 && manifest.bridge.port <= 65535, 'bridge.port must be an integer from 1024 to 65535.');
        push(errors, typeof manifest.bridge.autoStart === 'boolean', 'bridge.autoStart must be boolean.');
        if (Object.hasOwn(manifest.bridge, 'optionalDependency')) push(errors, typeof manifest.bridge.optionalDependency === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(manifest.bridge.optionalDependency), 'bridge.optionalDependency has an invalid name.');
    }

    push(errors, isPlainObject(manifest.capabilities), 'capabilities must be a plain object.');
    if (isPlainObject(manifest.capabilities)) {
        for (const key of Object.keys(manifest.capabilities)) push(errors, key === 'actuators' || key === 'sensors', `Unknown capabilities property: ${key}`);
        for (const key of ['actuators', 'sensors']) validateStringList(errors, manifest.capabilities[key], `capabilities.${key}`, /^[A-Za-z][A-Za-z0-9]{0,63}$/, 64);
    }

    push(errors, isPlainObject(manifest.limits) && Object.keys(manifest.limits).length >= 1 && Object.keys(manifest.limits).length <= 32, 'limits must contain 1 to 32 entries.');
    if (isPlainObject(manifest.limits)) {
        for (const [key, value] of Object.entries(manifest.limits)) {
            push(errors, /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key), `Invalid limit name: ${key}`);
            if (typeof value === 'number') {
                push(errors, Number.isFinite(value) && Math.abs(value) <= 1e9, `Limit ${key} must be finite and bounded.`);
            } else {
                push(errors, isPlainObject(value), `Limit ${key} must be a number or range.`);
                if (isPlainObject(value)) {
                    push(errors, Object.keys(value).length === 2 && Object.hasOwn(value, 'min') && Object.hasOwn(value, 'max'), `Limit range ${key} must contain only min and max.`);
                    push(errors, Number.isFinite(value.min) && Number.isFinite(value.max) && Math.abs(value.min) <= 1e9 && Math.abs(value.max) <= 1e9 && value.min <= value.max, `Limit range ${key} is invalid.`);
                }
            }
        }
    }

    validateStringList(errors, manifest.supportedHosts, 'supportedHosts', /^(macos|windows|linux)$/, 3, false);
    validateStringList(errors, manifest.requiredChecks, 'requiredChecks', /^test\.[a-z0-9.-]{1,63}$/, 32, false);
    validateStringList(errors, manifest.knownLimitations, 'knownLimitations', /^.{1,500}$/s, 20);
    if (manifest.hardwareStatus === 'verified-with-limitations') push(errors, Array.isArray(manifest.knownLimitations) && manifest.knownLimitations.length > 0, 'verified-with-limitations requires at least one known limitation.');
    return errors;
}

function resolveManifestPath(id) {
    if (!safeId(id)) throw new Error('Robot id is unsafe or invalid.');
    const target = path.join(MANIFEST_DIR, `${id}.json`);
    const relative = path.relative(MANIFEST_DIR, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Manifest path escapes the manifest directory.');
    return target;
}

function readManifestFile(filePath) {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Manifest must be a regular file: ${path.basename(filePath)}`);
    if (stat.size > MAX_MANIFEST_BYTES) throw new Error(`Manifest exceeds ${MAX_MANIFEST_BYTES} bytes: ${path.basename(filePath)}`);
    const realDirectory = fs.realpathSync(MANIFEST_DIR);
    const realFile = fs.realpathSync(filePath);
    if (!realFile.startsWith(realDirectory + path.sep)) throw new Error(`Manifest resolves outside its directory: ${path.basename(filePath)}`);
    return JSON.parse(fs.readFileSync(realFile, 'utf8'));
}

function listManifestPaths() {
    const files = [];
    for (const entry of fs.readdirSync(MANIFEST_DIR, { withFileTypes: true })) {
        if (!entry.name.endsWith('.json')) continue;
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Manifest must be a regular file: ${entry.name}`);
        files.push(path.join(MANIFEST_DIR, entry.name));
    }
    return files.sort();
}

function validateManifestSet(items) {
    const errors = [];
    const ids = new Set();
    const ports = new Map();
    for (const item of items) {
        const manifest = item.manifest || item;
        const label = item.fileName || manifest.id || '<unknown>';
        if (ids.has(manifest.id)) errors.push(`${label}: duplicate robot id ${manifest.id}.`);
        ids.add(manifest.id);
        const port = manifest.bridge && manifest.bridge.port;
        if (Number.isInteger(port) && ports.has(port)) errors.push(`${label}: bridge port ${port} is already used by ${ports.get(port)}.`);
        if (Number.isInteger(port)) ports.set(port, manifest.id);
    }
    return errors;
}

function resolveRepositoryFile(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\0') || relativePath.includes('\\') || path.isAbsolute(relativePath)) {
        throw new Error(`Unsafe repository path: ${String(relativePath)}`);
    }
    const target = path.resolve(ROOT, relativePath);
    const relative = path.relative(ROOT, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Repository path escapes root: ${relativePath}`);
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Repository path must be a regular file: ${relativePath}`);
    const realRoot = fs.realpathSync(ROOT);
    const realTarget = fs.realpathSync(target);
    if (!realTarget.startsWith(realRoot + path.sep)) throw new Error(`Repository path resolves outside root: ${relativePath}`);
    return realTarget;
}

function readText(relativePath) {
    return fs.readFileSync(resolveRepositoryFile(relativePath), 'utf8');
}

function exists(relativePath) {
    try {
        resolveRepositoryFile(relativePath);
        return true;
    } catch (_error) {
        return false;
    }
}

function parseProperties(contents) {
    const values = new Map();
    for (const raw of contents.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const index = line.indexOf('=');
        if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
    }
    return values;
}

function repositoryChecks(manifest) {
    const errors = [];
    const warnings = [];
    const ok = (condition, message) => { if (!condition) errors.push(message); };
    const adapterFile = `RobotIntegrationKit/python/src/codeon_robot_bridge/${manifest.bridge.adapter}_adapter.py`;
    ok(exists(adapterFile), `Missing bridge adapter: ${adapterFile}`);
    const serverPath = 'RobotIntegrationKit/python/src/codeon_robot_bridge/server.py';
    if (exists(serverPath)) {
        const server = readText(serverPath);
        ok(server.includes(`from .${manifest.bridge.adapter}_adapter import ${manifest.bridge.adapterClass}`), `Bridge server does not import ${manifest.bridge.adapterClass}.`);
        ok(new RegExp(`choices=\\([^)]*['\"]${manifest.bridge.adapter}['\"]`).test(server), `Bridge CLI does not allow adapter ${manifest.bridge.adapter}.`);
        ok(server.includes(`${manifest.bridge.adapterClass}(`), `Bridge server does not construct ${manifest.bridge.adapterClass}.`);
    }
    if (exists(adapterFile)) {
        const adapter = readText(adapterFile);
        ok(adapter.includes(`class ${manifest.bridge.adapterClass}(RobotAdapter)`), `Adapter file does not define ${manifest.bridge.adapterClass}.`);
        for (const capability of [...manifest.capabilities.actuators, ...manifest.capabilities.sensors]) ok(adapter.includes(capability), `Adapter does not mention declared capability ${capability}.`);
    }
    if (manifest.bridge.optionalDependency) {
        const pyproject = readText('RobotIntegrationKit/python/pyproject.toml');
        ok(new RegExp(`^${manifest.bridge.optionalDependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'm').test(pyproject), `Missing Python optional dependency group ${manifest.bridge.optionalDependency}.`);
    }

    if (manifest.scope !== 'complete') return { errors, warnings };
    const modulePath = manifest.module;
    ok(exists(`${modulePath}/pom.xml`), `Missing robot module ${modulePath}/pom.xml.`);
    const rootPom = readText('pom.xml');
    const serverPom = readText('OpenRobertaServer/pom.xml');
    ok(rootPom.includes(`<module>${modulePath}</module>`), `Root reactor does not include ${modulePath}.`);
    ok(rootPom.includes(`<artifactId>${modulePath}</artifactId>`), `Root dependency management does not include ${modulePath}.`);
    ok(serverPom.includes(`<artifactId>${modulePath}</artifactId>`), `Server does not depend on ${modulePath}.`);

    const whitelist = readText('OpenRobertaServer/src/main/resources/openRoberta.properties');
    const whitelistLine = whitelist.split(/\r?\n/).find((line) => /^\s*robot\.whitelist\s*=/.test(line)) || '';
    const whitelisted = whitelistLine.split('=')[1]?.split(',').map((value) => value.trim()).includes(manifest.id) || false;
    ok(manifest.activation === 'active' ? whitelisted : !whitelisted, manifest.activation === 'active' ? `Active robot ${manifest.id} is absent from robot.whitelist.` : `Draft robot ${manifest.id} must not be active in robot.whitelist.`);

    const propertiesPath = `${modulePath}/src/main/resources/${manifest.id}.properties`;
    ok(exists(propertiesPath), `Missing plugin properties: ${propertiesPath}`);
    if (exists(propertiesPath)) {
        const properties = parseProperties(readText(propertiesPath));
        ok(properties.get('robot.real.name') === manifest.displayName, 'robot.real.name differs from displayName.');
        const configurable = properties.get('robot.configuration') === 'true';
        const fixed = properties.get('robot.configuration.fixed') === 'true';
        ok(manifest.configurationMode === 'fixed' ? configurable && fixed : manifest.configurationMode === 'user-configurable' ? configurable && !fixed : !configurable && !fixed, `Plugin properties do not match configurationMode ${manifest.configurationMode}.`);
        for (const key of ['robot.program.toolbox.beginner', 'robot.program.default', 'robot.configuration.toolbox', 'robot.configuration.default']) {
            const resource = properties.get(key);
            const safeResource = typeof resource === 'string'
                && resource.startsWith(`/${manifest.id}/`)
                && !resource.includes('..')
                && !resource.includes('\\')
                && path.posix.normalize(resource) === resource;
            ok(safeResource && exists(`${modulePath}/src/main/resources${resource}`), `Plugin resource ${key} is missing or invalid.`);
        }
    }

    const connections = readText('OpenRobertaWeb/src/app/roberta/controller/connections/connections.ts');
    ok(connections.includes(`export class ${manifest.browserConnectionClass}`), `Browser connection ${manifest.browserConnectionClass} is not exported.`);
    const behaviourFiles = fs.readdirSync(path.join(ROOT, 'OpenRobertaWeb/src/app/nepostackmachine')).filter((name) => name.endsWith('.ts'));
    ok(behaviourFiles.some((name) => readText(`OpenRobertaWeb/src/app/nepostackmachine/${name}`).includes(`class ${manifest.browserBehaviourClass}`)), `Browser behaviour ${manifest.browserBehaviourClass} is missing.`);
    ok(exists(`OpenRobertaServer/staticResources/css/img/system_preview/${manifest.previewImage}`), `Preview image ${manifest.previewImage} is missing.`);

    if (manifest.simulation === '2d' || manifest.simulation === '2d-3d') ok(exists(`OpenRobertaWeb/src/app/simulation/simulationLogic/robot.${manifest.id}.ts`), `2D simulation adapter robot.${manifest.id}.ts is missing.`);
    if (manifest.simulation === '3d' || manifest.simulation === '2d-3d') {
        const adapter3d = 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js';
        ok(exists(adapter3d) && readText(adapter3d).toLowerCase().includes(manifest.id), `3D simulation adapter does not mention ${manifest.id}.`);
    }

    const graph = JSON.parse(readText('architecture/codeon-architecture-graph.json'));
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    ok(nodeIds.has(`robot.${manifest.id}`), `Architecture graph lacks robot.${manifest.id}.`);
    ok(graph.nodes.some((node) => node.type === 'module' && node.path === modulePath), `Architecture graph lacks module ${modulePath}.`);
    for (const checkId of manifest.requiredChecks) ok(nodeIds.has(checkId), `Architecture graph lacks required check ${checkId}.`);
    return { errors, warnings };
}

module.exports = {
    MANIFEST_DIR,
    ROOT,
    listManifestPaths,
    readManifestFile,
    repositoryChecks,
    resolveManifestPath,
    safeId,
    validateManifest,
    validateManifestSet
};
