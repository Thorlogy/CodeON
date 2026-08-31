import * as LOG from 'log';
import * as GUISTATE_C from 'guiState.controller';
import * as $ from 'jquery';
// @ts-ignore
import * as Blockly from 'blockly';
import * as CONNECTION_C from 'connection.controller';
import * as GUISTATE from 'guiState.model';

let blocklyWorkspace;

function resolveBlocklyWorkspace() {
    blocklyWorkspace = blocklyWorkspace || GUISTATE_C.getBlocklyWorkspace();
    return blocklyWorkspace;
}

function isConnectedCozmo(): boolean {
    const connection = CONNECTION_C.getConnectionInstance();
    return GUISTATE_C.getRobotGroup() === 'cozmo' && !!connection && connection.isRobotConnected();
}

function reconnectCozmo(): void {
    if (GUISTATE_C.getRobotGroup() !== 'cozmo') {
        return;
    }
    const robot = GUISTATE_C.getRobot();
    const connection = CONNECTION_C.getConnectionInstance();
    if (!connection || CONNECTION_C.getConnectionRobotName() !== robot) {
        CONNECTION_C.switchConnection(robot).catch((error) => LOG.error('Cozmo connection restart failed: ' + error));
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
document.addEventListener(
    'mousedown',
    function (event) {
        const target = event.target as Element | null;
        const stopButton = target && target.closest ? target.closest('#stopBrick') : null;
        if (stopButton && GUISTATE_C.getRobotGroup() === 'cozmo') {
            event.preventDefault();
            event.stopImmediatePropagation();
            LOG.info('stopBrick from delegated Cozmo button');
            stopProgram();
            return;
        }
        const runButton = target && target.closest ? target.closest('#runOnBrick') : null;
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
    },
    true
);

function init(workspace) {
    blocklyWorkspace = workspace || GUISTATE_C.getBlocklyWorkspace();
    if (!blocklyWorkspace) {
        return;
    }
    initEvents();
}

function initEvents() {
    Blockly.bindEvent_(blocklyWorkspace.robControls.runOnBrick, 'mousedown', null, function (e) {
        const isCozmo = GUISTATE_C.getRobotGroup() === 'cozmo';
        const connectedCozmo = isConnectedCozmo();
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
    const notificationElement = $('#releaseInfo');
    const notificationElementTitle = notificationElement.children('#releaseInfoTitle');
    const notificationElementDescription = notificationElement.children('#releaseInfoContent');
    const notificationMessage =
        GUISTATE_C.getRobotGroup() === 'cozmo'
            ? Blockly.Msg.POPUP_RUN_NOTIFICATION_COZMO ||
              'Prepare Cozmo: 1. Switch Cozmo on. 2. Connect this computer to the Wi-Fi shown on Cozmo\'s display; no internet connection is normal. 3. Put Cozmo on a clear surface. 4. Press Start again. The local Cozmo bridge starts automatically with CodeON.'
            : Blockly.Msg.POPUP_RUN_NOTIFICATION;
    notificationElementDescription.html(notificationMessage);
    notificationElementTitle.html(Blockly.Msg.POPUP_ATTENTION);
    const notification = notificationElement.off('notificationFadeInComplete.codeonRunHelp').on('notificationFadeInComplete.codeonRunHelp', function () {
        clearTimeout(notification.data('hideInterval'));
        const id = setTimeout(function () {
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
    let ping = GUISTATE_C.doPing();
    GUISTATE_C.setConnectionState('busy');
    GUISTATE_C.setPing(false);
    LOG.info('run ' + GUISTATE_C.getProgramName() + 'on brick from source code editor');
    CONNECTION_C.getConnectionInstance().runNative(sourceCode);
    GUISTATE_C.setPing(ping);
}

/**
 * Start the program on the brick
 */
function runOnBrick(opt_program?) {
    let ping = GUISTATE.server.ping;
    GUISTATE_C.setConnectionState('busy');
    GUISTATE_C.setPing(false);
    LOG.info('run ' + GUISTATE_C.getProgramName() + 'on brick');
    let xmlProgram;
    let xmlTextProgram;
    if (opt_program) {
        xmlTextProgram = opt_program;
    } else {
        xmlProgram = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        xmlTextProgram = Blockly.Xml.domToText(xmlProgram);
    }
    let isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
    let configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
    let xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;

    CONNECTION_C.getConnectionInstance().runOnBrick(configName, xmlTextProgram, xmlConfigText);
    GUISTATE_C.setPing(ping);
}

async function stopProgram() {
    CONNECTION_C.getConnectionInstance().stopProgram();
}

export { init, runNative, runOnBrick };
