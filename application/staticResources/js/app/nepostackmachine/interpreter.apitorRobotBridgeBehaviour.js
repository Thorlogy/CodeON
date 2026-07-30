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
define(["require", "exports", "./interpreter.robotSimBehaviour"], function (require, exports, interpreter_robotSimBehaviour_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ApitorRobotBridgeBehaviour = void 0;
    /** Stack-machine behaviour for the three independently controlled Apitor ports. */
    var ApitorRobotBridgeBehaviour = /** @class */ (function (_super) {
        __extends(ApitorRobotBridgeBehaviour, _super);
        function ApitorRobotBridgeBehaviour(bridge, onError) {
            var _this = _super.call(this) || this;
            _this.bridge = bridge;
            _this.onError = onError;
            _this.lastAction = '';
            _this.sensorSnapshot = {};
            _this.motorStates = new Map();
            _this.pollSensors();
            _this.updateStatus();
            return _this;
        }
        ApitorRobotBridgeBehaviour.prototype.motorOnAction = function (_name, port, _durationType, _duration, speed, _time) {
            var _this = this;
            var numericSpeed = Number(speed) || 0;
            var level = Math.max(1, Math.min(12, Math.round(Math.abs(numericSpeed))));
            var direction = numericSpeed < 0 ? 2 : 1;
            var normalizedPort = String(port || '').toUpperCase();
            var nextState = "".concat(direction, ":").concat(level);
            if (this.motorStates.get(normalizedPort) === nextState) {
                return 0;
            }
            this.motorStates.set(normalizedPort, nextState);
            this.lastAction = "".concat(normalizedPort, " \u00B7 ").concat(direction === 1 ? this.label('vorwärts', 'forward') : this.label('rückwärts', 'backward'), " \u00B7 ").concat(level);
            this.updateStatus();
            this.bridge.command('setMotor', { port: normalizedPort, direction: direction, speed: level }).catch(function (error) {
                if (_this.motorStates.get(normalizedPort) === nextState) {
                    _this.motorStates.delete(normalizedPort);
                }
                _this.report(error);
            });
            return 0;
        };
        ApitorRobotBridgeBehaviour.prototype.motorStopAction = function (_name, port) {
            var _this = this;
            var normalizedPort = String(port || '').toUpperCase();
            if (this.motorStates.get(normalizedPort) === 'stopped') {
                return 0;
            }
            this.motorStates.set(normalizedPort, 'stopped');
            this.lastAction = "".concat(normalizedPort, " \u00B7 ").concat(this.label('gestoppt', 'stopped'));
            this.updateStatus();
            this.bridge.command('stopMotor', { port: normalizedPort }).catch(function (error) {
                if (_this.motorStates.get(normalizedPort) === 'stopped') {
                    _this.motorStates.delete(normalizedPort);
                }
                _this.report(error);
            });
            return 0;
        };
        ApitorRobotBridgeBehaviour.prototype.close = function () {
            var _this = this;
            if (this.sensorTimer !== undefined) {
                window.clearInterval(this.sensorTimer);
                this.sensorTimer = undefined;
            }
            this.motorStates.clear();
            this.bridge.stopAll().catch(function (error) { return _this.report(error); });
            this.lastAction = this.label('Alle Motoren gestoppt', 'All motors stopped');
            this.updateStatus();
        };
        ApitorRobotBridgeBehaviour.prototype.getSample = function (state, name, sensor, port, mode, slot) {
            if (sensor !== 'apitor') {
                _super.prototype.getSample.call(this, state, name, sensor, port, mode, slot);
                return;
            }
            var key = String(mode || '');
            if (key === 'infrared1Line' || key === 'infrared2Line' || key === 'infrared1Outside' || key === 'infrared2Outside') {
                var isOutside = key.endsWith('Outside');
                var rawKey = key.startsWith('infrared1') ? 'infrared1' : 'infrared2';
                var isOnLine = Number(this.sensorSnapshot[rawKey]) >= 5;
                state.push(isOutside ? !isOnLine : isOnLine);
                return;
            }
            var value = this.sensorSnapshot[key];
            state.push(value === undefined || value === null ? 0 : Number(value));
        };
        ApitorRobotBridgeBehaviour.prototype.pollSensors = function () {
            var _this = this;
            var update = function () {
                return _this.bridge
                    .sensor('sensorSnapshot')
                    .then(function (response) {
                    _this.sensorSnapshot = response.value || {};
                    _this.updateStatus();
                })
                    .catch(function (error) { return console.warn('Apitor sensor sample delayed:', error); });
            };
            update();
            this.sensorTimer = window.setInterval(update, 200);
        };
        ApitorRobotBridgeBehaviour.prototype.updateStatus = function () {
            var id = 'codeon-apitor-status';
            var panel = document.getElementById(id);
            if (!panel) {
                panel = document.createElement('div');
                panel.id = id;
                Object.assign(panel.style, {
                    position: 'fixed', right: '18px', top: '64px', zIndex: '9999',
                    padding: '10px 14px', borderRadius: '6px', color: '#ffffff',
                    background: 'rgba(0, 52, 74, 0.92)', fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)', pointerEvents: 'none'
                });
                document.body.appendChild(panel);
            }
            var sensorLine = this.sensorSnapshot.colorRaw === undefined
                ? this.label('Sensoren: noch keine Daten', 'Sensors: no data yet')
                : "".concat(this.label('Sensoren', 'Sensors'), ": Farbe ").concat(this.sensorSnapshot.colorRaw, "/").concat(this.sensorSnapshot.colorGroup, " \u00B7 S1 ").concat(this.sensorSnapshot.infrared1, " \u00B7 S2 ").concat(this.sensorSnapshot.infrared2);
            panel.textContent = "\uD83E\uDD16 Apitor ".concat(this.label('Status', 'status'), "\n").concat(this.label('Aktion', 'Action'), ": ").concat(this.lastAction || this.label('Bereit', 'Ready'), "\n").concat(sensorLine);
        };
        ApitorRobotBridgeBehaviour.prototype.label = function (de, en) {
            var language = (document.documentElement.lang || navigator.language || 'de').toLowerCase();
            return language.startsWith('de') ? de : en;
        };
        ApitorRobotBridgeBehaviour.prototype.report = function (error) {
            var normalized = error instanceof Error ? error : new Error(String(error));
            if (this.onError)
                this.onError(normalized);
            else
                console.error(normalized);
        };
        return ApitorRobotBridgeBehaviour;
    }(interpreter_robotSimBehaviour_1.RobotSimBehaviour));
    exports.ApitorRobotBridgeBehaviour = ApitorRobotBridgeBehaviour;
});
