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
define(["require", "exports", "log", "guiState.controller", "jquery", "blockly", "connection.controller", "guiState.model"], function (require, exports, LOG, GUISTATE_C, $, Blockly, CONNECTION_C, GUISTATE) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.runOnBrick = exports.runNative = exports.init = void 0;
    var blocklyWorkspace;
    function resolveBlocklyWorkspace() {
        blocklyWorkspace = blocklyWorkspace || GUISTATE_C.getBlocklyWorkspace();
        return blocklyWorkspace;
    }
    function isConnectedCozmo() {
        var connection = CONNECTION_C.getConnectionInstance();
        return GUISTATE_C.getRobotGroup() === 'cozmo' && !!connection && connection.isRobotConnected();
    }
    function reconnectCozmo() {
        if (GUISTATE_C.getRobotGroup() !== 'cozmo') {
            return;
        }
        var robot = GUISTATE_C.getRobot();
        var connection = CONNECTION_C.getConnectionInstance();
        if (!connection || CONNECTION_C.getConnectionRobotName() !== robot) {
            CONNECTION_C.switchConnection(robot).catch(function (error) { return LOG.error('Cozmo connection restart failed: ' + error); });
            return;
        }
        // Re-initializing an existing Cozmo connection is safe: its bridge client
        // de-duplicates an in-flight attempt. It also clears a SESSION_REPLACED or
        // stale-Wi-Fi stop state, so clicking the disabled triangle is a useful
        // manual recovery action without restarting CodeON.
        connection.init();
    }
    // The Blockly workspace and its controls can be created after this module is
    // loaded. Capture disabled Run clicks at the document boundary so the help is
    // independent of controller initialization and Blockly's event propagation.
    document.addEventListener('mousedown', function (event) {
        var target = event.target;
        var stopButton = target && target.closest ? target.closest('#stopBrick') : null;
        if (stopButton && GUISTATE_C.getRobotGroup() === 'cozmo') {
            event.preventDefault();
            event.stopImmediatePropagation();
            LOG.info('stopBrick from delegated Cozmo button');
            stopProgram();
            return;
        }
        var runButton = target && target.closest ? target.closest('#runOnBrick') : null;
        if (!runButton) {
            return;
        }
        // Blockly recreates its controls when the workspace is refreshed. The
        // direct listener registered below can therefore point at an obsolete
        // Run button. Delegate Cozmo's Run click from the document so the
        // current control always starts the bridge program.
        if (GUISTATE_C.getRobotGroup() === 'cozmo') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!isConnectedCozmo() || !resolveBlocklyWorkspace()) {
                reconnectCozmo();
                showRunNotification();
                return;
            }
            LOG.info('runOnBrick from delegated Cozmo button');
            runOnBrick();
            return;
        }
        if (runButton.classList.contains('disabled')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showRunNotification();
            return;
        }
    }, true);
    function init(workspace) {
        blocklyWorkspace = workspace || GUISTATE_C.getBlocklyWorkspace();
        if (!blocklyWorkspace) {
            return;
        }
        initEvents();
    }
    exports.init = init;
    function initEvents() {
        Blockly.bindEvent_(blocklyWorkspace.robControls.runOnBrick, 'mousedown', null, function (e) {
            var isCozmo = GUISTATE_C.getRobotGroup() === 'cozmo';
            var connectedCozmo = isConnectedCozmo();
            if ((isCozmo && !connectedCozmo) || ($('#runOnBrick').hasClass('disabled') && !connectedCozmo)) {
                reconnectCozmo();
                showRunNotification();
                return false;
            }
            if (!resolveBlocklyWorkspace()) {
                showRunNotification();
                return false;
            }
            LOG.info('runOnBrick from blockly button');
            runOnBrick();
            return false;
        });
        Blockly.bindEvent_(blocklyWorkspace.robControls.stopBrick, 'mousedown', null, function (e) {
            LOG.info('stopBrick from blockly button');
            stopProgram();
            return false;
        });
        Blockly.bindEvent_(blocklyWorkspace.robControls.stopProgram, 'mousedown', null, function (e) {
            LOG.info('stopProgram from blockly button');
            stopProgram();
            return false;
        });
    }
    function showRunNotification() {
        var notificationElement = $('#releaseInfo');
        var notificationElementTitle = notificationElement.children('#releaseInfoTitle');
        var notificationElementDescription = notificationElement.children('#releaseInfoContent');
        var notificationMessage = GUISTATE_C.getRobotGroup() === 'cozmo'
            ? Blockly.Msg.POPUP_RUN_NOTIFICATION_COZMO ||
                'Prepare Cozmo: 1. Switch Cozmo on. 2. Connect this computer to the Wi-Fi shown on Cozmo\'s display; no internet connection is normal. 3. Put Cozmo on a clear surface. 4. Press Start again. The local Cozmo bridge starts automatically with CodeON.'
            : Blockly.Msg.POPUP_RUN_NOTIFICATION;
        notificationElementDescription.html(notificationMessage);
        notificationElementTitle.html(Blockly.Msg.POPUP_ATTENTION);
        var notification = notificationElement.off('notificationFadeInComplete.codeonRunHelp').on('notificationFadeInComplete.codeonRunHelp', function () {
            clearTimeout(notification.data('hideInterval'));
            var id = setTimeout(function () {
                notificationElement.fadeOut(500);
            }, 10000);
            notification.data('hideInterval', id);
        });
        notificationElement.fadeIn(500, function () {
            $(this).trigger('notificationFadeInComplete');
        });
    }
    /**
     * Start the program on brick from the source code editor
     */
    function runNative(sourceCode) {
        var ping = GUISTATE_C.doPing();
        GUISTATE_C.setConnectionState('busy');
        GUISTATE_C.setPing(false);
        LOG.info('run ' + GUISTATE_C.getProgramName() + 'on brick from source code editor');
        CONNECTION_C.getConnectionInstance().runNative(sourceCode);
        GUISTATE_C.setPing(ping);
    }
    exports.runNative = runNative;
    /**
     * Start the program on the brick
     */
    function runOnBrick(opt_program) {
        var ping = GUISTATE.server.ping;
        GUISTATE_C.setConnectionState('busy');
        GUISTATE_C.setPing(false);
        LOG.info('run ' + GUISTATE_C.getProgramName() + 'on brick');
        var xmlProgram;
        var xmlTextProgram;
        if (opt_program) {
            xmlTextProgram = opt_program;
        }
        else {
            xmlProgram = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            xmlTextProgram = Blockly.Xml.domToText(xmlProgram);
        }
        var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
        var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
        var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
        CONNECTION_C.getConnectionInstance().runOnBrick(configName, xmlTextProgram, xmlConfigText);
        GUISTATE_C.setPing(ping);
    }
    exports.runOnBrick = runOnBrick;
    function stopProgram() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                CONNECTION_C.getConnectionInstance().stopProgram();
                return [2 /*return*/];
            });
        });
    }
});
