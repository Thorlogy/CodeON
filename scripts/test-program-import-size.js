'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const files = [
    'OpenRobertaWeb/src/app/roberta/controller/import.controller.js',
    'OpenRobertaServer/staticResources/js/app/roberta/controller/import.controller.js',
    'application/staticResources/js/app/roberta/controller/import.controller.js',
];
const limit = 2 * 1024 * 1024;
let checks = 0;
for (const file of files) {
    for (const language of ['de', 'en']) {
        let change;
        let reads = 0;
        const messages = [];
        const exports = {};
        const jquery = () => ({
            val() {}, off() {}, attr() {}, clickWrap() {}, length: 0,
            onWrap(event, handler) { change = handler; },
        });
        const msg = { displayPopupMessage(key, message) { messages.push(message); } };
        const gui = { getLanguage: () => language, getSourceCodeFileExtension: () => 'nqc' };
        const blockly = { Msg: { OK: 'OK' } };
        const context = {
            MSG: msg, LOG: {}, UTIL: {}, GUISTATE_C: gui, PROGRAM_C: {}, NN_C: {},
            CONFIGURATION_C: {}, PROGRAM: {
                loadProgramFromXML(name, xml, callback) {
                    callback({ rc: 'error', message: 'ORA_PROGRAM_IMPORT_TOO_LARGE' });
                },
            }, Blockly: blockly, $: jquery,
            FileReader: class { readAsText() { reads++; } },
            define(deps, factory) {
                factory(null, exports, msg, {}, {}, gui, {}, {}, {}, context.PROGRAM, blockly, jquery);
            },
        };
        let source = fs.readFileSync(path.join(root, file), 'utf8');
        if (file.startsWith('OpenRobertaWeb/')) {
            source = source.replace(/^import .*;\r?\n/gm, '').replace(/export function /g, 'function ').replace(/^export \{.*\};?\r?$/gm, '');
            source += '\nthis.api = { importXml, importXmlFromStart, importSourceCode, importSourceCodeToCompile, loadProgramFromXML };';
        }
        vm.runInNewContext(source, context, { filename: file });
        const api = context.api || exports;
        api.loadProgramFromXML('test', '<export></export>');
        assert.ok(messages.at(-1).includes(language === 'de' ? 'Importanfrage' : 'import request'));
        checks++;
        for (const method of ['importXml', 'importXmlFromStart']) {
            api[method]();
            for (const size of [0, limit - 1, limit]) {
                const before = reads;
                change({ target: { files: [{ name: 'test.xml', size }] } });
                assert.equal(reads, before + 1, method + ' must accept boundary');
                checks++;
            }
            const before = reads;
            change({ target: { files: [{ name: '<untrusted>.xml', size: limit + 1 }] } });
            assert.equal(reads, before, 'Oversize file must not be read or imported');
            assert.ok(messages.at(-1).includes('2 MiB'));
            assert.ok(!messages.at(-1).includes('<untrusted>'));
            change({ target: { files: [] } });
            assert.equal(reads, before, 'Cancel must not read a file');
            checks += 2;
        }
        for (const method of ['importSourceCode', 'importSourceCodeToCompile']) {
            api[method](() => {});
            const before = reads;
            change({ target: { files: [{ name: 'source.nqc', size: limit + 1 }] } });
            assert.equal(reads, before + 1, 'Source-code import must remain unchanged');
            checks++;
        }
    }
}
assert.equal(fs.readFileSync(path.join(root, files[1]), 'utf8'), fs.readFileSync(path.join(root, files[2]), 'utf8'));
console.log('Program import size: ' + checks + ' behavioral checks passed; packaged controllers identical.');
