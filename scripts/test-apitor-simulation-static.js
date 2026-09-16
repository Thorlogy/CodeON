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
assert.ok(actuators.includes('system_preview/apitor.svg'), 'Die technische Apitor-Draufsicht der 2D-Simulation fehlt.');

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

const runControllerSource = read('OpenRobertaWeb/src/app/roberta/controller/progRun.controller.ts');
assert.ok(runControllerSource.includes("robotGroup === 'apitor'"), 'Apitor-spezifische Starthilfe fehlt im Run-Controller.');
assert.ok(
    runControllerSource.includes('Blockly.Msg.POPUP_RUN_NOTIFICATION_APITOR'),
    'Apitor-Starthilfe verwendet keinen Uebersetzungsschluessel.'
);
assert.ok(
    runControllerSource.includes('Blockly.Msg.POPUP_RUN_NOTIFICATION_COZMO') &&
        runControllerSource.includes(': Blockly.Msg.POPUP_RUN_NOTIFICATION;'),
    'Die bestehenden Cozmo- und Standardhinweise muessen unveraendert erreichbar bleiben.'
);

const serverRunController = read('OpenRobertaServer/staticResources/js/app/roberta/controller/progRun.controller.js');
const packagedRunController = read('application/staticResources/js/app/roberta/controller/progRun.controller.js');
assert.strictEqual(serverRunController, packagedRunController, 'Server- und Paketversion des Run-Controllers muessen identisch sein.');
assert.ok(serverRunController.includes('POPUP_RUN_NOTIFICATION_APITOR'), 'Apitor-Starthilfe fehlt in der ausgelieferten Webanwendung.');

const serverGermanMessages = read('OpenRobertaServer/staticResources/blockly/msg/js/de.js');
const packagedGermanMessages = read('application/staticResources/blockly/msg/js/de.js');
assert.strictEqual(serverGermanMessages, packagedGermanMessages, 'Server- und Paketversion der deutschen Texte muessen identisch sein.');
assert.ok(serverGermanMessages.includes('POPUP_RUN_NOTIFICATION_APITOR'), 'Der deutsche Apitor-Hinweis fehlt.');
assert.ok(serverGermanMessages.includes('UR2045SI'), 'Der erkennbare Bluetooth-Name fehlt im deutschen Apitor-Hinweis.');

const serverEnglishMessages = read('OpenRobertaServer/staticResources/blockly/msg/json/en.json');
const packagedEnglishMessages = read('application/staticResources/blockly/msg/json/en.json');
assert.strictEqual(serverEnglishMessages, packagedEnglishMessages, 'Server- und Paketversion der englischen Texte muessen identisch sein.');
const englishMessages = JSON.parse(serverEnglishMessages);
assert.ok(englishMessages.POPUP_RUN_NOTIFICATION_APITOR, 'Der englische Apitor-Hinweis fehlt.');
assert.ok(englishMessages.POPUP_RUN_NOTIFICATION_APITOR.includes('UR2045SI'), 'Der erkennbare Bluetooth-Name fehlt im englischen Apitor-Hinweis.');

console.log('CodeON-Apitor-Simulationspruefung erfolgreich.');
