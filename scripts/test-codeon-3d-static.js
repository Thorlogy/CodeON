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
    'distance: 17',
    'new THREE.Fog(',
    'THREE.PCFSoftShadowMap',
    "poseHud.id = 'sim3dPoseHud'",
    "sceneLabel.textContent = '3D SIMULATION'",
    'orbit.targetX = robotMesh.position.x',
].forEach(function (feature) {
    assert.ok(runtimeSource.indexOf(feature) !== -1, '3D-RoboMission-Merkmal fehlt: ' + feature);
});

const version = 'simulation3d.adapter.js?v=codeon-3d-robomission-2';
assert.ok(fs.readFileSync(serverIndex, 'utf8').indexOf(version) !== -1, 'Cache-Version fehlt im Quell-Index.');
assert.ok(fs.readFileSync(runtimeIndex, 'utf8').indexOf(version) !== -1, 'Cache-Version fehlt im Laufzeit-Index.');

console.log('CodeON-3D-Pruefung erfolgreich.');
