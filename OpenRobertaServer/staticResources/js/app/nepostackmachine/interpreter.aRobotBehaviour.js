define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ARobotBehaviour = void 0;
    var ARobotBehaviour = /** @class */ (function () {
        function ARobotBehaviour() {
            this.hardwareState = {};
            this.hardwareState.actions = {};
            this.hardwareState.sensors = {};
            this.blocking = false;
        }
        ARobotBehaviour.prototype.getActionState = function (actionType, resetState) {
            if (resetState === void 0) { resetState = false; }
            var v = this.hardwareState.actions[actionType];
            if (resetState) {
                delete this.hardwareState.actions[actionType];
            }
            return v;
        };
        ARobotBehaviour.prototype.setBlocking = function (value) {
            this.blocking = value;
        };
        ARobotBehaviour.prototype.getBlocking = function () {
            return this.blocking;
        };
        ARobotBehaviour.prototype.sendIRAction = function (_message) {
            // Communication is optional for robot behaviours.
        };
        ARobotBehaviour.prototype.receiveIRAction = function (s) {
            s.push(0);
        };
        return ARobotBehaviour;
    }());
    exports.ARobotBehaviour = ARobotBehaviour;
});
