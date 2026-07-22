var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define(["require", "exports", "./interpreter.constants", "./interpreter.robotSimBehaviour"], function (require, exports, C, interpreter_robotSimBehaviour_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RobotBridgeBehaviour = void 0;
    /**
     * Hardware behaviour shared by differential-drive robots using Robot Bridge 1.0.
     * Robot-specific limits remain in the adapter; the browser only converts the
     * stack-machine percentages and distances into protocol values.
     */
    var RobotBridgeBehaviour = /** @class */ (function (_super) {
        __extends(RobotBridgeBehaviour, _super);
        function RobotBridgeBehaviour(bridge, maxWheelSpeedMmPerSec, trackWidthMm, onError) {
            if (maxWheelSpeedMmPerSec === void 0) { maxWheelSpeedMmPerSec = 150; }
            if (trackWidthMm === void 0) { trackWidthMm = 70; }
            var _this = _super.call(this) || this;
            _this.bridge = bridge;
            _this.onError = onError;
            _this.motionGeneration = 0;
            _this.maxWheelSpeedMmPerSec = maxWheelSpeedMmPerSec;
            _this.trackWidthMm = trackWidthMm;
            return _this;
        }
        RobotBridgeBehaviour.prototype.driveAction = function (_name, direction, speed, distance, time) {
            var signedSpeed = this.directionSign(direction) * this.toWheelSpeed(speed);
            if (distance === 0) {
                this.stopMotion();
                return 0;
            }
            var duration = time !== undefined ? Math.max(0, time) : distance === undefined ? 0 : this.travelTimeMs(distance * 10, signedSpeed);
            this.startMotion(signedSpeed, signedSpeed, duration);
            return duration;
        };
        RobotBridgeBehaviour.prototype.curveAction = function (_name, direction, speedL, speedR, distance, time) {
            var sign = this.directionSign(direction);
            var left = sign * this.toWheelSpeed(speedL);
            var right = sign * this.toWheelSpeed(speedR);
            if (distance === 0) {
                this.stopMotion();
                return 0;
            }
            var duration = time !== undefined ? Math.max(0, time) : distance === undefined ? 0 : this.travelTimeMs(distance * 10, (Math.abs(left) + Math.abs(right)) / 2);
            this.startMotion(left, right, duration);
            return duration;
        };
        RobotBridgeBehaviour.prototype.turnAction = function (_name, direction, speed, angle, time) {
            var wheelSpeed = this.toWheelSpeed(speed);
            var left = direction === C.LEFT ? -wheelSpeed : wheelSpeed;
            var right = -left;
            if (angle === 0) {
                this.stopMotion();
                return 0;
            }
            var duration = time !== undefined
                ? Math.max(0, time)
                : angle === undefined
                    ? 0
                    : this.travelTimeMs(Math.PI * this.trackWidthMm * Math.abs(angle) / 360, wheelSpeed);
            this.startMotion(left, right, duration);
            return duration;
        };
        RobotBridgeBehaviour.prototype.driveStop = function (_name) {
            this.stopMotion();
        };
        RobotBridgeBehaviour.prototype.close = function () {
            this.stopMotion();
        };
        RobotBridgeBehaviour.prototype.startMotion = function (left, right, durationMs) {
            var _this = this;
            var generation = ++this.motionGeneration;
            this.send('drive', { left: left, right: right });
            if (durationMs > 0) {
                window.setTimeout(function () {
                    if (generation === _this.motionGeneration)
                        _this.stopMotion();
                }, durationMs);
            }
        };
        RobotBridgeBehaviour.prototype.stopMotion = function () {
            var _this = this;
            ++this.motionGeneration;
            this.bridge.stopAll().catch(function (error) { return _this.report(error); });
        };
        RobotBridgeBehaviour.prototype.send = function (command, params) {
            var _this = this;
            this.bridge.command(command, params).catch(function (error) { return _this.report(error); });
        };
        RobotBridgeBehaviour.prototype.toWheelSpeed = function (percent) {
            return Math.max(-100, Math.min(100, Number(percent) || 0)) * this.maxWheelSpeedMmPerSec / 100;
        };
        RobotBridgeBehaviour.prototype.directionSign = function (direction) {
            return direction === C.FORWARD || direction === C.FOREWARD ? 1 : -1;
        };
        RobotBridgeBehaviour.prototype.travelTimeMs = function (distanceMm, speedMmPerSec) {
            return speedMmPerSec === 0 ? 0 : Math.abs(distanceMm / speedMmPerSec) * 1000;
        };
        RobotBridgeBehaviour.prototype.report = function (error) {
            if (this.onError)
                this.onError(error);
            else
                console.error(error);
        };
        return RobotBridgeBehaviour;
    }(interpreter_robotSimBehaviour_1.RobotSimBehaviour));
    exports.RobotBridgeBehaviour = RobotBridgeBehaviour;
});
