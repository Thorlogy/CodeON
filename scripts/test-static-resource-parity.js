#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'OpenRobertaServer/staticResources');
const packaged = path.join(root, 'application/staticResources');
const checkedExtensions = new Set(['.html', '.css', '.svg', '.json']);

function selectedFiles(base) {
    const files = [];
    function visit(directory, relativeDirectory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const relative = path.posix.join(relativeDirectory, entry.name);
            const absolute = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) {
                throw new Error(`Unexpected symlink in static resources: ${relative}`);
            }
            if (entry.isDirectory()) {
                visit(absolute, relative);
            } else if (entry.isFile() && checkedExtensions.has(path.extname(entry.name).toLowerCase())) {
                files.push(relative);
            }
        }
    }
    visit(base, '');
    return files.sort();
}

const sourceFiles = selectedFiles(source);
const packagedFiles = selectedFiles(packaged);
for (const extension of checkedExtensions) {
    assert.ok(sourceFiles.some((file) => file.toLowerCase().endsWith(extension)), `No ${extension} files checked`);
}
assert.deepStrictEqual(packagedFiles, sourceFiles, 'HTML/CSS/SVG/JSON file inventories differ between source and package');

for (const file of sourceFiles) {
    const original = fs.readFileSync(path.join(source, file));
    const copy = fs.readFileSync(path.join(packaged, file));
    assert.ok(original.equals(copy), `Static resource differs between source and package: ${file}`);
}

const tabRule = '.tab-pane:not(.active)';
assert.ok(fs.readFileSync(path.join(source, 'css/style.css'), 'utf8').includes(tabRule), 'Inactive-tab click protection is missing');

// This AMD module has a known behavioral drift in the old package. Check both
// copies with a minimal, hardware-free dependency stub instead of comparing
// minified and unminified JavaScript byte-for-byte.
function loadInterpreter(base) {
    const exports = {};
    class State {
        removeHighlights() {}
        getOp() { return {}; }
        evalHighlightings() {}
        getDebugMode() { return false; }
    }
    const constants = { OPS: 'OPS', DEBUG_STEP_INTO: 'stepInto', DEBUG_BREAKPOINT: 'breakpoint', DEBUG_STEP_OVER: 'stepOver' };
    const context = {
        define(dependencies, factory) {
            factory(() => {}, exports, { State }, {}, constants, {}, {}, {});
        }
    };
    const file = path.join(base, 'js/app/nepostackmachine/interpreter.interpreter.js');
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file, timeout: 1000 });
    assert.strictEqual(typeof exports.Interpreter, 'function', `Interpreter AMD export missing in ${file}`);
    return exports.Interpreter;
}

for (const [label, base] of [['source', source], ['package', packaged]]) {
    const Interpreter = loadInterpreter(base);
    for (const normalClose of [false, true, undefined]) {
        for (const naturalEnd of [false, true]) {
            let closeCalls = 0;
            let callbacks = 0;
            const behaviour = { close() { closeCalls++; }, getBlocking() { return false; } };
            const interpreter = new Interpreter({ OPS: [] }, behaviour, () => { callbacks++; }, [], 'parity test', false, normalClose);
            if (naturalEnd) {
                interpreter.evalSingleOperation = () => { interpreter.terminated = true; return [0, false]; };
                interpreter.run(Number.MAX_SAFE_INTEGER);
            } else {
                interpreter.terminate();
            }
            assert.strictEqual(callbacks, 1, `${label}: termination callback must run once`);
            assert.strictEqual(closeCalls, normalClose === false ? 0 : 1,
                `${label}: close=${normalClose} must control behaviour closing on ${naturalEnd ? 'natural end' : 'forced termination'}`);
        }
    }
}

function rcxSnapshot(base, sensors) {
    const exports = {};
    function RobotEv3() { this.id = 'rcx'; this.pose = {}; }
    RobotEv3.prototype.resetOnProgramEnd = () => { throw new Error('RCX must not reset motors at program end'); };
    class RCXChassis { constructor() { this.geom = { color: 'yellow' }; } }
    class TouchSensor { constructor(...args) { this.args = args; } }
    class LightSensor { constructor(...args) { this.args = args; } }
    class Timer { constructor() {} }
    class EV3Keys { constructor() {} }
    let overlayCalls = 0;
    const context = {
        window: { CodeOnSensorOverlay2D: { draw() { overlayCalls++; } } },
        define(dependencies, factory) {
            factory(() => {}, exports, { default: RobotEv3 }, { RCXChassis }, { TouchSensor, LightSensor, Timer, EV3Keys });
        }
    };
    const file = path.join(base, 'js/app/simulation/simulationLogic/robot.rcx.js');
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file, timeout: 1000 });
    const robot = new exports.default();
    robot.configure({ SENSORS: sensors });
    robot.resetOnProgramEnd();
    robot.sensorMountOverlay.draw({}, robot);
    const placed = Object.keys(sensors).sort().map((port) => [port, robot[port].constructor.name, robot[port].args]);
    return JSON.stringify({ placed, overlayCalls, priority: robot.sensorMountOverlay.drawPriority });
}

const rcxCases = [
    { S1: { TYPE: 'TOUCH' } },
    { S1: { TYPE: 'TOUCH' }, S2: { TYPE: 'TOUCH' }, S3: { TYPE: 'LIGHT' }, S4: { TYPE: 'LIGHT' } }
];
for (const sensors of rcxCases) {
    const fromSource = rcxSnapshot(source, sensors);
    const fromPackage = rcxSnapshot(packaged, sensors);
    assert.strictEqual(fromPackage, fromSource, `RCX source/package simulation behavior differs for ${Object.keys(sensors).join(', ')}`);
    const result = JSON.parse(fromSource);
    assert.strictEqual(result.overlayCalls, 1);
    assert.strictEqual(result.priority, 99);
    if (Object.keys(sensors).length === 4) {
        assert.deepStrictEqual(result.placed.map((item) => item[2][2]), [-6, 6, -5, 5], 'RCX sensor positions must stay distinct');
    }
}

console.log(`Static resource parity: ${sourceFiles.length} HTML/CSS/SVG/JSON files match; interpreter and RCX contracts match`);

// Other JavaScript bundles, generated maps and images need a separate provenance
// review; they are intentionally not copied or declared equivalent by this check.
