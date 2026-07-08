/*
 important note:
    AceAjax types are incomplete some typing errors have to be suppressed with it-ignore
*/
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setCodeLanguage = exports.setViewCode = exports.setEditorCode = exports.getEditorCode = exports.setWasEditedByUser = exports.getCurrentLanguage = exports.wasEditedByUser = exports.init = void 0;
    var codeView;
    var editor;
    var currentLanguage;
    var wasEdited = false;
    var previousLineCount = 0;
    var initialized = false;
    // EV3dev API Autocomplete Completer
    var ev3devCompleter = {
        getCompletions: function (editor, session, pos, prefix, callback) {
            var completions = [
                // Hal display methods
                {
                    caption: 'hal.drawText',
                    value: 'hal.drawText(text, x, y)',
                    meta: 'EV3dev Display',
                    score: 1000
                },
                {
                    caption: 'hal.drawPicture',
                    value: 'hal.drawPicture(picture, x, y)',
                    meta: 'EV3dev Display',
                    score: 1000
                },
                {
                    caption: 'hal.clearDisplay',
                    value: 'hal.clearDisplay()',
                    meta: 'EV3dev Display',
                    score: 1000
                },
                // Hal timing methods
                {
                    caption: 'hal.waitFor',
                    value: 'hal.waitFor(ms)',
                    meta: 'EV3dev Timing',
                    score: 1000
                },
                // Motor control methods
                {
                    caption: 'hal.rotateDirectionRegulated',
                    value: 'hal.rotateDirectionRegulated(port, direction, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000
                },
                {
                    caption: 'hal.rotateDirectionAngle',
                    value: 'hal.rotateDirectionAngle(port, direction, speed, angle)',
                    meta: 'EV3dev Motor',
                    score: 1000
                },
                {
                    caption: 'hal.turnOnRegulatedMotor',
                    value: 'hal.turnOnRegulatedMotor(port, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000
                },
                {
                    caption: 'hal.setRegulatedMotorSpeed',
                    value: 'hal.setRegulatedMotorSpeed(port, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000
                },
                {
                    caption: 'hal.stopMotor',
                    value: 'hal.stopMotor(port, mode)',
                    meta: 'EV3dev Motor',
                    score: 1000
                },
                // Sensor methods
                {
                    caption: 'hal.isKeyPressed',
                    value: 'hal.isKeyPressed(key)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.isPressed',
                    value: 'hal.isPressed(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.getUltraSonicSensorDistance',
                    value: 'hal.getUltraSonicSensorDistance(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.getColorSensorColour',
                    value: 'hal.getColorSensorColour(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.getColorSensorRed',
                    value: 'hal.getColorSensorRed(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.getGyroSensorAngle',
                    value: 'hal.getGyroSensorAngle(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                {
                    caption: 'hal.getInfraredSensorDistance',
                    value: 'hal.getInfraredSensorDistance(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000
                },
                // Sound methods
                {
                    caption: 'hal.playTone',
                    value: 'hal.playTone(frequency, duration)',
                    meta: 'EV3dev Sound',
                    score: 1000
                },
                {
                    caption: 'hal.playFile',
                    value: 'hal.playFile(filename)',
                    meta: 'EV3dev Sound',
                    score: 1000
                },
                // LED methods
                {
                    caption: 'hal.ledOn',
                    value: 'hal.ledOn(color, mode)',
                    meta: 'EV3dev LED',
                    score: 1000
                },
                {
                    caption: 'hal.ledOff',
                    value: 'hal.ledOff()',
                    meta: 'EV3dev LED',
                    score: 1000
                },
                // Common Python patterns
                {
                    caption: 'if',
                    value: 'if ${1:condition}:\n    ${2:pass}',
                    meta: 'Python',
                    score: 900
                },
                {
                    caption: 'while',
                    value: 'while ${1:condition}:\n    ${2:pass}',
                    meta: 'Python',
                    score: 900
                },
                {
                    caption: 'for',
                    value: 'for ${1:i} in range(${2:10}):\n    ${3:pass}',
                    meta: 'Python',
                    score: 900
                },
                {
                    caption: 'def',
                    value: 'def ${1:function_name}(${2:params}):\n    ${3:pass}',
                    meta: 'Python',
                    score: 900
                }
            ];
            callback(null, completions);
        }
    };
    function init() {
        if (initialized)
            return;
        initialized = true;
        ace.require('ace/ext/language_tools');
        codeView = ace.edit('codeContent');
        applyDefaultSettings(codeView);
        codeView.setOptions({
            readOnly: false,
            highlightActiveLine: true,
            highlightGutterLine: true,
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true, // Added for live autocomplete
        });
        // Add custom EV3dev completer to codeView as well
        // @ts-ignore
        var langToolsForCodeView = ace.require('ace/ext/language_tools');
        langToolsForCodeView.addCompleter(ev3devCompleter);
        editor = ace.edit('aceEditor');
        applyDefaultSettings(editor);
        editor.setOptions({
            enableBasicAutocompletion: true,
            enableSnippets: true,
            enableLiveAutocompletion: true,
        });
        // Add custom EV3dev completer
        // @ts-ignore
        var langTools = ace.require('ace/ext/language_tools');
        langTools.addCompleter(ev3devCompleter);
        editor.session.on('change', function () {
            if (previousLineCount !== editor.session.getLength()) {
                previousLineCount = editor.session.getLength();
                resetActiveLine(editor);
            }
            wasEdited = true;
        });
        editor.session.on('changeFold', function () {
            resetActiveLine(editor);
        });
        editor.selection.on('changeSelection', function () {
            resetActiveLine(editor);
        });
        codeView.session.on('changeFold', function () {
            highlightEverySecondLine(codeView);
        });
        $(window).resize(function () {
            codeView.resize();
            editor.resize();
        });
    }
    exports.init = init;
    function wasEditedByUser() {
        return wasEdited;
    }
    exports.wasEditedByUser = wasEditedByUser;
    function getCurrentLanguage() {
        return currentLanguage;
    }
    exports.getCurrentLanguage = getCurrentLanguage;
    function setWasEditedByUser(edited) {
        wasEdited = edited;
    }
    exports.setWasEditedByUser = setWasEditedByUser;
    function getEditorCode() {
        return editor.getValue();
    }
    exports.getEditorCode = getEditorCode;
    function setEditorCode(sourceCode) {
        editor.setValue(sourceCode, 0);
        editor.clearSelection();
        editor.focus();
        resetActiveLine(editor);
    }
    exports.setEditorCode = setEditorCode;
    function setViewCode(sourceCode) {
        codeView.setValue(sourceCode, 0);
        codeView.clearSelection();
        codeView.moveCursorTo(0, 0);
        highlightEverySecondLine(codeView);
    }
    exports.setViewCode = setViewCode;
    function setCodeLanguage(languageFileExtension) {
        var langToSet;
        switch (languageFileExtension) {
            case 'py':
                langToSet = 'python';
                break;
            case 'java':
                langToSet = 'java';
                break;
            case 'ino':
            case 'nxc':
            case 'cpp':
                langToSet = 'c_cpp';
                break;
            case 'json':
                langToSet = 'json';
                break;
            default:
                langToSet = 'python';
        }
        editor.session.setMode('ace/mode/' + langToSet);
        codeView.session.setMode('ace/mode/' + langToSet);
        previousLineCount = editor.session.getLength();
        currentLanguage = langToSet;
    }
    exports.setCodeLanguage = setCodeLanguage;
    function applyDefaultSettings(ed) {
        ed.session.setUseWrapMode(true);
        ed.setShowPrintMargin(false);
    }
    function resetActiveLine(ed) {
        ed.setHighlightActiveLine(false);
        // @ts-ignore
        if (ed.getSelectedText().length == 0) {
            ed.setHighlightActiveLine(true);
        }
    }
    function getNumberOfVisibleRows(ed) {
        var hiddenRows = 0;
        //TODO add fold type once AceAjax typings are complete
        //@ts-ignore
        ed.session.getAllFolds().forEach(function (fold) {
            var startRow = fold.start.row;
            var endRow = fold.end.row;
            hiddenRows += endRow - startRow;
        });
        return ed.session.getLength() - hiddenRows;
    }
    // Function to style every second line
    function highlightEverySecondLine(ed) {
        for (var id in ed.session.getMarkers(false)) {
            ed.session.removeMarker(Number(id));
        }
        for (var i = 0; i < getNumberOfVisibleRows(ed); i++) {
            if (i % 2 === 1) {
                ed.session.addGutterDecoration(i, 'ace_lineBackgroundGrey');
                ed.session.highlightLines(i, i, 'ace_lineBackgroundGrey', false);
            }
            else {
                ed.session.highlightLines(i, i, 'ace_lineBackgroundWhite', false);
            }
        }
    }
});
