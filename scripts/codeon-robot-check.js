#!/usr/bin/env node

'use strict';

const path = require('path');
const {
    listManifestPaths,
    readManifestFile,
    repositoryChecks,
    resolveManifestPath,
    validateManifest,
    validateManifestSet
} = require('./codeon-robot-manifest');

function usage() {
    return 'Usage: npm run robot:check -- [--id ROBOT_ID] [--json]';
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
        }
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--id' && index + 1 < args.length && !args[index + 1].startsWith('--')) {
            if (seen.has(arg)) throw new Error('Duplicate option: --id');
            seen.add(arg);
            options.id = args[++index];
        }
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
    return options;
}

function buildReport(loaded, selectedId = null, checkRepository = repositoryChecks) {
    const selected = selectedId === null ? loaded : loaded.filter(({ fileName }) => fileName === `${selectedId}.json`);
    if (selectedId !== null && selected.length === 0) throw new Error(`No robot integration manifest found for id: ${selectedId}`);
    const results = selected.map(({ fileName, manifest }) => {
        const errors = validateManifest(manifest, fileName);
        const repository = errors.length === 0 ? checkRepository(manifest) : { errors: [], warnings: [] };
        const id = errors.length === 0 ? manifest.id : path.basename(fileName, '.json');
        return { id, file: fileName, errors: [...errors, ...repository.errors], warnings: repository.warnings };
    });
    const setErrors = validateManifestSet(loaded);
    const errorCount = results.reduce((sum, result) => sum + result.errors.length, 0) + setErrors.length;
    return { ok: errorCount === 0, checked: results.length, manifestSetChecked: loaded.length, errorCount, results, setErrors };
}

function run(args = process.argv.slice(2)) {
    const options = parseArguments(args);
    if (options.help) {
        console.log(usage());
        return 0;
    }
    if (options.id) resolveManifestPath(options.id);
    const paths = listManifestPaths();
    if (paths.length === 0) throw new Error('No robot integration manifests found.');
    const loaded = paths.map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
    const report = buildReport(loaded, options.id);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
        for (const result of report.results) {
            console.log(`${result.errors.length ? 'FAIL' : 'OK'} ${result.id} (${result.file})`);
            for (const warning of result.warnings) console.log(`  WARN ${warning}`);
            for (const error of result.errors) console.log(`  ERROR ${error}`);
        }
        for (const error of report.setErrors) console.log(`ERROR ${error}`);
        const scope = options.id ? `${report.checked} selected manifest(s), ${report.manifestSetChecked} checked globally` : `${report.checked} manifest(s)`;
        console.log(`${report.ok ? 'Robot integration checks passed' : 'Robot integration checks failed'}: ${scope}, ${report.errorCount} error(s).`);
    }
    return report.ok ? 0 : 1;
}

if (require.main === module) {
    try {
        process.exitCode = run();
    } catch (error) {
        console.error(`Robot integration check failed: ${error.message}`);
        console.error(usage());
        process.exitCode = 1;
    }
}

module.exports = { buildReport, parseArguments, run };
