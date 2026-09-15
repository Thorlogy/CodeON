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
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--json') options.json = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--id' && index + 1 < args.length) options.id = args[++index];
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
    return options;
}

function run(args = process.argv.slice(2)) {
    const options = parseArguments(args);
    if (options.help) {
        console.log(usage());
        return 0;
    }
    const paths = options.id ? [resolveManifestPath(options.id)] : listManifestPaths();
    if (paths.length === 0) throw new Error('No robot integration manifests found.');
    const loaded = paths.map((filePath) => ({ fileName: path.basename(filePath), manifest: readManifestFile(filePath) }));
    const results = loaded.map(({ fileName, manifest }) => {
        const errors = validateManifest(manifest, fileName);
        const repository = errors.length === 0 ? repositoryChecks(manifest) : { errors: [], warnings: [] };
        return { id: manifest.id || fileName, file: fileName, errors: [...errors, ...repository.errors], warnings: repository.warnings };
    });
    const setErrors = validateManifestSet(loaded);
    const errorCount = results.reduce((sum, result) => sum + result.errors.length, 0) + setErrors.length;
    const report = { ok: errorCount === 0, checked: results.length, errorCount, results, setErrors };
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
        for (const result of results) {
            console.log(`${result.errors.length ? 'FAIL' : 'OK'} ${result.id} (${result.file})`);
            for (const warning of result.warnings) console.log(`  WARN ${warning}`);
            for (const error of result.errors) console.log(`  ERROR ${error}`);
        }
        for (const error of setErrors) console.log(`ERROR ${error}`);
        console.log(`${report.ok ? 'Robot integration checks passed' : 'Robot integration checks failed'}: ${results.length} manifest(s), ${errorCount} error(s).`);
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

module.exports = { parseArguments, run };
