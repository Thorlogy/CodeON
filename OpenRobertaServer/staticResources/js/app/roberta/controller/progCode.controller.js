define(["require", "exports", "message", "util.roberta", "guiState.controller", "program.controller", "program.model", "progRun.controller", "import.controller", "blockly", "jquery", "aceEditor", "codeToBlocks"], function (require, exports, MSG, UTIL, GUISTATE_C, PROG_C, PROGRAM, PROGRUN_C, IMPORT_C, Blockly, $, ACE_EDITOR, codeToBlocks_1) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.init = void 0;
    var INITIAL_WIDTH = 0.5;
    var blocklyWorkspace;
    function init() {
        blocklyWorkspace = GUISTATE_C.getBlocklyWorkspace();
        initEvents();
    }
    exports.init = init;
    function initEvents() {
        $('#codeButton').off('click touchend');
        $('#codeButton').onWrap('click touchend', function (event) {
            toggleCode($(this));
            return false;
        });
        $('#codeDownload').onWrap('click', function (event) {
            var filename = GUISTATE_C.getProgramName() + '.' + GUISTATE_C.getSourceCodeFileExtension();
            UTIL.download(filename, ACE_EDITOR.getEditorCode());
            MSG.displayMessage('MENU_MESSAGE_DOWNLOAD', 'TOAST', filename);
        }, 'codeDownload clicked');
        $('#codeRefresh').onWrap('click', function (event) {
            event.stopPropagation();
            var workspace = GUISTATE_C.getBlocklyWorkspace();
            var dom = Blockly.Xml.workspaceToDom(workspace);
            var xmlProgram = Blockly.Xml.domToText(dom);
            var xmlConfiguration = GUISTATE_C.getConfigurationXML();
            var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
            var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
            var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
            var language = GUISTATE_C.getLanguage();
            PROGRAM.showSourceProgram(GUISTATE_C.getProgramName(), configName, xmlProgram, xmlConfigText, PROG_C.getSSID(), PROG_C.getPassword(), language, function (result) {
                PROG_C.reloadProgram(result, true);
                if (result.rc == 'ok') {
                    GUISTATE_C.setState(result);
                    ACE_EDITOR.setEditorCode(result.sourceCode);
                    GUISTATE_C.setProgramSource(result.sourceCode);
                    ACE_EDITOR.setWasEditedByUser(false);
                }
                else {
                    MSG.displayInformation(result, result.message, result.message, result.parameters);
                }
            });
        }, 'code refresh clicked');
        // Synchronize button - import code from blocks (replaces refresh for editable mode)
        $('#codeSynchronize').onWrap('click', function (event) {
            event.stopPropagation();
            if (isNqcSource()) {
                importCodeToBlocks();
                return;
            }
            var workspace = GUISTATE_C.getBlocklyWorkspace();
            var dom = Blockly.Xml.workspaceToDom(workspace);
            var xmlProgram = Blockly.Xml.domToText(dom);
            var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
            var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
            var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
            var language = GUISTATE_C.getLanguage();
            PROGRAM.showSourceProgram(GUISTATE_C.getProgramName(), configName, xmlProgram, xmlConfigText, PROG_C.getSSID(), PROG_C.getPassword(), language, function (result) {
                PROG_C.reloadProgram(result, true);
                if (result.rc == 'ok') {
                    GUISTATE_C.setState(result);
                    ACE_EDITOR.setEditorCode(result.sourceCode);
                    GUISTATE_C.setProgramSource(result.sourceCode);
                    ACE_EDITOR.setWasEditedByUser(false);
                }
                else {
                    MSG.displayInformation(result, result.message, result.message, result.parameters);
                }
            });
        }, 'code synchronize clicked');
        // Upload button - import code from file
        $('#codeUpload').onWrap('click', function (event) {
            event.stopPropagation();
            IMPORT_C.importSourceCode(function (name, source) {
                ACE_EDITOR.setEditorCode(source);
                ACE_EDITOR.setWasEditedByUser(true);
            });
        }, 'code upload clicked');
        // Run button - execute the code
        $('#codeRun').onWrap('click', function (event) {
            event.stopPropagation();
            PROGRUN_C.runNative(ACE_EDITOR.getEditorCode());
        }, 'code run clicked');
        // Import to Blocks button - convert source code back to blocks.
        $('#codeImportToBlocks').onWrap('click', function (event) {
            event.stopPropagation();
            importCodeToBlocks();
        }, 'import to blocks clicked');
    }
    function isNqcSource() {
        return GUISTATE_C.getSourceCodeFileExtension() === 'nqc';
    }
    function updateCodeToolbarForSourceLanguage() {
        if (isNqcSource()) {
            $('#codeSynchronize').attr('title', 'NQC-Code in Blöcke übernehmen').attr('data-bs-original-title', 'NQC-Code in Blöcke übernehmen');
            $('#codeRefresh').attr('title', 'NQC aus Blöcken neu erzeugen').attr('data-bs-original-title', 'NQC aus Blöcken neu erzeugen');
            $('#codeImportToBlocks').hide();
        }
        else {
            $('#codeImportToBlocks').show();
        }
    }
    /**
     * Import source code back to Blockly blocks. For RCX this is a deliberately
     * strict NQC subset so an unfamiliar command cannot silently disappear.
     */
    function importCodeToBlocks() {
        var code = ACE_EDITOR.getEditorCode();
        var converter = new codeToBlocks_1.CodeToBlocksConverter();
        var workspace;
        var originalProgramXml;
        try {
            // The program workspace is replaced when another robot or program is
            // loaded. Do not use the reference captured during controller startup.
            workspace = GUISTATE_C.getBlocklyWorkspace();
            if (!workspace) {
                throw new Error('Der aktuelle Programmbereich wurde nicht gefunden. Die Blöcke wurden nicht verändert.');
            }
            originalProgramXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
            var isNqc = isNqcSource();
            var xml = isNqc ? converter.convertNqcToXML(code, GUISTATE_C.getConfigurationXML()) : converter.convertToXML(code);
            var dom = Blockly.Xml.textToDom(xml, workspace);
            // Validate the source before touching the workspace. Keep the mandatory
            // start block and replace only its following program chain.
            var startBlock_1 = workspace.getAllBlocks().find(function (block) { return block.type === 'robControls_start'; });
            if (!startBlock_1) {
                throw new Error('Der Startblock wurde nicht gefunden. Die Blöcke wurden nicht verändert.');
            }
            if (startBlock_1.nextConnection && startBlock_1.nextConnection.isConnected()) {
                startBlock_1.nextConnection.disconnect();
            }
            // Removing only the first top block can leave the rest of the old
            // statement chain behind. Dispose top blocks repeatedly until the
            // mandatory start block is the only remaining program block.
            var blocksToDispose = workspace.getTopBlocks(false).filter(function (block) { return block !== startBlock_1; });
            while (blocksToDispose.length > 0) {
                blocksToDispose.forEach(function (block) { return block.dispose(false); });
                blocksToDispose = workspace.getTopBlocks(false).filter(function (block) { return block !== startBlock_1; });
            }
            Blockly.Xml.domToWorkspace(dom, workspace);
            var importedBlocks = workspace.getTopBlocks(false).filter(function (block) { return block !== startBlock_1; });
            if (importedBlocks.length !== 1) {
                throw new Error("Es wurde keine eindeutige neue Programmkette erzeugt (".concat(importedBlocks.length, " Startbl\u00F6cke)."));
            }
            var importedBlock = importedBlocks[0];
            if (!importedBlock || !startBlock_1.nextConnection || !importedBlock.previousConnection) {
                throw new Error('Die importierten Blöcke konnten nicht mit dem Startblock verbunden werden.');
            }
            startBlock_1.nextConnection.connect(importedBlock.previousConnection);
            var updatedDom = Blockly.Xml.workspaceToDom(workspace);
            GUISTATE_C.setProgramXML(Blockly.Xml.domToText(updatedDom));
            GUISTATE_C.setProgramSaved(false);
            startBlock_1.render();
            importedBlock.render();
            Blockly.svgResize(workspace);
            // Reset edit flag
            ACE_EDITOR.setWasEditedByUser(false);
            // Show success message
            MSG.displayMessage('CODE_TO_BLOCKS_SUCCESS', 'TOAST', '');
        }
        catch (error) {
            // The conversion is transactional: if inserting or connecting the new
            // chain fails, restore the exact workspace that was visible before.
            if (workspace && originalProgramXml) {
                workspace.clear();
                var originalDom = Blockly.Xml.textToDom(originalProgramXml, workspace);
                Blockly.Xml.domToWorkspace(originalDom, workspace);
                Blockly.svgResize(workspace);
            }
            console.error('Code to blocks conversion error:', error);
            MSG.displayMessage(getErrorMessage(error), 'POPUP', '');
        }
    }
    function getErrorMessage(error) {
        if (error && error.message) {
            return error.message;
        }
        if (error !== undefined && error !== null) {
            return String(error);
        }
        return 'Code konnte nicht in Blöcke umgewandelt werden.';
    }
    function toggleCode($button) {
        if ($('#codeButton').hasClass('rightActive')) {
            // Check for unsaved changes before closing
            if (ACE_EDITOR.wasEditedByUser()) {
                $('#show-message-confirm').oneWrap('shown.bs.modal', function () {
                    $('#confirm').off();
                    $('#confirm').on('click', function (e) {
                        e.preventDefault();
                        ACE_EDITOR.setWasEditedByUser(false);
                        $('#blocklyDiv').closeRightView();
                    });
                    $('#confirmCancel').off();
                    $('#confirmCancel').on('click', function (e) {
                        e.preventDefault();
                        $('.modal').modal('hide');
                    });
                });
                MSG.displayMessage('SOURCE_CODE_EDITOR_CLOSE_CONFIRMATION', 'POPUP', '', true, false);
            }
            else {
                $('#blocklyDiv').closeRightView();
            }
        }
        else {
            // Always generate the initial editor contents from the workspace that
            // is currently visible. This also covers the first opening of <>.
            var workspace = GUISTATE_C.getBlocklyWorkspace();
            var dom = Blockly.Xml.workspaceToDom(workspace);
            var xmlProgram = Blockly.Xml.domToText(dom);
            var isNamedConfig = !GUISTATE_C.isConfigurationStandard() && !GUISTATE_C.isConfigurationAnonymous();
            var configName = isNamedConfig ? GUISTATE_C.getConfigurationName() : undefined;
            var xmlConfigText = GUISTATE_C.isConfigurationAnonymous() ? GUISTATE_C.getConfigurationXML() : undefined;
            var language = GUISTATE_C.getLanguage();
            PROGRAM.showSourceProgram(GUISTATE_C.getProgramName(), configName, xmlProgram, xmlConfigText, PROG_C.getSSID(), PROG_C.getPassword(), language, function (result) {
                PROG_C.reloadProgram(result);
                if (result.rc == 'ok') {
                    GUISTATE_C.setState(result);
                    ACE_EDITOR.setEditorCode(result.sourceCode);
                    ACE_EDITOR.setWasEditedByUser(false);
                    // TODO change javaSource to source on server
                    GUISTATE_C.setProgramSource(result.sourceCode);
                    updateCodeToolbarForSourceLanguage();
                    $button.openRightView($('#codeDiv'), INITIAL_WIDTH);
                }
                else {
                    MSG.displayInformation(result, result.message, result.message, result.parameters);
                }
            });
        }
    }
});
