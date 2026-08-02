#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const properties = read('RobotCozmo/src/main/resources/cozmo.properties');
assert.ok(properties.includes('getsimulationcode = validate.and.collect.sim,generatesimulation,regenerateNepo'), 'Cozmo-Simulationsworkflow fehlt.');

['OpenRobertaWeb/src/main.js', 'OpenRobertaWeb/src/mission.js'].forEach(function (file) {
    assert.ok(read(file).includes("'robot.cozmo': 'js/app/simulation/simulationLogic/robot.cozmo'"), 'RequireJS-Alias fehlt: ' + file);
});

const robot = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.cozmo.ts');
assert.ok(robot.includes('new CozmoChassis'), 'Cozmo-Chassis wird nicht verwendet.');

const actuators = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.actuators.ts');
['export class CozmoChassis', "MOTOR_L: 'L'", "MOTOR_R: 'R'", "PORT: 'a'", 'liftPosition'].forEach(function (feature) {
    assert.ok(actuators.includes(feature), 'Cozmo-Chassis-Merkmal fehlt: ' + feature);
});

const controller = read('OpenRobertaServer/staticResources/js/app/roberta/controller/guiState.controller.js');
assert.ok(controller.includes('system_preview/cozmo.svg'), 'Cozmo-Hintergrundbild der Programmierbuehne fehlt.');

const serverRobot = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.cozmo.js');
const packagedRobot = read('application/staticResources/js/app/simulation/simulationLogic/robot.cozmo.js');
assert.strictEqual(serverRobot, packagedRobot, 'Server- und Paketversion von robot.cozmo muessen identisch sein.');

const serverActuators = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.actuators.js');
const packagedActuators = read('application/staticResources/js/app/simulation/simulationLogic/robot.actuators.js');
assert.strictEqual(serverActuators, packagedActuators, 'Server- und Paketversion der Aktoren muessen identisch sein.');

const server3d = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
const packaged3d = read('application/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
assert.strictEqual(server3d, packaged3d, 'Server- und Paketversion des 3D-Adapters muessen identisch sein.');
['buildCozmoRobot', 'cozmoLift', 'createCozmoCube', 'cozmoCubeHeld'].forEach(function (feature) {
    assert.ok(server3d.includes(feature), 'Cozmo-3D-Merkmal fehlt: ' + feature);
});

console.log('CodeON-Cozmo-Simulationspruefung erfolgreich.');
