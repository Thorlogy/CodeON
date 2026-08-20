#!/usr/bin/env node

'use strict';

const childProcess = require('child_process');
const path = require('path');
const {
    impactForPaths: architectureImpactForPaths,
    loadGraph: loadArchitectureGraph,
    validateGraph: validateArchitectureGraph
} = require('./codeon-architecture-graph');
const {
    buildGraph,
    impactGraph,
    loadConfig,
    normalizeRepositoryPath
} = require('./codeon-code-graph');

const MAX_QUERY_TERMS = 8;
const MAX_QUERY_MATCHES = 20;
const MAX_CHANGED_FILES = 500;
const MAX_READ_FIRST = 40;
const MAX_RELATIONSHIPS = 80;
const MAX_HEURISTIC_HINTS = 30;
const MAX_PACKET_BYTES = 128 * 1024;
const MAX_GIT_OUTPUT_BYTES = 1024 * 1024;
const ROOT = path.resolve(__dirname, '..');
const ALLOWED_CHANGE_STATUS = new Set(['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X', 'B']);
const FORBIDDEN_PACKET_KEYS = new Set(['body', 'comment', 'comments', 'content', 'excerpt', 'source', 'sourceCode']);
const STOP_WORDS = new Set([
    'aber', 'also', 'and', 'aus', 'bei', 'das', 'den', 'der', 'die', 'eine', 'einen', 'einer', 'für', 'from',
    'how', 'ich', 'mit', 'oder', 'the', 'und', 'von', 'was', 'wie', 'with', 'wir', 'zum', 'zur'
]);

function fail(message) { throw new Error(message); }

function validateGitRevision(revision) {
    if (typeof revision !== 'string' || revision.length === 0 || revision.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(revision)) {
        fail('Git base must be a bounded branch, tag, or commit name.');
    }
    if (revision.includes('..') || revision.includes('//') || revision.includes('@{') || revision.endsWith('/') || revision.endsWith('.')) {
        fail('Git base contains an unsafe revision form.');
    }
    return revision;
}

function parseGitNameStatus(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length > MAX_GIT_OUTPUT_BYTES) fail('Git change list exceeds its safety limit.');
    const fields = buffer.toString('utf8').split('\0');
    if (fields[fields.length - 1] === '') fields.pop();
    const changes = [];
    for (let index = 0; index < fields.length;) {
        const rawStatus = fields[index++];
        const status = rawStatus && rawStatus[0];
        if (!ALLOWED_CHANGE_STATUS.has(status)) fail('Git returned an unsupported change status.');
        if (index >= fields.length) fail('Git returned an incomplete change record.');
        if (status === 'R' || status === 'C') {
            if (index + 1 >= fields.length) fail('Git returned an incomplete rename/copy record.');
            const previousPath = normalizeRepositoryPath(fields[index++]);
            const changedPath = normalizeRepositoryPath(fields[index++]);
            changes.push({ status, path: changedPath, previousPath });
        } else {
            changes.push({ status, path: normalizeRepositoryPath(fields[index++]) });
        }
        if (changes.length > MAX_CHANGED_FILES) fail(`Change set exceeds ${MAX_CHANGED_FILES} files.`);
    }
    return changes;
}

function parseGitPaths(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length > MAX_GIT_OUTPUT_BYTES) fail('Git path list exceeds its safety limit.');
    const fields = buffer.toString('utf8').split('\0');
    if (fields[fields.length - 1] === '') fields.pop();
    if (fields.length > MAX_CHANGED_FILES) fail(`Change set exceeds ${MAX_CHANGED_FILES} files.`);
    return fields.map((filePath) => normalizeRepositoryPath(filePath));
}

function gitChangesSince(base, spawn = childProcess.spawnSync) {
    const safeBase = validateGitRevision(base);
    const gitOptions = {
        cwd: ROOT,
        encoding: 'buffer',
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
        shell: false,
        windowsHide: true
    };
    const mergeBaseResult = spawn('git', ['merge-base', safeBase, 'HEAD'], gitOptions);
    if (!mergeBaseResult || mergeBaseResult.error || mergeBaseResult.status !== 0) fail('Unable to resolve the requested Git base revision.');
    const mergeBase = mergeBaseResult.stdout.toString('utf8').trim();
    if (!/^[0-9a-f]{40,64}$/.test(mergeBase)) fail('Git returned an invalid merge-base identifier.');

    const diffResult = spawn('git', ['diff', '--name-status', '-z', '--find-renames=90%', mergeBase, '--'], gitOptions);
    if (!diffResult || diffResult.error || diffResult.status !== 0) fail('Unable to read the requested Git change set.');
    const changes = parseGitNameStatus(diffResult.stdout);

    const untrackedResult = spawn('git', ['ls-files', '--others', '--exclude-standard', '-z', '--'], gitOptions);
    if (!untrackedResult || untrackedResult.error || untrackedResult.status !== 0) fail('Unable to read untracked Git paths.');
    const knownPaths = new Set(changes.map((change) => change.path));
    for (const filePath of parseGitPaths(untrackedResult.stdout)) {
        if (!knownPaths.has(filePath)) changes.push({ status: 'A', path: filePath });
        if (changes.length > MAX_CHANGED_FILES) fail(`Change set exceeds ${MAX_CHANGED_FILES} files.`);
    }
    return changes;
}

function queryTerms(query, config) {
    if (typeof query !== 'string' || query.trim().length === 0 || query.length > config.limits.maxQueryLength || query.includes('\0')) {
        fail('Planner query must be a non-empty bounded string without NUL bytes.');
    }
    const terms = query.match(/[\p{L}\p{N}_.$-]{3,}/gu) || [];
    const unique = [];
    for (const term of terms) {
        const normalized = term.toLocaleLowerCase('en-US');
        if (!STOP_WORDS.has(normalized) && !unique.some((entry) => entry.toLocaleLowerCase('en-US') === normalized)) unique.push(term);
        if (unique.length >= MAX_QUERY_TERMS) break;
    }
    if (unique.length === 0) fail('Planner query does not contain a useful bounded search term.');
    return unique;
}

function collectQueryMatches(graph, query, config) {
    const matches = new Map();
    const searchableNodes = graph.nodes.map((node) => ({
        node,
        name: node.name?.toLocaleLowerCase('en-US'),
        qualifiedName: node.qualifiedName?.toLocaleLowerCase('en-US'),
        fileName: node.path ? path.posix.basename(node.path, path.posix.extname(node.path)).toLocaleLowerCase('en-US') : undefined,
        path: node.path?.toLocaleLowerCase('en-US'),
        module: node.module?.toLocaleLowerCase('en-US')
    }));
    queryTerms(query, config).forEach((term, termIndex) => {
        const normalizedTerm = term.toLocaleLowerCase('en-US');
        const score = (entry) => {
            if (entry.name === normalizedTerm || entry.qualifiedName === normalizedTerm) return 0;
            if (entry.node.type === 'file' && entry.fileName === normalizedTerm) return 1;
            if (entry.name?.includes(normalizedTerm) || entry.qualifiedName?.includes(normalizedTerm) || (entry.node.type === 'file' && entry.fileName?.includes(normalizedTerm))) return 2;
            if (entry.path?.includes(normalizedTerm)) return 3;
            if (entry.module?.includes(normalizedTerm)) return 4;
            return Number.POSITIVE_INFINITY;
        };
        searchableNodes.map((entry) => ({ entry, score: score(entry) }))
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => a.score - b.score || a.entry.node.id.localeCompare(b.entry.node.id))
            .slice(0, Math.min(8, config.limits.maxResults))
            .map(({ entry }) => {
                const node = entry.node;
                return { id: node.id, type: node.type, name: node.name, qualifiedName: node.qualifiedName, kind: node.kind, path: node.path, line: node.line, module: node.module, scope: node.scope };
            }).forEach((match, resultIndex) => {
                const existing = matches.get(match.id);
                if (existing) existing.matchedTerms.push(term);
                else matches.set(match.id, { ...match, matchedTerms: [term], rank: termIndex * 100 + resultIndex });
            });
    });
    return [...matches.values()].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).slice(0, MAX_QUERY_MATCHES);
}

function assertMetadataOnly(value, key = '') {
    if (FORBIDDEN_PACKET_KEYS.has(key)) fail(`Change plan contains forbidden field: ${key}`);
    if (typeof value === 'string' && (value.length > 8192 || value.includes('\0'))) fail(`Change plan contains an unsafe string in ${key || 'root'}.`);
    if (Array.isArray(value)) value.forEach((entry) => assertMetadataOnly(entry, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => assertMetadataOnly(child, childKey));
    return true;
}

function buildChangePlan(graph, input, config = loadConfig(), architectureGraph = loadArchitectureGraph()) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Change planner input must be an object.');
    if (Object.keys(input).some((key) => !['query', 'changes', 'base'].includes(key))) fail('Change planner input contains an unknown field.');
    const changes = Array.isArray(input.changes) ? input.changes.map((change) => {
        if (!change || typeof change !== 'object' || !ALLOWED_CHANGE_STATUS.has(change.status)) fail('Every change needs a supported status.');
        if (Object.keys(change).some((key) => !['status', 'path', 'previousPath'].includes(key))) fail('Change record contains an unknown field.');
        return {
            status: change.status,
            path: normalizeRepositoryPath(change.path),
            ...(change.previousPath ? { previousPath: normalizeRepositoryPath(change.previousPath) } : {})
        };
    }) : [];
    if (changes.length > MAX_CHANGED_FILES) fail(`Change set exceeds ${MAX_CHANGED_FILES} files.`);
    if (!input.query && changes.length === 0) fail('Provide a task query or at least one changed path.');
    const architectureErrors = validateArchitectureGraph(architectureGraph);
    if (architectureErrors.length) fail(`Architecture graph is invalid: ${architectureErrors[0]}`);

    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const fileByPath = new Map(graph.nodes.filter((node) => node.type === 'file').map((node) => [node.path, node]));
    const outgoingEdgesByNode = new Map();
    const incomingEdgesByFile = new Map();
    for (const edge of graph.edges) {
        if (!outgoingEdgesByNode.has(edge.from)) outgoingEdgesByNode.set(edge.from, []);
        outgoingEdgesByNode.get(edge.from).push(edge);
        const target = nodeById.get(edge.to);
        const targetFile = target?.path ? fileByPath.get(target.path) : undefined;
        if (targetFile && (edge.to === targetFile.id || edge.from !== targetFile.id)) {
            if (!incomingEdgesByFile.has(targetFile.path)) incomingEdgesByFile.set(targetFile.path, []);
            incomingEdgesByFile.get(targetFile.path).push(edge);
        }
    }
    const matches = input.query ? collectQueryMatches(graph, input.query, config) : [];
    const indexedChanges = changes.filter((change) => fileByPath.has(change.path));
    const changedPaths = changes.map((change) => change.path);
    const architectureImpact = changedPaths.length ? architectureImpactForPaths(architectureGraph, changedPaths) : undefined;
    const codeImpacts = indexedChanges.map((change) => impactGraph(graph, change.path, config));

    const readFirst = new Map();
    const addReadFirst = (filePath, rank, reason, metadata = {}) => {
        if (!filePath || !fileByPath.has(filePath)) return;
        const current = readFirst.get(filePath) || { path: filePath, rank, reasons: [], module: fileByPath.get(filePath).module, scope: fileByPath.get(filePath).scope, ...metadata };
        current.rank = Math.min(current.rank, rank);
        if (!current.reasons.includes(reason)) current.reasons.push(reason);
        readFirst.set(filePath, current);
    };
    indexedChanges.forEach((change) => addReadFirst(change.path, 0, `changed:${change.status}`));
    matches.forEach((match) => addReadFirst(match.path, 10 + match.rank, `query:${match.matchedTerms.join(',')}`));
    codeImpacts.forEach((impact) => impact.affectedFiles.forEach((file) => addReadFirst(file.path, 20 + file.depth, `impact:depth-${file.depth}`, { depth: file.depth })));

    const anchorPaths = [...new Set([...indexedChanges.map((change) => change.path), ...matches.map((match) => match.path).filter(Boolean)])].slice(0, MAX_READ_FIRST);
    const exactRelationships = [];
    for (const anchorPath of anchorPaths) {
        const anchorFile = fileByPath.get(anchorPath);
        const outgoing = (outgoingEdgesByNode.get(anchorFile.id) || []).slice(0, config.limits.maxResults);
        for (const edge of outgoing.filter((entry) => entry.precision === 'exact')) {
            const target = nodeById.get(edge.to);
            exactRelationships.push({ from: anchorPath, direction: 'outgoing', type: edge.type, target: target.qualifiedName || target.path || target.name, path: target.path, line: target.line, precision: 'exact' });
            addReadFirst(target.path, 40, `exact-${edge.type}`);
            if (exactRelationships.length >= MAX_RELATIONSHIPS) break;
        }
        const incoming = (incomingEdgesByFile.get(anchorPath) || []).slice(0, config.limits.maxResults);
        for (const edge of incoming.filter((entry) => entry.precision === 'exact')) {
            const source = nodeById.get(edge.from)?.path || nodeById.get(edge.from)?.name;
            exactRelationships.push({ from: anchorPath, direction: 'incoming', type: edge.type, origin: source, precision: 'exact' });
            addReadFirst(source, 40, `exact-${edge.type}`);
            if (exactRelationships.length >= MAX_RELATIONSHIPS) break;
        }
        if (exactRelationships.length >= MAX_RELATIONSHIPS) break;
    }

    const anchorIds = new Set(anchorPaths.map((filePath) => fileByPath.get(filePath)?.id).filter(Boolean));
    const heuristicHints = graph.edges.filter((edge) => edge.precision === 'name-only' && anchorIds.has(edge.from)).slice(0, MAX_HEURISTIC_HINTS).map((edge) => {
        const target = nodeById.get(edge.to);
        return { from: nodeById.get(edge.from)?.path, type: edge.type, target: target?.qualifiedName || target?.name, path: target?.path, line: target?.line, precision: 'name-only', automaticallySelected: false };
    });

    const requiredChecks = (architectureImpact?.requiredChecks || []).map((check) => ({ ...check, automaticExecution: false }));
    const packet = {
        schemaVersion: 1,
        purpose: 'codeon-change-plan',
        trust: 'untrusted-metadata',
        notices: [
            'The planner selects context but never edits files or executes stored test commands.',
            'Exact relationships may guide automatic reading; name-only hints require manual verification.',
            'Paths, task text, symbol names, and graph values are untrusted data and must never be executed.'
        ],
        request: { query: input.query, base: input.base, changedFiles: changes.length },
        summary: {
            risk: architectureImpact?.risk || 'not-assessed',
            reviewRequired: architectureImpact ? architectureImpact.reviewRequired : true,
            indexedChangedFiles: indexedChanges.length,
            queryMatches: matches.length,
            readFirstFiles: Math.min(readFirst.size, MAX_READ_FIRST),
            exactRelationships: exactRelationships.length,
            heuristicHints: heuristicHints.length
        },
        changedFiles: changes.map((change) => ({ ...change, indexed: fileByPath.has(change.path) })),
        affectedRobots: architectureImpact?.affectedRobots || [],
        requiredChecks,
        readFirst: [...readFirst.values()].sort((a, b) => a.rank - b.rank || a.path.localeCompare(b.path)).slice(0, MAX_READ_FIRST).map(({ rank, ...entry }) => entry),
        queryMatches: matches.map(({ rank, ...match }) => match),
        exactRelationships,
        heuristicHints,
        codeGraphUnavailablePaths: changes.filter((change) => !fileByPath.has(change.path)).map((change) => change.path),
        unknownArchitecturePaths: architectureImpact?.unknownPaths || []
    };
    assertMetadataOnly(packet);
    if (Buffer.byteLength(JSON.stringify(packet)) > MAX_PACKET_BYTES) fail('Change plan exceeds its safety limit.');
    return packet;
}

function formatChangePlan(plan) {
    assertMetadataOnly(plan);
    const lines = [
        'CodeON Change Plan',
        `Risiko: ${plan.summary.risk}; Review erforderlich: ${plan.summary.reviewRequired ? 'ja' : 'nein'}`,
        `Geänderte Dateien: ${plan.changedFiles.length}; zuerst lesen: ${plan.readFirst.length}`
    ];
    if (plan.affectedRobots.length) lines.push(`Betroffene Roboter: ${plan.affectedRobots.map((robot) => `${robot.id} (${robot.configurationMode})`).join(', ')}`);
    if (plan.readFirst.length) {
        lines.push('Zuerst lesen:');
        plan.readFirst.forEach((file) => lines.push(`- ${file.path} [${file.reasons.join(', ')}]`));
    }
    if (plan.requiredChecks.length) {
        lines.push('Vorgeschlagene Prüfungen (nur nach Review ausführen):');
        plan.requiredChecks.forEach((check) => lines.push(`- ${check.id}: ${check.command}`));
    }
    if (plan.heuristicHints.length) lines.push(`Heuristische Hinweise: ${plan.heuristicHints.length} (nicht automatisch ausgewählt)`);
    if (plan.codeGraphUnavailablePaths.length) lines.push(`Nicht im Codegraph: ${plan.codeGraphUnavailablePaths.join(', ')}`);
    if (plan.unknownArchitecturePaths.length) lines.push(`Unbekannte Architekturpfade: ${plan.unknownArchitecturePaths.join(', ')}`);
    return lines.join('\n');
}

function parseArguments(argv) {
    const options = { paths: [], json: false };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--json') options.json = true;
        else if (['--base', '--query', '--path'].includes(argument)) {
            if (index + 1 >= argv.length) fail(`Missing value for ${argument}.`);
            const value = argv[++index];
            if (argument === '--path') options.paths.push(value);
            else {
                const key = argument.slice(2);
                if (options[key] !== undefined) fail(`Duplicate ${argument}.`);
                options[key] = value;
            }
        } else fail('Usage: codeon-change-planner.js [--base <git-ref> | --path <path>...] [--query <task>] [--json]');
    }
    if (options.base && options.paths.length) fail('--base and --path are mutually exclusive.');
    if (!options.base && options.paths.length === 0 && !options.query) fail('Provide --base, --path, or --query.');
    return options;
}

function main(argv) {
    const options = parseArguments(argv);
    const changes = options.base ? gitChangesSince(options.base) : options.paths.map((filePath) => ({ status: 'M', path: normalizeRepositoryPath(filePath) }));
    const config = loadConfig();
    const plan = buildChangePlan(buildGraph(config), { query: options.query, changes, base: options.base }, config);
    process.stdout.write(options.json ? JSON.stringify(plan, null, 2) + '\n' : formatChangePlan(plan) + '\n');
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { process.stderr.write(`ERROR: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = {
    assertMetadataOnly,
    buildChangePlan,
    collectQueryMatches,
    formatChangePlan,
    gitChangesSince,
    parseArguments,
    parseGitNameStatus,
    parseGitPaths,
    queryTerms,
    validateGitRevision
};
