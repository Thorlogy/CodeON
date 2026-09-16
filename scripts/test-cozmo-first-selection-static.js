const assert = require('assert');
const fs = require('fs');

const sourcePath = 'OpenRobertaWeb/src/main.js';
const serverPath = 'OpenRobertaServer/staticResources/js/main.js';
const applicationPath = 'application/staticResources/js/main.js';
const serverIndexPath = 'OpenRobertaServer/staticResources/index.html';
const applicationIndexPath = 'application/staticResources/index.html';

const source = fs.readFileSync(sourcePath, 'utf8');
const server = fs.readFileSync(serverPath, 'utf8');
const application = fs.readFileSync(applicationPath, 'utf8');
const serverIndex = fs.readFileSync(serverIndexPath, 'utf8');
const applicationIndex = fs.readFileSync(applicationIndexPath, 'utf8');
const startView = fs.readFileSync('OpenRobertaWeb/src/app/roberta/controller/startView.controller.ts', 'utf8');
const configurationController = fs.readFileSync('OpenRobertaWeb/src/app/roberta/controller/configuration.controller.js', 'utf8');

assert.strictEqual(
    server,
    application,
    'the packaged application must contain the same compiled main.js as the server resources'
);

const initialBranch = source.slice(source.indexOf('if (!mainCallbackCalled)'), source.indexOf('} else {', source.indexOf('if (!mainCallbackCalled)')));

assert.match(
    source,
    /function showProgramTab\(callback, params, opt_onProgramTabReady\)/,
    'showProgramTab must support work that is deferred until the program tab is ready'
);
assert.match(
    source,
    /if \(\$\('#tabProgram'\)\.hasClass\('active'\)\) \{\s*programTabReady\(\);/,
    'an already activated program tab must still complete its initialization'
);
assert.match(
    source,
    /if \(!\$\('#tabProgram'\)\.hasClass\('active'\)\) \{\s*const programTab = document\.getElementById\('tabProgram'\);\s*programTab && programTab\.click\(\);/,
    'program-tab activation must fall back to a native click after initialization'
);
assert.match(
    initialBranch,
    /showProgramTab\(callback, params, function \(\) \{[\s\S]*?\.initConnection\(robot\)/,
    'the first robot connection must start only after the program tab is ready'
);
assert.doesNotMatch(
    initialBranch,
    /guiStateController\.setInitialState\(\);\s*connectionController\.initConnection\(robot\);/,
    'the first connection must not start before the final program view is ready'
);
assert.doesNotMatch(
    startView,
    /openSelectedRobotProgram|programTab\.click\(\)/,
    'the start view must not race the main initialization by opening the program tab itself'
);
assert.match(
    configurationController,
    /GUISTATE_C\.getRobotGroup\(\) === 'cozmo' \? null : GUISTATE_C\.getConfigurationToolbox\(\)/,
    'Cozmo must initialize its fixed configuration workspace without an empty toolbox'
);
assert.match(
    configurationController,
    /if \(GUISTATE_C\.getRobotGroup\(\) === 'cozmo'\) \{[\s\S]*?xml = '<block_set xmlns="http:\/\/de\.fhg\.iais\.roberta\.blockly" robottype="cozmo" xmlversion="3\.1"><\/block_set>';/,
    'Cozmo fixed block_set must be represented as an empty read-only Blockly workspace'
);
assert.match(server, /function showProgramTab\(callback, params, opt_onProgramTabReady\)/);
assert.match(server, /\.initConnection\(robot\)[\s\S]*?Initial robot connection failed/);
assert.match(source, /codeon-live-20260916-40/);
assert.match(server, /codeon-live-20260916-40/);
assert.strictEqual(serverIndex, applicationIndex, 'the packaged application must contain the same index as the server resources');
assert.match(serverIndex, /codeon-live-20260916-40/);

console.log('Cozmo first-selection initialization checks passed.');
