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
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
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
                }
                else {
                    MSG.displayInformation(result, result.message, result.message, result.parameters);
                }
            });
        }, 'code refresh clicked');
        // Synchronize button - import code from blocks (replaces refresh for editable mode)
        $('#codeSynchronize').onWrap('click', function (event) {
            event.stopPropagation();
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
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
        // Import to Blocks button - convert code back to blocks
        $('#codeImportToBlocks').onWrap('click', function (event) {
            event.stopPropagation();
            importCodeToBlocks();
        }, 'import to blocks clicked');
    }
    /**
     * Import Python code back to Blockly blocks
     */
    function importCodeToBlocks() {
        var code = ACE_EDITOR.getEditorCode();
        var converter = new codeToBlocks_1.CodeToBlocksConverter();
        try {
            var xml = converter.convertToXML(code);
            var dom = Blockly.Xml.textToDom(xml);
            // Clear workspace
            blocklyWorkspace.clear();
            // Load new blocks
            Blockly.Xml.domToWorkspace(dom, blocklyWorkspace);
            // Reset edit flag
            ACE_EDITOR.setWasEditedByUser(false);
            // Show success message
            MSG.displayMessage('CODE_TO_BLOCKS_SUCCESS', 'TOAST', '');
            // Close code panel
            $('#blocklyDiv').closeRightView();
        }
        catch (error) {
            console.error('Code to blocks conversion error:', error);
            MSG.displayMessage('CODE_TO_BLOCKS_ERROR', 'POPUP', error.message || 'Conversion failed');
        }
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
            var dom = Blockly.Xml.workspaceToDom(blocklyWorkspace);
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
                    // TODO change javaSource to source on server
                    GUISTATE_C.setProgramSource(result.sourceCode);
                    $button.openRightView($('#codeDiv'), INITIAL_WIDTH);
                }
                else {
                    MSG.displayInformation(result, result.message, result.message, result.parameters);
                }
            });
        }
    }
});
