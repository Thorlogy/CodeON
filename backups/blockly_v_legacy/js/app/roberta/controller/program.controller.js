define(["require", "exports", "message", "log", "util.roberta", "guiState.controller", "robot.controller", "nn.controller", "program.model", "user.model", "configuration.controller", "blockly", "jquery", "aceEditor", "jquery-validate"], function (require, exports, MSG, LOG, UTIL, GUI, ROBOT, NN, PROGRAM, USER, CONF, Blockly, $, ACE) {
    var $formSingleModal;
    Object.defineProperty(exports, "__esModule", { value: true });

    var blocklyWorkspace;
    var isPgmSaved = true;
    var isConfSaved = true;
    var ssid = "";
    var password = "";

    function getSSID() { return ssid; }
    function getPassword() { return password; }

    function setSSID(s) { ssid = s; }
    function setPassword(p) { password = p; }

    function translateToolboxXML(xmlString) {
        console.log("ANTIGRAVITY DEBUG: Inside translateToolboxXML");
        if (!Blockly.Msg) {
            console.error("ANTIGRAVITY DEBUG: Blockly.Msg is UNDEFINED!");
            return xmlString;
        }
        console.log("ANTIGRAVITY DEBUG: Blockly.Msg.TOOLBOX_ACTION is:", Blockly.Msg.TOOLBOX_ACTION);
        if (!xmlString || typeof xmlString !== 'string') return xmlString;

        // ANTIGRAVITY: Match TOOLBOX_XYZ patterns and replace with Blockly.Msg.TOOLBOX_XYZ
        return xmlString.replace(/(TOOLBOX_[A-Z_]+)/g, function (match) {
            if (Blockly.Msg && Blockly.Msg[match]) {
                return Blockly.Msg[match];
            } else {
                console.warn("ANTIGRAVITY DEBUG: Missing translation for key:", match);
            }
            return match;
        });
    }

    function saveToServer() {
        $(".modal").modal("hide");
        var xml = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xmlText = Blockly.Xml.domToText(xml);
        var configName = !GUI.isConfigurationStandard() && !GUI.isConfigurationAnonymous() ? GUI.getConfigurationName() : undefined;
        var configXml = GUI.isConfigurationAnonymous() ? GUI.getConfigurationXML() : undefined;
        PROGRAM.saveProgramToServer(GUI.getProgramName(), GUI.getProgramOwnerName(), xmlText, configName, configXml, GUI.getProgramTimestamp(), function (result) {
            if (result.rc === "ok") {
                GUI.setProgramTimestamp(result.lastChanged);
                GUI.setProgramSaved(true);
                GUI.setConfigurationSaved(true);
                LOG.info("save program " + GUI.getProgramName());
            }
            MSG.displayInformation(result, "MESSAGE_EDIT_SAVE_PROGRAM", result.message, GUI.getProgramName());
        });
    }

    function saveAsProgramToServer() {
        $formSingleModal.validate();
        if ($formSingleModal.valid()) {
            $(".modal").modal("hide");
            var progName = $("#singleModalInput").val().trim();
            var xml = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            var xmlText = Blockly.Xml.domToText(xml);
            var configName = !GUI.isConfigurationStandard() && !GUI.isConfigurationAnonymous() ? GUI.getConfigurationName() : undefined;
            var configXml = GUI.isConfigurationAnonymous() ? GUI.getConfigurationXML() : undefined;
            var userAccountName = GUI.getUserAccountName();

            LOG.info("saveAs program " + GUI.getProgramName());
            PROGRAM.saveAsProgramToServer(progName, userAccountName, xmlText, configName, configXml, GUI.getProgramTimestamp(), function (result) {
                if (result.rc === "ok") {
                    LOG.info("saved program " + GUI.getProgramName() + " as " + progName);
                    result.name = progName;
                    result.programShared = false;
                    GUI.setProgram(result, userAccountName, userAccountName);
                    MSG.displayInformation(result, "MESSAGE_EDIT_SAVE_PROGRAM_AS", result.message, GUI.getProgramName());
                } else if (result.cause === "ORA_PROGRAM_SAVE_AS_ERROR_PROGRAM_EXISTS") {
                    var lastChanged = result.lastChanged;
                    var title = Blockly.Msg.POPUP_BACKGROUND_REPLACE || "A program with the same name already exists! <br> Would you like to replace it?";
                    $("#show-message-confirm").oneWrap("shown.bs.modal", function (e) {
                        $("#confirm").off();
                        $("#confirm").onWrap("click", function (e) {
                            e.preventDefault();
                            PROGRAM.saveProgramToServer(progName, userAccountName, xmlText, configName, configXml, lastChanged, function (result) {
                                if (result.rc === "ok") {
                                    LOG.info("saved program " + GUI.getProgramName() + " as " + progName + " and overwrote old content");
                                    result.name = progName;
                                    GUI.setProgram(result, userAccountName, userAccountName);
                                    MSG.displayInformation(result, "MESSAGE_EDIT_SAVE_PROGRAM_AS", result.message, GUI.getProgramName());
                                } else {
                                    LOG.info("failed to overwrite " + progName);
                                    MSG.displayMessage(result.message, "POPUP", "");
                                }
                            });
                        }, "confirm modal");
                        $("#confirmCancel").off();
                        $("#confirmCancel").onWrap("click", function (e) {
                            e.preventDefault();
                            $(".modal").modal("hide");
                        }, "cancel modal");
                    });
                    MSG.displayPopupMessage("ORA_PROGRAM_SAVE_AS_ERROR_PROGRAM_EXISTS", title, Blockly.Msg.POPUP_REPLACE, Blockly.Msg.POPUP_CANCEL);
                }
            });
        }
    }

    function newProgram(opt_further) {
        var further = opt_further || false;
        if (further || GUI.isProgramSaved()) {
            var result = {
                rc: "ok",
                name: "NEPOprog",
                programShared: false,
                lastChanged: ""
            };
            GUI.setProgram(result);
            initProgramEnvironment();
            PROGRAM.programWasReplaced();
            LOG.info("New program loaded");
        } else {
            $("#show-message-confirm").oneWrap("shown.bs.modal", function (e) {
                $("#confirm").off();
                $("#confirm").on("click", function (e) {
                    e.preventDefault();
                    newProgram(true);
                });
                $("#confirmCancel").off();
                $("#confirmCancel").on("click", function (e) {
                    e.preventDefault();
                    $(".modal").modal("hide");
                });
            });
            if (GUI.isUserLoggedIn()) {
                MSG.displayMessage("POPUP_BEFOREUNLOAD_LOGGEDIN", "POPUP", "", true);
            } else {
                MSG.displayMessage("POPUP_BEFOREUNLOAD", "POPUP", "", true);
            }
        }
    }

    function linkProgram() {
        var xml = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xmlText = Blockly.Xml.domToText(xml);
        var xmlProgram = '<export xmlns="http://de.fhg.iais.roberta.blockly"><program>' + xmlText + '</program><config>' + GUI.getConfigurationXML() + '</config></export>';
        var url = new URL(document.location);
        var shareUrl = url.protocol + "//" + url.host + "?loadSystem=" + GUI.getRobot() + "&loadProgram=" + encodeURI(xmlProgram);

        var $tempInput = $("<input>");
        $("body").append($tempInput);
        $tempInput.val(shareUrl).select();
        document.execCommand("copy");
        $tempInput.remove();

        var text = "</br><textarea readonly style='width:100%;' type='text'>" + shareUrl + "</textarea>";
        LOG.info("ProgramLinkShare");
        MSG.displayMessage("POPUP_GET_LINK", "POPUP", text);
    }

    function initProgramForms() {
        $formSingleModal = $("#single-modal-form");
        $("#buttonCancelFirmwareUpdateAndRun").onWrap("click", function () {
            start();
        }, "cancel firmware update and run");
    }

    function initProgramEnvironment() {
        var x, y;
        if ($(window).width() < 768) {
            x = $(window).width() / 50;
            y = 25;
        } else {
            x = $(window).width() / 5;
            y = 50;
        }
        var progXML = GUI.getProgramProg();
        programToBlocklyWorkspace(progXML);

        var topBlocks = blocklyWorkspace.getTopBlocks(true);
        if (topBlocks[0]) {
            var coord = topBlocks[0].getRelativeToSurfaceXY();
            topBlocks[0].moveBy(x - coord.x, y - coord.y);
        }
    }

    function reloadProgram(data, opt_callback) {
        var progXML;
        if (data) {
            progXML = data.progXML;
            if (!$.isEmptyObject(data.confAnnos)) {
                GUI.confAnnos = data.confAnnos;
                UTIL.alertTab("tabConfiguration");
            }
        } else {
            progXML = GUI.getProgramXML();
        }
        programToBlocklyWorkspace(progXML, opt_callback);
    }

    function reloadView() {
        if (GUI.getView() == "tabProgram") {
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            var xml = Blockly.Xml.domToText(dom);
            programToBlocklyWorkspace(xml);
            var toolbox = GUI.getProgramToolbox();

            // ANTIGRAVITY DEBUG
            console.log("ANTIGRAVITY DEBUG: reloadView updateToolbox");
            if (toolbox) {
                var translatedToolbox = typeof toolbox === 'string' ? translateToolboxXML(toolbox) : toolbox;

                if (typeof translatedToolbox === 'string') {
                    blocklyWorkspace.updateToolbox(Blockly.Xml.textToDom(translatedToolbox));
                } else {
                    blocklyWorkspace.updateToolbox(translatedToolbox);
                }
            }
            isConfSaved = true;
        } else {
            isConfSaved = false;
        }
    }

    function resetView() {
        blocklyWorkspace.setDevice({
            group: GUI.getRobotGroup(),
            robot: GUI.getRobot()
        });
        initProgramEnvironment();
        var toolbox = GUI.getProgramToolbox();

        // ANTIGRAVITY DEBUG
        console.log("ANTIGRAVITY DEBUG: resetView updateToolbox with translation");

        var translatedToolbox = typeof toolbox === 'string' ? translateToolboxXML(toolbox) : toolbox;
        blocklyWorkspace.updateToolbox(typeof translatedToolbox === 'string' ? Blockly.Xml.textToDom(translatedToolbox) : translatedToolbox);
    }

    function loadToolbox(level) {
        GUI.setProgramToolboxLevel(level);
        var toolbox = GUI.getToolbox(level);

        // ANTIGRAVITY DEBUG
        console.log("ANTIGRAVITY DEBUG: loadToolbox level=" + level);

        if (toolbox) {
            var translatedToolbox = typeof toolbox === 'string' ? translateToolboxXML(toolbox) : toolbox;

            if (typeof translatedToolbox === 'string') {
                blocklyWorkspace.updateToolbox(Blockly.Xml.textToDom(translatedToolbox));
            } else {
                blocklyWorkspace.updateToolbox(translatedToolbox);
            }
        }
        if (level === "beginner") {
            $(".help.expert").hide();
        } else {
            $(".help.expert").show();
        }
    }

    function loadExternalToolbox(toolbox) {
        if (toolbox) {
            var translatedToolbox = typeof toolbox === 'string' ? translateToolboxXML(toolbox) : toolbox;
            if (typeof translatedToolbox === 'string') {
                blocklyWorkspace.updateToolbox(Blockly.Xml.textToDom(translatedToolbox));
            } else {
                blocklyWorkspace.updateToolbox(translatedToolbox);
            }
        }
    }

    function programToBlocklyWorkspace(xml, opt_callback) {
        if (xml) {
            isPgmSaved = false;
            blocklyWorkspace.clear();
            var dom = Blockly.Xml.textToDom(xml, blocklyWorkspace);
            Blockly.Xml.domToWorkspace(dom, blocklyWorkspace);
            blocklyWorkspace.setVersion(dom.getAttribute("xmlversion"));
            $("#infoContent").html(blocklyWorkspace.description);
            if (typeof blocklyWorkspace.description == "string" && blocklyWorkspace.description.length) {
                $("#infoButton").addClass("notEmpty");
            } else {
                $("#infoButton").removeClass("notEmpty");
            }
            var tags = blocklyWorkspace.tags;
            $("#infoTags").tagsinput("removeAll");
            $(".bootstrap-tagsinput input").attr("placeholder", "Tags");
            $("#infoTags").tagsinput("add", tags);
            GUI.getConfigurationXML();
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
            var xmlText = Blockly.Xml.domToText(dom);
            var configName = !GUI.isConfigurationStandard() && !GUI.isConfigurationAnonymous() ? GUI.getConfigurationName() : undefined;
            var configXml = GUI.isConfigurationAnonymous() ? GUI.getConfigurationXML() : undefined;
            GUI.setProgramSaved(true);
            var language = GUI.getLanguage();
            if ($("#codeDiv").hasClass("rightActive") && opt_callback) {
                PROGRAM.showSourceProgram(GUI.getProgramName(), configName, xmlText, configXml, language, getSSID(), getPassword(), function (result) {
                    ACE.setViewCode(result.sourceCode);
                });
            }
            setTimeout(function () {
                isPgmSaved = true;
            }, 500);
        }
    }

    function init() {
        Blockly.Workspace.prototype.setDevice = function (device) {
            this.device = device.group;
            this.subDevice = device.robot;
            if (this.toolbox_) {
                this.toolbox_.flyout_.workspace_.device = device.group;
                this.toolbox_.flyout_.workspace_.subDevice = device.robot;
            }
            if (this.flyout_) {
                this.flyout_.workspace_.device = device.group;
                this.flyout_.workspace_.subDevice = device.robot;
            }
        };

        var toolbox = GUI.getProgramToolbox();

        // ANTIGRAVITY DEBUG
        console.log("ANTIGRAVITY DEBUG: init toolbox original content length:", toolbox ? toolbox.length : 0);
        if (!toolbox) {
            console.error("ANTIGRAVITY CRITICAL: Toolbox content is EMPTY!");
            toolbox = '<xml><category name="ERROR: MISSING TOOLBOX"></category></xml>';
        }

        var toolboxDom = toolbox;
        if (typeof toolbox === 'string') {
            try {
                // Apply translation BEFORE parsing to DOM
                toolbox = translateToolboxXML(toolbox);
                toolboxDom = Blockly.Xml.textToDom(toolbox);
                console.log("ANTIGRAVITY DEBUG: Toolbox parsed successfully after translation.");
            } catch (e) {
                console.error("ANTIGRAVITY CRITICAL: Toolbox XML Parse Error", e);
            }
        }












        // Previous specific polyfill block removed as it is now covered by the generic one above.

        blocklyWorkspace = Blockly.inject(document.getElementById("blocklyDiv"), {
            path: "/blockly/",
            toolbox: toolboxDom,
            trashcan: true,
            scrollbars: true,
            media: "../blockly/media/",
            zoom: {
                controls: true,
                wheel: false,
                startScale: 1,
                maxScale: 4,
                minScale: 0.25,
                scaleSpeed: 1.1
            },
            variableDeclaration: true,
            robControls: true
        });




        $(window).resize();
        blocklyWorkspace.setDevice({
            group: GUI.getRobotGroup(),
            robot: GUI.getRobot()
        });
        GUI.setBlocklyWorkspace(blocklyWorkspace);
        blocklyWorkspace.robControls.disable("saveProgram");
        blocklyWorkspace.robControls.refreshTooltips(GUI.getRobotRealName());
        GUI.checkSim();


        // ANTIGRAVITY PATCH: Ensure toolbox structure is correct for V10 (Removed debug check)

        $("#program").find(".blocklyToolboxDiv:first").wrap("<div id='toolboxDiv' style='position: absolute;'></div>");
        $("#toolboxDiv").prepend('<ul class="nav nav-tabs levelTabs"><li class="nav-item"><a class="nav-link typcn typcn-media-stop-outline active beginner" href="#beginner" data-bs-toggle="tab">1</a></li><li class="nav-item"><a href="#expert" class="nav-link typcn typcn-star-outline expert" data-bs-toggle=\"tab\">2</a></li></ul>');

        initProgramEnvironment();

        $("#sliderDiv").draggable({
            axis: "x",
            cursor: "col-resize"
        });
        $("#tabProgram").onWrap("click", function (e) {
            e.preventDefault();
            if (GUI.getView() === "tabConfiguration" && GUI.isUserLoggedIn() && !GUI.isConfigurationSaved() && !GUI.isConfigurationAnonymous()) {
                $("#show-message-confirm").oneWrap("shown.bs.modal", function (e) {
                    $("#confirm").off();
                    $("#confirm").on("click", function (e) {
                        e.preventDefault();
                        GUI.setConfigurationName("");
                        $("#tabProgram").tabWrapShow();
                    });
                    $("#confirmCancel").off();
                    $("#confirmCancel").on("click", function (e) {
                        e.preventDefault();
                        $(".modal").modal("hide");
                    });
                });
                MSG.displayMessage("POPUP_CONFIGURATION_UNSAVED", "POPUP", "", true);
                return false;
            }
            $("#tabProgram").tabWrapShow();
        });
        $("#tabProgram").onWrap("show.bs.tab", function (e) {
            GUI.setView("tabProgram");
        });
        $("#tabProgram").onWrap("shown.bs.tab", function (e) {
            blocklyWorkspace.markFocused();
            blocklyWorkspace.setVisible(true);
            if (!isConfSaved) {
                reloadView();
            }
            $(window).resize();
        });
        $("#tabProgram").onWrap("hide.bs.tab", function (e) {
            isConfSaved = false;
        });
        $("#tabProgram").onWrap("hidden.bs.tab", function (e) {
            blocklyWorkspace.setVisible(false);
        });
        $(".expert, .beginner").onWrap("click", function (e) {
            var target = $(e.target).attr("href");
            if (!target) {
                target = $(e.target.parentElement).attr("href");
            }
            target = target.substring(1);
            $('.levelTabs a[href="#' + target + '"]').tabWrapShow();
            e.preventDefault();
            loadToolbox(target);
            e.stopPropagation();
            LOG.info("toolbox clicked, switched to " + target);
        });

        Blockly.bindEvent_(blocklyWorkspace.robControls.saveProgram, "mousedown", null, function (e) {
            LOG.info("saveProgram from blockly button");
            saveToServer();
            return false;
        });
        blocklyWorkspace.robControls.disable("saveProgram");
        blocklyWorkspace.addChangeListener(function (e) {
            if (isPgmSaved && e.type != Blockly.Events.UI) {
                if (GUI.isProgramSaved()) {
                    GUI.setProgramSaved(false);
                }
            }
            if (e.type === Blockly.Events.DELETE) {
                if (blocklyWorkspace.getAllBlocks().length === 0) {
                    newProgram(true);
                }
            }
            $(".selectedHelp").removeClass("selectedHelp");
            if (Blockly.selected && $("#blocklyDiv").hasClass("rightActive")) {
                var block = Blockly.selected.type;
                $("#" + block).addClass("selectedHelp");
                $("#helpContent").scrollTo("#" + block, 1000, {
                    offset: -10
                });
            }
            return false;
        });
        initProgramForms();
    }

    exports.init = init;
    exports.setSSID = setSSID;
    exports.getSSID = getSSID;
    exports.setPassword = setPassword;
    exports.getPassword = getPassword;
    exports.saveToServer = saveToServer;
    exports.loadFromGallery = function (data) {
        var robot = data[0] === GUI.getRobotGroup() ? GUI.getRobot() : GUI.findRobot(data[0]);
        var programName = data[1];
        var ownerName = data[3];
        var galleryName = "Gallery";

        ROBOT.switchRobot(robot, {}, false, function () {
            PROGRAM.loadProgramFromListing(programName, galleryName, ownerName, function (result) {
                if (result.rc === "ok") {
                    result.programShared = "READ";
                    result.name = programName;
                    GUI.setProgram(result, galleryName, ownerName);
                    GUI.setProgramXML(result.progXML);
                    if (result.configName === undefined) {
                        if (result.confXML === undefined) {
                            GUI.setConfigurationNameDefault();
                            GUI.setConfigurationXML(GUI.getConfigurationConf());
                        } else {
                            GUI.setConfigurationName("");
                            GUI.setConfigurationXML(result.confXML);
                        }
                    } else {
                        GUI.setConfigurationName(result.configName);
                        GUI.setConfigurationXML(result.confXML);
                    }
                    $("#tabProgram").oneWrap("shown.bs.tab", function (e) {
                        CONF.reloadConf();
                        reloadProgram();
                    });
                    $("#tabProgram").tabWrapShow();
                }
                MSG.displayInformation(result, "", result.message);
            });
        });
    };
    exports.initProgramForms = initProgramForms;
    exports.showSaveAsModal = function () {
        $.validator.addMethod("regex", function (value, element, regexp) {
            value = value.trim();
            return value.match(regexp);
        }, "No special Characters allowed here. Use only upper and lowercase letters (A through Z; a through z) and numbers.");

        UTIL.showSingleModal(function () {
            $("#singleModalInput").attr("type", "text");
            $("#single-modal h5").text(Blockly.Msg.MENU_SAVE_AS);
            $("#single-modal label").text(Blockly.Msg.POPUP_NAME);
        }, saveAsProgramToServer, function () {

        }, {
            rules: {
                singleModalInput: {
                    required: true,
                    regex: /^[a-zA-Z_öäüÖÄÜß$€][a-zA-Z0-9_öäüÖÄÜß$€]{0,254}$/
                }
            },
            errorClass: "form-invalid",
            errorPlacement: function (error, element) {
                error.insertAfter(element);
            },
            messages: {
                singleModalInput: {
                    required: Blockly.Msg.VALIDATION_FIELD_REQUIRED,
                    regex: Blockly.Msg.MESSAGE_INVALID_NAME
                }
            }
        });
    };
    exports.initProgramEnvironment = initProgramEnvironment;
    exports.newProgram = newProgram;
    exports.linkProgram = linkProgram;
    exports.exportXml = function () {
        var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
        var xml = '<export xmlns="http://de.fhg.iais.roberta.blockly"><program>' + Blockly.Xml.domToText(dom) + '</program><config>' + GUI.getConfigurationXML() + '</config></export>';
        LOG.info("ProgramExport");
        UTIL.download(GUI.getProgramName() + ".xml", xml);
        MSG.displayMessage("MENU_MESSAGE_DOWNLOAD", "TOAST", GUI.getProgramName());
    };
    exports.exportAllXml = function () {
        var userAccountName = GUI.getUserAccountName();
        USER.userLoggedInCheck(function (result) {
            if (result.rc === "ok") {
                PROGRAM.exportAllProgramsXml();
            } else {
                MSG.displayMessage(result.cause, "TOAST", "Log in check failed for Export");
            }
        });
    };
    exports.getBlocklyWorkspace = function () {
        return blocklyWorkspace;
    };
    exports.reloadProgram = reloadProgram;
    exports.reloadView = reloadView;
    exports.resetView = resetView;
    exports.loadToolbox = loadToolbox;
    exports.loadExternalToolbox = loadExternalToolbox;
    exports.programToBlocklyWorkspace = programToBlocklyWorkspace;
});
