#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverAdapter = path.join(root, 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
const runtimeAdapter = path.join(root, 'application/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js');
const serverIndex = path.join(root, 'OpenRobertaServer/staticResources/index.html');
const runtimeIndex = path.join(root, 'application/staticResources/index.html');

const serverSource = fs.readFileSync(serverAdapter, 'utf8');
const runtimeSource = fs.readFileSync(runtimeAdapter, 'utf8');

assert.strictEqual(serverSource, runtimeSource, 'Quell- und Laufzeitversion des 3D-Adapters muessen identisch sein.');

[
    'distance: 7',
    'new THREE.Fog(',
    'THREE.PCFSoftShadowMap',
    "poseHud.id = 'sim3dPoseHud'",
    "sceneLabel.textContent = '3D SIMULATION'",
    'orbit.targetX = robotMesh.position.x',
    "frontBumper.name = 'touchBumper'",
    "lightLens.name = 'lightSensorLens'",
    'syncWorldObjects(simScene, robot, size, scale)',
    'ground.w = 200000',
    "data-codeon-3d-object-count",
    'robotVisualScale = (45 * scale) / 3.3',
    'robotMesh.rotation.y = -robot.pose.theta - Math.PI / 2',
    "group.userData.leftWheel = makeWheel('leftWheel'",
    'function beginRobotDrag(event)',
    'robot.chassis.transformNewPose(robot.pose, robot.chassis)',
    'function createRampGeometry(width, depth, height, descending)',
    "source.codeOn3dStructure = type",
].forEach(function (feature) {
    assert.ok(runtimeSource.indexOf(feature) !== -1, '3D-RoboMission-Merkmal fehlt: ' + feature);
});

[
    "data-codeon-3d-structure='ramp-up'",
    "data-codeon-3d-structure='ramp-down'",
    "data-codeon-3d-structure='plateau'",
].forEach(function (feature) {
    assert.ok(fs.readFileSync(serverIndex, 'utf8').indexOf(feature) !== -1, '3D-Struktur fehlt im Quell-Index: ' + feature);
    assert.ok(fs.readFileSync(runtimeIndex, 'utf8').indexOf(feature) !== -1, '3D-Struktur fehlt im Laufzeit-Index: ' + feature);
});

const version = 'simulation3d.adapter.js?v=codeon-3d-robomission-5';
assert.ok(fs.readFileSync(serverIndex, 'utf8').indexOf(version) !== -1, 'Cache-Version fehlt im Quell-Index.');
assert.ok(fs.readFileSync(runtimeIndex, 'utf8').indexOf(version) !== -1, 'Cache-Version fehlt im Laufzeit-Index.');

console.log('CodeON-3D-Pruefung erfolgreich.');
