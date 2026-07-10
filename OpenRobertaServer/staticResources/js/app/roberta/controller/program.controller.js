define(["require", "exports", "message", "log", "util.roberta", "guiState.controller", "robot.controller", "nn.controller", "program.model", "user.model", "configuration.controller", "blockly", "jquery", "aceEditor", "jquery-validate"], function (require, exports, MSG, LOG, UTIL, GUISTATE_C, ROBOT_C, NN_C, PROGRAM, USER, CONFIGURATION_C, Blockly, $, ACE_EDITOR) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.programToBlocklyWorkspace = exports.loadExternalToolbox = exports.loadToolbox = exports.resetView = exports.reloadView = exports.reloadProgram = exports.getBlocklyWorkspace = exports.exportAllXml = exports.exportXml = exports.linkProgram = exports.newProgram = exports.initProgramEnvironment = exports.showSaveAsModal = exports.initProgramForms = exports.loadFromGallery = exports.saveToServer = exports.init = exports.getPassword = exports.setPassword = exports.getSSID = exports.setSSID = void 0;
    var $formSingleModal;
    var blocklyWorkspace;
    var listenToBlocklyEvents = true;
    var seen = true;
    var _SSID = '';
    var _password = '';
    function setSSID(SSID) {
        _SSID = SSID;
    }
    exports.setSSID = setSSID;
    function getSSID() {
        return _SSID;
    }
    exports.getSSID = getSSID;
    function setPassword(password) {
        _password = password;
    }
    exports.setPassword = setPassword;
    function getPassword() {
        return _password;
    }
    exports.getPassword = getPassword;
    /**
     * Inject Blockly with initial toolbox
     */
    function init() {
        initView();
        initProgramEnvironment();
        initEvents();
        initProgramForms();
    }
    exports.init = init;
    function initView() {
        var toolbox = GUISTATE_C.getProgramToolbox();
        var serverTheme = GUISTATE_C.getTheme();
        var blocklyTheme;
        var activeBlockly = (typeof window !== 'undefined' && window.Blockly && window.Blockly.Theme) ? window.Blockly : Blockly;
        if (serverTheme && serverTheme.category) {
            var catMap = {
                "TOOLBOX_ACTION": "CAT_ACTION_RGB", "TOOLBOX_SENSOR": "CAT_SENSOR_RGB", "TOOLBOX_CONTROL": "CAT_CONTROL_RGB", "TOOLBOX_LOGIC": "CAT_LOGIC_RGB", "TOOLBOX_MATH": "CAT_MATH_RGB", "TOOLBOX_TEXT": "CAT_TEXT_RGB", "TOOLBOX_LIST": "CAT_LIST_RGB", "TOOLBOX_COLOUR": "CAT_COLOUR_RGB", "TOOLBOX_VARIABLE": "CAT_VARIABLE_RGB", "TOOLBOX_PROCEDURE": "CAT_PROCEDURE_RGB", "TOOLBOX_COMMUNICATION": "CAT_COMMUNICATION_RGB", "TOOLBOX_IMAGE": "CAT_IMAGE_RGB", "TOOLBOX_DAEMON": "CAT_DAEMON_RGB",
                "TOOLBOX_DRIVE": "CAT_ACTION_RGB", "TOOLBOX_MOVE": "CAT_ACTION_RGB", "TOOLBOX_DISPLAY": "CAT_ACTION_RGB", "TOOLBOX_SOUND": "CAT_ACTION_RGB", "TOOLBOX_LIGHT": "CAT_ACTION_RGB", "TOOLBOX_PIN": "CAT_ACTION_RGB", "TOOLBOX_WAIT": "CAT_CONTROL_RGB", "TOOLBOX_DECISION": "CAT_CONTROL_RGB", "TOOLBOX_LOOP": "CAT_CONTROL_RGB"
            };
            for (var key in catMap) {
                var themeKey = catMap[key];
                if (serverTheme.category[themeKey]) {
                    var blocklyColorKey = "CAT_" + key.toUpperCase().replace("TOOLBOX_", "") + "_RGB";
                    activeBlockly[blocklyColorKey] = serverTheme.category[themeKey];
                }
            }
        }
        if (serverTheme && activeBlockly.Theme) {
            var categoryStyles = {};
            var blockStyles = {};
            // Map OpenRoberta categories to Blockly V10 categoryStyles
            if (serverTheme.category) {
                var catMap = {
                    "TOOLBOX_ACTION": "CAT_ACTION_RGB",
                    "TOOLBOX_SENSOR": "CAT_SENSOR_RGB",
                    "TOOLBOX_CONTROL": "CAT_CONTROL_RGB",
                    "TOOLBOX_LOGIC": "CAT_LOGIC_RGB",
                    "TOOLBOX_MATH": "CAT_MATH_RGB",
                    "TOOLBOX_TEXT": "CAT_TEXT_RGB",
                    "TOOLBOX_LIST": "CAT_LIST_RGB",
                    "TOOLBOX_COLOUR": "CAT_COLOUR_RGB",
                    "TOOLBOX_VARIABLE": "CAT_VARIABLE_RGB",
                    "TOOLBOX_PROCEDURE": "CAT_PROCEDURE_RGB",
                    "TOOLBOX_COMMUNICATION": "CAT_COMMUNICATION_RGB",
                    "TOOLBOX_IMAGE": "CAT_IMAGE_RGB",
                    "TOOLBOX_DAEMON": "CAT_DAEMON_RGB",
                    // Expert categories
                    "TOOLBOX_DRIVE": "CAT_ACTION_RGB",
                    "TOOLBOX_MOVE": "CAT_ACTION_RGB",
                    "TOOLBOX_DISPLAY": "CAT_ACTION_RGB",
                    "TOOLBOX_SOUND": "CAT_ACTION_RGB",
                    "TOOLBOX_LIGHT": "CAT_ACTION_RGB",
                    "TOOLBOX_PIN": "CAT_ACTION_RGB",
                    "TOOLBOX_WAIT": "CAT_CONTROL_RGB",
                    "TOOLBOX_DECISION": "CAT_CONTROL_RGB",
                    "TOOLBOX_LOOP": "CAT_CONTROL_RGB"
                };
                for (var key in catMap) {
                    if (serverTheme.category[catMap[key]]) {
                        categoryStyles[key] = {
                            "colour": serverTheme.category[catMap[key]]
                        };
                    }
                }
                // 1. Inject categorystyle into the Toolbox XML
                toolbox = injectThemeCategoryStyles(toolbox);
            }
            // Define standard block styles using theme colors
            if (serverTheme.category) {
                blockStyles["logic_blocks"] = { "colourPrimary": serverTheme.category["CAT_LOGIC_RGB"] };
                blockStyles["loop_blocks"] = { "colourPrimary": serverTheme.category["CAT_CONTROL_RGB"] };
                blockStyles["math_blocks"] = { "colourPrimary": serverTheme.category["CAT_MATH_RGB"] };
                blockStyles["text_blocks"] = { "colourPrimary": serverTheme.category["CAT_TEXT_RGB"] };
                blockStyles["list_blocks"] = { "colourPrimary": serverTheme.category["CAT_LIST_RGB"] };
                blockStyles["colour_blocks"] = { "colourPrimary": serverTheme.category["CAT_COLOUR_RGB"] };
                blockStyles["variable_blocks"] = { "colourPrimary": serverTheme.category["CAT_VARIABLE_RGB"] };
                blockStyles["procedure_blocks"] = { "colourPrimary": serverTheme.category["CAT_PROCEDURE_RGB"] };
                // Custom OpenRoberta Styles
                blockStyles["robActions_blocks"] = { "colourPrimary": serverTheme.category["CAT_ACTION_RGB"] };
                blockStyles["robSensors_blocks"] = { "colourPrimary": serverTheme.category["CAT_SENSOR_RGB"] };
                blockStyles["robControls_blocks"] = { "colourPrimary": serverTheme.category["CAT_CONTROL_RGB"] };
                blockStyles["robBrick_blocks"] = { "colourPrimary": serverTheme.category["CAT_ACTION_RGB"] };
            }
            // 2. Assign styles to OpenRoberta blocks in Blockly.Blocks
            if (activeBlockly.Blocks) {
                for (var blockName in activeBlockly.Blocks) {
                    if (activeBlockly.Blocks.hasOwnProperty(blockName)) {
                        var block = activeBlockly.Blocks[blockName];
                        if (blockName.startsWith("robActions")) {
                            block.style = "robActions_blocks";
                        }
                        else if (blockName.startsWith("robSensors")) {
                            block.style = "robSensors_blocks";
                        }
                        else if (blockName.startsWith("robControls")) {
                            block.style = "robControls_blocks";
                        }
                        else if (blockName.startsWith("robBrick")) {
                            block.style = "robBrick_blocks";
                        }
                    }
                }
            }
            blocklyTheme = activeBlockly.Theme.defineTheme('CreateV10', {
                'base': activeBlockly.Themes.Classic,
                'categoryStyles': categoryStyles,
                'blockStyles': blockStyles,
                'componentStyles': {
                    'workspaceBackgroundColour': '#ffffff',
                    'toolboxBackgroundColour': '#DDDDDD',
                    'toolboxForegroundColour': '#000000',
                    'flyoutBackgroundColour': '#dddddd',
                    'flyoutForegroundColour': '#000000',
                    'flyoutOpacity': 1,
                    'scrollbarColour': '#797979',
                    'insertionMarkerColour': '#fff',
                    'insertionMarkerOpacity': 0.3,
                    'scrollbarOpacity': 0.4,
                    'cursorColour': '#d0d0d0'
                },
                'fontStyle': {
                    'family': '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    'weight': 'normal',
                    'size': 12
                }
            });
        }
        blocklyWorkspace = activeBlockly.inject(document.getElementById('blocklyDiv'), {
            path: '/blockly/',
            toolbox: toolbox,
            theme: blocklyTheme || GUISTATE_C.getTheme(),
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
            variableDeclaration: true,
            robControls: true,
        });
        $(window).resize();
        blocklyWorkspace.setDevice({
            group: GUISTATE_C.getRobotGroup(),
            robot: GUISTATE_C.getRobot(),
        });
        GUISTATE_C.setBlocklyWorkspace(blocklyWorkspace);
        blocklyWorkspace.robControls.disable('saveProgram');
        blocklyWorkspace.robControls.refreshTooltips(GUISTATE_C.getRobotRealName());
        GUISTATE_C.checkSim();
        $('#program').find('.blocklyToolboxDiv:first').wrap("<div id='toolboxDiv' style='position: absolute;'></div>");
        $('#toolboxDiv').prepend('<ul class="nav nav-tabs levelTabs"><li class="nav-item"><a class="nav-link typcn typcn-media-stop-outline active beginner" href="#beginner" data-bs-toggle="tab">1</a></li><li class="nav-item"><a href="#expert" class="nav-link typcn typcn-star-outline expert" data-bs-toggle="tab">2</a></li></ul>');
    }
    function initEvents() {
        $('#sliderDiv').draggable({
            axis: 'x',
            cursor: 'col-resize',
        });
        $('#tabProgram').onWrap('click', function (e) {
            e.preventDefault();
            if (GUISTATE_C.getView() === 'tabConfiguration' &&
                GUISTATE_C.isUserLoggedIn() &&
                !GUISTATE_C.isConfigurationSaved() &&
                !GUISTATE_C.isConfigurationAnonymous()) {
                $('#show-message-confirm').oneWrap('shown.bs.modal', function (e) {
                    $('#confirm').off();
                    $('#confirm').on('click', function (e) {
                        e.preventDefault();
                        // TODO, check if we want to give the user the opportunity to convert the named configuration into an anonymous one
                        GUISTATE_C.setConfigurationName('');
                        // or reset to last saved version:
                        //$('#tabConfiguration').trigger('reload');
                        $('#tabProgram').tabWrapShow();
                    });
                    $('#confirmCancel').off();
                    $('#confirmCancel').on('click', function (e) {
                        e.preventDefault();
                        $('.modal').modal('hide');
                    });
                });
                MSG.displayMessage('POPUP_CONFIGURATION_UNSAVED', 'POPUP', '', true);
                return false;
            }
            else {
                $('#tabProgram').tabWrapShow();
            }
        });
        $('#tabProgram').onWrap('show.bs.tab', function (e) {
            GUISTATE_C.setView('tabProgram');
        });
        $('#tabProgram').onWrap('shown.bs.tab', function (e) {
            blocklyWorkspace.markFocused();
            blocklyWorkspace.setVisible(true);
            if (!seen) {
                // TODO may need to be removed if program tab can receive changes while in background
                reloadView();
            }
            $(window).resize();
        });
        $('#tabProgram').onWrap('hide.bs.tab', function (e) {
            seen = false;
        });
        $('#tabProgram').onWrap('hidden.bs.tab', function (e) {
            blocklyWorkspace.setVisible(false);
        });
        $('.expert, .beginner').onWrap('click', function (e) {
            var target = ($(e.target).attr('href') && $(e.target).attr('href').substring(1)) ||
                ($(e.target.parentElement).attr('href') && $(e.target.parentElement).attr('href').substring(1)); // activated tab
            $('.levelTabs a[href="' + target + '"]').tabWrapShow();
            e.preventDefault();
            loadToolbox(target);
            e.stopPropagation();
            LOG.info('toolbox clicked, switched to ' + target);
        });
        $('#syncButton').onWrap('click', function (e) {
            e.preventDefault();
            // The source-code controller owns the conversion because it has the
            // current Ace content and knows the active robot language (NQC, Python,
            // ...). Opening the editor first avoids generating over a user's code.
            if (!$('#codeButton').hasClass('rightActive')) {
                $('#codeButton').trigger('click');
                return;
            }
            $('#codeSynchronize').trigger('click');
        });
        bindControl();
        blocklyWorkspace.addChangeListener(function (event) {
            if (listenToBlocklyEvents && event.type != Blockly.Events.UI && GUISTATE_C.isProgramSaved()) {
                GUISTATE_C.setProgramSaved(false);
            }
            if (event.type === Blockly.Events.DELETE) {
                if (blocklyWorkspace.getAllBlocks().length === 0) {
                    newProgram(true);
                }
            }
            $('.selectedHelp').removeClass('selectedHelp');
            if (Blockly.selected && $('#blocklyDiv').hasClass('rightActive')) {
                var block = Blockly.selected.type;
                $('#' + block).addClass('selectedHelp');
                $('#helpContent').scrollTo('#' + block, 1000, {
                    offset: -10,
                });
            }
            // Auto-Sync: Update Source Code Editor if visible
            if (event.type !== Blockly.Events.UI && $('#sourceCodeEditorPane').is(':visible')) {
                clearTimeout(blocklyWorkspace.syncTimeout);
                blocklyWorkspace.syncTimeout = setTimeout(function () {
                    var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
                    var xmlProgram = Blockly.Xml.domToText(dom);
                    var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
                    var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
                    var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
                    var language = GUISTATE_C.getLanguage();
                    PROGRAM.showSourceProgram(GUISTATE_C.getProgramName(), configName, xmlProgram, xmlConfigText, language, getSSID(), getPassword(), function (result) {
                        ACE_EDITOR.setEditorCode(result.sourceCode);
                    });
                }, 2000);
            }
            return false;
        });
    }
    /**
     * Save program to server
     */
    function saveToServer() {
        $('.modal').modal('hide'); // close all opened popups
        var xmlProgram = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xmlProgramText = Blockly.Xml.domToText(xmlProgram);
        var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
        var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
        var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
        PROGRAM.saveProgramToServer(GUISTATE_C.getProgramName(), GUISTATE_C.getProgramOwnerName(), xmlProgramText, configName, xmlConfigText, GUISTATE_C.getProgramTimestamp(), function (result) {
            if (result.rc === 'ok') {
                GUISTATE_C.setProgramTimestamp(result.lastChanged);
                GUISTATE_C.setProgramSaved(true);
                GUISTATE_C.setConfigurationSaved(true);
                LOG.info('save program ' + GUISTATE_C.getProgramName());
            }
            MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_PROGRAM', result.message, GUISTATE_C.getProgramName());
        });
    }
    exports.saveToServer = saveToServer;
    /**
     * Save program with new name to server
     */
    function saveAsProgramToServer() {
        $formSingleModal.validate();
        if ($formSingleModal.valid()) {
            $('.modal').modal('hide'); // close all opened popups
            var progName = $('#singleModalInput').val().trim();
            var xmlProgram = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            var xmlProgramText = Blockly.Xml.domToText(xmlProgram);
            var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
            var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
            var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
            var userAccountName = GUISTATE_C.getUserAccountName();
            LOG.info('saveAs program ' + GUISTATE_C.getProgramName());
            PROGRAM.saveAsProgramToServer(progName, userAccountName, xmlProgramText, configName, xmlConfigText, GUISTATE_C.getProgramTimestamp(), function (result) {
                if (result.rc === 'ok') {
                    LOG.info('saved program ' + GUISTATE_C.getProgramName() + ' as ' + progName);
                    result.name = progName;
                    result.programShared = false;
                    GUISTATE_C.setProgram(result, userAccountName, userAccountName);
                    MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_PROGRAM_AS', result.message, GUISTATE_C.getProgramName());
                }
                else {
                    if (result.cause === 'ORA_PROGRAM_SAVE_AS_ERROR_PROGRAM_EXISTS') {
                        //show replace option
                        //get last changed of program to overwrite
                        var lastChanged = result.lastChanged;
                        var modalMessage = Blockly.Msg.POPUP_BACKGROUND_REPLACE || 'A program with the same name already exists! <br> Would you like to replace it?';
                        $('#show-message-confirm').oneWrap('shown.bs.modal', function (e) {
                            $('#confirm').off();
                            $('#confirm').onWrap('click', function (e) {
                                e.preventDefault();
                                PROGRAM.saveProgramToServer(progName, userAccountName, xmlProgramText, configName, xmlConfigText, lastChanged, function (result) {
                                    if (result.rc === 'ok') {
                                        LOG.info('saved program ' + GUISTATE_C.getProgramName() + ' as ' + progName + ' and overwrote old content');
                                        result.name = progName;
                                        GUISTATE_C.setProgram(result, userAccountName, userAccountName);
                                        MSG.displayInformation(result, 'MESSAGE_EDIT_SAVE_PROGRAM_AS', result.message, GUISTATE_C.getProgramName());
                                    }
                                    else {
                                        LOG.info('failed to overwrite ' + progName);
                                        MSG.displayMessage(result.message, 'POPUP', '');
                                    }
                                });
                            }, 'confirm modal');
                            $('#confirmCancel').off();
                            $('#confirmCancel').onWrap('click', function (e) {
                                e.preventDefault();
                                $('.modal').modal('hide');
                            }, 'cancel modal');
                        });
                        MSG.displayPopupMessage('ORA_PROGRAM_SAVE_AS_ERROR_PROGRAM_EXISTS', modalMessage, Blockly.Msg.POPUP_REPLACE, Blockly.Msg.POPUP_CANCEL);
                    }
                }
            });
        }
    }
    /**
     * Load the program that was selected in gallery list
     */
    function loadFromGallery(program) {
        var programName = program[1];
        var user = program[3];
        var robotGroup = program[0];
        var robotType;
        if (robotGroup === GUISTATE_C.getRobotGroup()) {
            robotType = GUISTATE_C.getRobot();
        }
        else {
            robotType = GUISTATE_C.findRobot(robotGroup);
        }
        var owner = 'Gallery';
        function loadProgramFromGallery() {
            PROGRAM.loadProgramFromListing(programName, owner, user, function (result) {
                if (result.rc === 'ok') {
                    result.programShared = 'READ';
                    result.name = programName;
                    GUISTATE_C.setProgram(result, owner, user);
                    GUISTATE_C.setProgramXML(result.progXML);
                    //                    GUISTATE_C.setConfigurationName('');
                    //                    GUISTATE_C.setConfigurationXML(result.confXML);
                    if (result.configName === undefined) {
                        if (result.confXML === undefined) {
                            GUISTATE_C.setConfigurationNameDefault();
                            GUISTATE_C.setConfigurationXML(GUISTATE_C.getConfigurationConf());
                        }
                        else {
                            GUISTATE_C.setConfigurationName('');
                            GUISTATE_C.setConfigurationXML(result.confXML);
                        }
                    }
                    else {
                        GUISTATE_C.setConfigurationName(result.configName);
                        GUISTATE_C.setConfigurationXML(result.confXML);
                    }
                    $('#tabProgram').oneWrap('shown.bs.tab', function (e) {
                        CONFIGURATION_C.reloadConf();
                        reloadProgram();
                    });
                    $('#tabProgram').tabWrapShow();
                }
                MSG.displayInformation(result, '', result.message);
            });
        }
        //TODO !!!!
        ROBOT_C.switchRobot(robotType, {}, false, loadProgramFromGallery);
    }
    exports.loadFromGallery = loadFromGallery;
    function initProgramForms() {
        $formSingleModal = $('#single-modal-form');
        $('#buttonCancelFirmwareUpdateAndRun').onWrap('click', function () {
            start();
        }, 'cancel firmware update and run');
    }
    exports.initProgramForms = initProgramForms;
    function showSaveAsModal() {
        $.validator.addMethod('regex', function (value, element, regexp) {
            value = value.trim();
            return value.match(regexp);
        }, 'No special Characters allowed here. Use only upper and lowercase letters (A through Z; a through z) and numbers.');
        UTIL.showSingleModal(function () {
            $('#singleModalInput').attr('type', 'text');
            $('#single-modal h5').text(Blockly.Msg['MENU_SAVE_AS']);
            $('#single-modal label').text(Blockly.Msg['POPUP_NAME']);
        }, saveAsProgramToServer, function () { }, {
            rules: {
                singleModalInput: {
                    required: true,
                    regex: /^[a-zA-Z_öäüÖÄÜß$€][a-zA-Z0-9_öäüÖÄÜß$€]{0,254}$/,
                },
            },
            errorClass: 'form-invalid',
            errorPlacement: function (label, element) {
                label.insertAfter(element);
            },
            messages: {
                singleModalInput: {
                    required: Blockly.Msg['VALIDATION_FIELD_REQUIRED'],
                    regex: Blockly.Msg['MESSAGE_INVALID_NAME'],
                },
            },
        });
    }
    exports.showSaveAsModal = showSaveAsModal;
    function initProgramEnvironment() {
        var x, y;
        if ($(window).width() < 768) {
            x = $(window).width() / 50;
            y = 25;
        }
        else {
            x = $(window).width() / 5;
            y = 50;
        }
        var program = GUISTATE_C.getProgramProg();
        programToBlocklyWorkspace(program);
        var blocks = blocklyWorkspace.getTopBlocks(true);
        if (blocks[0]) {
            var coord = blocks[0].getRelativeToSurfaceXY();
            blocks[0].moveBy(x - coord.x, y - coord.y);
        }
    }
    exports.initProgramEnvironment = initProgramEnvironment;
    /**
     * New program
     */
    function newProgram(opt_further) {
        var further = opt_further || false;
        function loadNewProgram() {
            var result = {};
            result.rc = 'ok';
            result.name = 'NEPOprog';
            result.programShared = false;
            result.lastChanged = '';
            GUISTATE_C.setProgram(result);
            initProgramEnvironment();
            NN_C.programWasReplaced();
            LOG.info('New program loaded');
        }
        if (further || GUISTATE_C.isProgramSaved()) {
            loadNewProgram();
        }
        else {
            confirmLoadProgram();
        }
    }
    exports.newProgram = newProgram;
    function confirmLoadProgram() {
        $('#show-message-confirm').oneWrap('shown.bs.modal', function (e) {
            $('#confirm').off();
            $('#confirm').on('click', function (e) {
                e.preventDefault();
                newProgram(true);
            });
            $('#confirmCancel').off();
            $('#confirmCancel').on('click', function (e) {
                e.preventDefault();
                $('.modal').modal('hide');
            });
        });
        if (GUISTATE_C.isUserLoggedIn()) {
            MSG.displayMessage('POPUP_BEFOREUNLOAD_LOGGEDIN', 'POPUP', '', true);
        }
        else {
            MSG.displayMessage('POPUP_BEFOREUNLOAD', 'POPUP', '', true);
        }
    }
    function linkProgram() {
        var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xml = Blockly.Xml.domToText(dom);
        //TODO this should be removed after the next release
        xml = '<export xmlns="http://de.fhg.iais.roberta.blockly"><program>' + xml + '</program><config>' + GUISTATE_C.getConfigurationXML() + '</config></export>';
        var location = new URL(document.location);
        var clean_uri = location.protocol + '//' + location.host;
        var link = clean_uri + '?loadSystem=';
        link += GUISTATE_C.getRobot();
        link += '&loadProgram=' + xml;
        link = encodeURI(link);
        var $temp = $('<input>');
        $('body').append($temp);
        $temp.val(link).select();
        document.execCommand('copy');
        $temp.remove();
        var displayLink = '</br><textarea readonly style="width:100%;" type="text">' + link + '</textarea>';
        LOG.info('ProgramLinkShare');
        MSG.displayMessage('POPUP_GET_LINK', 'POPUP', displayLink);
    }
    exports.linkProgram = linkProgram;
    /**
     * Create a file from the blocks and download it.
     */
    function exportXml() {
        var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xml = '<export xmlns="http://de.fhg.iais.roberta.blockly"><program>' +
            Blockly.Xml.domToText(dom) +
            '</program><config>' +
            GUISTATE_C.getConfigurationXML() +
            '</config></export>';
        LOG.info('ProgramExport');
        UTIL.download(GUISTATE_C.getProgramName() + '.xml', xml);
        MSG.displayMessage('MENU_MESSAGE_DOWNLOAD', 'TOAST', GUISTATE_C.getProgramName());
    }
    exports.exportXml = exportXml;
    /**
     * Download all programs by the current User
     */
    function exportAllXml() {
        USER.userLoggedInCheck(function (result) {
            if (result.rc === 'ok') {
                PROGRAM.exportAllProgramsXml();
            }
            else {
                MSG.displayMessage(result.cause, 'TOAST', 'Log in check failed for Export');
            }
        });
    }
    exports.exportAllXml = exportAllXml;
    function getBlocklyWorkspace() {
        return blocklyWorkspace;
    }
    exports.getBlocklyWorkspace = getBlocklyWorkspace;
    function bindControl() {
        Blockly.bindEvent_(blocklyWorkspace.robControls.saveProgram, 'mousedown', null, function (e) {
            LOG.info('saveProgram from blockly button');
            saveToServer();
            return false;
        });
        blocklyWorkspace.robControls.disable('saveProgram');
    }
    function reloadProgram(opt_result, opt_fromShowSource) {
        var program;
        if (opt_result) {
            program = opt_result.progXML;
            if (!$.isEmptyObject(opt_result.confAnnos)) {
                GUISTATE_C.confAnnos = opt_result.confAnnos;
                UTIL.alertTab('tabConfiguration');
            }
        }
        else {
            program = GUISTATE_C.getProgramXML();
        }
        programToBlocklyWorkspace(program, opt_fromShowSource);
    }
    exports.reloadProgram = reloadProgram;
    function reloadView() {
        if (isVisible()) {
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            var xml = Blockly.Xml.domToText(dom);
            programToBlocklyWorkspace(xml);
            var toolbox = GUISTATE_C.getProgramToolbox();
            blocklyWorkspace.updateToolbox(injectThemeCategoryStyles(toolbox));
            seen = true;
        }
        else {
            seen = false;
        }
    }
    exports.reloadView = reloadView;
    function resetView() {
        if (blocklyWorkspace) {
            blocklyWorkspace.setDevice({ group: GUISTATE_C.getRobotGroup(), robot: GUISTATE_C.getRobot() });
            initProgramEnvironment();
            var toolbox = GUISTATE_C.getProgramToolbox();
            blocklyWorkspace.updateToolbox(injectThemeCategoryStyles(toolbox));
        }
    }
    exports.resetView = resetView;
    function loadToolbox(level) {
        GUISTATE_C.setProgramToolboxLevel(level);
        var xml = GUISTATE_C.getToolbox(level);
        if (xml) {
            blocklyWorkspace.updateToolbox(injectThemeCategoryStyles(xml));
            refreshToolboxCategoryAppearance();
        }
        if (level === 'beginner') {
            $('.help.expert').hide();
        }
        else {
            $('.help.expert').show();
        }
    }
    exports.loadToolbox = loadToolbox;
    function refreshToolboxCategoryAppearance() {
        window.requestAnimationFrame(function () {
            $('#program .blocklyTreeRow').each(function () {
                var colour = window.getComputedStyle(this).borderLeftColor;
                if (colour && colour !== 'rgba(0, 0, 0, 0)') {
                    this.style.backgroundColor = colour;
                    $(this).find('.blocklyTreeLabel').css('color', '#fff');
                }
            });
        });
    }
    function loadExternalToolbox(toolbox) {
        if (toolbox) {
            blocklyWorkspace.updateToolbox(injectThemeCategoryStyles(toolbox));
        }
    }
    exports.loadExternalToolbox = loadExternalToolbox;
    function injectThemeCategoryStyles(xmlString) {
        if (!xmlString) return xmlString;
        var serverTheme = GUISTATE_C.getTheme();
        if (!serverTheme || !serverTheme.category) return xmlString;
        var catMap = {
            "TOOLBOX_ACTION": "CAT_ACTION_RGB", "TOOLBOX_SENSOR": "CAT_SENSOR_RGB", "TOOLBOX_CONTROL": "CAT_CONTROL_RGB", "TOOLBOX_LOGIC": "CAT_LOGIC_RGB", "TOOLBOX_MATH": "CAT_MATH_RGB", "TOOLBOX_TEXT": "CAT_TEXT_RGB", "TOOLBOX_LIST": "CAT_LIST_RGB", "TOOLBOX_COLOUR": "CAT_COLOUR_RGB", "TOOLBOX_VARIABLE": "CAT_VARIABLE_RGB", "TOOLBOX_PROCEDURE": "CAT_PROCEDURE_RGB", "TOOLBOX_COMMUNICATION": "CAT_COMMUNICATION_RGB", "TOOLBOX_IMAGE": "CAT_IMAGE_RGB", "TOOLBOX_DAEMON": "CAT_DAEMON_RGB", "TOOLBOX_DRIVE": "CAT_ACTION_RGB", "TOOLBOX_MOVE": "CAT_ACTION_RGB", "TOOLBOX_DISPLAY": "CAT_ACTION_RGB", "TOOLBOX_SOUND": "CAT_ACTION_RGB", "TOOLBOX_LIGHT": "CAT_ACTION_RGB", "TOOLBOX_PIN": "CAT_ACTION_RGB", "TOOLBOX_WAIT": "CAT_CONTROL_RGB", "TOOLBOX_DECISION": "CAT_CONTROL_RGB", "TOOLBOX_LOOP": "CAT_CONTROL_RGB"
        };
        try {
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(xmlString, "text/xml");
            var categories = xmlDoc.getElementsByTagName("category");
            for (var i = 0; i < categories.length; i++) {
                var catName = categories[i].getAttribute("name");
                if (catName && catMap[catName] && serverTheme.category[catMap[catName]]) {
                    categories[i].setAttribute("colour", serverTheme.category[catMap[catName]]);
                }
            }
            return new XMLSerializer().serializeToString(xmlDoc);
        } catch (e) {
            console.error("Error patching toolbox XML:", e);
            return xmlString;
        }
    }
    function isVisible() {
        return GUISTATE_C.getView() == 'tabProgram';
    }
    function programToBlocklyWorkspace(xml, opt_fromShowSource) {
        if (!xml) {
            return;
        }
        listenToBlocklyEvents = false;
        blocklyWorkspace.clear();
        var dom = Blockly.Xml.textToDom(xml, blocklyWorkspace);
        Blockly.Xml.domToWorkspace(dom, blocklyWorkspace);
        blocklyWorkspace.setVersion(dom.getAttribute('xmlversion'));
        $('#infoContent').html(blocklyWorkspace.description);
        if (typeof blocklyWorkspace.description === 'string' && blocklyWorkspace.description.length) {
            $('#infoButton').addClass('notEmpty');
        }
        else {
            $('#infoButton').removeClass('notEmpty');
        }
        var tmpTags = blocklyWorkspace.tags;
        $('#infoTags').tagsinput('removeAll');
        $('.bootstrap-tagsinput input').attr('placeholder', 'Tags');
        $('#infoTags').tagsinput('add', tmpTags);
        var xmlConfiguration = GUISTATE_C.getConfigurationXML();
        var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xmlProgram = Blockly.Xml.domToText(dom);
        var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
        var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
        var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
        GUISTATE_C.setProgramSaved(true);
        var language = GUISTATE_C.getLanguage();
        if ($('#codeDiv').hasClass('rightActive') && opt_fromShowSource) {
            PROGRAM.showSourceProgram(GUISTATE_C.getProgramName(), configName, xmlProgram, xmlConfigText, language, getSSID(), getPassword(), function (result) {
                ACE_EDITOR.setViewCode(result.sourceCode);
            });
        }
        setTimeout(function () {
            listenToBlocklyEvents = true;
        }, 500);
    }
    exports.programToBlocklyWorkspace = programToBlocklyWorkspace;
});
