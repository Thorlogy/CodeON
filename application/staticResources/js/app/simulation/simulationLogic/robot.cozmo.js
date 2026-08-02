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
define(["require", "exports", "robot.ev3", "robot.actuators", "robot.sensors"], function (require, exports, robot_ev3_1, robot_actuators_1, robot_sensors_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    /** Cozmo simulation with a differential tracked drive and fixed front lift. */
    var RobotCozmo = /** @class */ (function (_super) {
        __extends(RobotCozmo, _super);
        function RobotCozmo() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.timer = new robot_sensors_1.Timer(1);
            _this.imgList = ['simpleBackground', 'drawBackground', 'robertaBackground', 'rescueBackground', 'maze', 'blank', 'mathBackground'];
            return _this;
        }
        RobotCozmo.prototype.configure = function (configuration) {
            this.chassis = new robot_actuators_1.CozmoChassis(this.id, configuration, 2, this.pose);
            this.buttons = new robot_sensors_1.EV3Keys([], this.id);
        };
        return RobotCozmo;
    }(robot_ev3_1.default));
    exports.default = RobotCozmo;
});
