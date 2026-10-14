'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function loadRobot(file, modules) {
    const output = {};
    const code = fs.readFileSync(path.join(root, 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic', file), 'utf8');
    vm.runInNewContext(code, { define(deps, factory) { factory(...deps.map((dep) => dep === 'exports' ? output : modules[dep])); } });
    return output.default;
}

function Sensor(port, x, y, theta) { Object.assign(this, { port, x, y, theta }); }
function FakeChassis() { this.geom = { x: -32, y: -18, w: 46, h: 36, color: 'yellow' }; }
const mounts = new Map([
    ['rcx|S2|LIGHT', { x: 0, y: -20, theta: 0 }],
    ['rcj|U1|ULTRASONIC', { x: 0, y: 18, theta: -Math.PI / 2 }],
    ['rcj|C1|COLOR', { x: -12, y: 0, theta: 0 }],
]);
const mountModule = {
    getSensorMount(group, id, type, fallback) { return mounts.get([group, id, type].join('|')) || fallback; },
};
const sensors = {
    LightSensor: Sensor, TouchSensor: Sensor, Timer: function () {}, EV3Keys: function () {},
    ColorSensor: Sensor, ColorSensorHex: Sensor, DistanceSensor: Sensor, UltrasonicSensor: Sensor,
    InductiveSensor: Sensor, GyroSensor: function () {},
};
const actuators = {
    RCXChassis: FakeChassis,
    RCJChassis: FakeChassis,
    StatusLed: function () {}, WebAudio: function () {},
};
const jquery = () => ({ on() {} });
const RobotRcx = loadRobot('robot.rcx.js', { 'robot.ev3': { default: function () {} }, 'robot.actuators': actuators, 'robot.sensors': sensors, 'robot.sensor.points': mountModule });
const rcx = Object.create(RobotRcx.prototype);
Object.assign(rcx, { id: 0, pose: { x: 0, y: 0, theta: 0 } });
const rcxConfig = { SENSORS: { S1: { TYPE: 'TOUCH' }, S2: { TYPE: 'LIGHT' } } };
RobotRcx.prototype.configure.call(rcx, rcxConfig);
assert.deepEqual([rcx.S2.x, rcx.S2.y], [0, -20], 'RCX light sensor reads local-browser placement');
assert.deepEqual([rcx.S1.x, rcx.S1.y], [25, 0], 'unconfigured RCX sensor retains default placement');
assert.deepEqual(rcxConfig.SENSORS.S2, { TYPE: 'LIGHT' }, 'mount override does not mutate compiler configuration');

const RobotRcj = loadRobot('robot.rcj.js', {
    'robot.base.mobile': { RobotBaseMobile: function () {}, Pose: function (x, y, theta) { Object.assign(this, { x, y, theta }); } },
    'robot.sensors': sensors, 'robot.actuators': actuators, 'robot.sensor.points': mountModule, jquery,
});
const rcj = Object.create(RobotRcj.prototype);
Object.assign(rcj, { id: 0, pose: { x: 0, y: 0, theta: 0 } });
const rcjConfig = { SENSORS: { U1: { TYPE: 'ULTRASONIC' }, C1: { TYPE: 'COLOR' } } };
RobotRcj.prototype.configure.call(rcj, rcjConfig);
assert.deepEqual([rcj.U1.x, rcj.U1.y, rcj.U1.theta], [0, 18, -Math.PI / 2], 'RCJ ultrasonic mount changes position and ray direction');
assert.deepEqual([rcj.C1.x, rcj.C1.y], [-12, 0], 'RCJ floor sensor mount changes simulation sampling position');
assert.deepEqual(rcjConfig.SENSORS.U1, { TYPE: 'ULTRASONIC' }, 'mount override leaves RCJ configuration untouched');

// Exercise the actual 2D light-sensor sampler at a fixed robot pose. The two
// locally selected sides see different canvas colors; no browser or robot is needed.
const sensorExports = {};
const sensorSource = fs.readFileSync(path.join(root, 'OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/robot.sensors.js'), 'utf8');
const math = {
    transform(pose, point) { point.rx = pose.x + point.x; point.ry = pose.y + point.y; },
    rgbToHsv() { return []; },
    getColor() { return ['NONE', '#000000']; },
};
const sensorDeps = {
    'exports': sensorExports,
    'simulation.math': math,
    'util.roberta': { round: Math.round },
    'blockly': { Msg: {} },
};
vm.runInNewContext(sensorSource, {
    define(deps, factory) { factory(...deps.map((dep) => sensorDeps[dep] || {})); },
});
const samplingSensors = { ...sensors, LightSensor: sensorExports.LightSensor };
const SamplingRcx = loadRobot('robot.rcx.js', {
    'robot.ev3': { default: function () {} }, 'robot.actuators': actuators,
    'robot.sensors': samplingSensors, 'robot.sensor.points': mountModule,
});
const sampleRcx = Object.create(SamplingRcx.prototype);
Object.assign(sampleRcx, { id: 0, pose: { x: 0, y: 0, theta: 0 } });
const sampleConfig = { SENSORS: { S2: { TYPE: 'LIGHT' } } };
const sampledY = [];
function imageData(blue) {
    const data = new Uint8ClampedArray(6 * 6 * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = blue ? 0 : 255;
        data[i + 1] = blue ? 0 : 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
    }
    return { data };
}
const floor = { getImageData(_x, y) { sampledY.push(y); return imageData(y > 0); } };
const overlay = { getImageData() { return { data: new Uint8ClampedArray(6 * 6 * 4) }; } };
function sampleLight() {
    SamplingRcx.prototype.configure.call(sampleRcx, sampleConfig);
    const values = {};
    sampleRcx.S2.updateSensor(false, 0, sampleRcx, values, floor, overlay);
    return values.light.S2.light;
}
const leftLight = sampleLight();
mounts.set('rcx|S2|LIGHT', { x: 0, y: 20, theta: 0 });
const rightLight = sampleLight();
assert.deepEqual(sampledY, [-23, 17], 'same pose samples opposite sides of the color boundary');
assert.equal(leftLight, 100, 'left mount samples white ground');
assert.ok(Math.abs(rightLight - 100 / 3) < 0.01, 'right mount samples blue ground');
assert.deepEqual(sampleConfig.SENSORS.S2, { TYPE: 'LIGHT' }, 'sampling does not alter the robot configuration');
console.log('PASS runtime mount injection and fixed-pose 2D light sampling: RCX/RCJ mounts, direction, defaults and immutable configuration.');
