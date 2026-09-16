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
const VALUE_OPTIONS = new Set(['--id', '--name', '--transport', '--port', '--host', '--optional-dependency', '--confirm', '--plan-hash']);

function usage() {
    return [
        'Usage: npm run robot:new -- (--dry-run | --write --confirm ID --plan-hash SHA256) --id ID --name NAME --transport TYPE --port PORT --host HOST [--host HOST] [--optional-dependency EXTRA] [--json]',
        'TYPE: wifi, ble, usb, serial, other-local; HOST: macos, windows, linux'
    ].join('\n');
}

function parseArguments(args) {
    const options = { dryRun: false, write: false, json: false, help: false, hosts: [] };
    const seen = new Set();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--dry-run') {
            if (seen.has(arg)) throw new Error('Duplicate option: --dry-run');
            seen.add(arg);
            options.dryRun = true;
        } else if (arg === '--write') {
            if (seen.has(arg)) throw new Error('Duplicate option: --write');
            seen.add(arg);
            options.write = true;
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
                    '--id': 'id', '--name': 'name', '--transport': 'transport', '--port': 'port', '--optional-dependency': 'optionalDependency', '--confirm': 'confirm', '--plan-hash': 'planHash'
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
    const allowed = new Set(['dryRun', 'write', 'json', 'help', 'hosts', 'id', 'name', 'transport', 'port', 'optionalDependency', 'confirm', 'planHash']);
    const unknown = Object.keys(options).find((key) => !allowed.has(key));
    if (unknown) throw new Error(`Unknown option property: ${unknown}`);
    if (options.help) return;
    if (typeof options.dryRun !== 'boolean' || typeof options.write !== 'boolean') throw new Error('Scaffold mode flags must be boolean.');
    if (options.dryRun === options.write) throw new Error('Choose exactly one scaffold mode: --dry-run or --write.');
    if (!safeId(options.id)) throw new Error('Robot id must match ^[a-z][a-z0-9]{1,31}$.');
    if (options.write && options.confirm !== options.id) throw new Error('Write mode requires --confirm with the exact robot id.');
    if (options.write && (typeof options.planHash !== 'string' || !/^[0-9a-f]{64}$/.test(options.planHash))) throw new Error('Write mode requires the exact SHA-256 value from --plan-hash.');
    if (options.dryRun && (options.confirm !== undefined || options.planHash !== undefined)) throw new Error('--confirm and --plan-hash are accepted only with --write.');
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

function isStrictlyContainedPath(rootPath, targetPath, pathApi = path) {
    const relative = pathApi.relative(rootPath, targetPath);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative);
}

function relativeTarget(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.includes('\\')) throw new Error(`Unsafe generated target: ${String(relativePath)}`);
    const absolute = path.resolve(ROOT, relativePath);
    const relative = path.relative(ROOT, absolute);
    if (!isStrictlyContainedPath(ROOT, absolute)) throw new Error(`Unsafe generated target: ${relativePath}`);
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

function scaffoldTargets(id) {
    return [
        `RobotIntegrationKit/manifests/${id}.json`,
        `RobotIntegrationKit/python/src/codeon_robot_bridge/${id}_adapter.py`,
        `RobotIntegrationKit/python/tests/test_${id}_adapter.py`,
        `RobotIntegrationKit/docs/acceptance/${id}.md`
    ];
}

function scaffoldPlanHash(files) {
    const receipt = files.map(({ path: filePath, bytes, sha256 }) => ({ path: filePath, bytes, sha256 }));
    return crypto.createHash('sha256').update(JSON.stringify(receipt), 'utf8').digest('hex');
}

function pathExists(filePath, io = fs) {
    try {
        io.lstatSync(filePath);
        return true;
    } catch (error) {
        if (error && error.code === 'ENOENT') return false;
        throw error;
    }
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
    const targets = scaffoldTargets(options.id);
    const files = [
        plannedFile(targets[0], JSON.stringify(manifest, null, 2) + '\n'),
        plannedFile(targets[1], renderTemplate('adapter.py.tpl', values)),
        plannedFile(targets[2], renderTemplate('test_adapter.py.tpl', values)),
        plannedFile(targets[3], renderTemplate('HARDWARE_ACCEPTANCE.md.tpl', values))
    ];
    const planHash = scaffoldPlanHash(files);
    if (options.write && options.planHash !== planHash) throw new Error('Plan hash does not match the current scaffold; run --dry-run again and review the new output.');
    const collisions = files.filter((file) => pathExists(path.join(ROOT, file.path))).map((file) => file.path);
    if (collisions.length) throw new Error(`Generated target already exists: ${collisions[0]}`);
    return {
        purpose: `codeon-robot-bridge-${options.write ? 'write' : 'dry-run'}`,
        mode: options.write ? 'write' : 'dry-run',
        planHash,
        writePerformed: false,
        manifest,
        files,
        manualNextSteps: [
            options.write
                ? 'Review the newly created fail-closed files before editing or registering them.'
                : `Review every generated file, then use the same inputs with --write --confirm ${options.id} --plan-hash ${planHash} instead of --dry-run.`,
            'Implement and test a real idempotent stop_all before any movement command.',
            'Add vendor dependencies only as an isolated optional extra.',
            'Register the adapter only after dependency-absent and hardware-absent tests pass.',
            `Run npm run robot:check -- --id ${options.id} after the files and registrations exist.`
        ]
    };
}

function verifyWritePlan(plan) {
    if (!plan || typeof plan !== 'object' || plan.mode !== 'write' || plan.writePerformed !== false) throw new Error('Only an unexecuted write-mode plan may be written.');
    if (!plan.manifest || !safeId(plan.manifest.id)) throw new Error('Write plan has an invalid robot id.');
    const expected = scaffoldTargets(plan.manifest.id);
    const manifestErrors = validateManifest(plan.manifest, `${plan.manifest.id}.json`);
    if (manifestErrors.length) throw new Error(`Write plan manifest is invalid: ${manifestErrors[0]}`);
    if (!Array.isArray(plan.files) || plan.files.length !== expected.length) throw new Error('Write plan must contain exactly four scaffold files.');
    for (let index = 0; index < expected.length; index += 1) {
        const file = plan.files[index];
        if (!file || file.path !== expected[index]) throw new Error(`Unexpected scaffold target at position ${index + 1}.`);
        if (typeof file.content !== 'string') throw new Error(`Scaffold content is missing: ${file.path}`);
        if (!Number.isInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_TEMPLATE_BYTES) throw new Error(`Scaffold size is invalid: ${file.path}`);
        if (Buffer.byteLength(file.content, 'utf8') !== file.bytes) throw new Error(`Scaffold byte count changed: ${file.path}`);
        const digest = crypto.createHash('sha256').update(file.content, 'utf8').digest('hex');
        if (digest !== file.sha256) throw new Error(`Scaffold content hash changed: ${file.path}`);
    }
    const expectedManifest = JSON.stringify(plan.manifest, null, 2) + '\n';
    if (plan.files[0].content !== expectedManifest) throw new Error('Scaffold manifest content differs from the reviewed manifest.');
    if (plan.planHash !== scaffoldPlanHash(plan.files)) throw new Error('Scaffold plan hash differs from the reviewed plan.');
}

function resolveWriteTargets(plan, destinationRoot, io) {
    const rootPath = path.resolve(destinationRoot);
    const rootStat = io.lstatSync(rootPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Scaffold root must be a real directory.');
    const realRoot = io.realpathSync(rootPath);
    const seen = new Set();
    return plan.files.map((file) => {
        const target = path.resolve(rootPath, file.path);
        if (!isStrictlyContainedPath(rootPath, target)) throw new Error(`Unsafe scaffold target: ${file.path}`);
        if (seen.has(target)) throw new Error(`Duplicate scaffold target: ${file.path}`);
        seen.add(target);
        const parent = path.dirname(target);
        const parentStat = io.lstatSync(parent);
        if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error(`Scaffold parent must be a real directory: ${file.path}`);
        const realParent = io.realpathSync(parent);
        if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) throw new Error(`Scaffold parent escapes repository: ${file.path}`);
        if (pathExists(target, io)) throw new Error(`Generated target already exists: ${file.path}`);
        return { file, target };
    });
}

function writePlan(plan, destinationRoot = ROOT, io = fs) {
    verifyWritePlan(plan);
    const targets = resolveWriteTargets(plan, destinationRoot, io);
    const created = [];
    try {
        for (const { file, target } of targets) {
            const constants = io.constants || fs.constants;
            const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0);
            const descriptor = io.openSync(target, flags, 0o644);
            created.push(target);
            try {
                io.writeFileSync(descriptor, file.content, { encoding: 'utf8' });
                io.fsyncSync(descriptor);
            } finally {
                io.closeSync(descriptor);
            }
            const written = io.lstatSync(target);
            if (!written.isFile() || written.isSymbolicLink()) throw new Error(`Written target is not a regular file: ${file.path}`);
            const content = io.readFileSync(target, 'utf8');
            const digest = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
            if (Buffer.byteLength(content, 'utf8') !== file.bytes || digest !== file.sha256) throw new Error(`Written content verification failed: ${file.path}`);
        }
    } catch (error) {
        const rollbackErrors = [];
        for (const target of created.reverse()) {
            try {
                const stat = io.lstatSync(target);
                if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('target changed type');
                io.unlinkSync(target);
            } catch (rollbackError) {
                rollbackErrors.push(`${path.relative(destinationRoot, target)}: ${rollbackError.message}`);
            }
        }
        const rollback = rollbackErrors.length === 0 ? 'Created files were rolled back.' : `Rollback incomplete: ${rollbackErrors.join('; ')}`;
        throw new Error(`Scaffold write failed: ${error.message}. ${rollback}`);
    }
    return {
        ...plan,
        writePerformed: true,
        writtenFiles: plan.files.map((file) => file.path)
    };
}

function formatPlan(plan) {
    const written = plan.writePerformed === true;
    const lines = [
        `CodeON robot bridge ${written ? 'scaffold created' : 'dry run'}: ${plan.manifest.displayName} (${plan.manifest.id})`,
        written ? 'Exactly four fail-closed scaffold files were created; no registrations were changed.' : 'No files were written.',
        `Plan confirmation hash: ${plan.planHash}`,
        written ? 'Created files:' : 'Planned new files:'
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
    const result = options.write ? writePlan(plan) : plan;
    console.log(options.json ? JSON.stringify(result, null, 2) : formatPlan(result));
    return 0;
}

if (require.main === module) {
    try {
        process.exitCode = run();
    } catch (error) {
        console.error(`Robot scaffold failed: ${error.message}`);
        console.error(usage());
        process.exitCode = 1;
    }
}

module.exports = { adapterClassFor, buildManifest, buildPlan, formatPlan, isStrictlyContainedPath, parseArguments, renderTemplate, run, scaffoldPlanHash, validateOptions, verifyWritePlan, writePlan };
