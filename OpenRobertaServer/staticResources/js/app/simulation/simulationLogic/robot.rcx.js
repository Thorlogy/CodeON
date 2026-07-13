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
    var RobotRcx = /** @class */ (function (_super) {
        __extends(RobotRcx, _super);
        function RobotRcx() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.timer = new robot_sensors_1.Timer(1);
            return _this;
        }
        RobotRcx.prototype.configure = function (configuration) {
            this.chassis = new robot_actuators_1.RCXChassis(this.id, configuration, 2, this.pose);
            var sensors = configuration['SENSORS'];
            var _loop_1 = function (c) {
                switch (sensors[c]['TYPE']) {
                    case 'TOUCH':
                        this_1[c] = new robot_sensors_1.TouchSensor(c, 25, 0, this_1.chassis.geom.color);
                        break;
                    case 'LIGHT': {
                        var myColorLightSensors_1 = [];
                        var rcx_1 = this_1;
                        Object.keys(this_1).forEach(function (x) {
                            if (rcx_1[x] && rcx_1[x] instanceof robot_sensors_1.LightSensor) {
                                myColorLightSensors_1.push(rcx_1[x]);
                            }
                        });
                        var ord = myColorLightSensors_1.length + 1;
                        var id = Object.keys(sensors).filter(function (sensor) { return sensors[sensor]['TYPE'] == 'LIGHT'; }).length;
                        var y = ord * 10 - 5 * (id + 1);
                        this_1[c] = new robot_sensors_1.LightSensor(c, 15, y, 0, 5);
                        break;
                    }
                }
            };
            var this_1 = this;
            for (var c in sensors) {
                _loop_1(c);
            }
            var myButtons = [];
            this.buttons = new robot_sensors_1.EV3Keys(myButtons, this.id);
        };
        return RobotRcx;
    }(robot_ev3_1.default));
    exports.default = RobotRcx;
});
