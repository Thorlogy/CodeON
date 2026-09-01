#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const generator = read('RobotRCX/src/main/java/de/fhg/iais/roberta/visitor/codegen/RcxNqcVisitor.java');
assert.ok(!generator.includes('Off(OUT_A+OUT_B+OUT_C);'), 'Der RCX-Generator darf keinen unsichtbaren Abschlussstopp erzeugen.');

const robotBase = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.base.ts');
assert.ok(/resetOnProgramEnd\(\): void \{\s*this\.reset\(\);\s*\}/.test(robotBase), 'Das sichere Standardverhalten fuer andere Roboter fehlt.');

const simulation = read('OpenRobertaWeb/src/app/simulation/simulationLogic/simulation.roberta.ts');
assert.ok(simulation.includes('robot.resetOnProgramEnd()'), 'Die Simulation verwendet den roboterspezifischen Abschluss-Hook nicht.');

const rcxRobot = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.rcx.ts');
assert.ok(rcxRobot.includes('override resetOnProgramEnd(): void {}'), 'Der RCX darf am Programmende nicht automatisch zurueckgesetzt werden.');

const actuators = read('OpenRobertaWeb/src/app/simulation/simulationLogic/robot.actuators.ts');
assert.ok(
    actuators.includes('interpreterRunning || myRobot.interpreter.isTerminated()'),
    'Das RCX-Chassis behaelt den Motorzustand nach Programmende nicht bei.'
);

['robot.base.js', 'simulation.roberta.js', 'robot.rcx.js'].forEach(function (file) {
    const relative = 'js/app/simulation/simulationLogic/' + file;
    [read('OpenRobertaServer/staticResources/' + relative), read('application/staticResources/' + relative)].forEach(function (runtime) {
        assert.ok(runtime.includes('resetOnProgramEnd'), 'RCX-Abschlusssemantik fehlt in einer ausgelieferten Datei: ' + file);
    });
});

const serverActuators = read('OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.actuators.js');
const packagedActuators = read('application/staticResources/js/app/simulation/simulationLogic/robot.actuators.js');
assert.strictEqual(serverActuators, packagedActuators, 'Server- und Paketversion der Aktoren muessen identisch sein.');
assert.ok(
    serverActuators.includes('interpreterRunning || myRobot.interpreter.isTerminated()'),
    'Die ausgelieferte RCX-Simulation behaelt den Motorzustand nach Programmende nicht bei.'
);

console.log('RCX-Programmende-Simulationspruefung erfolgreich.');
