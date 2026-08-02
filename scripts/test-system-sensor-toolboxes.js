#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const rcxExpert = read('RobotRCX/src/main/resources/rcx.program.toolbox.expert.xml');
assert(!rcxExpert.includes('edisonCommunication_'), 'RCX toolbox must not expose Edison communication blocks');

const rcjExpert = read('RobotSpike/src/main/resources/rcj/program.toolbox.expert.xml');
const rcjDefault = read('RobotSpike/src/main/resources/rcj/configuration.default.xml');
assert(rcjExpert.includes('robSensors_touchkey_getSample'), 'RCJ screen buttons must remain available');
assert(!rcjExpert.includes('robSensors_touch_getSample'), 'RCJ toolbox must not expose an unconfigured generic touch sensor');
assert(rcjExpert.includes('robSensors_inductive_getSample'), 'RCJ inductive sensor block must be available');
assert(rcjDefault.includes('type="robConf_inductive"'), 'RCJ default configuration must include the inductive sensor');
assert(rcjDefault.includes('<field name="PORT">F</field>'), 'RCJ inductive sensor must use the free port F');

const toolboxFiles = [
    'RobotRCX/src/main/resources/rcx.program.toolbox.beginner.xml',
    'RobotRCX/src/main/resources/rcx.program.toolbox.expert.xml',
    'RobotEdison/src/main/resources/edison.program.toolbox.beginner.xml',
    'RobotEdison/src/main/resources/edison.program.toolbox.expert.xml',
    'RobotSpike/src/main/resources/rcj/program.toolbox.beginner.xml',
    'RobotSpike/src/main/resources/rcj/program.toolbox.expert.xml',
    'RobotCozmo/src/main/resources/cozmo/program.toolbox.xml',
    'RobotCozmo/src/main/resources/cozmo/program.toolbox.expert.xml',
    'RobotApitor/src/main/resources/apitor/program.toolbox.xml',
    'RobotApitor/src/main/resources/apitor/program.toolbox.expert.xml',
];

for (const toolboxFile of toolboxFiles) {
    const toolbox = read(toolboxFile);
    assert(toolbox.includes('TOOLBOX_SENSOR'), `${toolboxFile} must contain a sensor category`);
    assert(!/UNSUPPORTED SENSOR|undefined sensor/i.test(toolbox), `${toolboxFile} contains an undefined sensor label`);
}

console.log('System sensor toolbox checks passed.');
