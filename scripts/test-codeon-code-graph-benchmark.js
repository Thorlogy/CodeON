#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { readBenchmark, validateBenchmark } = require('./codeon-code-graph-benchmark');

const benchmark = readBenchmark();
assert.strictEqual(validateBenchmark(benchmark), true);
assert.ok(benchmark.cases.some((entry) => entry.type === 'query'));
assert.ok(benchmark.cases.some((entry) => entry.type === 'file'));
assert.ok(benchmark.cases.some((entry) => entry.type === 'impact'));

const duplicate = JSON.parse(JSON.stringify(benchmark));
duplicate.cases[1].id = duplicate.cases[0].id;
assert.throws(() => validateBenchmark(duplicate), /unique/);

const traversal = JSON.parse(JSON.stringify(benchmark));
const fileCase = traversal.cases.find((entry) => entry.type === 'file');
fileCase.input = '../outside';
assert.throws(() => validateBenchmark(traversal), /inside/);

const oversized = JSON.parse(JSON.stringify(benchmark));
oversized.cases[0].topK = 101;
assert.throws(() => validateBenchmark(oversized), /topK/);

const unknownField = JSON.parse(JSON.stringify(benchmark));
unknownField.cases[0].source = 'must not be accepted';
assert.throws(() => validateBenchmark(unknownField), /Unknown field/);

console.log('CodeON code graph benchmark-contract checks passed.');
