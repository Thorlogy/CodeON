#!/usr/bin/env node

'use strict';

const path = require('path');
const {
    listManifestPaths,
    readManifestFile,
    repositoryChecks,
    requiredCheckCommands,
    resolveManifestPath,
    validateManifest,
    validateManifestSet
} = require('./codeon-robot-manifest');

function usage() {
    return 'Usage: npm run robot:status -- --id ROBOT_ID [--json]';
}

function parseArguments(args) {
    const options = { id: null, json: false, help: false };
    const seen = new Set();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--json') {
            if (seen.has(arg)) throw new Error('Duplicate option: --json');
            seen.add(arg);
            options.json = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--id' && index + 1 < args.length && !args[index + 1].startsWith('--')) {
            if (seen.has(arg)) throw new Error('Duplicate option: --id');
            seen.add(arg);
            options.id = args[++index];
        } else {
            throw new Error(`Unknown or incomplete argument: ${arg}`);
        }
    }
    if (!options.help && options.id === null) throw new Error('--id is required.');
    return options;
}

function phase(id, state, summary, findings = []) {
    return { id, state, summary, findings };
}

function buildStatus(loaded, selectedId, checkRepository = repositoryChecks, lookupChecks = requiredCheckCommands) {
    const selected = loaded.filter(({ fileName }) => fileName === `${selectedId}.json`);
    if (selected.length === 0) throw new Error(`No robot integration manifest found for id: ${selectedId}`);
    const { fileName, manifest } = selected[0];
    const manifestErrors = validateManifest(manifest, fileName);
    const setErrors = validateManifestSet(loaded);
    const contractErrors = [...manifestErrors, ...setErrors];
    const repository = manifestErrors.length === 0
        ? checkRepository(manifest)
        : { errors: [], warnings: [], bridgeErrors: [], completeErrors: [] };
    const bridgeErrors = repository.bridgeErrors || repository.errors || [];
    const completeErrors = repository.completeErrors || [];
    const repositoryErrors = repository.errors || [...bridgeErrors, ...completeErrors];
    const phases = [];

    phases.push(contractErrors.length === 0
        ? phase('manifest', 'complete', 'Manifest and global ID/port uniqueness are valid.')
        : phase('manifest', 'blocked', 'The manifest contract must be repaired before repository progress can be assessed.', contractErrors));

    if (contractErrors.length > 0) {
        phases.push(phase('bridge', 'blocked', 'Bridge assessment is blocked by the manifest contract.'));
        phases.push(phase('system', 'blocked', 'Complete-system assessment is blocked by the manifest contract.'));
    } else {
        phases.push(bridgeErrors.length === 0
            ? phase('bridge', 'complete', 'Bridge adapter, test and static registration agree with the manifest.')
            : phase('bridge', 'pending', 'Bridge implementation or registration is still incomplete.', bridgeErrors));
        if (manifest.scope === 'bridge') {
            phases.push(phase('system', 'pending', 'The manifest intentionally remains bridge-only; no selectable CodeON system is claimed.'));
        } else {
            phases.push(completeErrors.length === 0
                ? phase('system', 'complete', 'Plugin, browser, simulation and architecture registrations agree with the manifest.')
                : phase('system', 'pending', 'The complete CodeON system still has static integration gaps.', completeErrors));
        }
    }

    const declaredChecks = manifestErrors.length === 0 ? lookupChecks(manifest.requiredChecks) : [];
    phases.push(phase(
        'verification',
        'pending',
        'Required checks are declared but their latest execution result is deliberately not inferred from repository files.',
        declaredChecks.map(({ id, command }) => command ? `${id}: ${command}` : `${id}: no command found`)
    ));

    const limitations = Array.isArray(manifest.knownLimitations) ? manifest.knownLimitations : [];
    if (manifest.hardwareStatus === 'verified') {
        phases.push(phase('hardware', 'complete', 'The manifest records hardware verification.'));
    } else if (manifest.hardwareStatus === 'verified-with-limitations') {
        phases.push(phase('hardware', 'attention', 'Hardware is recorded as verified with known limitations.', limitations));
    } else {
        phases.push(phase('hardware', 'pending', `Hardware status is ${manifest.hardwareStatus || 'invalid'}.`, limitations));
    }

    const nextActions = [];
    if (contractErrors.length > 0) nextActions.push(...contractErrors.map((error) => `Repair contract: ${error}`));
    else if (bridgeErrors.length > 0) nextActions.push(...bridgeErrors.map((error) => `Complete bridge step: ${error}`));
    else if (manifest.scope === 'bridge') nextActions.push('Keep scope=bridge until stop, watchdog, disconnect and hardware-absent behavior have independent evidence.');
    else if (completeErrors.length > 0) nextActions.push(...completeErrors.map((error) => `Complete system step: ${error}`));
    if (declaredChecks.length > 0) nextActions.push('Run the declared checks explicitly; this status command never executes them or marks them passed.');
    if (manifest.hardwareStatus === 'verified-with-limitations') nextActions.push('Retain or resolve every documented hardware limitation before claiming full verification.');
    else if (manifest.hardwareStatus !== 'verified') nextActions.push('Complete and document physical hardware acceptance before changing hardwareStatus.');

    return {
        id: manifest.id || selectedId,
        displayName: manifest.displayName || null,
        file: fileName,
        scope: manifest.scope || null,
        activation: manifest.activation || null,
        hardwareStatus: manifest.hardwareStatus || null,
        staticallyConsistent: contractErrors.length === 0 && repositoryErrors.length === 0,
        phases,
        requiredChecks: declaredChecks,
        nextActions,
        warnings: repository.warnings || []
    };
}

function formatStatus(status) {
    const labels = { complete: 'DONE', pending: 'NEXT', attention: 'NOTE', blocked: 'BLOCKED' };
    const lines = [
        `CodeON robot integration status: ${status.displayName || status.id} (${status.id})`,
        `Scope: ${status.scope || 'invalid'}; activation: ${status.activation || 'invalid'}; hardware: ${status.hardwareStatus || 'invalid'}`
    ];
    for (const item of status.phases) {
        lines.push('', `[${labels[item.state]}] ${item.id}: ${item.summary}`);
        for (const finding of item.findings) lines.push(`  - ${finding}`);
    }
    for (const warning of status.warnings) lines.push('', `WARN ${warning}`);
    lines.push('', 'Next actions:');
    status.nextActions.forEach((action, index) => lines.push(`${index + 1}. ${action}`));
    lines.push('', 'Read-only result: no tests were executed and no files were changed.');
    return lines.join('\n');
}

function run(args = process.argv.slice(2)) {
    const options = parseArguments(args);
    if (options.help) {
        console.log(usage());
        return 0;
    }
    resolveManifestPath(options.id);
    const paths = listManifestPaths();
    if (paths.length === 0) throw new Error('No robot integration manifests found.');
    const loaded = paths.map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
    const status = buildStatus(loaded, options.id);
    console.log(options.json ? JSON.stringify(status, null, 2) : formatStatus(status));
    return status.phases[0].state === 'blocked' ? 1 : 0;
}

if (require.main === module) {
    try {
        process.exitCode = run();
    } catch (error) {
        console.error(`Robot integration status failed: ${error.message}`);
        console.error(usage());
        process.exitCode = 1;
    }
}

module.exports = { buildStatus, formatStatus, parseArguments, run };
