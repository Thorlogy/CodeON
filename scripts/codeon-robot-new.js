#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    ROOT,
    listManifestPaths,
    optionalDependencyGroups,
    readManifestFile,
    registeredRobotIds,
    reservedLocalPorts,
    safeId,
    validateManifest,
    validateManifestSet
} = require('./codeon-robot-manifest');

const TEMPLATE_DIR = path.join(ROOT, 'RobotIntegrationKit', 'templates', 'bridge');
const MAX_TEMPLATE_BYTES = 64 * 1024;
const TRANSPORTS = new Set(['wifi', 'ble', 'usb', 'serial', 'other-local']);
const HOSTS = new Set(['macos', 'windows', 'linux']);
const VALUE_OPTIONS = new Set(['--id', '--name', '--transport', '--port', '--host', '--optional-dependency']);

function usage() {
    return [
        'Usage: npm run robot:new -- --dry-run --id ID --name NAME --transport TYPE --port PORT --host HOST [--host HOST] [--optional-dependency EXTRA] [--json]',
        'TYPE: wifi, ble, usb, serial, other-local; HOST: macos, windows, linux'
    ].join('\n');
}

function parseArguments(args) {
    const options = { dryRun: false, json: false, help: false, hosts: [] };
    const seen = new Set();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--dry-run') {
            if (seen.has(arg)) throw new Error('Duplicate option: --dry-run');
            seen.add(arg);
            options.dryRun = true;
        } else if (arg === '--json') {
            if (seen.has(arg)) throw new Error('Duplicate option: --json');
            seen.add(arg);
            options.json = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (VALUE_OPTIONS.has(arg)) {
            if (index + 1 >= args.length || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
            const value = args[++index];
            if (arg === '--host') options.hosts.push(value);
            else {
                if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
                seen.add(arg);
                const key = {
                    '--id': 'id', '--name': 'name', '--transport': 'transport', '--port': 'port', '--optional-dependency': 'optionalDependency'
                }[arg];
                options[key] = value;
            }
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return options;
}

function validateOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options) || Object.getPrototypeOf(options) !== Object.prototype) throw new Error('Options must be a plain object.');
    const allowed = new Set(['dryRun', 'json', 'help', 'hosts', 'id', 'name', 'transport', 'port', 'optionalDependency']);
    const unknown = Object.keys(options).find((key) => !allowed.has(key));
    if (unknown) throw new Error(`Unknown option property: ${unknown}`);
    if (options.help) return;
    if (options.dryRun !== true) throw new Error('Write mode is not available; --dry-run is required.');
    if (!safeId(options.id)) throw new Error('Robot id must match ^[a-z][a-z0-9]{1,31}$.');
    if (typeof options.name !== 'string' || !/^[\p{L}\p{N} .,'()&+/_-]{1,80}$/u.test(options.name) || options.name.trim() !== options.name) throw new Error('Name must be a single, bounded display name without control characters.');
    if (!TRANSPORTS.has(options.transport)) throw new Error('Unsupported transport.');
    if (typeof options.port !== 'string' || !/^[0-9]{4,5}$/.test(options.port)) throw new Error('Port must be a decimal integer from 1024 to 65535.');
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be a decimal integer from 1024 to 65535.');
    if (!Array.isArray(options.hosts) || options.hosts.length === 0) throw new Error('At least one --host is required.');
    if (new Set(options.hosts).size !== options.hosts.length) throw new Error('Duplicate host.');
    for (const host of options.hosts) if (!HOSTS.has(host)) throw new Error(`Unsupported host: ${host}`);
    if (options.optionalDependency !== undefined) {
        if (typeof options.optionalDependency !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(options.optionalDependency)) throw new Error('Optional dependency group has an invalid name.');
        if (options.optionalDependency !== options.id && !options.optionalDependency.startsWith(`${options.id}-`)) throw new Error('Optional dependency group must be robot-specific and start with the robot id.');
    }
}

function adapterClassFor(id) {
    return id[0].toUpperCase() + id.slice(1) + 'Adapter';
}

function readTemplate(name) {
    if (!['adapter.py.tpl', 'test_adapter.py.tpl', 'HARDWARE_ACCEPTANCE.md.tpl'].includes(name)) throw new Error('Unknown template.');
    const filePath = path.join(TEMPLATE_DIR, name);
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Template must be a regular file: ${name}`);
    if (stat.size > MAX_TEMPLATE_BYTES) throw new Error(`Template exceeds ${MAX_TEMPLATE_BYTES} bytes: ${name}`);
    const realDirectory = fs.realpathSync(TEMPLATE_DIR);
    const realFile = fs.realpathSync(filePath);
    if (!realFile.startsWith(realDirectory + path.sep)) throw new Error(`Template resolves outside its directory: ${name}`);
    return fs.readFileSync(realFile, 'utf8');
}

function renderTemplate(name, values) {
    let rendered = readTemplate(name);
    for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{{${key}}}`, value);
    if (/\{\{[A-Z_]+\}\}/.test(rendered)) throw new Error(`Template contains an unresolved placeholder: ${name}`);
    return rendered.endsWith('\n') ? rendered : rendered + '\n';
}

function relativeTarget(relativePath) {
    const absolute = path.resolve(ROOT, relativePath);
    const relative = path.relative(ROOT, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes('\\')) throw new Error(`Unsafe generated target: ${relativePath}`);
    return relative.split(path.sep).join('/');
}

function buildManifest(options) {
    return {
        $schema: '../schema/robot-integration.schema.json',
        schemaVersion: 1,
        id: options.id,
        displayName: options.name,
        scope: 'bridge',
        activation: 'draft',
        transport: options.transport,
        bridge: {
            adapter: options.id,
            adapterClass: adapterClassFor(options.id),
            port: Number(options.port),
            autoStart: false,
            ...(options.optionalDependency ? { optionalDependency: options.optionalDependency } : {})
        },
        capabilities: { actuators: [], sensors: [] },
        limits: { heartbeatTimeoutMs: 1000 },
        supportedHosts: [...options.hosts].sort(),
        hardwareStatus: 'experimental',
        requiredChecks: ['test.robot-bridge'],
        knownLimitations: ['Hardware protocol and safety limits are not yet verified.']
    };
}

function plannedFile(relativePath, content) {
    return {
        path: relativeTarget(relativePath),
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: crypto.createHash('sha256').update(content, 'utf8').digest('hex'),
        content
    };
}

function buildPlan(options) {
    validateOptions(options);
    if (registeredRobotIds().has(options.id)) throw new Error(`Robot id is already registered: ${options.id}`);
    const port = Number(options.port);
    const portOwners = reservedLocalPorts().get(port);
    if (portOwners) throw new Error(`Local port ${port} is already reserved by ${[...portOwners].sort().join(', ')}.`);
    if (options.optionalDependency && optionalDependencyGroups().has(options.optionalDependency)) throw new Error(`Python optional dependency group already exists: ${options.optionalDependency}`);
    const manifest = buildManifest(options);
    const manifestErrors = validateManifest(manifest, `${options.id}.json`);
    if (manifestErrors.length) throw new Error(`Generated manifest is invalid: ${manifestErrors[0]}`);
    const existing = listManifestPaths().map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
    const setErrors = validateManifestSet([...existing, { fileName: `${options.id}.json`, manifest }]);
    if (setErrors.length) throw new Error(setErrors[0]);

    const values = {
        ROBOT_ID: options.id,
        ROBOT_ID_LITERAL: JSON.stringify(options.id),
        ADAPTER_CLASS: manifest.bridge.adapterClass,
        DISPLAY_NAME: options.name,
        TRANSPORT: options.transport,
        HOSTS: manifest.supportedHosts.map((host) => `\`${host}\``).join(', ')
    };
    const files = [
        plannedFile(`RobotIntegrationKit/manifests/${options.id}.json`, JSON.stringify(manifest, null, 2) + '\n'),
        plannedFile(`RobotIntegrationKit/python/src/codeon_robot_bridge/${options.id}_adapter.py`, renderTemplate('adapter.py.tpl', values)),
        plannedFile(`RobotIntegrationKit/python/tests/test_${options.id}_adapter.py`, renderTemplate('test_adapter.py.tpl', values)),
        plannedFile(`RobotIntegrationKit/docs/acceptance/${options.id}.md`, renderTemplate('HARDWARE_ACCEPTANCE.md.tpl', values))
    ];
    const collisions = files.filter((file) => fs.existsSync(path.join(ROOT, file.path))).map((file) => file.path);
    if (collisions.length) throw new Error(`Generated target already exists: ${collisions[0]}`);
    return {
        purpose: 'codeon-robot-bridge-dry-run',
        writePerformed: false,
        manifest,
        files,
        manualNextSteps: [
            'Review every generated file before enabling any write operation.',
            'Implement and test a real idempotent stop_all before any movement command.',
            'Add vendor dependencies only as an isolated optional extra.',
            'Register the adapter only after dependency-absent and hardware-absent tests pass.',
            `Run npm run robot:check -- --id ${options.id} after the files and registrations exist.`
        ]
    };
}

function formatPlan(plan) {
    const lines = [
        `CodeON robot bridge dry run: ${plan.manifest.displayName} (${plan.manifest.id})`,
        'No files were written.',
        'Planned new files:'
    ];
    for (const file of plan.files) lines.push(`- ${file.path} (${file.bytes} bytes, sha256 ${file.sha256.slice(0, 12)}…)`);
    lines.push('', 'Draft manifest:', JSON.stringify(plan.manifest, null, 2), '', 'Manual next steps:');
    plan.manualNextSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    return lines.join('\n');
}

function run(args = process.argv.slice(2)) {
    const options = parseArguments(args);
    if (options.help) {
        console.log(usage());
        return 0;
    }
    const plan = buildPlan(options);
    console.log(options.json ? JSON.stringify(plan, null, 2) : formatPlan(plan));
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = run();
    } catch (error) {
        console.error(`Robot scaffold dry run failed: ${error.message}`);
        console.error(usage());
        process.exitCode = 1;
    }
}

module.exports = { adapterClassFor, buildManifest, buildPlan, formatPlan, parseArguments, renderTemplate, run, validateOptions };
