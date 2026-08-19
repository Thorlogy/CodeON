#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'architecture', 'codeon-architecture-graph.json');
const MAX_GRAPH_BYTES = 1024 * 1024;
const ALLOWED_NODE_TYPES = new Set(['module', 'robot', 'test']);
const ALLOWED_EDGE_TYPES = new Set(['implemented-by', 'depends-on', 'verified-by']);
const ALLOWED_RISKS = new Set(['low', 'medium', 'high', 'critical']);
const RISK_ORDER = { unknown: 5, critical: 4, high: 3, medium: 2, low: 1 };

function fail(message) {
    throw new Error(message);
}

function normalizeRepositoryPath(input) {
    if (typeof input !== 'string' || input.length === 0 || input.length > 4096 || input.includes('\0')) {
        fail('Path must be a non-empty repository-relative string.');
    }
    if (path.isAbsolute(input) || input.includes('\\')) {
        fail(`Absolute and platform-ambiguous paths are not allowed: ${input}`);
    }
    const normalized = path.posix.normalize(input.replace(/^\.\//, ''));
    if (normalized === '..' || normalized.startsWith('../') || normalized === '.') {
        fail(`Path must stay inside the repository: ${input}`);
    }
    return normalized;
}

function resolveExistingRepositoryPath(relativePath) {
    const normalized = normalizeRepositoryPath(relativePath);
    const absolute = path.resolve(ROOT, normalized);
    const relative = path.relative(ROOT, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        fail(`Path escapes repository: ${relativePath}`);
    }
    if (!fs.existsSync(absolute)) {
        fail(`Referenced path does not exist: ${normalized}`);
    }
    const realRoot = fs.realpathSync(ROOT);
    const realTarget = fs.realpathSync(absolute);
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
        fail(`Referenced path resolves outside repository: ${normalized}`);
    }
    return absolute;
}

function loadGraph() {
    const stat = fs.statSync(GRAPH_PATH);
    if (stat.size > MAX_GRAPH_BYTES) {
        fail(`Graph exceeds ${MAX_GRAPH_BYTES} bytes.`);
    }
    return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
}

function parseProperties(relativePath) {
    const result = new Map();
    const contents = fs.readFileSync(resolveExistingRepositoryPath(relativePath), 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separator = line.indexOf('=');
        if (separator < 1) {
            continue;
        }
        result.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
    return result;
}

function pomDeclaresDependency(pomPath, artifactId) {
    const pom = fs.readFileSync(resolveExistingRepositoryPath(pomPath), 'utf8');
    const escaped = artifactId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<artifactId>\\s*${escaped}\\s*</artifactId>`).test(pom);
}

function validateGraph(graph) {
    const errors = [];
    const check = (condition, message) => {
        if (!condition) errors.push(message);
    };

    check(graph && graph.schemaVersion === 1, 'schemaVersion must be 1.');
    check(Array.isArray(graph.nodes), 'nodes must be an array.');
    check(Array.isArray(graph.edges), 'edges must be an array.');
    check(Array.isArray(graph.impactRules), 'impactRules must be an array.');
    if (errors.length) return errors;

    const nodes = new Map();
    for (const node of graph.nodes) {
        check(node && typeof node.id === 'string' && /^[a-z][a-z0-9.-]+$/.test(node.id), `Invalid node id: ${node && node.id}`);
        check(ALLOWED_NODE_TYPES.has(node && node.type), `Invalid node type for ${node && node.id}`);
        check(!nodes.has(node.id), `Duplicate node id: ${node.id}`);
        nodes.set(node.id, node);
        for (const pathField of ['path', 'pom', 'propertiesPath']) {
            if (node[pathField]) {
                try { resolveExistingRepositoryPath(node[pathField]); } catch (error) { errors.push(`${node.id}: ${error.message}`); }
            }
        }
        if (node.type === 'robot') {
            check(['fixed', 'user-configurable', 'built-in'].includes(node.configurationMode), `${node.id} has invalid configurationMode.`);
            check(typeof node.propertiesPath === 'string', `${node.id} must declare propertiesPath.`);
            if (typeof node.propertiesPath === 'string') {
                try {
                    const properties = parseProperties(node.propertiesPath);
                    const configurable = properties.get('robot.configuration') === 'true';
                    const fixed = properties.get('robot.configuration.fixed') === 'true';
                    if (node.configurationMode === 'fixed') {
                        check(configurable && fixed, `${node.id} graph says fixed but plugin properties do not.`);
                    } else if (node.configurationMode === 'user-configurable') {
                        check(configurable && !fixed, `${node.id} graph says user-configurable but plugin properties do not.`);
                    } else {
                        check(!configurable && !fixed, `${node.id} graph says built-in but plugin properties do not.`);
                    }
                } catch (error) {
                    errors.push(`${node.id}: ${error.message}`);
                }
            }
        }
        if (node.type === 'test') {
            check(typeof node.command === 'string' && node.command.length > 0 && node.command.length <= 512, `${node.id} must have a bounded informational command.`);
        }
    }

    const edgeKeys = new Set();
    for (const edge of graph.edges) {
        const key = `${edge.from}|${edge.type}|${edge.to}`;
        check(nodes.has(edge.from), `Unknown edge source: ${edge.from}`);
        check(nodes.has(edge.to), `Unknown edge target: ${edge.to}`);
        check(ALLOWED_EDGE_TYPES.has(edge.type), `Invalid edge type: ${edge.type}`);
        check(edge.from !== edge.to, `Self edge is not allowed: ${key}`);
        check(!edgeKeys.has(key), `Duplicate edge: ${key}`);
        edgeKeys.add(key);

        if (edge.type === 'depends-on' && nodes.has(edge.from) && nodes.has(edge.to)) {
            const source = nodes.get(edge.from);
            const target = nodes.get(edge.to);
            if (source.type === 'module' && target.type === 'module' && source.pom && target.artifactId) {
                try {
                    check(pomDeclaresDependency(source.pom, target.artifactId), `${source.id} graph dependency on ${target.id} is absent from ${source.pom}.`);
                } catch (error) {
                    errors.push(`${source.id}: ${error.message}`);
                }
            }
        }
    }

    const ruleIds = new Set();
    for (const rule of graph.impactRules) {
        check(rule && typeof rule.id === 'string' && /^[a-z][a-z0-9-]+$/.test(rule.id), `Invalid impact rule id: ${rule && rule.id}`);
        check(!ruleIds.has(rule.id), `Duplicate impact rule id: ${rule.id}`);
        ruleIds.add(rule.id);
        check(Array.isArray(rule.paths) && rule.paths.length > 0, `${rule.id} must declare paths.`);
        check(ALLOWED_RISKS.has(rule.risk), `${rule.id} has invalid risk.`);
        check(typeof rule.reason === 'string' && rule.reason.length > 0 && rule.reason.length <= 300, `${rule.id} must have a bounded reason.`);
        for (const graphPath of rule.paths || []) {
            try {
                const normalized = normalizeRepositoryPath(graphPath.endsWith('/') ? graphPath.slice(0, -1) : graphPath);
                check(normalized.length > 0, `${rule.id} has an empty path.`);
                resolveExistingRepositoryPath(normalized);
            } catch (error) {
                errors.push(`${rule.id}: ${error.message}`);
            }
        }
        for (const robotId of rule.robots || []) check(nodes.get(robotId)?.type === 'robot', `${rule.id} references invalid robot ${robotId}.`);
        for (const testId of rule.tests || []) check(nodes.get(testId)?.type === 'test', `${rule.id} references invalid test ${testId}.`);
    }

    for (const robot of [...nodes.values()].filter((node) => node.type === 'robot')) {
        check(graph.edges.some((edge) => edge.from === robot.id && edge.type === 'implemented-by'), `${robot.id} has no implementation module.`);
        check(graph.edges.some((edge) => edge.from === robot.id && edge.type === 'verified-by'), `${robot.id} has no verification edge.`);
    }

    return errors;
}

function ruleMatches(rulePath, changedPath) {
    if (rulePath.endsWith('/')) return changedPath === rulePath.slice(0, -1) || changedPath.startsWith(rulePath);
    return changedPath === rulePath;
}

function impactForPaths(graph, inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) fail('Provide at least one changed repository-relative path.');
    const paths = [...new Set(inputs.map(normalizeRepositoryPath))].sort();
    const matchedRules = graph.impactRules.filter((rule) => paths.some((changedPath) => rule.paths.some((rulePath) => ruleMatches(rulePath, changedPath))));
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const robots = [...new Set(matchedRules.flatMap((rule) => rule.robots || []))].sort();
    const tests = [...new Set(matchedRules.flatMap((rule) => rule.tests || []))].sort();
    const unknownPaths = paths.filter((changedPath) => !graph.impactRules.some((rule) => rule.paths.some((rulePath) => ruleMatches(rulePath, changedPath))));
    const risk = unknownPaths.length
        ? 'unknown'
        : matchedRules.map((rule) => rule.risk).sort((a, b) => RISK_ORDER[b] - RISK_ORDER[a])[0] || 'unknown';

    return {
        paths,
        risk,
        reviewRequired: risk === 'unknown' || risk === 'critical' || risk === 'high',
        affectedRobots: robots.map((id) => ({ id, label: nodes.get(id).label, configurationMode: nodes.get(id).configurationMode })),
        requiredChecks: tests.map((id) => ({ id, label: nodes.get(id).label, command: nodes.get(id).command })),
        matchedRules: matchedRules.map((rule) => ({ id: rule.id, reason: rule.reason })),
        unknownPaths,
        note: unknownPaths.length ? 'Unknown paths are not considered safe; perform a manual impact review and update the graph if the area is architectural.' : undefined
    };
}

function robotSummary(graph, robotId) {
    const normalizedId = robotId.startsWith('robot.') ? robotId : `robot.${robotId}`;
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const robot = nodes.get(normalizedId);
    if (!robot || robot.type !== 'robot') fail(`Unknown robot: ${robotId}`);
    return {
        ...robot,
        relationships: graph.edges
            .filter((edge) => edge.from === normalizedId || edge.to === normalizedId)
            .map((edge) => ({ ...edge, fromLabel: nodes.get(edge.from).label, toLabel: nodes.get(edge.to).label }))
    };
}

function main(argv) {
    const graph = loadGraph();
    const command = argv[0] || 'validate';
    if (command === 'validate') {
        const errors = validateGraph(graph);
        if (errors.length) {
            errors.forEach((error) => process.stderr.write(`ERROR: ${error}\n`));
            process.exitCode = 1;
            return;
        }
        process.stdout.write(`CodeON architecture graph valid: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.impactRules.length} impact rules.\n`);
    } else if (command === 'impact') {
        const errors = validateGraph(graph);
        if (errors.length) fail(`Graph is invalid; run validate first. ${errors[0]}`);
        process.stdout.write(JSON.stringify(impactForPaths(graph, argv.slice(1)), null, 2) + '\n');
    } else if (command === 'robot') {
        const errors = validateGraph(graph);
        if (errors.length) fail(`Graph is invalid; run validate first. ${errors[0]}`);
        process.stdout.write(JSON.stringify(robotSummary(graph, argv[1] || ''), null, 2) + '\n');
    } else {
        fail('Usage: codeon-architecture-graph.js validate | impact <paths...> | robot <id>');
    }
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        process.stderr.write(`ERROR: ${error.message}\n`);
        process.exitCode = 1;
    }
}

module.exports = { impactForPaths, loadGraph, normalizeRepositoryPath, robotSummary, validateGraph };
