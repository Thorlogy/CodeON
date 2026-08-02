#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const properties = read('RobotApitor/src/main/resources/apitor.properties');
assert.ok(properties.includes('getsimulationcode = validate.and.collect.sim,generatesimulation,regenerateNepo'), 'Apitor-Simulationsworkflow fehlt.');

['OpenRobertaWeb/src/main.js', 'OpenRobertaWeb/src/mission.js'].forEach(function (file) {
    assert.ok(read(file).includes("'robot.apitor': 'js/app/simulation/simulationLogic/robot.apitor'"), 'RequireJS-Alias fehlt: ' + file);
});

const robot = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.apitor.ts');
assert.ok(robot.includes('new ApitorChassis'), 'Apitor-Chassis wird nicht verwendet.');

const actuators = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.actuators.ts');
['export class ApitorChassis', "MOTOR_L: 'M2'", "MOTOR_R: 'M3'", "color: '#f58220'"].forEach(function (feature) {
    assert.ok(actuators.includes(feature), 'Apitor-Chassis-Merkmal fehlt: ' + feature);
});

const behaviour = read('OpenRobertaWeb/src/app/nepostackmachine/interpreter.robotSimBehaviour.ts');
assert.ok(behaviour.includes("String(name).toLowerCase() === 'apitor'"), 'Apitor-Geschwindigkeitsskalierung fehlt.');

const serverRuntime = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.apitor.js');
const packagedRuntime = read('application/staticResources/js/app/simulation/simulationLogic/robot.apitor.js');
assert.strictEqual(serverRuntime, packagedRuntime, 'Server- und Paketversion von robot.apitor muessen identisch sein.');

const server3d = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
const packaged3d = read('application/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
assert.strictEqual(server3d, packaged3d, 'Server- und Paketversion des 3D-Adapters muessen identisch sein.');
assert.ok(server3d.includes('isApitorSelected'), 'Apitor-Erkennung fehlt im 3D-Adapter.');
assert.ok(server3d.includes('0xf58220'), 'Apitor-Farbe fehlt im 3D-Adapter.');

console.log('CodeON-Apitor-Simulationspruefung erfolgreich.');
