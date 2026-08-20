#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { buildGraph, fileContext, impactGraph, loadConfig, normalizeRepositoryPath, queryGraph } = require('./codeon-code-graph');

const ROOT = path.resolve(__dirname, '..');
const BENCHMARK_PATH = path.join(ROOT, 'architecture', 'codeon-code-graph-benchmark.json');
const MAX_BENCHMARK_BYTES = 128 * 1024;
const MAX_CASES = 50;

function fail(message) { throw new Error(message); }

function readBenchmark(benchmarkPath = BENCHMARK_PATH) {
    const stat = fs.statSync(benchmarkPath);
    if (!stat.isFile() || stat.size > MAX_BENCHMARK_BYTES) fail('Code graph benchmark exceeds its safety limit.');
    const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
    validateBenchmark(benchmark);
    return benchmark;
}

function validateStringList(value, label, maximum = 100) {
    if (!Array.isArray(value) || value.length === 0 || value.length > maximum || value.some((entry) => typeof entry !== 'string' || entry.length === 0 || entry.length > 4096 || entry.includes('\0'))) {
        fail(`Invalid ${label}.`);
    }
}

function validateBenchmark(benchmark) {
    if (!benchmark || benchmark.schemaVersion !== 1 || !Array.isArray(benchmark.cases) || benchmark.cases.length === 0 || benchmark.cases.length > MAX_CASES) {
        fail('Benchmark schemaVersion or cases are invalid.');
    }
    if (Object.keys(benchmark).some((key) => !['schemaVersion', 'description', 'cases'].includes(key))) fail('Benchmark contains an unknown root field.');
    const ids = new Set();
    for (const benchmarkCase of benchmark.cases) {
        if (!benchmarkCase || typeof benchmarkCase.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(benchmarkCase.id) || ids.has(benchmarkCase.id)) {
            fail('Every benchmark case needs a unique bounded id.');
        }
        ids.add(benchmarkCase.id);
        if (!['query', 'file', 'impact'].includes(benchmarkCase.type)) fail(`Invalid benchmark type for ${benchmarkCase.id}.`);
        const commonKeys = ['id', 'type', 'input'];
        const typeKeys = benchmarkCase.type === 'query'
            ? ['topK', 'expectedPaths', 'maxUnexpectedPaths']
            : benchmarkCase.type === 'file'
                ? ['expectedExactPaths']
                : ['expectedAffectedPaths', 'expectedRobots', 'expectedChecks'];
        if (Object.keys(benchmarkCase).some((key) => !commonKeys.includes(key) && !typeKeys.includes(key))) fail(`Unknown field in benchmark case ${benchmarkCase.id}.`);
        if (typeof benchmarkCase.input !== 'string' || benchmarkCase.input.length === 0 || benchmarkCase.input.length > 4096 || benchmarkCase.input.includes('\0')) {
            fail(`Invalid benchmark input for ${benchmarkCase.id}.`);
        }
        if (benchmarkCase.type === 'query') {
            if (!Number.isInteger(benchmarkCase.topK) || benchmarkCase.topK < 1 || benchmarkCase.topK > 100) fail(`Invalid topK for ${benchmarkCase.id}.`);
            if (!Number.isInteger(benchmarkCase.maxUnexpectedPaths) || benchmarkCase.maxUnexpectedPaths < 0 || benchmarkCase.maxUnexpectedPaths > 100) fail(`Invalid maxUnexpectedPaths for ${benchmarkCase.id}.`);
            validateStringList(benchmarkCase.expectedPaths, `${benchmarkCase.id}.expectedPaths`);
        } else if (benchmarkCase.type === 'file') {
            normalizeRepositoryPath(benchmarkCase.input);
            validateStringList(benchmarkCase.expectedExactPaths, `${benchmarkCase.id}.expectedExactPaths`);
        } else {
            normalizeRepositoryPath(benchmarkCase.input);
            validateStringList(benchmarkCase.expectedAffectedPaths, `${benchmarkCase.id}.expectedAffectedPaths`);
            validateStringList(benchmarkCase.expectedRobots, `${benchmarkCase.id}.expectedRobots`);
            validateStringList(benchmarkCase.expectedChecks, `${benchmarkCase.id}.expectedChecks`);
        }
    }
    return true;
}

function missing(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter((entry) => !actualSet.has(entry));
}

function runQueryCase(graph, benchmarkCase, config) {
    const paths = [...new Set(queryGraph(graph, benchmarkCase.input, config).slice(0, benchmarkCase.topK).map((entry) => entry.path).filter(Boolean))];
    const missed = missing(benchmarkCase.expectedPaths, paths);
    const expectedSet = new Set(benchmarkCase.expectedPaths);
    const unexpected = paths.filter((entry) => !expectedSet.has(entry));
    return { passed: missed.length === 0 && unexpected.length <= benchmarkCase.maxUnexpectedPaths, expected: benchmarkCase.expectedPaths.length, matched: benchmarkCase.expectedPaths.length - missed.length, missed, unexpected };
}

function runFileCase(graph, benchmarkCase, config) {
    const context = fileContext(graph, benchmarkCase.input, config);
    const exactPaths = [...new Set(context.outgoing.filter((edge) => edge.precision === 'exact').map((edge) => edge.path).filter(Boolean))];
    const missed = missing(benchmarkCase.expectedExactPaths, exactPaths);
    return { passed: missed.length === 0, expected: benchmarkCase.expectedExactPaths.length, matched: benchmarkCase.expectedExactPaths.length - missed.length, missed };
}

function runImpactCase(graph, benchmarkCase, config) {
    const impact = impactGraph(graph, benchmarkCase.input, config);
    const missedPaths = missing(benchmarkCase.expectedAffectedPaths, impact.affectedFiles.map((entry) => entry.path));
    const missedRobots = missing(benchmarkCase.expectedRobots, impact.architectureImpact.affectedRobots.map((entry) => entry.id));
    const missedChecks = missing(benchmarkCase.expectedChecks, impact.architectureImpact.requiredChecks.map((entry) => entry.id));
    const missed = [...missedPaths, ...missedRobots, ...missedChecks];
    const expected = benchmarkCase.expectedAffectedPaths.length + benchmarkCase.expectedRobots.length + benchmarkCase.expectedChecks.length;
    return { passed: missed.length === 0, expected, matched: expected - missed.length, missed };
}

function runBenchmark(graph, benchmark, config = loadConfig()) {
    const cases = benchmark.cases.map((benchmarkCase) => {
        let result;
        if (benchmarkCase.type === 'query') result = runQueryCase(graph, benchmarkCase, config);
        else if (benchmarkCase.type === 'file') result = runFileCase(graph, benchmarkCase, config);
        else result = runImpactCase(graph, benchmarkCase, config);
        return { id: benchmarkCase.id, type: benchmarkCase.type, ...result };
    });
    const expected = cases.reduce((sum, entry) => sum + entry.expected, 0);
    const matched = cases.reduce((sum, entry) => sum + entry.matched, 0);
    return { schemaVersion: 1, cases: cases.length, passed: cases.filter((entry) => entry.passed).length, failed: cases.filter((entry) => !entry.passed).length, expectationRecall: expected === 0 ? 1 : matched / expected, results: cases };
}

function main(argv) {
    if (argv.length > 1 || (argv[0] && argv[0] !== '--json')) fail('Usage: codeon-code-graph-benchmark.js [--json]');
    const config = loadConfig();
    const report = runBenchmark(buildGraph(config), readBenchmark(), config);
    if (argv[0] === '--json') process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else process.stdout.write(`CodeON code graph benchmark: ${report.passed}/${report.cases} cases passed, ${(report.expectationRecall * 100).toFixed(1)}% expectation recall.\n`);
    if (report.failed) process.exitCode = 1;
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { process.stderr.write(`ERROR: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { readBenchmark, runBenchmark, validateBenchmark };
