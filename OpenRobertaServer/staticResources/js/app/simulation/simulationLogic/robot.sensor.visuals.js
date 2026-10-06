/* Read-only visual descriptors for RCX/RCJ sensor attachments.
 * Coordinates remain in simulator units; rendering must not change sensors.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CodeOnSensorVisuals = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const classes = {
        TOUCH: ['TouchSensor'], LIGHT: ['LightSensor'],
        COLOUR: ['ColorSensor', 'ColorSensorHex'],
        ULTRASONIC: ['UltrasonicSensor'], INDUCTIVE: ['InductiveSensor']
    };
    const allowed = { rcx: ['TOUCH', 'LIGHT'], rcj: ['TOUCH', 'COLOUR', 'ULTRASONIC', 'INDUCTIVE'] };
    const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
    const instance = (object, type) => typeof type === 'function' && !!type.prototype && object instanceof type;
    const coordinate = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000;
    const text = value => typeof value === 'string' && value.length > 0 && value.length <= 128;

    // Pass actual AMD module exports, not constructor.name (minified in releases).
    function describe(robot, types) {
        if (!types || !types.sensors) return [];
        const family = instance(robot, types.rcx) ? 'rcx' : instance(robot, types.rcj) ? 'rcj' : null;
        if (!family) return [];
        const sensors = robot.configuration && robot.configuration.SENSORS;
        if (!sensors || typeof sensors !== 'object' || Array.isArray(sensors)) return [];
        const result = [];
        for (const key of Object.keys(sensors).sort()) {
            if (!text(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
            const config = sensors[key];
            const type = config && (config.TYPE === 'COLOR' ? 'COLOUR' : config.TYPE);
            if (!allowed[family].includes(type) || !own(robot, key)) continue;
            const sensor = robot[key];
            // Configuration identifies the slot; the actual sensor supplies its pose.
            if (!sensor || !classes[type].some(key => instance(sensor, types.sensors[key])) || sensor.port !== key) continue;
            // LightSensor extends ColorSensor, but is not an RCJ colour sensor.
            if (type === 'COLOUR' && instance(sensor, types.sensors.LightSensor)) continue;
            if (!coordinate(sensor.x) || !coordinate(sensor.y)) continue;
            let theta = sensor.theta;
            let mountX = sensor.x, mountY = sensor.y;
            let side = null;
            if (type === 'TOUCH') {
                side = sensor.position;
                if (side !== 'front' && side !== 'back') continue;
                theta = side === 'front' ? 0 : Math.PI;
                // TouchSensor.draw/updateSensor use the chassis contact edge,
                // not the nominal sensor x (RCJ: -32 versus -25).
                const left = robot.chassis && robot.chassis[side + 'Left'];
                const right = robot.chassis && robot.chassis[side + 'Right'];
                if (!left || !right || ![left.x,left.y,right.x,right.y].every(coordinate)) continue;
                mountX = (left.x + right.x) / 2;
                // Display placement can separate multiple RCX bumpers along
                // the same front edge; contact logic still uses that edge.
                mountY = sensor.y;
            } else if (type === 'INDUCTIVE' && theta === undefined) {
                theta = 0; // Existing InductiveSensor has no theta initialization.
            }
            if (!coordinate(theta)) continue;
            result.push(Object.freeze({
                id: JSON.stringify([family, key, type]), family, type,
                configurationKey: key, simulationPort: sensor.port,
                // RCJ component PORT is physical; do not mistake its user NAME for PORT.
                hardwarePort: own(config, 'PORT') && text(config.PORT) ? config.PORT : null,
                x: sensor.x, y: sensor.y, mountX, mountY, theta, side
            }));
        }
        return result;
    }

    function applyMounts(robot, descriptors, mounts) {
        if (!robot || !robot.chassis || !robot.chassis.geom || !mounts) return descriptors;
        const geom = robot.chassis.geom;
        const minX = geom.x, maxX = geom.x + geom.w, minY = geom.y, maxY = geom.y + geom.h;
        const isRcj = descriptors.length && descriptors[0].family === 'rcj';
        const sideHeight = isRcj ? 2.1 : 1.65;
        // RCJ's side wheel occupies the chassis midpoint. Its decorative
        // sensor pod belongs near the front quarter, clear of that wheel.
        const sideX = isRcj ? maxX - 4 : (minX + maxX) / 2;
        const positions = {
            front: { x: maxX, y: (minY + maxY) / 2, theta: 0, height: 0.58, pitch: 0 },
            // Side mounts sit above each model's wheel envelope on a visible
            // outboard bracket; 0.58 placed them beside the RCX wheel hub.
            right: { x: sideX, y: maxY, theta: Math.PI / 2, height: sideHeight, pitch: 0 },
            back: { x: minX, y: (minY + maxY) / 2, theta: Math.PI, height: 0.58, pitch: 0 },
            left: { x: sideX, y: minY, theta: -Math.PI / 2, height: sideHeight, pitch: 0 },
            up: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, theta: 0, height: 1.35, pitch: Math.PI / 2 },
            down: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, theta: 0, height: 0.3, pitch: -Math.PI / 2 }
        };
        return descriptors.map(descriptor => {
            const position = positions[mounts[descriptor.id]];
            if (!position) return descriptor;
            return Object.freeze(Object.assign({}, descriptor, {
                mountPosition: mounts[descriptor.id], mountX: position.x, mountY: position.y,
                theta: position.theta, mountHeight: position.height, mountPitch: position.pitch
            }));
        });
    }

    return Object.freeze({ describe, applyMounts });
});
