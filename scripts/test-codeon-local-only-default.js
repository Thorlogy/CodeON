#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const jarPath = path.join(root, 'application/lib/OpenRobertaServer.jar');
const properties = read('OpenRobertaServer/src/main/resources/openRoberta.properties');
const packagedProperties = execFileSync('unzip',
    ['-p', jarPath, 'openRoberta.properties'],
    { encoding: 'utf8' });
const serverSource = read('OpenRobertaServer/src/main/java/de/fhg/iais/roberta/main/ServerStarter.java');
const packagedServerClass = execFileSync('unzip',
    ['-p', jarPath, 'de/fhg/iais/roberta/main/ServerStarter.class']);

for (const [label, content] of [['source', properties], ['packaged JAR', packagedProperties]]) {
    const binding = content.match(/^\s*server\.ip\s*=\s*([^\s#]+)\s*$/gm) || [];
    assert.equal(binding.length, 1, `Exactly one active server.ip default is required in ${label}.`);
    assert.match(binding[0], /^\s*server\.ip\s*=\s*127\.0\.0\.1\s*$/,
        `${label} must bind to loopback by default.`);
}
assert.match(serverSource, /String host = requireLoopbackHost\(this\.serverProperties\.getStringProperty\("server\.ip"\)\)/,
    'The server must validate its bind address before opening connectors.');
assert.ok(packagedServerClass.includes(Buffer.from('CodeON server.ip must be a loopback address')),
    'The packaged server class must contain the loopback guard.');
assert.match(read('start-codeon-rcx.py'), /server\.ip=127\.0\.0\.1/,
    'The Python launcher must keep its loopback override.');
assert.match(read('ora.sh'), /server\.ip=127\.0\.0\.1/,
    'The shell launcher must keep its loopback override.');
for (const file of ['ora.sh', 'admin.sh', 'application/admin.sh', 'Resources/dockerStandalone/start.sh']) {
    assert.match(read(file), /address=127\.0\.0\.1:2000/,
        `${file} must bind the optional Java debugger to loopback.`);
    assert.doesNotMatch(read(file), /address=0\.0\.0\.0:2000/,
        `${file} must not expose the optional Java debugger.`);
}
assert.equal(read('admin.sh'), read('application/admin.sh'),
    'The administration launcher and its packaged copy must remain identical.');

console.log('CodeON local-only server default: OK');
