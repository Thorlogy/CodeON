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
            _this.sensorSnapshot = {};
            _this.lastAction = '';
            _this.lastError = '';
            _this.maxWheelSpeedMmPerSec = maxWheelSpeedMmPerSec;
            _this.trackWidthMm = trackWidthMm;
            _this.updateStatusPanel();
            _this.pollSensors();
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
            if (this.sensorTimer !== undefined)
                window.clearInterval(this.sensorTimer);
            this.send('camera', { enabled: false });
            this.setCameraPrivacyIndicator(false);
            this.stopMotion();
            this.lastAction = this.isGerman() ? 'Programm beendet' : 'Program finished';
            this.updateStatusPanel();
        };
        RobotBridgeBehaviour.prototype.motorOnAction = function (name, port, durationType, duration, speed, time) {
            var normalizedPort = String(port || '').toLowerCase();
            var percent = Math.max(0, Math.min(100, Number(speed) || 0));
            if (normalizedPort === 'h') {
                this.send('setHead', { angle: -0.4 + percent * 0.011 });
                // Position blocks are complete actions: allow Cozmo enough time
                // to reach the requested position before executing the next block.
                return 650;
            }
            if (normalizedPort === 'a') {
                this.send('setLift', { height: 32 + percent * 0.6 });
                return 2200;
            }
            return _super.prototype.motorOnAction.call(this, name, port, durationType, duration, speed, time);
        };
        RobotBridgeBehaviour.prototype.toneAction = function (_name, frequency, duration) {
            this.send('tone', { frequency: frequency, duration: duration });
            return Math.max(0, Number(duration) || 0);
        };
        RobotBridgeBehaviour.prototype.sayTextAction = function (text, speed, _pitch) {
            this.send('speak', { text: String(text), speed: speed });
            return Math.max(500, String(text).length * 75);
        };
        RobotBridgeBehaviour.prototype.ledOnAction = function (_name, _port, color) {
            this.send('setBackpackLight', { color: color });
        };
        RobotBridgeBehaviour.prototype.ledOffAction = function (_name, _port) {
            this.send('setBackpackLight', { color: '#000000' });
        };
        RobotBridgeBehaviour.prototype.lightAction = function (mode, _color, port) {
            if (String(port).toLowerCase() === 'display') {
                this.send('displayFace', { face: String(mode).toUpperCase() });
                return;
            }
            if (String(port).toLowerCase() !== 'camera') {
                _super.prototype.lightAction.call(this, mode, _color, port);
                return;
            }
            var normalizedMode = String(mode).toLowerCase();
            if (normalizedMode === 'track') {
                this.send('trackFace', {});
                this.setCameraPrivacyIndicator(true);
            }
            else {
                var enabled = normalizedMode === 'start' || normalizedMode === 'on';
                this.send('camera', { enabled: enabled });
                this.setCameraPrivacyIndicator(enabled);
            }
        };
        RobotBridgeBehaviour.prototype.getSample = function (state, name, sensor, port, mode, slot) {
            if (sensor !== 'cozmo' && sensor !== 'gyro') {
                _super.prototype.getSample.call(this, state, name, sensor, port, mode, slot);
                return;
            }
            var key = String(mode || '').toLowerCase();
            var face = this.sensorSnapshot.face || {};
            var values = {
                battery: this.sensorSnapshot.battery,
                headangle: this.sensorSnapshot.headAngle,
                liftheight: this.sensorSnapshot.liftHeight,
                accelx: this.sensorSnapshot.accelX,
                accely: this.sensorSnapshot.accelY,
                accelz: this.sensorSnapshot.accelZ,
                posex: this.sensorSnapshot.poseX,
                posey: this.sensorSnapshot.poseY,
                poseheading: this.sensorSnapshot.poseHeading,
                pickedup: !!this.sensorSnapshot.pickedUp,
                moving: !!this.sensorSnapshot.moving,
                oncharger: !!this.sensorSnapshot.onCharger,
                facedetected: !!face.detected,
                facecount: Number(face.count) || 0,
                facex: Number(face.x) || 0,
                facey: Number(face.y) || 0,
                facesize: Number(face.size) || 0,
                faceposition: face.position || 'NONE',
                angle: this.sensorSnapshot.gyroZ,
                rate: this.sensorSnapshot.gyroZ,
            };
            state.push(values[key] !== undefined ? values[key] : 0);
        };
        RobotBridgeBehaviour.prototype.pollSensors = function () {
            var _this = this;
            // Sensor data is informative. A single delayed sample must never stop
            // an otherwise healthy robot program or lock the editor.
            var update = function () {
                return _this.bridge
                    .sensor('snapshot')
                    .then(function (response) {
                    _this.sensorSnapshot = response.value || {};
                    _this.updateStatusPanel();
                })
                    .catch(function (error) { return console.warn('Cozmo sensor sample delayed:', error); });
            };
            update();
            this.sensorTimer = window.setInterval(update, 150);
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
            var german = this.isGerman();
            var labels = {
                drive: german ? 'Fahren' : 'Driving',
                setHead: german ? 'Kopf positionieren' : 'Positioning head',
                setLift: german ? 'Lift positionieren' : 'Positioning lift',
                tone: german ? 'Ton abspielen' : 'Playing tone',
                speak: german ? 'Text sprechen' : 'Speaking text',
                setBackpackLight: german ? 'Statusleuchte setzen' : 'Setting status light',
                camera: params.enabled ? (german ? 'Kamera starten' : 'Starting camera') : german ? 'Kamera stoppen' : 'Stopping camera',
                trackFace: german ? 'Gesicht fortlaufend verfolgen' : 'Tracking face continuously',
                displayFace: german ? 'Gesicht anzeigen' : 'Showing face',
            };
            this.lastAction = labels[command] || command;
            this.lastError = '';
            this.updateStatusPanel();
            this.bridge.command(command, params).catch(function (error) {
                _this.lastError = error instanceof Error ? error.message : String(error);
                _this.updateStatusPanel();
                _this.report(error);
            });
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
        RobotBridgeBehaviour.prototype.setCameraPrivacyIndicator = function (enabled) {
            var _a;
            var id = 'codeon-cozmo-camera-privacy';
            (_a = document.getElementById(id)) === null || _a === void 0 ? void 0 : _a.remove();
            if (!enabled)
                return;
            var indicator = document.createElement('div');
            indicator.id = id;
            indicator.textContent = this.isGerman()
                ? '🔒 Privacy Mode aktiv · Cozmo-Kamera wird nur lokal ausgewertet'
                : '🔒 Privacy Mode active · Cozmo camera is processed locally only';
            Object.assign(indicator.style, {
                position: 'fixed',
                right: '18px',
                top: '18px',
                zIndex: '10000',
                padding: '10px 14px',
                borderRadius: '6px',
                color: '#ffffff',
                background: '#006b73',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                fontSize: '14px',
                fontWeight: '600',
                pointerEvents: 'none',
            });
            document.body.appendChild(indicator);
        };
        RobotBridgeBehaviour.prototype.updateStatusPanel = function () {
            var id = 'codeon-cozmo-status';
            var panel = document.getElementById(id);
            if (!panel) {
                panel = document.createElement('div');
                panel.id = id;
                Object.assign(panel.style, {
                    position: 'fixed',
                    right: '18px',
                    top: '64px',
                    zIndex: '9999',
                    minWidth: '250px',
                    maxWidth: '360px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    color: '#ffffff',
                    background: 'rgba(0, 52, 74, 0.92)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    fontSize: '13px',
                    lineHeight: '1.45',
                    whiteSpace: 'pre-line',
                    pointerEvents: 'none',
                });
                document.body.appendChild(panel);
            }
            var german = this.isGerman();
            var face = this.sensorSnapshot.face || {};
            var camera = this.sensorSnapshot.cameraEnabled
                ? this.sensorSnapshot.faceTracking
                    ? german
                        ? 'aktiv · Gesicht verfolgen'
                        : 'active · tracking face'
                    : german
                        ? 'aktiv'
                        : 'active'
                : german
                    ? 'aus'
                    : 'off';
            var audio = this.sensorSnapshot.audioBusy
                ? german
                    ? 'wird abgespielt'
                    : 'playing'
                : this.sensorSnapshot.audioError
                    ? german
                        ? 'Fehler'
                        : 'error'
                    : german
                        ? 'bereit'
                        : 'ready';
            var head = Number(this.sensorSnapshot.headAngle);
            var lift = Number(this.sensorSnapshot.liftHeight);
            var position = (Number.isFinite(head) ? "".concat(german ? 'Kopf' : 'Head', " ").concat(head.toFixed(2), " rad") : "".concat(german ? 'Kopf' : 'Head', " \u2013")) +
                ' · ' +
                (Number.isFinite(lift) ? "Lift ".concat(lift.toFixed(0), " mm") : 'Lift –');
            var error = this.lastError || this.sensorSnapshot.audioError;
            var cameraFrames = Number(this.sensorSnapshot.cameraFrames) || 0;
            var faceDetections = Number(this.sensorSnapshot.faceDetections) || 0;
            var cameraDetail = " \u00B7 ".concat(cameraFrames, " ").concat(german ? 'Bilder' : 'frames');
            var cameraError = this.sensorSnapshot.cameraError;
            panel.textContent =
                "\uD83E\uDD16 Cozmo ".concat(german ? 'Status' : 'status', "\n").concat(german ? 'Aktion' : 'Action', ": ").concat(this.lastAction || (german ? 'Bereit' : 'Ready'), "\n") +
                    "".concat(german ? 'Kamera' : 'Camera', ": ").concat(camera).concat(cameraDetail, "\n").concat(german ? 'Gesicht' : 'Face', ": ").concat(face.detected
                        ? german
                            ? 'gerade erkannt'
                            : 'detected now'
                        : faceDetections > 0
                            ? german
                                ? "erkannt \u00B7 ".concat(faceDetections, " Treffer")
                                : "detected \u00B7 ".concat(faceDetections, " hits")
                            : german
                                ? 'noch nicht erkannt'
                                : 'not detected yet', "\n") +
                    "".concat(german ? 'Audio' : 'Audio', ": ").concat(audio, "\n").concat(position) +
                    (error || cameraError ? "\n\u26A0 ".concat(error || cameraError) : '');
        };
        RobotBridgeBehaviour.prototype.isGerman = function () {
            var pageLanguage = document.documentElement.lang || '';
            return pageLanguage.toLowerCase().startsWith('de') || navigator.language.toLowerCase().startsWith('de');
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
