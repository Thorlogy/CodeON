'use strict';
const assert = require('node:assert/strict');
const mounts = require('../OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.mounts.js');

const button = { hidden: true, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
const panel = { hidden: true };
global.document = {
    getElementById(id) { return id === 'simSensorMounts' ? button : null; },
    querySelector(selector) { return selector === '.codeonSensorMountPanel' ? panel : null; },
};

for (const group of ['rcx', 'rcj']) {
    mounts.setAvailableForRobotGroup(group, false);
    assert.equal(button.hidden, false, `${group} has local visual sensor positions`);
    panel.hidden = false;
    mounts.setAvailableForRobotGroup(group, true);
    assert.equal(button.hidden, true, `${group} Webots does not show the local editor`);
    assert.equal(panel.hidden, true);
}
for (const group of ['cozmo', 'apitor', 'edisonv2', undefined]) {
    mounts.setAvailableForRobotGroup('rcx', false);
    panel.hidden = false;
    mounts.setAvailableForRobotGroup(group, false);
    assert.equal(button.hidden, true, `${group} must not inherit the RCX editor`);
    assert.equal(panel.hidden, true, `${group} must close an open RCX editor`);
    assert.equal(button.attributes['aria-expanded'], 'false');
}
delete global.document;
console.log('PASS sensor mount availability: RCX/RCJ only, Webots excluded, other robot switches close the editor.');
