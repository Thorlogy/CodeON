'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
for (const file of ['OpenRobertaWeb/src/helper/comm.js',
    'OpenRobertaServer/staticResources/js/helper/comm.js', 'application/staticResources/js/helper/comm.js']) {
    let options;
    let wrappedErrors = 0;
    const errors = [];
    const replies = [];
    const exports = {};
    const jquery = { ajax: config => { options = config; } };
    const wrap = { wrapREST: fn => fn, wrapErrorFn: fn => response => { wrappedErrors++; fn(response); } };
    const log = { reportToComm: () => [] };
    const context = { $: jquery, WRAP: wrap, LOG: log,
        define(deps, factory) { factory(null, exports, jquery, wrap, log); } };
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.startsWith('OpenRobertaWeb/')) {
        source = source.replace(/^import .*;\r?\n/gm, '').replace(/export (const|let|function) /g, '$1 ')
            .replace(/^export \{.*\};?\r?$/gm, '');
        source += '\nthis.api = {json, setErrorFn};';
    }
    vm.runInNewContext(source, context, { filename: file });
    const api = context.api || exports;
    api.setErrorFn(response => errors.push(response.status));
    api.json('/program/import', {}, result => replies.push(result), 'test');
    options.error({ status: 413, responseText: '<untrusted>' });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].rc, 'error');
    assert.equal(replies[0].message, 'ORA_PROGRAM_IMPORT_TOO_LARGE');
    assert.equal(errors.length, 0);
    options.error({ status: 500 });
    assert.deepEqual(errors, [500]);
    api.json('/program/save', {}, result => replies.push(result), 'test');
    options.error({ status: 413 });
    assert.deepEqual(errors, [500, 413]);
    assert.equal(replies.length, 1);
    options.success({ rc: 'ok' });
    assert.equal(replies.length, 2);
    assert.equal(wrappedErrors, 3, 'Existing error wrapper remains active');
}
console.log('Import HTTP feedback: source and both packaged variants passed scoped 413, other endpoint/error and success checks.');
