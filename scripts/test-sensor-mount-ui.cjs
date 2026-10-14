'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const serverHtml = read('OpenRobertaServer/staticResources/index.html');
const appHtml = read('application/staticResources/index.html');
assert.equal(serverHtml, appHtml, 'runtime entry pages stay in sync');
assert.match(serverHtml, /id='sensorMountOpen'/);
assert.match(serverHtml, /id='sensorMountEditor'/);

const controller = read('OpenRobertaWeb/src/app/roberta/controller/configuration.controller.js');
assert.match(controller, /robBrick_RCX-Brick/);
assert.match(controller, /robConf_ultrasonic/);
assert.match(controller, /getRobotGroup\(\).*rcx.*rcj/s);
assert.match(controller, /setSensorMount\(group, id, type, mount\)/);
assert.match(controller, /removeSensorMount/);
assert.match(controller, /beim nächsten SIM-Start/);
assert.match(controller, /nach oben\/unten gerichtete Sensoren werden nicht simuliert/);
assert.match(controller, /sensors facing up or down are not simulated/);
assert.match(controller, /function escapeSensorAttribute/);
assert.match(controller, /sensorMountText\('Links', 'Left'\)/);
assert.match(controller, /sensorMountEditorGroup !== group/);
assert.match(controller, /sensorMountEditorOpen = false;\s*\$\('#sensorMountEditor'\)\.hide\(\)\.empty\(\)/);
assert.doesNotMatch(controller, /cozmo.*sensor-mount|edison.*sensor-mount/i, 'editor is not enabled for excluded systems');

for (const file of [
    'OpenRobertaServer/staticResources/js/app/roberta/controller/configuration.controller.js',
    'application/staticResources/js/app/roberta/controller/configuration.controller.js',
]) {
    const js = read(file);
    assert.match(js, /sensorMountOpen/);
    assert.match(js, /robot\.sensor\.points/);
}

for (const file of [
    'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.points.js',
    'application/staticResources/js/app/simulation/simulationLogic/robot.sensor.points.js',
]) assert.ok(fs.existsSync(path.join(root, file)), file + ' is built for the runtime');

console.log('PASS sensor mount UI: RCX/RCJ controls, local save/reset hooks, excluded systems and runtime mirrors.');
