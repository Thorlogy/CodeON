/* Visual-only 2D mount markers. Existing sensor glyphs retain their real origins. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.CodeOnSensorOverlay2D = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const colors = Object.freeze({ TOUCH: '#c84138', LIGHT: '#d6a900', COLOUR: '#008ca4', ULTRASONIC: '#1765ad', INDUCTIVE: '#d28110' });
    const labels = Object.freeze({ up: '\u2191', down: '\u2193' });

    function draw(ctx, robot, types) {
        const visuals = root.CodeOnSensorVisuals;
        const mounts = root.CodeOnSensorMounts;
        if (!ctx || !robot || !visuals || !mounts || !types) return 0;
        const descriptors = visuals.describe(robot, types);
        if (!descriptors.length) return 0;
        const family = descriptors[0].family;
        const selected = mounts.read(null, family, descriptors);
        if (!Object.keys(selected).length) return 0;
        const mounted = visuals.applyMounts(robot, descriptors, selected);
        let count = 0;
        mounted.forEach(function (sensor, index) {
            if (!sensor.mountPosition) return;
            const original = descriptors[index];
            if (!Number.isFinite(sensor.mountX) || !Number.isFinite(sensor.mountY)) return;
            const x = sensor.mountX, y = sensor.mountY;
            const color = colors[sensor.type] || '#1765ad';
            ctx.save();
            // A dotted connector makes the difference between decorative mount
            // and unchanged measuring point visible in the 2D view.
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(original.mountX, original.mountY);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = 'bold 10px sans-serif';
            const name = String(sensor.configurationKey || sensor.simulationPort || '').slice(0, 10);
            ctx.fillText(name + (labels[sensor.mountPosition] || ''), x + 9, y - 8);
            ctx.restore();
            count++;
        });
        return count;
    }

    return Object.freeze({ draw });
});
