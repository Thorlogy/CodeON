define(["require", "exports", "util.roberta", "log", "message", "guiState.controller", "robot.model", "program.controller", "configuration.controller", "webview.controller", "jquery", "blockly", "connection.controller", "jquery-validate"], function (require, exports, UTIL, LOG, MSG, GUISTATE_C, ROBOT, PROGRAM_C, CONFIGURATION_C, WEBVIEW_C, $, Blockly, CONNECTION_C) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.switchRobot = exports.updateFirmware = exports.handleFirmwareConflict = exports.showListModal = exports.showScanModal = exports.showSetApiKeyModal = exports.showSetTokenModal = exports.getPort = exports.setPort = exports.init = void 0;
    var $formSingleModal;
    var robotPort;
    var connectionInstance;
    /**
     * Initialize robot
     */
    function init(robot, extensions) {
        var ready = $.Deferred();
        extend(robot, extensions);
        $.when(ROBOT.setRobot(robot, extensions, function (result) {
            if (result.rc == 'ok') {
                GUISTATE_C.setExtensions(extensions);
                GUISTATE_C.setRobot(robot, result, true);
            }
        })).then(function () {
            initRobotForms();
            ready.resolve();
        });
        return ready.promise();
    }
    exports.init = init;
    /**
     * Set token
     *
     * @param token Token value to be set
     */
    function setToken(token) {
        $formSingleModal.validate();
        if ($formSingleModal.valid()) {
            ROBOT.setToken(token, function (result) {
                if (result.rc === 'ok') {
                    GUISTATE_C.setRobotToken(token);
                    GUISTATE_C.setState(result);
                    // @ts-ignore
                    MSG.displayInformation(result, 'MESSAGE_ROBOT_CONNECTED', result.message, GUISTATE_C.getRobotName());
                    handleFirmwareConflict(result['robot.update'], result['robot.serverVersion']);
                }
                else {
                    if (result.message === 'ORA_TOKEN_SET_ERROR_WRONG_ROBOTTYPE') {
                        $('.modal').modal('hide');
                    }
                }
                UTIL.response(result);
            });
        }
    }
    function setApiKey(apiKey, url) {
        $formSingleModal.validate();
        var checkUrl = function (url) {
            var reg = new RegExp('^txt40\\.local$|^192\\.168(\\.[0-9]{1,3}){2}$');
            return reg.test(url);
        };
        if ($formSingleModal.valid() && checkUrl(url)) {
            ROBOT.setApiKey(apiKey, url, function () {
                GUISTATE_C.setRobotToken(apiKey);
                GUISTATE_C.setRobotUrl(url);
                GUISTATE_C.setRunEnabled(true);
                GUISTATE_C.setConnectionState('wait');
                $('#stopProgram').addClass('disabled');
                $('#head-navi-icon-robot').removeClass('error');
                $('#head-navi-icon-robot').removeClass('busy');
                $('#head-navi-icon-robot').addClass('wait');
                // @ts-ignore
                MSG.displayInformation({ rc: 'ok' }, 'MESSAGE_ROBOT_CONNECTED', '', GUISTATE_C.getRobotName());
                setTimeout(function () {
                    $('.modal').modal('hide');
                }, 100);
            });
        }
    }
    function setPort(port) {
        robotPort = port;
        $('#single-modal-list').modal('hide');
        GUISTATE_C.setRobotPort(port);
    }
    exports.setPort = setPort;
    function getPort() {
        return robotPort;
    }
    exports.getPort = getPort;
    function initRobotForms() {
        $('#iconDisplayRobotState').onWrap('click', function () {
            connectionInstance.showRobotInfo();
        }, 'display robot state');
        $('#wlan-form').removeData('validator');
        $.validator.addMethod('wlanRegex', function (value, element) {
            return this.optional(element) || /^[a-zA-Z0-9$ *\(\)\{\}\[\]><~`\'\\\/|=+!?.,%#+&^@_\-äöüÄÖÜß]+$/gi.test(value);
        }, 'This field contains nonvalid symbols.');
        $('#wlan-form').validate({
            rules: {
                wlanSsid: {
                    required: true,
                    wlanRegex: true,
                },
                wlanPassword: {
                    required: true,
                    wlanRegex: true,
                },
            },
            errorClass: 'form-invalid',
            errorPlacement: function (label, element) {
                label.insertBefore(element.parent());
            },
            messages: {
                wlanSsid: {
                    required: Blockly.Msg['VALIDATION_FIELD_REQUIRED'],
                    wlanRegex: Blockly.Msg['VALIDATION_CONTAINS_SPECIAL_CHARACTERS'],
                },
                wlanPassword: {
                    required: Blockly.Msg['VALIDATION_FIELD_REQUIRED'],
                    wlanRegex: Blockly.Msg['VALIDATION_CONTAINS_SPECIAL_CHARACTERS'],
                },
            },
        });
        $('#setWlanCredentials').onWrap('click', function (e) {
            e.preventDefault();
            $('#wlan-form').validate();
            if ($('#wlan-form').valid()) {
                PROGRAM_C.setSSID(document.getElementById('wlanSsid').value);
                PROGRAM_C.setPassword(document.getElementById('wlanPassword').value);
                $('#menu-wlan').modal('hide');
            }
        }, 'wlan form submitted');
        $('#doUpdateFirmware').onWrap('click', function () {
            $('#set-token').modal('hide');
            $('#confirmUpdateFirmware').modal('hide');
            updateFirmware();
        }, 'update firmware of robot');
        $formSingleModal = $('#single-modal-form');
        $('#connectionsTable').bootstrapTable({
            formatNoMatches: function () {
                return '<div class="lds-ellipsis"></div>';
            },
            columns: [
                {
                    // TODO: translations
                    title: 'Name',
                    field: 'name',
                },
                {
                    visible: false,
                    field: 'id',
                },
            ],
        });
        $('#connectionsTable').onWrap('click-row.bs.table', function (e, row) {
            WEBVIEW_C.jsToAppInterface({
                target: GUISTATE_C.getRobot(),
                type: 'connect',
                robot: row.id,
            });
        }, 'connect to robot');
        $('#show-available-connections').on('hidden.bs.modal', function (e) {
            WEBVIEW_C.jsToAppInterface({
                target: GUISTATE_C.getRobot(),
                type: 'stopScan',
            });
        });
        $('#show-available-connections').onWrap('add', function (event, data) {
            $('#connectionsTable').bootstrapTable('insertRow', {
                index: 999,
                row: {
                    name: data.brickname,
                    id: data.brickid,
                },
            });
        }, 'insert robot connections');
        $('#show-available-connections').onWrap('connect', function (event, data) {
            var result = {};
            result['robotName'] = data.brickname;
            result['robotState'] = 'wait';
            GUISTATE_C.setState(result);
            $('#show-available-connections').modal('hide');
        }, 'connect to a robot');
    }
    function showSetTokenModal(tokenMinLength, tokenMaxLength) {
        UTIL.showSingleModal(function () {
            $('#singleModalInput').attr('type', 'text');
            $('#single-modal h5').text(Blockly.Msg['MENU_CONNECT']);
            $('#single-modal label').text(Blockly.Msg['POPUP_VALUE']);
            $('#singleModalInput').addClass('capitalLetters');
            $('#single-modal a[href]').text(Blockly.Msg['POPUP_STARTUP_HELP']);
            $('#single-modal a[href]').attr('href', 'http://wiki.open-roberta.org');
        }, function () {
            // @ts-ignore
            setToken($('#singleModalInput').val().toUpperCase());
        }, function () {
            $('#singleModalInput').removeClass('capitalLetters');
        }, {
            rules: {
                singleModalInput: {
                    required: true,
                    minlength: tokenMinLength,
                    maxlength: tokenMaxLength,
                },
            },
            errorClass: 'form-invalid',
            errorPlacement: function (label, element) {
                label.insertAfter(element);
            },
            messages: {
                singleModalInput: {
                    required: Blockly.Msg['VALIDATION_FIELD_REQUIRED'],
                    minlength: Blockly.Msg['VALIDATION_TOKEN_LENGTH'],
                    maxlength: Blockly.Msg['VALIDATION_TOKEN_LENGTH'],
                },
            },
        });
    }
    exports.showSetTokenModal = showSetTokenModal;
    // TODO add blocklyMsg
    function showSetApiKeyModal(placeHolderUrl) {
        UTIL.showSingleModal(function () {
            $('.form-label-ip').removeClass('hidden');
            $('.ip-input-group').removeClass('hidden');
            $('#singleModalInput').attr('type', 'text');
            $('#singleModalInputIp').attr('type', 'text');
            $('#single-modal #singleModalInputIp').val(placeHolderUrl);
            $('#single-modal h5').text(Blockly.Msg['MENU_CONNECT']);
            $('#single-modal .form-label').text(Blockly.Msg['POPUP_VALUE']);
            $('#single-modal .form-label-ip').text('URL or IP address');
            $('#single-modal a[href]').text(Blockly.Msg['POPUP_STARTUP_HELP']);
            $('#single-modal a[href]').attr('href', 'http://wiki.open-roberta.org');
        }, function () {
            // @ts-ignore
            setApiKey($('#singleModalInput').val(), $('#singleModalInputIp').val());
        }, function () {
            $('.form-label-ip').addClass('hidden');
            $('.ip-input-group').addClass('hidden');
        }, {
            rules: {
                singleModalInput: {
                    required: true,
                    minlength: 6,
                    maxlength: 6,
                },
                singleModalInputIp: {
                    required: true,
                },
            },
            errorClass: 'form-invalid',
            errorPlacement: function (label, element) {
                label.insertAfter(element);
            },
            messages: {
                singleModalInput: {
                    required: Blockly.Msg['VALIDATION_FIELD_REQUIRED'],
                    minlength: Blockly.Msg['VALIDATION_TOKEN_LENGTH'],
                    maxlength: Blockly.Msg['VALIDATION_TOKEN_LENGTH'],
                },
                singleModalInputIp: {
                    required: 'Wifi: txt40.local, USB: 192.168.7.2, or Ip address of your robot: INFO > Wi-FI > IP',
                },
            },
        });
    }
    exports.showSetApiKeyModal = showSetApiKeyModal;
    function showScanModal() {
        if ($('#show-available-connections').is(':visible')) {
            return;
        }
        $('#connectionsTable').bootstrapTable('removeAll');
        WEBVIEW_C.jsToAppInterface({
            target: GUISTATE_C.getRobot(),
            type: 'startScan',
        });
        $('#show-available-connections').modal('show');
    }
    exports.showScanModal = showScanModal;
    function showListModal() {
        UTIL.showSingleListModal(function () {
            $('#single-modal-list h3').text(Blockly.Msg['MENU_CONNECT']);
            $('#single-modal-list label').text(Blockly.Msg['POPUP_VALUE']);
            $('#single-modal-list a[href]').text(Blockly.Msg['POPUP_STARTUP_HELP']);
            $('#single-modal-list a[href]').attr('href', 'http://wiki.open-roberta.org');
        }, function () {
            // @ts-ignore
            setPort(document.getElementById('singleModalListInput').value);
        }, function () { });
    }
    exports.showListModal = showListModal;
    /**
     * Handle firmware conflict between server and robot
     */
    function handleFirmwareConflict(updateInfo, robotServerVersion) {
        if (updateInfo < 0) {
            LOG.info("The firmware version '" +
                robotServerVersion +
                "' on the server is newer than the firmware version '" +
                GUISTATE_C.getRobotVersion() +
                "' on the robot");
            $('#confirmUpdateFirmware').modal('show');
            return true;
        }
        else if (updateInfo > 0) {
            LOG.info("The firmware version '" +
                robotServerVersion +
                "' on the server is older than the firmware version '" +
                GUISTATE_C.getRobotVersion() +
                "' on the robot");
            // @ts-ignore
            MSG.displayMessage('MESSAGE_FIRMWARE_ERROR', 'POPUP', '');
            return true;
        }
        return false;
    }
    exports.handleFirmwareConflict = handleFirmwareConflict;
    /**
     * Update robot firmware
     */
    function updateFirmware() {
        ROBOT.updateFirmware(function (result) {
            GUISTATE_C.setState(result);
            if (result.rc === 'ok') {
                // @ts-ignore
                MSG.displayMessage('MESSAGE_RESTART_ROBOT', 'POPUP', '');
            }
            else {
                // @ts-ignore
                MSG.displayInformation(result, '', result.message, GUISTATE_C.getRobotFWName());
            }
        });
    }
    exports.updateFirmware = updateFirmware;
    function extend(robot, extensions) {
        var robots = GUISTATE_C.getRobots();
        for (var key in Object.keys(robots)) {
            var r = robots[key];
            if (r.name === robot) {
                for (var _i = 0, _a = Object.entries(r.extensions); _i < _a.length; _i++) {
                    var _b = _a[_i], key_1 = _b[0], value = _b[1];
                    if (value === 'always') {
                        extensions[key_1] = true;
                        break;
                    }
                }
                break;
            }
        }
    }
    /**
     * Switch robot
     */
    function switchRobot(robot, extensions, opt_continue, opt_callback) {
        PROGRAM_C['SSID'] = null;
        PROGRAM_C['password'] = null;
        $('#wlanSsid').text('');
        $('#wlanPassword').text('');
        extend(robot, extensions);
        var further;
        // no need to ask for saving programs if you switch the robot in between a group
        function hasSameRobotGroupAndExtensions(robot, extensions) {
            if (GUISTATE_C.findGroup(robot) != GUISTATE_C.getRobotGroup()) {
                return false;
            }
            var oldExtensions = GUISTATE_C.getExtensions();
            var newExtensionKeys = Object.keys(extensions);
            var oldExtensionKeys = Object.keys(GUISTATE_C.getExtensions());
            if (newExtensionKeys.length !== oldExtensionKeys.length) {
                return false;
            }
            else {
                for (var _i = 0, newExtensionKeys_1 = newExtensionKeys; _i < newExtensionKeys_1.length; _i++) {
                    var key = newExtensionKeys_1[_i];
                    if (extensions[key] !== oldExtensions[key]) {
                        return false;
                    }
                }
            }
            return true;
        }
        var sameRobotGroupAndExtensions = hasSameRobotGroupAndExtensions(robot, extensions);
        if (!opt_continue && sameRobotGroupAndExtensions) {
            further = true;
        }
        else {
            further = opt_continue || false;
            Blockly.clipboardXml_ = null;
        }
        if (further || (GUISTATE_C.isProgramSaved() && GUISTATE_C.isConfigurationSaved())) {
            if (robot === GUISTATE_C.getRobot() && sameRobotGroupAndExtensions) {
                typeof opt_callback === 'function' && opt_callback();
                return;
            }
            ROBOT.setRobot(robot, extensions, function (result) {
                if (result.rc === 'ok') {
                    if ($('.rightMenuButton.rightActive').length > 0) {
                        $('.rightMenuButton.rightActive').clickWrap();
                    }
                    var sameRobotGroupAndExtensions_1 = hasSameRobotGroupAndExtensions(robot, extensions);
                    GUISTATE_C.setExtensions(extensions);
                    GUISTATE_C.setRobot(robot, result);
                    if (!sameRobotGroupAndExtensions_1) {
                        CONFIGURATION_C.resetView();
                        PROGRAM_C.resetView();
                    }
                    CONNECTION_C.switchConnection(robot);
                    CONFIGURATION_C.changeRobotSvg();
                    if (GUISTATE_C.getView() == 'tabConfList') {
                        $('#confList>.bootstrap-table').find('button[name="refresh"]').clickWrap();
                    }
                    if (GUISTATE_C.getView() == 'tabProgList') {
                        $('#progList>.bootstrap-table').find('button[name="refresh"]').clickWrap();
                    }
                    //TODO inform app if one is there
                    //                    WEBVIEW_C.jsToAppInterface({
                    //                        'target' : 'wedo',
                    //                        'op' : {'type''disconnect'
                    //                    });
                    typeof opt_callback === 'function'
                        ? opt_callback()
                        : // @ts-ignore
                            MSG.displayInformation(result, result.message, result.message, GUISTATE_C.getRobotRealName());
                    var deprecatedData = GUISTATE_C.getRobotDeprecatedData(robot);
                    if (deprecatedData !== undefined) {
                        $('#show-message>.modal-dialog').removeClass('modal-sm');
                        $('#show-message').on('hidden.bs.modal', function () {
                            $('#show-message>.modal-dialog').addClass('modal-sm');
                        });
                        MSG.displayPopupMessage(GUISTATE_C.getLanguage(), deprecatedData, 'OK', false);
                    }
                }
                else {
                    // @ts-ignore
                    MSG.displayInformation(result, result.message, result.message, GUISTATE_C.getRobotRealName());
                }
            });
        }
        else {
            $('#show-message-confirm').oneWrap('shown.bs.modal', function (e) {
                $('#confirm').off();
                $('#confirm').onWrap('click', function (e) {
                    e.preventDefault();
                    switchRobot(robot, extensions, true, opt_callback);
                }, 'confirm modal');
                $('#confirmCancel').off();
                $('#confirmCancel').onWrap('click', function (e) {
                    e.preventDefault();
                    $('.modal').modal('hide');
                }, 'cancel modal');
            });
            if (GUISTATE_C.isUserLoggedIn()) {
                // @ts-ignore
                MSG.displayMessage('POPUP_BEFOREUNLOAD_LOGGEDIN', 'POPUP', '', true);
            }
            else {
                // @ts-ignore
                MSG.displayMessage('POPUP_BEFOREUNLOAD', 'POPUP', '', true);
            }
        }
    }
    exports.switchRobot = switchRobot;
});
