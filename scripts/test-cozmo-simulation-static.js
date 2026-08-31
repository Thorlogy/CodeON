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

const runControllerSource = read('OpenRobertaWeb/src/app/roberta/controller/progRun.controller.ts');
assert.ok(runControllerSource.includes("GUISTATE_C.getRobotGroup() === 'cozmo'"), 'Cozmo-spezifische Starthilfe fehlt.');
assert.ok(runControllerSource.includes('Blockly.Msg.POPUP_RUN_NOTIFICATION_COZMO'), 'Cozmo-Starthilfe verwendet keinen Uebersetzungsschluessel.');
assert.ok(runControllerSource.includes("document.addEventListener(\n    'mousedown'"), 'Cozmo-Starthilfe ueberlebt einen Austausch der Blockly-Steuerelemente nicht.');
assert.ok(runControllerSource.includes("target.closest('#runOnBrick')"), 'Cozmo-Starthilfe erkennt den aktuellen Blockly-Play-Button nicht.');
assert.ok(
    runControllerSource.includes('runOnBrick from delegated Cozmo button'),
    'Der aktive Cozmo-Play-Button wird nach einem Austausch der Blockly-Steuerelemente nicht delegiert.'
);
const serverRunController = read('OpenRobertaServer/staticResources/js/app/roberta/controller/progRun.controller.js');
const packagedRunController = read('application/staticResources/js/app/roberta/controller/progRun.controller.js');
[serverRunController, packagedRunController].forEach(function (generatedController) {
    assert.ok(generatedController.includes('POPUP_RUN_NOTIFICATION_COZMO'), 'Cozmo-Starthilfe fehlt in einer ausgelieferten Webanwendung.');
    assert.ok(
        generatedController.includes('isConnectedCozmo'),
        'Die ausgelieferte Cozmo-Ausfuehrung beruecksichtigt den echten Bridge-Verbindungsstatus nicht.'
    );
    assert.ok(
        generatedController.includes('runOnBrick from delegated Cozmo button'),
        'Die delegierte Cozmo-Programmausfuehrung fehlt in einer ausgelieferten Webanwendung.'
    );
});
const germanMessages = read('OpenRobertaServer/staticResources/blockly/msg/js/de.js');
['eingeschaltete Ladestation', 'Lift einmal hoch', 'Beende gegebenenfalls die Cozmo-App', 'Lasse Cozmo zunächst auf der Ladestation', 'zusammen mit CodeON gestartet'].forEach(function (instruction) {
    assert.ok(germanMessages.includes(instruction), 'Cozmo-Startanweisung fehlt: ' + instruction);
});

const robotControllerSource = read('OpenRobertaWeb/src/app/roberta/controller/robot.controller.ts');
assert.ok(
    /if \(robot === GUISTATE_C\.getRobot\(\) && sameRobotGroupAndExtensions\) \{[\s\S]*?CONNECTION_C\.switchConnection\(robot\);[\s\S]*?return;/.test(
        robotControllerSource
    ),
    'Die lokale Roboterverbindung wird bei erneuter Auswahl desselben Roboters nicht initialisiert.'
);
[
    'OpenRobertaServer/staticResources/js/app/roberta/controller/robot.controller.js',
    'application/staticResources/js/app/roberta/controller/robot.controller.js',
].forEach(function (deliveredRobotController) {
    const switchCalls = read(deliveredRobotController).match(/\.switchConnection\(/g) || [];
    assert.ok(switchCalls.length >= 2, 'Die Verbindungskorrektur fehlt in der ausgelieferten Webanwendung: ' + deliveredRobotController);
});

const liveCacheVersion = 'codeon-cozmo-live-20260823-6';
[
    'OpenRobertaWeb/src/main.js',
    'OpenRobertaServer/staticResources/js/main.js',
    'application/staticResources/js/main.js',
    'OpenRobertaServer/staticResources/index.html',
    'application/staticResources/index.html',
].forEach(function (deliveredEntryPoint) {
    assert.ok(read(deliveredEntryPoint).includes(liveCacheVersion), 'Aktueller Cozmo-Cache-Buster fehlt: ' + deliveredEntryPoint);
});

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
