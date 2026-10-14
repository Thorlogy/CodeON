import * as LOG from 'log';
import * as UTIL from 'util.roberta';
import * as MSG from 'message';
import * as GUISTATE_C from 'guiState.controller';
import * as Blockly from 'blockly';
import * as CONFIGURATION from 'configuration.model';
import * as CV from 'confVisualization';
import * as SENSOR_MOUNTS from 'robot.sensor.points';
import * as $ from 'jquery';
import 'jquery-validate';

var $formSingleModal;

var bricklyWorkspace;
var confVis;
var listenToBricklyEvents = true;
var seen = false;
var fixedConfigurationWorkspace = false;
var sensorMountEditorOpen = false;
var sensorMountEditorGroup;

var SENSOR_MOUNT_PRESETS = {
    rcx: { front: { x: 25, y: 0 }, back: { x: -30, y: 0 }, left: { x: 0, y: -20 }, right: { x: 0, y: 20 }, center: { x: 0, y: 0 } },
    rcj: { front: { x: 14, y: 0 }, back: { x: -32, y: 0 }, left: { x: 0, y: -18 }, right: { x: 0, y: 18 }, center: { x: 0, y: 0 } },
};

function configuredExternalSensors() {
    var group = String(GUISTATE_C.getRobotGroup() || '').toLowerCase();
    if (group !== 'rcx' && group !== 'rcj') return [];
    var blocks = bricklyWorkspace ? bricklyWorkspace.getAllBlocks(false) : [];
    var sensors = [];
    if (group === 'rcx') {
        var brick = blocks.find(function (block) { return block.type === 'robBrick_RCX-Brick'; });
        if (!brick) return sensors;
        var touchInputs = ['S1', 'S2', 'S3'].filter(function (port) { var item = brick.getInputTargetBlock(port); return item && item.type === 'robBrick_touch'; });
        var lightInputs = ['S1', 'S2', 'S3'].filter(function (port) { var item = brick.getInputTargetBlock(port); return item && item.type === 'robBrick_light'; });
        ['S1', 'S2', 'S3'].forEach(function (port) {
            var child = brick.getInputTargetBlock(port);
            if (!child) return;
            var type = child.type === 'robBrick_touch' ? 'TOUCH' : child.type === 'robBrick_light' ? 'LIGHT' : undefined;
            if (!type) return;
            var inputs = type === 'TOUCH' ? touchInputs : lightInputs;
            var ordinal = inputs.indexOf(port) + 1;
            var y = type === 'TOUCH' && inputs.length > 1 ? (ordinal - (inputs.length + 1) / 2) * 12 : type === 'LIGHT' ? ordinal * 10 - 5 * (inputs.length + 1) : 0;
            sensors.push({ id: port, type: type, label: port + ' · ' + (Blockly.Msg['SENSOR_' + type] || type), fallback: { x: type === 'TOUCH' ? 25 : 15, y: y, theta: 0 } });
        });
        return sensors;
    }
    var rcjType = { robConf_touch: 'TOUCH', robConf_ultrasonic: 'ULTRASONIC', robConf_colour: 'COLOR', robConf_color: 'COLOR', robConf_inductive: 'INDUCTIVE' };
    blocks.forEach(function (block) {
        var type = rcjType[block.type];
        if (!type) return;
        var name = block.getFieldValue('NAME');
        var port = block.getFieldValue('PORT');
        var id = name || port;
        if (id) sensors.push({ id: id, type: type, label: id + ' · ' + (Blockly.Msg['SENSOR_' + type] || type), fallback: type === 'TOUCH' ? { x: -25, y: 0 } : type === 'INDUCTIVE' ? { x: 14, y: 0 } : { x: 9, y: 0, theta: 0 } });
    });
    var ultrasounds = sensors.filter(function (sensor) { return sensor.type === 'ULTRASONIC'; });
    ultrasounds.forEach(function (sensor, index) {
        var count = ultrasounds.length;
        var ordinal = index + 1;
        if (count === 3 && ordinal <= 2) sensor.fallback = { x: 18, y: ordinal === 1 ? -18 : 18, theta: ordinal === 1 ? -Math.PI / 4 : Math.PI / 4 };
        else if (count % 2 === 0) {
            var locations = [{ x: 14, y: -18, theta: -Math.PI / 4 }, { x: 14, y: 18, theta: Math.PI / 4 }, { x: -32, y: -18, theta: -3 * Math.PI / 4 }, { x: -32, y: 18, theta: 3 * Math.PI / 4 }];
            sensor.fallback = locations[(ordinal - 1) % locations.length];
        } else sensor.fallback = { x: 14, y: 0, theta: 0 };
    });
    var colors = sensors.filter(function (sensor) { return sensor.type === 'COLOR'; });
    colors.forEach(function (sensor, index) { sensor.fallback = { x: 9, y: (index + 1) * 10 - 5 * (colors.length + 1), theta: 0 }; });
    return sensors;
}

function sensorMountSide(group, mount) {
    var positions = SENSOR_MOUNT_PRESETS[group];
    var selected = 'center';
    var best = Number.POSITIVE_INFINITY;
    Object.keys(positions).forEach(function (side) {
        var point = positions[side];
        var distance = Math.pow(point.x - mount.x, 2) + Math.pow(point.y - mount.y, 2);
        if (distance < best) { best = distance; selected = side; }
    });
    return selected;
}

function sensorMountText(german, english) {
    return String(GUISTATE_C.getLanguage() || '').toLowerCase() === 'de' ? german : english;
}

function escapeSensorAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSensorMountEditor() {
    var $editor = $('#sensorMountEditor');
    if (!$editor.length) return;
    var group = String(GUISTATE_C.getRobotGroup() || '').toLowerCase();
    if (group !== 'rcx' && group !== 'rcj') { sensorMountEditorOpen = false; $editor.hide().empty(); return; }
    var sensors = configuredExternalSensors();
    var html = '<div class="d-flex align-items-center justify-content-between mb-2"><strong>' + sensorMountText('Sensoren in der Simulation', 'Sensors in the simulation') + '</strong>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" id="sensorMountToggle">' + sensorMountText('Schließen', 'Close') + '</button></div>' +
        '<div class="small text-muted mb-2">' + sensorMountText('Montage gilt nur in diesem Browser und wird beim nächsten SIM-Start übernommen.', 'Mounting is stored only in this browser and applied on the next SIM start.') + ' ' +
        sensorMountText('Die Ausrichtung ist horizontal; nach oben/unten gerichtete Sensoren werden nicht simuliert.', 'Orientation is horizontal only; sensors facing up or down are not simulated.') + '</div>';
    if (!sensors.length) html += '<div class="small">' + sensorMountText('In der aktuellen Konfiguration sind keine unterstützten externen Sensoren vorhanden.', 'No supported external sensors are configured.') + '</div>';
    sensors.forEach(function (sensor, index) {
        var fallback = sensor.fallback || { x: 0, y: 0, theta: 0 };
        var mount = SENSOR_MOUNTS.getSensorMount(group, sensor.id, sensor.type, fallback);
        var side = sensorMountSide(group, mount);
        var sides = sensor.type === 'TOUCH' ? ['front', 'back'] : ['front', 'left', 'right', 'back', 'center'];
        html += '<div class="border-top pt-2 mt-2 sensor-mount-row"><label class="form-label small mb-1" for="sensorMount-' + index + '">' +
            $('<div>').text(sensor.label).html() + '</label><select class="form-select form-select-sm sensor-mount-side" id="sensorMount-' + index + '" ' +
            'data-sensor-id="' + escapeSensorAttribute(sensor.id) + '" data-sensor-type="' + escapeSensorAttribute(sensor.type) + '" data-default-x="' + fallback.x + '" data-default-y="' + fallback.y + '">';
        sides.forEach(function (position) {
            var label = {
                front: sensorMountText('Vorne', 'Front'), left: sensorMountText('Links', 'Left'), right: sensorMountText('Rechts', 'Right'),
                back: sensorMountText('Hinten', 'Back'), center: sensorMountText('Mitte', 'Center'),
            }[position];
            html += '<option value="' + position + '" ' + (position === side ? 'selected' : '') + '>' + label + '</option>';
        });
        html += '</select>';
        html += '<button type="button" class="btn btn-sm btn-link px-0 sensor-mount-reset" data-sensor-id="' + escapeSensorAttribute(sensor.id) +
            '" data-sensor-type="' + escapeSensorAttribute(sensor.type) + '">' + sensorMountText('Standardposition', 'Default position') + '</button>';
        if (sensor.type === 'ULTRASONIC') {
            var directions = [
                { value: 0, label: sensorMountText('Vorne', 'Front') }, { value: Math.PI / 4, label: sensorMountText('Vorne rechts', 'Front right') }, { value: Math.PI / 2, label: sensorMountText('Rechts', 'Right') },
                { value: 3 * Math.PI / 4, label: sensorMountText('Hinten rechts', 'Back right') }, { value: Math.PI, label: sensorMountText('Hinten', 'Back') },
                { value: -3 * Math.PI / 4, label: sensorMountText('Hinten links', 'Back left') }, { value: -Math.PI / 2, label: sensorMountText('Links', 'Left') }, { value: -Math.PI / 4, label: sensorMountText('Vorne links', 'Front left') },
            ];
            var angle = Number.isFinite(mount.theta) ? mount.theta : 0;
            var direction = directions.reduce(function (bestOption, option) {
                return Math.abs(option.value - angle) < Math.abs(bestOption.value - angle) ? option : bestOption;
            }, directions[0]);
            html += '<label class="form-label small mb-1 mt-2" for="sensorDirection-' + index + '">Ausrichtung</label>' +
                '<select class="form-select form-select-sm sensor-mount-direction" id="sensorDirection-' + index + '" data-sensor-id="' +
                escapeSensorAttribute(sensor.id) + '" data-sensor-type="' + escapeSensorAttribute(sensor.type) + '" data-default-x="' + fallback.x + '" data-default-y="' + fallback.y + '">';
            directions.forEach(function (option) {
                html += '<option value="' + option.value + '" ' + (option === direction ? 'selected' : '') + '>' + option.label + '</option>';
            });
            html += '</select>';
        }
        html += '</div>';
    });
    $editor.html(html).toggle(sensorMountEditorOpen);
    $editor.closest('#configuration').css('position', 'relative');
}

function saveSensorMountControl(control) {
    var group = String(GUISTATE_C.getRobotGroup() || '').toLowerCase();
    var id = control.getAttribute('data-sensor-id');
    var type = control.getAttribute('data-sensor-type');
    var row = control.closest('.sensor-mount-row');
    var sideSelect = row.querySelector('.sensor-mount-side');
    var directionSelect = row.querySelector('.sensor-mount-direction');
    var side = sideSelect ? sideSelect.value : 'center';
    var fallback = { x: Number(control.getAttribute('data-default-x')), y: Number(control.getAttribute('data-default-y')) };
    var current = SENSOR_MOUNTS.getSensorMount(group, id, type, fallback);
    var point = SENSOR_MOUNT_PRESETS[group][side];
    var mount = { x: point.x, y: point.y };
    if (side === 'front' || side === 'back') mount.y = Math.max(-20, Math.min(20, current.y));
    if (side === 'left' || side === 'right') mount.x = Math.max(-30, Math.min(25, current.x));
    if (type === 'ULTRASONIC') mount.theta = directionSelect ? Number(directionSelect.value) : 0;
    SENSOR_MOUNTS.setSensorMount(group, id, type, mount);
}

function init() {
    initView();
    initEvents();
    initConfigurationForms();
    initConfigurationEnvironment();
}

/**
 * Inject Brickly with initial toolbox
 *
 * @param {response}
 *            toolbox
 */
function initView() {
    fixedConfigurationWorkspace = GUISTATE_C.getRobotGroup() === 'cozmo';
    // Cozmo's hardware is fixed. Passing its deliberately empty toolbox to
    // Blockly aborts the first robot initialization in some Blockly builds.
    // A workspace without a toolbox still supports the read-only overview and
    // the fixed configuration XML used by validators.
    var toolbox = GUISTATE_C.getRobotGroup() === 'cozmo' ? null : GUISTATE_C.getConfigurationToolbox();
    bricklyWorkspace = Blockly.inject(document.getElementById('bricklyDiv'), {
        path: '/blockly/',
        toolbox: toolbox,
        trashcan: true,
        scrollbars: true,
        media: '../blockly/media/',
        zoom: {
            controls: true,
            wheel: false,
            startScale: 1.0,
            maxScale: 4,
            minScale: 0.25,
            scaleSpeed: 1.1,
        },
        checkInTask: ['-Brick', 'robConf'],
        variableDeclaration: true,
        robControls: true,
        theme: GUISTATE_C.getTheme(),
    });
    bricklyWorkspace.setDevice({
        group: GUISTATE_C.getRobotGroup(),
        robot: GUISTATE_C.getRobot(),
    });
    // Configurations can't be executed. A fixed configuration without a
    // toolbox may not create Blockly's optional robot-control buttons.
    if (bricklyWorkspace.robControls && bricklyWorkspace.robControls.runOnBrick) {
        bricklyWorkspace.robControls.runOnBrick.setAttribute('style', 'display : none');
    }
    GUISTATE_C.setBricklyWorkspace(bricklyWorkspace);
    if (bricklyWorkspace.robControls) {
        bricklyWorkspace.robControls.disable('saveProgram');
    }
}

function initEvents() {
    $('#tabConfiguration').onWrap('show.bs.tab', function (e) {
        GUISTATE_C.setView('tabConfiguration');
    });

    $('#tabConfiguration').onWrap(
        'shown.bs.tab',
        function (e) {
            bricklyWorkspace.markFocused();
            if (GUISTATE_C.isConfigurationUsed()) {
                bricklyWorkspace.setVisible(true);
            } else {
                bricklyWorkspace.setVisible(false);
            }
            $(window).resize();
            UTIL.clearAnnotations(bricklyWorkspace);
            if (GUISTATE_C.confAnnos !== undefined) {
                UTIL.annotateBlocks(bricklyWorkspace, GUISTATE_C.confAnnos);
                delete GUISTATE_C.confAnnos;
            }
            confVis && confVis.refresh();
            renderSensorMountButton();
        },
        'tabConfiguration clicked'
    );

    $('#tabConfiguration').onWrap('hidden.bs.tab', function (e) {
        var dom = confVis ? confVis.getXml() : Blockly.Xml.workspaceToDom(bricklyWorkspace);
        var xml = Blockly.Xml.domToText(dom);
        GUISTATE_C.setConfigurationXML(xml);
        bricklyWorkspace.setVisible(false);
    });

    $(document).off('.sensorMountEditor');
    $(document).on('click.sensorMountEditor', '#sensorMountOpen', function () {
        sensorMountEditorOpen = true;
        renderSensorMountEditor();
    });
    $(document).on('click.sensorMountEditor', '#sensorMountToggle', function () {
        sensorMountEditorOpen = false;
        $('#sensorMountEditor').hide();
    });
    $(document).on('click.sensorMountEditor', '.sensor-mount-reset', function () {
        SENSOR_MOUNTS.removeSensorMount(GUISTATE_C.getRobotGroup(), this.getAttribute('data-sensor-id'), this.getAttribute('data-sensor-type'));
        renderSensorMountEditor();
    });
    $(document).on('change.sensorMountEditor', '.sensor-mount-side, .sensor-mount-direction', function () {
        saveSensorMountControl(this);
    });

    initWorkspaceEvents();
}

function initWorkspaceEvents() {
    if (bricklyWorkspace.robControls && bricklyWorkspace.robControls.saveProgram) {
        Blockly.bindEvent_(bricklyWorkspace.robControls.saveProgram, 'mousedown', null, function (e) {
            LOG.info('saveConfiguration from brickly button');
            saveToServer();
        });
    }

    bricklyWorkspace.addChangeListener(function (event) {
        if (listenToBricklyEvents && event.type != Blockly.Events.UI && GUISTATE_C.isConfigurationSaved()) {
            if (GUISTATE_C.isConfigurationStandard()) {
                GUISTATE_C.setConfigurationName('');
            }
            GUISTATE_C.setConfigurationSaved(false);
            GUISTATE_C.setProgramSaved(false);
        }
        if (event.type === Blockly.Events.DELETE) {
            if (bricklyWorkspace.getAllBlocks().length === 0) {
                newConfiguration(true);
            }
        }
        renderSensorMountButton();
        if ($('#sensorMountEditor').is(':visible')) renderSensorMountEditor();
    });
    renderSensorMountButton();
}

function renderSensorMountButton() {
    var group = String(GUISTATE_C.getRobotGroup() || '').toLowerCase();
    var $button = $('#sensorMountOpen');
    if (sensorMountEditorGroup !== group) {
        sensorMountEditorGroup = group;
        sensorMountEditorOpen = false;
        $('#sensorMountEditor').hide().empty();
    }
    $button.text(sensorMountText('Sensoren platzieren', 'Place sensors'));
    $button.toggle(group === 'rcx' || group === 'rcj');
}

function initConfigurationForms() {
    $formSingleModal = $('#single-modal-form');
}

/**
 * Save configuration to server
 */
function saveToServer() {
    $('.modal').modal('hide'); // close all opened popups
    if (GUISTATE_C.isConfigurationStandard() || GUISTATE_C.isConfigurationAnonymous()) {
        LOG.error('saveToServer may only be called with an explicit config name');
        return;
    }
    var dom = confVis ? confVis.getXml() : Blockly.Xml.workspaceToDom(bricklyWorkspace);
    var xmlText = Blockly.Xml.domToText(dom);
    CONFIGURATION.saveConfigurationToServer(GUISTATE_C.getConfigurationName(), xmlText, function (result) {
        if (result.rc === 'ok') {
            GUISTATE_C.setConfigurationSaved(true);
            LOG.info('save brick configuration ' + GUISTATE_C.getConfigurationName());
        }
        MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_CONFIGURATION', result.message, GUISTATE_C.getConfigurationName());
    });
}

/**
 * Save configuration with new name to server
 */
function saveAsToServer() {
    $formSingleModal.validate();
    if ($formSingleModal.valid()) {
        $('.modal').modal('hide'); // close all opened popups
        var confName = $('#singleModalInput').val().trim();
        if (GUISTATE_C.getConfigurationStandardName() === confName) {
            LOG.error('saveAsToServer may NOT use the config standard name');
            return;
        }
        var dom = confVis ? confVis.getXml() : Blockly.Xml.workspaceToDom(bricklyWorkspace);
        var xmlText = Blockly.Xml.domToText(dom);
        CONFIGURATION.saveAsConfigurationToServer(confName, xmlText, function (result) {
            if (result.rc === 'ok') {
                result.name = confName;
                GUISTATE_C.setConfiguration(result);
                GUISTATE_C.setProgramSaved(false);
                LOG.info('save brick configuration ' + GUISTATE_C.getConfigurationName());
                MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_CONFIGURATION_AS', result.message, GUISTATE_C.getConfigurationName());
            } else if (result.cause == 'ORA_CONFIGURATION_SAVE_AS_ERROR_CONFIGURATION_EXISTS') {
                //Replace popup window
                var modalMessage =
                    Blockly.Msg.POPUP_BACKGROUND_REPLACE_CONFIGURATION ||
                    'A configuration with the same name already exists! <br> Would you like to replace it?';
                $('#show-message-confirm').onWrap('shown.bs.modal', function (e) {
                    $('#confirm').off();
                    $('#confirm').onWrap(
                        'click',
                        function (e) {
                            e.preventDefault;
                            CONFIGURATION.saveConfigurationToServer(confName, xmlText, function (result) {
                                if (result.rc == 'ok') {
                                    result.name = confName;
                                    GUISTATE_C.setConfiguration(result);
                                    GUISTATE_C.setProgramSaved(false);
                                    LOG.info('saved configuration' + GUISTATE_C.getConfigurationName() + ' as' + confName + ' and overwrote old content');
                                    MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_CONFIGURATION_AS', result.message, GUISTATE_C.getConfigurationName());
                                } else {
                                    LOG.info('failed to overwrite ' + confName);
                                    MSG.displayMessage(result.message, 'POPUP', '');
                                }
                            });
                        },
                        'confirm modal'
                    );
                    $('#confirmCancel').off();
                    $('#confirmCancel').onWrap(
                        'click',
                        function (e) {
                            e.preventDefault();
                            $('.modal').modal('hide');
                        },
                        'cancel modal'
                    );
                });
                MSG.displayPopupMessage(
                    'ORA_CONFIGURATION_SAVE_AS_ERROR_CONFIGURATION_EXISTS',
                    modalMessage,
                    Blockly.Msg.POPUP_REPLACE,
                    Blockly.Msg.POPUP_CANCEL
                );
            }
        });
    }
}

/**
 * Load the configuration that was selected in configurations list
 */
function loadFromListing(conf) {
    LOG.info('loadFromList ' + conf[0]);
    CONFIGURATION.loadConfigurationFromListing(conf[0], conf[1], function (result) {
        if (result.rc === 'ok') {
            result.name = conf[0];
            $('#tabConfiguration').oneWrap('shown.bs.tab', function () {
                showConfiguration(result);
            });
            $('#tabConfiguration').tabWrapShow();
        }
        MSG.displayInformation(result, '', result.message);
    });
}

function initConfigurationEnvironment() {
    var conf = GUISTATE_C.getConfigurationConf();
    configurationToBricklyWorkspace(conf);
    if (isVisible()) {
        if ($(window).width() < 768) {
            x = $(window).width() / 50;
            y = 25;
        } else {
            x = $(window).width() / 5;
            y = 50;
        }
        var blocks = bricklyWorkspace.getTopBlocks(true);
        for (var i = 0; i < blocks.length; i++) {
            var coord = Blockly.getSvgXY_(blocks[i].svgGroup_, bricklyWorkspace);
            var coordBlock = blocks[i].getRelativeToSurfaceXY();
            blocks[i].moveBy(coordBlock.x - coord.x + x, coordBlock.y - coord.y + y);
        }
        seen = true;
    } else {
        seen = false;
        bricklyWorkspace.setVisible(false);
    }
    var dom = confVis ? confVis.getXml() : Blockly.Xml.workspaceToDom(bricklyWorkspace);
    var xml = Blockly.Xml.domToText(dom);
    GUISTATE_C.setConfigurationXML(xml);
}

function showSaveAsModal() {
    var regexString = new RegExp('^(?!\\b' + GUISTATE_C.getConfigurationStandardName() + '\\b)([a-zA-Z_öäüÖÄÜß$€][a-zA-Z0-9_öäüÖÄÜß$€]*)$');
    $.validator.addMethod(
        'regex',
        function (value, element, regexp) {
            value = value.trim();
            return value.match(regexp);
        },
        'No special Characters allowed here. Use only upper and lowercase letters (A through Z; a through z) and numbers.'
    );

    UTIL.showSingleModal(
        function () {
            $('#singleModalInput').attr('type', 'text');
            $('#single-modal h5').text(Blockly.Msg['MENU_SAVE_AS']);
            $('#single-modal label').text(Blockly.Msg['POPUP_NAME']);
        },
        saveAsToServer,
        function () {},
        {
            rules: {
                singleModalInput: {
                    required: true,
                    regex: regexString,
                },
            },
            errorClass: 'form-invalid',
            errorPlacement: function (label, element) {
                label.insertAfter(element);
            },
            messages: {
                singleModalInput: {
                    required: jQuery.validator.format(Blockly.Msg['VALIDATION_FIELD_REQUIRED']),
                    regex: jQuery.validator.format(Blockly.Msg['MESSAGE_INVALID_CONF_NAME']),
                },
            },
        }
    );
}

/**
 * New configuration
 */
function newConfiguration(opt_further) {
    var further = opt_further || false;
    if (further || GUISTATE_C.isConfigurationSaved()) {
        var result = {};
        result.name = GUISTATE_C.getRobotGroup().toUpperCase() + 'basis';
        result.lastChanged = '';
        GUISTATE_C.setConfiguration(result);
        initConfigurationEnvironment();
    } else {
        $('#show-message-confirm').oneWrap('shown.bs.modal', function (e) {
            $('#confirm').off();
            $('#confirm').onWrap('click', function (e) {
                e.preventDefault();
                newConfiguration(true);
            });
            $('#confirmCancel').off();
            $('#confirmCancel').onWrap('click', function (e) {
                e.preventDefault();
                $('.modal').modal('hide');
            });
        });
        if (GUISTATE_C.isUserLoggedIn()) {
            MSG.displayMessage('POPUP_BEFOREUNLOAD_LOGGEDIN', 'POPUP', '', true);
        } else {
            MSG.displayMessage('POPUP_BEFOREUNLOAD', 'POPUP', '', true);
        }
    }
}

/**
 * Show configuration
 *
 * @param {load}
 *            load configuration
 * @param {data}
 *            data of server call
 */
function showConfiguration(result) {
    if (result.rc == 'ok') {
        configurationToBricklyWorkspace(result.confXML);
        GUISTATE_C.setConfiguration(result);
        LOG.info('show configuration ' + GUISTATE_C.getConfigurationName());
    }
}

function getBricklyWorkspace() {
    return bricklyWorkspace;
}

function reloadConf(opt_result) {
    var conf;
    if (opt_result) {
        conf = opt_result.confXML;
    } else {
        conf = GUISTATE_C.getConfigurationXML();
    }
    if (!seen) {
        configurationToBricklyWorkspace(conf);
        var x, y;
        if ($(window).width() < 768) {
            x = $(window).width() / 50;
            y = 25;
        } else {
            x = $(window).width() / 5;
            y = 50;
        }
        var blocks = bricklyWorkspace.getTopBlocks(true);
        for (var i = 0; i < blocks.length; i++) {
            var coord = Blockly.getSvgXY_(blocks[i].svgGroup_, bricklyWorkspace);
            var coordBlock = blocks[i].getRelativeToSurfaceXY();
            blocks[i].moveBy(coordBlock.x - coord.x + x, coordBlock.y - coord.y + y);
        }
    } else {
        configurationToBricklyWorkspace(conf);
    }
}

function reloadView() {
    var dom = confVis ? confVis.getXml() : Blockly.Xml.workspaceToDom(bricklyWorkspace);
    var xml = Blockly.Xml.domToText(dom);
    configurationToBricklyWorkspace(xml);
    var toolbox = GUISTATE_C.getConfigurationToolbox();
    if (!fixedConfigurationWorkspace) bricklyWorkspace.updateToolbox(toolbox);
}

function changeRobotSvg() {
    if (CV.CircuitVisualization.isRobotVisualized(GUISTATE_C.getRobotGroup() + '_' + GUISTATE_C.getRobot())) {
        bricklyWorkspace.setDevice({
            group: GUISTATE_C.getRobotGroup(),
            robot: GUISTATE_C.getRobot(),
        });
        confVis.resetRobot();
    }
}

function resetView() {
    if (bricklyWorkspace) {
        var fixedConfiguration = GUISTATE_C.getRobotGroup() === 'cozmo';
        var toolbox = fixedConfiguration ? null : GUISTATE_C.getConfigurationToolbox();
        var toolboxTree = Blockly.Options.parseToolboxTree(toolbox);
        var hasCategories = !!(toolboxTree && toolboxTree.getElementsByTagName('category').length);
        // Blockly cannot change between absent, flat and categorized toolboxes.
        // This is a rendering constraint, not a robot configuration mode: Apitor
        // remains user-configurable even though its toolbox has no categories.
        if (
            fixedConfigurationWorkspace !== fixedConfiguration ||
            !!bricklyWorkspace.options.languageTree !== !!toolboxTree ||
            bricklyWorkspace.options.hasCategories !== hasCategories
        ) {
            resetConfVisIfAvailable();
            bricklyWorkspace.dispose();
            initView();
            initWorkspaceEvents();
        }
        bricklyWorkspace.setDevice({
            group: GUISTATE_C.getRobotGroup(),
            robot: GUISTATE_C.getRobot(),
        });
        initConfigurationEnvironment();
        if (!fixedConfigurationWorkspace) bricklyWorkspace.updateToolbox(toolbox);
    }
}

function isVisible() {
    return GUISTATE_C.getView() == 'tabConfiguration';
}

function resetConfVisIfAvailable() {
    if (confVis) {
        confVis.dispose();
        confVis = null;
    }
}

function configurationToBricklyWorkspace(xml) {
    if (GUISTATE_C.getRobotGroup() === 'cozmo') {
        // Cozmo has a fixed built-in configuration and therefore legitimately
        // has no configurable Blockly XML. Its server-side block_set describes
        // that fixed hardware but is not a Blockly workspace document. The
        // read-only overview therefore uses a valid empty CodeON block set.
        xml = '<block_set xmlns="http://de.fhg.iais.roberta.blockly" robottype="cozmo" xmlversion="3.1"></block_set>';
    }
    // removing changelistener in blockly doesn't work, so no other way
    listenToBricklyEvents = false;
    bricklyWorkspace.clear();
    Blockly.svgResize(bricklyWorkspace);
    var dom = Blockly.Xml.textToDom(xml, bricklyWorkspace);
    resetConfVisIfAvailable();
    if (CV.CircuitVisualization.isRobotVisualized(GUISTATE_C.getRobotGroup(), GUISTATE_C.getRobot())) {
        confVis = CV.CircuitVisualization.domToWorkspace(dom, bricklyWorkspace);
    } else {
        Blockly.Xml.domToWorkspace(dom, bricklyWorkspace);
    }
    bricklyWorkspace.setVersion(dom.getAttribute('xmlversion'));
    var name;
    var configName = GUISTATE_C.getConfigurationName() == undefined ? '' : GUISTATE_C.getConfigurationName();
    if (xml == GUISTATE_C.getConfigurationConf()) {
        name = GUISTATE_C.getRobotGroup().toUpperCase() + 'basis';
    } else {
        name = configName;
    }
    GUISTATE_C.setConfigurationName(name);
    GUISTATE_C.setConfigurationSaved(true);
    $('#tabConfigurationName').html(name);
    setTimeout(function () {
        listenToBricklyEvents = true;
    }, 500);
    if (isVisible()) {
        seen = true;
    } else {
        seen = false;
    }
    if (GUISTATE_C.isConfigurationUsed()) {
        bricklyWorkspace.setVisible(true);
    } else {
        bricklyWorkspace.setVisible(false);
    }
}
export {
    init,
    initConfigurationForms,
    saveToServer,
    saveAsToServer,
    loadFromListing,
    initConfigurationEnvironment,
    showSaveAsModal,
    newConfiguration,
    showConfiguration,
    getBricklyWorkspace,
    reloadConf,
    reloadView,
    changeRobotSvg,
    resetView,
    configurationToBricklyWorkspace,
};
