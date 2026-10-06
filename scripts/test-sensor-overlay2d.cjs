'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const relative = 'staticResources/js/app/simulation/simulationLogic/robot.sensor.overlay2d.js';
const source = fs.readFileSync(path.join(root, 'OpenRobertaServer', relative), 'utf8');
assert.equal(source, fs.readFileSync(path.join(root, 'application', relative), 'utf8'));
const visuals = require(path.join(root, 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.visuals.js'));
const mounts = require(path.join(root, 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensor.mounts.js'));
globalThis.CodeOnSensorVisuals = visuals;
globalThis.CodeOnSensorMounts = mounts;
const storage = new Map();
globalThis.localStorage = {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
};
const overlay = require(path.join(root, 'OpenRobertaServer', relative));
const types = { rcx: class Rcx {}, rcj: class Rcj {}, sensors: { TouchSensor: class Touch {}, LightSensor: class Light {}, ColorSensor: class Color {} } };
function robot(ctor) {
    return Object.assign(new ctor(), {
        configuration: { SENSORS: { S1: { TYPE: 'LIGHT' } } },
        chassis: { geom: { x: -32, y: -18, w: 46, h: 36 } },
        S1: Object.assign(new types.sensors.LightSensor(), { port: 'S1', x: 15, y: 0, theta: 0 }),
    });
}
const calls = [];
const ctx = Object.fromEntries(['save','restore','setLineDash','beginPath','moveTo','lineTo','stroke','fill','arc','fillText'].map(name => [name, (...args) => calls.push([name, ...args])]));
const rcx = robot(types.rcx);
const initialSensor = JSON.stringify(rcx.S1), initialConfig = JSON.stringify(rcx.configuration);
assert.equal(overlay.draw(ctx, rcx, types), 0, 'No saved mounting choice leaves the original 2D view untouched');
assert.equal(calls.length, 0);
const descriptor = visuals.describe(rcx, types)[0];
assert.equal(mounts.write(null, 'rcx', descriptor.id, 'right', [descriptor]), true);
assert.equal(overlay.draw(ctx, rcx, types), 1);
assert.ok(calls.some(call => call[0] === 'moveTo' && call[1] === 15 && call[2] === 0), 'Connector begins at the actual measuring point');
assert.ok(calls.some(call => call[0] === 'lineTo' && call[1] === -9 && call[2] === 18), 'Marker follows the chosen chassis side');
assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === 'S1'), 'Marker identifies its configured sensor');
assert.equal(JSON.stringify(rcx.S1), initialSensor, 'Rendering never moves the sensor');
assert.equal(JSON.stringify(rcx.configuration), initialConfig, 'Rendering never changes the robot configuration');
calls.length = 0;
assert.equal(overlay.draw(ctx, robot(class Other {}), types), 0, 'Other robot systems have no overlay');
assert.equal(calls.length, 0);
assert.equal(mounts.clear(null, 'rcx', [descriptor]), true);
assert.equal(overlay.draw(ctx, rcx, types), 0, 'Reset removes the marker');
const rcj = Object.assign(new types.rcj(), {
    configuration: { SENSORS: { S2: { TYPE: 'COLOUR' } } },
    chassis: { geom: { x: -32, y: -18, w: 46, h: 36 } },
    S2: Object.assign(new types.sensors.ColorSensor(), { port: 'S2', x: 13, y: 0, theta: 0 }),
});
const rcjSensor = JSON.stringify(rcj.S2);
const rcjDescriptor = visuals.describe(rcj, types)[0];
assert.equal(mounts.write(null, 'rcj', rcjDescriptor.id, 'left', [rcjDescriptor]), true);
calls.length = 0;
assert.equal(overlay.draw(ctx, rcj, types), 1, 'RCJ also shows a chosen mount in 2D');
assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === 'S2'));
assert.equal(JSON.stringify(rcj.S2), rcjSensor, 'RCJ measuring sensor stays at its original position');
assert.equal(mounts.clear(null, 'rcj', [rcjDescriptor]), true);
for (const tree of ['OpenRobertaServer', 'application']) {
    const html = fs.readFileSync(path.join(root, tree, 'staticResources/index.html'), 'utf8');
    assert.ok(html.includes('robot.sensor.overlay2d.js'));
    for (const robotFile of ['robot.rcx.js', 'robot.rcj.js']) {
        const js = fs.readFileSync(path.join(root, tree, 'staticResources/js/app/simulation/simulationLogic', robotFile), 'utf8');
        assert.ok(js.includes('CodeOnSensorOverlay2D'), `${tree}/${robotFile} attaches the visual-only marker`);
    }
}
console.log('PASS 2D sensor mount markers: saved mount, real origin connector, reset, RCX/RCJ opt-in, packaged resources, unchanged sensor and configuration.');
