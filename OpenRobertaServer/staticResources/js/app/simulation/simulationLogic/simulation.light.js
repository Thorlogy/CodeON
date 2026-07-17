define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.calculateAmbientLight = void 0;
    /** Calculate the combined light level seen inside a directional sensor cone. */
    function calculateAmbientLight(sensorX, sensorY, viewDirection, lights, halfConeAngle) {
        if (halfConeAngle === void 0) { halfConeAngle = Math.PI / 8; }
        return Math.min(100, lights.reduce(function (sum, lamp) {
            var dx = lamp.x - sensorX;
            var dy = lamp.y - sensorY;
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (lamp.range <= 0 || distance > lamp.range) {
                return sum;
            }
            var direction = Math.atan2(dy, dx);
            var angle = Math.atan2(Math.sin(direction - viewDirection), Math.cos(direction - viewDirection));
            if (Math.abs(angle) > halfConeAngle) {
                return sum;
            }
            return sum + Math.max(0, lamp.intensity) * Math.max(0, 1 - distance / lamp.range);
        }, 0));
    }
    exports.calculateAmbientLight = calculateAmbientLight;
});
