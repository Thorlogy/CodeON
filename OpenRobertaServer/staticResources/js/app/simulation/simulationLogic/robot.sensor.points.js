var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeSensorMount = exports.setSensorMount = exports.getSensorMount = void 0;
    var STORAGE_KEY = 'codeon.sensorMounts.v1';
    var MAX_OFFSET = 100;
    function makeKey(robotGroup, sensorId, sensorType) {
        var group = String(robotGroup || '').toLowerCase();
        if ((group !== 'rcx' && group !== 'rcj') || !sensorId || !sensorType) {
            return undefined;
        }
        return [group, String(sensorId), String(sensorType).toUpperCase()].join('|');
    }
    function isValidMount(value) {
        return (value &&
            Number.isFinite(value.x) &&
            Number.isFinite(value.y) &&
            Math.abs(value.x) <= MAX_OFFSET &&
            Math.abs(value.y) <= MAX_OFFSET &&
            (value.theta === undefined || (Number.isFinite(value.theta) && Math.abs(value.theta) <= Math.PI * 2)));
    }
    function readAll() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { version: 1, sensors: {} };
            }
            var parsed_1 = JSON.parse(raw);
            if (!parsed_1 || parsed_1.version !== 1 || !parsed_1.sensors || typeof parsed_1.sensors !== 'object') {
                return { version: 1, sensors: {} };
            }
            var sensors_1 = {};
            Object.keys(parsed_1.sensors).forEach(function (key) {
                if (isValidMount(parsed_1.sensors[key])) {
                    sensors_1[key] = parsed_1.sensors[key];
                }
            });
            return { version: 1, sensors: sensors_1 };
        }
        catch (_error) {
            // Storage can be disabled (for example in private browsing); SIM must still work.
            return { version: 1, sensors: {} };
        }
    }
    function getSensorMount(robotGroup, sensorId, sensorType, fallback) {
        var key = makeKey(robotGroup, sensorId, sensorType);
        var saved = key ? readAll().sensors[key] : undefined;
        return saved && isValidMount(saved) ? __assign(__assign({}, fallback), saved) : fallback;
    }
    exports.getSensorMount = getSensorMount;
    function setSensorMount(robotGroup, sensorId, sensorType, mount) {
        var key = makeKey(robotGroup, sensorId, sensorType);
        if (!key || !isValidMount(mount)) {
            return false;
        }
        try {
            var current = readAll();
            current.sensors[key] = { x: mount.x, y: mount.y, theta: mount.theta };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            return true;
        }
        catch (_error) {
            return false;
        }
    }
    exports.setSensorMount = setSensorMount;
    function removeSensorMount(robotGroup, sensorId, sensorType) {
        var key = makeKey(robotGroup, sensorId, sensorType);
        if (!key) {
            return;
        }
        try {
            var current = readAll();
            delete current.sensors[key];
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
        catch (_error) {
            // Best-effort reset: simulator's built-in placement remains the fallback.
        }
    }
    exports.removeSensorMount = removeSensorMount;
});
