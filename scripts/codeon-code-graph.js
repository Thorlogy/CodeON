#!/usr/bin/env node

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    impactForPaths: architectureImpactForPaths,
    loadGraph: loadArchitectureGraph,
    validateGraph: validateArchitectureGraph
} = require('./codeon-architecture-graph');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'architecture', 'codeon-code-graph.config.json');
const DEFAULT_INDEX_PATH = '.codeon/code-graph.json';
const ALLOWED_SCOPES = new Set(['production', 'test', 'tool']);
const LANGUAGE_BY_EXTENSION = new Map([
    ['.java', 'java'],
    ['.js', 'javascript'],
    ['.ts', 'typescript'],
    ['.py', 'python']
]);
const SYMBOL_KINDS = new Set(['class', 'interface', 'enum', 'record', 'type', 'function', 'method']);
const EDGE_TYPES = new Set(['contains', 'imports', 'references']);
const CALL_KEYWORDS = new Set([
    'catch', 'class', 'def', 'do', 'else', 'for', 'function', 'if', 'import', 'interface', 'new', 'record',
    'return', 'sizeof', 'super', 'switch', 'synchronized', 'this', 'throw', 'typeof', 'while', 'with'
]);

function fail(message) {
    throw new Error(message);
}

function normalizeRepositoryPath(input) {
    if (typeof input !== 'string' || input.length === 0 || input.length > 4096 || input.includes('\0')) {
        fail('Path must be a non-empty, bounded repository-relative string.');
    }
    if (path.isAbsolute(input) || input.includes('\\')) {
        fail(`Absolute and platform-ambiguous paths are not allowed: ${input}`);
    }
    const normalized = path.posix.normalize(input.replace(/^\.\//, ''));
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        fail(`Path must stay inside the repository: ${input}`);
    }
    return normalized;
}

function resolveInsideRepository(relativePath, options = {}) {
    const normalized = normalizeRepositoryPath(relativePath);
    const absolute = path.resolve(ROOT, normalized);
    const relative = path.relative(ROOT, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        fail(`Path escapes repository: ${relativePath}`);
    }
    if (options.mustExist !== false && !fs.existsSync(absolute)) {
        fail(`Referenced path does not exist: ${normalized}`);
    }
    if (fs.existsSync(absolute)) {
        const realRoot = fs.realpathSync(ROOT);
        const realTarget = fs.realpathSync(absolute);
        if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
            fail(`Referenced path resolves outside repository: ${normalized}`);
        }
    }
    return { absolute, normalized };
}

function readBoundedJson(jsonPath, maxBytes) {
    const stat = fs.statSync(jsonPath);
    if (!stat.isFile() || stat.size > maxBytes) fail(`JSON file exceeds its safety limit: ${jsonPath}`);
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function loadConfig(configPath = CONFIG_PATH) {
    const config = readBoundedJson(configPath, 256 * 1024);
    validateConfig(config);
    return config;
}

function validateConfig(config) {
    const errors = [];
    const check = (condition, message) => { if (!condition) errors.push(message); };
    check(config && config.schemaVersion === 1, 'Code graph config schemaVersion must be 1.');
    check(Array.isArray(config && config.sourceRoots) && config.sourceRoots.length > 0, 'sourceRoots must be a non-empty array.');
    check(Array.isArray(config && config.sourceFiles), 'sourceFiles must be an array.');
    check(Array.isArray(config && config.extensions) && config.extensions.length > 0, 'extensions must be a non-empty array.');
    check(Array.isArray(config && config.excludedSegments), 'excludedSegments must be an array.');
    check(config && config.limits && typeof config.limits === 'object', 'limits must be an object.');
    if (errors.length) fail(errors.join(' '));

    const allowedExtensions = new Set(LANGUAGE_BY_EXTENSION.keys());
    for (const extension of config.extensions) check(allowedExtensions.has(extension), `Unsupported extension: ${extension}`);
    for (const segment of config.excludedSegments) {
        check(typeof segment === 'string' && /^[A-Za-z0-9._-]+$/.test(segment), `Invalid excluded segment: ${segment}`);
    }
    for (const entry of [...config.sourceRoots, ...config.sourceFiles]) {
        check(entry && typeof entry.module === 'string' && /^[A-Za-z][A-Za-z0-9-]+$/.test(entry.module), `Invalid module for ${entry && entry.path}`);
        check(ALLOWED_SCOPES.has(entry && entry.scope), `Invalid scope for ${entry && entry.path}`);
        try { resolveInsideRepository(entry.path); } catch (error) { errors.push(error.message); }
    }
    const limits = config.limits;
    for (const [name, minimum, maximum] of [
        ['maxFiles', 1, 10000],
        ['maxFileBytes', 1024, 10 * 1024 * 1024],
        ['maxNodes', 10, 200000],
        ['maxEdges', 10, 500000],
        ['maxQueryLength', 1, 1000],
        ['maxResults', 1, 1000],
        ['maxIndexBytes', 1024, 64 * 1024 * 1024]
    ]) check(Number.isInteger(limits[name]) && limits[name] >= minimum && limits[name] <= maximum, `Invalid limit ${name}.`);
    if (errors.length) fail(errors.join(' '));
    return true;
}

function shouldExclude(relativePath, config) {
    const excluded = new Set(config.excludedSegments);
    return relativePath.split('/').some((segment) => excluded.has(segment));
}

function discoverSourceFiles(config) {
    const files = new Map();
    const extensions = new Set(config.extensions);
    const addFile = (absolute, relative, metadata) => {
        const normalized = normalizeRepositoryPath(relative);
        if (shouldExclude(normalized, config) || !extensions.has(path.extname(normalized))) return;
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) return;
        if (!stat.isFile()) return;
        if (stat.size > config.limits.maxFileBytes) fail(`Source file exceeds maxFileBytes: ${normalized}`);
        if (!files.has(normalized)) files.set(normalized, { path: normalized, ...metadata, bytes: stat.size });
        if (files.size > config.limits.maxFiles) fail(`Source file count exceeds maxFiles (${config.limits.maxFiles}).`);
    };
    const walk = (absoluteDirectory, metadata) => {
        for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const absolute = path.join(absoluteDirectory, entry.name);
            const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
            if (shouldExclude(relative, config) || entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) walk(absolute, metadata);
            else if (entry.isFile()) addFile(absolute, relative, metadata);
        }
    };
    for (const rootEntry of config.sourceRoots) {
        const resolved = resolveInsideRepository(rootEntry.path);
        if (!fs.statSync(resolved.absolute).isDirectory()) fail(`Source root is not a directory: ${rootEntry.path}`);
        walk(resolved.absolute, { module: rootEntry.module, scope: rootEntry.scope });
    }
    for (const fileEntry of config.sourceFiles) {
        const resolved = resolveInsideRepository(fileEntry.path);
        addFile(resolved.absolute, resolved.normalized, { module: fileEntry.module, scope: fileEntry.scope });
    }
    return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function maskSource(source, language, maskStrings) {
    let result = '';
    let mode = 'normal';
    let quote = '';
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        const next = source[index + 1];
        if (mode === 'line-comment') {
            if (character === '\n') { mode = 'normal'; result += '\n'; } else result += ' ';
        } else if (mode === 'block-comment') {
            if (character === '*' && next === '/') { result += '  '; index += 1; mode = 'normal'; }
            else result += character === '\n' ? '\n' : ' ';
        } else if (mode === 'string') {
            if (character === '\\') {
                result += maskStrings ? '  ' : character + (next || '');
                index += 1;
            } else if (character === quote) {
                result += maskStrings ? ' ' : character;
                mode = 'normal';
            } else result += maskStrings && character !== '\n' ? ' ' : character;
        } else if ((language === 'python' && character === '#') || (character === '/' && next === '/')) {
            result += character === '/' ? '  ' : ' ';
            if (character === '/') index += 1;
            mode = 'line-comment';
        } else if (character === '/' && next === '*') {
            result += '  '; index += 1; mode = 'block-comment';
        } else if (character === "'" || character === '"' || (language !== 'java' && character === '`')) {
            quote = character; mode = 'string'; result += maskStrings ? ' ' : character;
        } else result += character;
    }
    return result;
}

function lineNumberAt(source, index) {
    let line = 1;
    for (let cursor = 0; cursor < index; cursor += 1) if (source.charCodeAt(cursor) === 10) line += 1;
    return line;
}

function addMatches(source, expression, kindForMatch, nameForMatch, symbols) {
    expression.lastIndex = 0;
    let match;
    while ((match = expression.exec(source)) !== null) {
        const name = nameForMatch(match);
        if (!name || CALL_KEYWORDS.has(name)) continue;
        symbols.push({ name, kind: kindForMatch(match), line: lineNumberAt(source, match.index) });
    }
}

function extractSymbols(source, language, maskedSource) {
    const masked = maskedSource ?? maskSource(source, language, true);
    const symbols = [];
    if (language === 'java') {
        addMatches(masked, /\b(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g, (match) => match[1], (match) => match[2], symbols);
        addMatches(masked, /\b(?:public|protected|private|static|final|abstract|synchronized|native|strictfp|default|\s)+[A-Za-z_$][\w$<>,.?\[\]\s]*\s+([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?:throws\s+[^{]+)?\{/g, () => 'method', (match) => match[1], symbols);
    } else if (language === 'javascript' || language === 'typescript') {
        addMatches(masked, /\b(class|interface|enum|type)\s+([A-Za-z_$][\w$]*)/g, (match) => match[1], (match) => match[2], symbols);
        addMatches(masked, /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, () => 'function', (match) => match[1], symbols);
        addMatches(masked, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g, () => 'function', (match) => match[1], symbols);
    } else if (language === 'python') {
        addMatches(masked, /^\s*(class)\s+([A-Za-z_][\w]*)\s*(?:\([^\n]*\))?\s*:/gm, () => 'class', (match) => match[2], symbols);
        addMatches(masked, /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/gm, () => 'function', (match) => match[1], symbols);
    }
    const unique = new Map();
    for (const symbol of symbols) unique.set(`${symbol.kind}|${symbol.name}|${symbol.line}`, symbol);
    return [...unique.values()].sort((a, b) => a.line - b.line || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function extractPackage(source, language, commentsRemovedSource) {
    const commentsRemoved = commentsRemovedSource ?? maskSource(source, language, false);
    if (language === 'java') return commentsRemoved.match(/\bpackage\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/)?.[1] || '';
    return '';
}

function extractImports(source, language, commentsRemovedSource) {
    const commentsRemoved = commentsRemovedSource ?? maskSource(source, language, false);
    const imports = new Set();
    const collect = (expression, group = 1) => {
        expression.lastIndex = 0;
        let match;
        while ((match = expression.exec(commentsRemoved)) !== null) if (match[group]) imports.add(match[group]);
    };
    if (language === 'java') collect(/\bimport\s+(?:static\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$*][\w$*]*)*)\s*;/g);
    else if (language === 'javascript' || language === 'typescript') {
        collect(/\b(?:import|export)\s+(?:[^'"\n]+?\s+from\s+)?['"]([^'"\n]+)['"]/g);
        collect(/\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g);
        collect(/\bdefine\s*\(\s*\[([^\]]*)\]/g);
        for (const value of [...imports].filter((item) => item.includes("'") || item.includes('"'))) {
            imports.delete(value);
            for (const match of value.matchAll(/['"]([^'"]+)['"]/g)) imports.add(match[1]);
        }
    } else if (language === 'python') {
        collect(/^\s*from\s+([.A-Za-z_][\w.]*)\s+import\s+/gm);
        const direct = /^\s*import\s+([^#\n]+)/gm;
        let match;
        while ((match = direct.exec(commentsRemoved)) !== null) {
            for (const item of match[1].split(',')) imports.add(item.trim().split(/\s+as\s+/)[0]);
        }
    }
    return [...imports].filter((value) => value && value.length <= 300).sort();
}

function extractCalls(source, language, maskedSource) {
    const masked = maskedSource ?? maskSource(source, language, true);
    const calls = new Set();
    for (const match of masked.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (!CALL_KEYWORDS.has(match[1])) calls.add(match[1]);
    }
    return [...calls].sort();
}

function makeSymbolId(filePath, symbol) {
    return `symbol:${filePath}:${symbol.line}:${symbol.kind}:${symbol.name}`;
}

function externalNodeId(language, specifier) {
    return `external:${language}:${specifier}`;
}

function resolveSourceImport(sourcePath, specifier, language, filesByPath) {
    let base;
    if (language === 'python' && specifier.startsWith('.')) {
        const leadingDots = specifier.match(/^\.+/)[0].length;
        let directory = path.posix.dirname(sourcePath);
        for (let level = 1; level < leadingDots; level += 1) directory = path.posix.dirname(directory);
        const modulePath = specifier.slice(leadingDots).replace(/\./g, '/');
        base = path.posix.join(directory, modulePath);
    } else if (specifier.startsWith('.')) {
        base = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
    } else if (language === 'javascript' || language === 'typescript') {
        base = path.posix.join(path.posix.dirname(sourcePath), specifier);
    }
    if (base && base !== '..' && !base.startsWith('../')) {
        for (const candidate of [base, `${base}.ts`, `${base}.js`, `${base}.py`, `${base}/index.ts`, `${base}/index.js`, `${base}/__init__.py`]) {
            if (filesByPath.has(candidate)) return filesByPath.get(candidate).id;
        }
    }
    const moduleSuffix = specifier.replace(/^\.+/, '').replace(/\./g, '/');
    const suffixes = language === 'python'
        ? [`/${moduleSuffix}.py`, `/${moduleSuffix}/__init__.py`]
        : [`/${specifier}.ts`, `/${specifier}.js`, `/${specifier}/index.ts`, `/${specifier}/index.js`];
    const matches = [...filesByPath.values()].filter((file) => suffixes.some((suffix) => file.path.endsWith(suffix)));
    if (matches.length === 1) return matches[0].id;
    return undefined;
}

function edgeKey(edge) {
    return JSON.stringify([edge.from, edge.type, edge.to, edge.precision]);
}

function buildGraph(config = loadConfig()) {
    const sourceFiles = discoverSourceFiles(config);
    const nodes = [];
    const edges = [];
    const parsedFiles = [];
    for (const file of sourceFiles) {
        const absolute = resolveInsideRepository(file.path).absolute;
        const source = fs.readFileSync(absolute, 'utf8');
        const language = LANGUAGE_BY_EXTENSION.get(path.extname(file.path));
        const maskedSource = maskSource(source, language, true);
        const commentsRemovedSource = maskSource(source, language, false);
        const fileNode = { id: `file:${file.path}`, type: 'file', path: file.path, language, module: file.module, scope: file.scope, bytes: file.bytes };
        nodes.push(fileNode);
        const packageName = extractPackage(source, language, commentsRemovedSource);
        const symbols = extractSymbols(source, language, maskedSource).map((symbol) => ({
            id: makeSymbolId(file.path, symbol),
            type: 'symbol',
            name: symbol.name,
            kind: symbol.kind,
            language,
            path: file.path,
            line: symbol.line,
            module: file.module,
            scope: file.scope,
            qualifiedName: packageName ? `${packageName}.${symbol.name}` : symbol.name
        }));
        for (const symbol of symbols) {
            nodes.push(symbol);
            edges.push({ from: fileNode.id, type: 'contains', to: symbol.id, precision: 'exact' });
        }
        parsedFiles.push({ fileNode, imports: extractImports(source, language, commentsRemovedSource), calls: extractCalls(source, language, maskedSource), symbols });
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const filesByPath = new Map(nodes.filter((node) => node.type === 'file').map((node) => [node.path, node]));
    const symbolsByQualifiedName = new Map();
    const symbolsBySimpleName = new Map();
    for (const symbol of nodes.filter((node) => node.type === 'symbol')) {
        if (!symbolsByQualifiedName.has(symbol.qualifiedName)) symbolsByQualifiedName.set(symbol.qualifiedName, []);
        symbolsByQualifiedName.get(symbol.qualifiedName).push(symbol);
        if (!symbolsBySimpleName.has(symbol.name)) symbolsBySimpleName.set(symbol.name, []);
        symbolsBySimpleName.get(symbol.name).push(symbol);
    }
    const ensureExternal = (language, specifier) => {
        const id = externalNodeId(language, specifier);
        if (!nodeById.has(id)) {
            const node = { id, type: 'external', name: specifier, language };
            nodes.push(node); nodeById.set(id, node);
        }
        return id;
    };

    for (const parsed of parsedFiles) {
        for (const specifier of parsed.imports) {
            let target;
            let precision = 'external';
            if (parsed.fileNode.language === 'java' && !specifier.endsWith('.*')) {
                const candidates = symbolsByQualifiedName.get(specifier) || [];
                if (candidates.length === 1) { target = candidates[0].id; precision = 'exact'; }
            } else target = resolveSourceImport(parsed.fileNode.path, specifier, parsed.fileNode.language, filesByPath);
            if (target) precision = 'exact';
            else target = ensureExternal(parsed.fileNode.language, specifier);
            edges.push({ from: parsed.fileNode.id, type: 'imports', to: target, precision, specifier });
        }
        for (const callName of parsed.calls) {
            const candidates = symbolsBySimpleName.get(callName) || [];
            if (candidates.length === 1 && candidates[0].path !== parsed.fileNode.path) {
                edges.push({ from: parsed.fileNode.id, type: 'references', to: candidates[0].id, precision: 'name-only', name: callName });
            }
        }
    }

    const uniqueNodes = [...new Map(nodes.map((node) => [node.id, node])).values()].sort((a, b) => a.id.localeCompare(b.id));
    const uniqueEdges = [...new Map(edges.map((edge) => [edgeKey(edge), edge])).values()].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)));
    const configContents = fs.readFileSync(CONFIG_PATH);
    const graph = {
        schemaVersion: 1,
        generator: 'scripts/codeon-code-graph.js',
        config: 'architecture/codeon-code-graph.config.json',
        configSha256: crypto.createHash('sha256').update(configContents).digest('hex'),
        stats: {
            files: uniqueNodes.filter((node) => node.type === 'file').length,
            symbols: uniqueNodes.filter((node) => node.type === 'symbol').length,
            externalDependencies: uniqueNodes.filter((node) => node.type === 'external').length,
            exactEdges: uniqueEdges.filter((edge) => edge.precision === 'exact').length,
            inferredEdges: uniqueEdges.filter((edge) => edge.precision === 'name-only').length
        },
        nodes: uniqueNodes,
        edges: uniqueEdges
    };
    const validationErrors = validateGraph(graph, config);
    if (validationErrors.length) fail(validationErrors[0]);
    return graph;
}

function validateGraph(graph, config = loadConfig()) {
    const errors = [];
    const check = (condition, message) => { if (!condition) errors.push(message); };
    check(graph && graph.schemaVersion === 1, 'Graph schemaVersion must be 1.');
    check(Array.isArray(graph && graph.nodes), 'Graph nodes must be an array.');
    check(Array.isArray(graph && graph.edges), 'Graph edges must be an array.');
    if (errors.length) return errors;
    check(graph.nodes.length <= config.limits.maxNodes, `Graph exceeds maxNodes (${config.limits.maxNodes}).`);
    check(graph.edges.length <= config.limits.maxEdges, `Graph exceeds maxEdges (${config.limits.maxEdges}).`);
    const nodeIds = new Set();
    for (const node of graph.nodes) {
        check(node && typeof node.id === 'string' && node.id.length <= 5000, 'Every node needs a bounded id.');
        check(!nodeIds.has(node.id), `Duplicate node id: ${node.id}`);
        nodeIds.add(node.id);
        check(['file', 'symbol', 'external'].includes(node.type), `Invalid node type: ${node.type}`);
        if (node.type === 'symbol') check(SYMBOL_KINDS.has(node.kind), `Invalid symbol kind: ${node.kind}`);
        for (const forbidden of ['body', 'content', 'source', 'sourceCode', 'excerpt']) check(!(forbidden in node), `Node ${node.id} contains forbidden source content.`);
        if (node.path) {
            try { normalizeRepositoryPath(node.path); } catch (error) { errors.push(error.message); }
        }
    }
    const edgeIds = new Set();
    for (const edge of graph.edges) {
        const key = edgeKey(edge);
        check(!edgeIds.has(key), `Duplicate edge: ${key}`); edgeIds.add(key);
        check(nodeIds.has(edge.from) && nodeIds.has(edge.to), `Edge references an unknown node: ${key}`);
        check(EDGE_TYPES.has(edge.type), `Invalid edge type: ${edge.type}`);
        check(['exact', 'external', 'name-only'].includes(edge.precision), `Invalid edge precision: ${edge.precision}`);
    }
    const encodedBytes = Buffer.byteLength(JSON.stringify(graph));
    check(encodedBytes <= config.limits.maxIndexBytes, `Graph exceeds maxIndexBytes (${config.limits.maxIndexBytes}).`);
    return errors;
}

function boundedQuery(input, config) {
    if (typeof input !== 'string' || input.trim().length === 0 || input.length > config.limits.maxQueryLength || input.includes('\0')) {
        fail('Query must be a non-empty, bounded string without NUL bytes.');
    }
    return input.trim().toLocaleLowerCase('en-US');
}

function queryGraph(graph, input, config = loadConfig()) {
    const query = boundedQuery(input, config);
    const score = (node) => {
        const name = node.name?.toLocaleLowerCase('en-US');
        const qualifiedName = node.qualifiedName?.toLocaleLowerCase('en-US');
        const fileName = node.path ? path.posix.basename(node.path, path.posix.extname(node.path)).toLocaleLowerCase('en-US') : undefined;
        const nodePath = node.path?.toLocaleLowerCase('en-US');
        const moduleName = node.module?.toLocaleLowerCase('en-US');
        if (name === query || qualifiedName === query) return 0;
        if (node.type === 'file' && fileName === query) return 1;
        if (name?.includes(query) || qualifiedName?.includes(query) || (node.type === 'file' && fileName?.includes(query))) return 2;
        if (nodePath?.includes(query)) return 3;
        if (moduleName?.includes(query)) return 4;
        return Number.POSITIVE_INFINITY;
    };
    return graph.nodes
        .map((node) => ({ node, score: score(node) }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((a, b) => a.score - b.score || a.node.id.localeCompare(b.node.id))
        .slice(0, config.limits.maxResults)
        .map(({ node }) => ({ id: node.id, type: node.type, name: node.name, qualifiedName: node.qualifiedName, kind: node.kind, path: node.path, line: node.line, module: node.module, scope: node.scope }));
}

function fileContext(graph, input, config = loadConfig()) {
    const normalized = normalizeRepositoryPath(input);
    const file = graph.nodes.find((node) => node.type === 'file' && node.path === normalized);
    if (!file) fail(`File is outside the configured source graph or does not exist: ${normalized}`);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const summarizeEdge = (edge) => {
        const target = nodeById.get(edge.to);
        return { type: edge.type, precision: edge.precision, target: target.qualifiedName || target.path || target.name, path: target.path, line: target.line };
    };
    const outgoing = graph.edges.filter((edge) => edge.from === file.id).map(summarizeEdge).slice(0, config.limits.maxResults);
    const incoming = graph.edges.filter((edge) => edge.to === file.id || (nodeById.get(edge.to)?.path === normalized && edge.from !== file.id))
        .map((edge) => ({ type: edge.type, precision: edge.precision, source: nodeById.get(edge.from)?.path || nodeById.get(edge.from)?.name }))
        .slice(0, config.limits.maxResults);
    return { file, outgoing, incoming };
}

function impactGraph(graph, input, config = loadConfig()) {
    const normalized = normalizeRepositoryPath(input);
    const file = graph.nodes.find((node) => node.type === 'file' && node.path === normalized);
    if (!file) fail(`File is outside the configured source graph or does not exist: ${normalized}`);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const affectedFiles = new Map([[file.id, { path: file.path, depth: 0, reasons: ['changed'] }]]);
    let frontier = [file.id];
    for (let depth = 1; depth <= 3 && frontier.length; depth += 1) {
        const next = [];
        for (const targetId of frontier) {
            const targetPath = nodeById.get(targetId)?.path;
            for (const edge of graph.edges) {
                if (edge.to !== targetId && (!targetPath || nodeById.get(edge.to)?.path !== targetPath)) continue;
                const source = nodeById.get(edge.from);
                if (!source || source.type !== 'file' || affectedFiles.has(source.id)) continue;
                affectedFiles.set(source.id, { path: source.path, depth, reasons: [`${edge.type}:${edge.precision}`], scope: source.scope, module: source.module });
                next.push(source.id);
                if (affectedFiles.size >= config.limits.maxResults) break;
            }
        }
        frontier = next;
    }
    const architectureGraph = loadArchitectureGraph();
    const architectureErrors = validateArchitectureGraph(architectureGraph);
    if (architectureErrors.length) fail(`Architecture graph is invalid: ${architectureErrors[0]}`);
    return {
        changedPath: normalized,
        architectureImpact: architectureImpactForPaths(architectureGraph, [normalized]),
        affectedFiles: [...affectedFiles.values()].sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path)),
        truncated: affectedFiles.size >= config.limits.maxResults
    };
}

function writeIndex(graph, outputPath = DEFAULT_INDEX_PATH, config = loadConfig()) {
    const normalized = normalizeRepositoryPath(outputPath);
    if (!normalized.startsWith('.codeon/') || !normalized.endsWith('.json')) {
        fail('Generated indexes may only be written as JSON files below .codeon/.');
    }
    const resolved = resolveInsideRepository(normalized, { mustExist: false });
    const graphDirectory = path.dirname(resolved.absolute);
    const codeonDirectory = path.join(ROOT, '.codeon');
    if (fs.existsSync(codeonDirectory) && fs.lstatSync(codeonDirectory).isSymbolicLink()) fail('.codeon must not be a symbolic link.');
    fs.mkdirSync(graphDirectory, { recursive: true, mode: 0o700 });
    const realDirectory = fs.realpathSync(graphDirectory);
    const realRoot = fs.realpathSync(ROOT);
    if (!realDirectory.startsWith(realRoot + path.sep)) fail('Index directory resolves outside the repository.');
    const encoded = JSON.stringify(graph, null, 2) + '\n';
    if (Buffer.byteLength(encoded) > config.limits.maxIndexBytes) fail('Encoded index exceeds maxIndexBytes.');
    const temporary = path.join(
        graphDirectory,
        `.${path.basename(resolved.absolute)}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`
    );
    try {
        fs.writeFileSync(temporary, encoded, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, resolved.absolute);
    } catch (error) {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        throw error;
    }
    return normalized;
}

function main(argv) {
    const command = argv[0] || 'validate';
    const config = loadConfig();
    const graph = buildGraph(config);
    if (command === 'validate') {
        const errors = validateGraph(graph, config);
        if (errors.length) fail(errors[0]);
        process.stdout.write(`CodeON code graph valid: ${graph.stats.files} files, ${graph.stats.symbols} symbols, ${graph.edges.length} edges.\n`);
    } else if (command === 'build') {
        const output = argv[1] || DEFAULT_INDEX_PATH;
        process.stdout.write(`${writeIndex(graph, output, config)}\n`);
    } else if (command === 'query') {
        process.stdout.write(JSON.stringify(queryGraph(graph, argv.slice(1).join(' '), config), null, 2) + '\n');
    } else if (command === 'file') {
        process.stdout.write(JSON.stringify(fileContext(graph, argv[1] || '', config), null, 2) + '\n');
    } else if (command === 'impact') {
        process.stdout.write(JSON.stringify(impactGraph(graph, argv[1] || '', config), null, 2) + '\n');
    } else fail('Usage: codeon-code-graph.js validate | build [output] | query <text> | file <path> | impact <path>');
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { process.stderr.write(`ERROR: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = {
    buildGraph,
    discoverSourceFiles,
    extractCalls,
    extractImports,
    extractSymbols,
    fileContext,
    impactGraph,
    loadConfig,
    normalizeRepositoryPath,
    queryGraph,
    validateConfig,
    validateGraph,
    writeIndex
};
