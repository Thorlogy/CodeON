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

const expectedSensors = {
    'RobotRCX/src/main/resources/rcx.program.toolbox.beginner.xml': [
        'robSensors_touch_getSample',
        'robSensors_light_getSample',
        'robSensors_encoder_reset',
        'robSensors_encoder_getSample',
        'robSensors_temperature_getSample',
        'robSensors_timer_getSample',
        'robSensors_timer_reset',
    ],
    'RobotRCX/src/main/resources/rcx.program.toolbox.expert.xml': [
        'robSensors_touch_getSample',
        'robSensors_light_getSample',
        'robSensors_encoder_getSample',
        'robSensors_temperature_getSample',
        'robSensors_timer_getSample',
        'robSensors_battery_getSample',
    ],
    'RobotEdison/src/main/resources/edison.program.toolbox.beginner.xml': [
        'robSensors_key_getSample',
        'robSensors_infrared_getSample',
        'robSensors_irseeker_getSample',
        'robSensors_light_getSample',
        'robSensors_sound_getSample',
        'edisonSensors_sensor_reset',
    ],
    'RobotEdison/src/main/resources/edison.program.toolbox.expert.xml': [
        'robSensors_key_getSample',
        'robSensors_infrared_getSample',
        'robSensors_irseeker_getSample',
        'robSensors_light_getSample',
        'robSensors_sound_getSample',
        'edisonSensors_sensor_reset',
    ],
    'RobotSpike/src/main/resources/rcj/program.toolbox.beginner.xml': [
        'robSensors_touchkey_getSample',
        'robSensors_colour_getSample',
        'robSensors_ultrasonic_getSample',
        'robSensors_timer_getSample',
        'robSensors_gyro_getSample',
    ],
    'RobotSpike/src/main/resources/rcj/program.toolbox.expert.xml': [
        'robSensors_touchkey_getSample',
        'robSensors_colour_getSample',
        'robSensors_ultrasonic_getSample',
        'robSensors_timer_getSample',
        'robSensors_gyro_getSample',
        'robSensors_inductive_getSample',
    ],
};

for (const [toolboxFile, blockTypes] of Object.entries(expectedSensors)) {
    const toolbox = read(toolboxFile);
    for (const blockType of blockTypes) {
        assert(toolbox.includes(`type="${blockType}"`) || toolbox.includes(`type='${blockType}'`), `${toolboxFile} must expose ${blockType}`);
    }
}

const blocklyRuntime = read('OpenRobertaServer/staticResources/blockly/blockly_compressed.js');
for (const rcxDefinition of ['sensors.touch.rcx', 'sensors.light.rcx', 'sensors.encoder.rcx', 'sensors.temperature.rcx', 'sensors.timer.rcx', 'sensors.battery.rcx']) {
    assert(blocklyRuntime.includes(rcxDefinition), `Blockly runtime must define ${rcxDefinition}`);
}
assert(blocklyRuntime.includes('sensorsAll.rcx'), 'Blockly runtime must register the complete RCX sensor set');

const browserRuntime = read('application/staticResources/blockly/blockly_compressed.js');
assert(blocklyRuntime === browserRuntime, 'Server and application Blockly runtimes must stay identical');

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
