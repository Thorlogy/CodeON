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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RobotBridgeClient = exports.RobotBridgeError = void 0;
    var RobotBridgeError = /** @class */ (function (_super) {
        __extends(RobotBridgeError, _super);
        function RobotBridgeError(code, message) {
            var _this = _super.call(this, message) || this;
            _this.code = code;
            _this.name = 'RobotBridgeError';
            return _this;
        }
        return RobotBridgeError;
    }(Error));
    exports.RobotBridgeError = RobotBridgeError;
    /** Browser client shared by all adapters implementing Robot Bridge Protocol 1.0. */
    var RobotBridgeClient = /** @class */ (function () {
        function RobotBridgeClient(url, requestTimeoutMs, heartbeatIntervalMs) {
            if (url === void 0) { url = 'ws://127.0.0.1:2223'; }
            if (requestTimeoutMs === void 0) { requestTimeoutMs = 3000; }
            if (heartbeatIntervalMs === void 0) { heartbeatIntervalMs = 400; }
            this.url = url;
            this.requestTimeoutMs = requestTimeoutMs;
            this.heartbeatIntervalMs = heartbeatIntervalMs;
            this.sequence = 0;
            this.pending = new Map();
        }
        RobotBridgeClient.prototype.open = function () {
            var _this = this;
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                return Promise.resolve();
            }
            return new Promise(function (resolve, reject) {
                var socket = new WebSocket(_this.url);
                _this.socket = socket;
                socket.onopen = function () { return resolve(); };
                socket.onerror = function () { return reject(new RobotBridgeError('TRANSPORT_ERROR', 'Robot bridge is not reachable')); };
                socket.onmessage = function (event) { return _this.handleResponse(event.data); };
                socket.onclose = function () { return _this.handleClose(); };
            });
        };
        RobotBridgeClient.prototype.capabilities = function () {
            return this.request('capabilities');
        };
        RobotBridgeClient.prototype.connectRobot = function () {
            // PyCozmo may need up to eight seconds to discover the robot on the
            // first connection. Keep ordinary commands on the short timeout.
            return this.request('connect', {}, 30000);
        };
        RobotBridgeClient.prototype.status = function () {
            return this.request('status');
        };
        RobotBridgeClient.prototype.command = function (command, params) {
            if (params === void 0) { params = {}; }
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.request('command', { command: command, params: params })];
                        case 1:
                            result = _a.sent();
                            if (command === 'drive' || command === 'turn') {
                                this.startHeartbeat();
                            }
                            return [2 /*return*/, result];
                    }
                });
            });
        };
        RobotBridgeClient.prototype.sensor = function (sensor, params) {
            if (params === void 0) { params = {}; }
            return this.request('sensor', { sensor: sensor, params: params });
        };
        RobotBridgeClient.prototype.stopAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.stopHeartbeat();
                            return [4 /*yield*/, this.request('stopAll')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        RobotBridgeClient.prototype.disconnectRobot = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.stopHeartbeat();
                            return [4 /*yield*/, this.request('disconnect')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        RobotBridgeClient.prototype.close = function () {
            this.stopHeartbeat();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            }
            this.socket = undefined;
        };
        RobotBridgeClient.prototype.request = function (type, values, timeoutMs) {
            var _this = this;
            if (values === void 0) { values = {}; }
            if (timeoutMs === void 0) { timeoutMs = this.requestTimeoutMs; }
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                return Promise.reject(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection is closed'));
            }
            var id = 'codeon-' + ++this.sequence;
            var message = Object.assign({ id: id, version: '1.0', type: type }, values);
            return new Promise(function (resolve, reject) {
                var timeout = window.setTimeout(function () {
                    _this.pending.delete(id);
                    reject(new RobotBridgeError('REQUEST_TIMEOUT', 'Robot bridge did not answer in time'));
                }, timeoutMs);
                _this.pending.set(id, { resolve: resolve, reject: reject, timeout: timeout });
                _this.socket.send(JSON.stringify(message));
            });
        };
        RobotBridgeClient.prototype.handleResponse = function (rawMessage) {
            var response;
            try {
                response = JSON.parse(String(rawMessage));
            }
            catch (_) {
                return;
            }
            var pending = this.pending.get(response.id);
            if (!pending) {
                return;
            }
            window.clearTimeout(pending.timeout);
            this.pending.delete(response.id);
            if (response.ok) {
                pending.resolve(response.result);
            }
            else {
                var error = response.error || { code: 'BRIDGE_ERROR', message: 'Robot bridge rejected the request' };
                pending.reject(new RobotBridgeError(error.code, error.message));
            }
        };
        RobotBridgeClient.prototype.startHeartbeat = function () {
            var _this = this;
            if (this.heartbeatTimer !== undefined) {
                return;
            }
            this.heartbeatTimer = window.setInterval(function () {
                _this.request('heartbeat').catch(function () { return _this.stopHeartbeat(); });
            }, this.heartbeatIntervalMs);
        };
        RobotBridgeClient.prototype.stopHeartbeat = function () {
            if (this.heartbeatTimer !== undefined) {
                window.clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = undefined;
            }
        };
        RobotBridgeClient.prototype.handleClose = function () {
            this.stopHeartbeat();
            this.socket = undefined;
            this.pending.forEach(function (pending) {
                window.clearTimeout(pending.timeout);
                pending.reject(new RobotBridgeError('TRANSPORT_CLOSED', 'Robot bridge connection was closed'));
            });
            this.pending.clear();
        };
        return RobotBridgeClient;
    }());
    exports.RobotBridgeClient = RobotBridgeClient;
});
