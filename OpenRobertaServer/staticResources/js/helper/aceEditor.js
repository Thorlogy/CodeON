/*
 important note:
    AceAjax types are incomplete some typing errors have to be suppressed with it-ignore
*/
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.setCodeLanguage = exports.updateViewCodePreservingCursor = exports.setViewCode = exports.setEditorCode = exports.getViewCode = exports.getEditorCode = exports.setViewCodeChangeHandler = exports.setWasEditedByUser = exports.getCurrentLanguage = exports.wasEditedByUser = exports.init = void 0;
    var codeView;
    var editor;
    var currentLanguage;
    var wasEdited = false;
    var previousLineCount = 0;
    var initialized = false;
    var viewCodeChangeHandler;
    // EV3dev API Autocomplete Completer
    var ev3devCompleter = {
        getCompletions: function (editor, session, pos, prefix, callback) {
            if (currentLanguage !== 'python') {
                callback(null, []);
                return;
            }
            var completions = [
                // Hal display methods
                {
                    caption: 'hal.drawText',
                    value: 'hal.drawText(text, x, y)',
                    meta: 'EV3dev Display',
                    score: 1000,
                },
                {
                    caption: 'hal.drawPicture',
                    value: 'hal.drawPicture(picture, x, y)',
                    meta: 'EV3dev Display',
                    score: 1000,
                },
                {
                    caption: 'hal.clearDisplay',
                    value: 'hal.clearDisplay()',
                    meta: 'EV3dev Display',
                    score: 1000,
                },
                // Hal timing methods
                {
                    caption: 'hal.waitFor',
                    value: 'hal.waitFor(ms)',
                    meta: 'EV3dev Timing',
                    score: 1000,
                },
                // Motor control methods
                {
                    caption: 'hal.rotateDirectionRegulated',
                    value: 'hal.rotateDirectionRegulated(port, direction, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000,
                },
                {
                    caption: 'hal.rotateDirectionAngle',
                    value: 'hal.rotateDirectionAngle(port, direction, speed, angle)',
                    meta: 'EV3dev Motor',
                    score: 1000,
                },
                {
                    caption: 'hal.turnOnRegulatedMotor',
                    value: 'hal.turnOnRegulatedMotor(port, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000,
                },
                {
                    caption: 'hal.setRegulatedMotorSpeed',
                    value: 'hal.setRegulatedMotorSpeed(port, speed)',
                    meta: 'EV3dev Motor',
                    score: 1000,
                },
                {
                    caption: 'hal.stopMotor',
                    value: 'hal.stopMotor(port, mode)',
                    meta: 'EV3dev Motor',
                    score: 1000,
                },
                // Sensor methods
                {
                    caption: 'hal.isKeyPressed',
                    value: 'hal.isKeyPressed(key)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.isPressed',
                    value: 'hal.isPressed(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.getUltraSonicSensorDistance',
                    value: 'hal.getUltraSonicSensorDistance(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.getColorSensorColour',
                    value: 'hal.getColorSensorColour(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.getColorSensorRed',
                    value: 'hal.getColorSensorRed(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.getGyroSensorAngle',
                    value: 'hal.getGyroSensorAngle(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                {
                    caption: 'hal.getInfraredSensorDistance',
                    value: 'hal.getInfraredSensorDistance(port)',
                    meta: 'EV3dev Sensor',
                    score: 1000,
                },
                // Sound methods
                {
                    caption: 'hal.playTone',
                    value: 'hal.playTone(frequency, duration)',
                    meta: 'EV3dev Sound',
                    score: 1000,
                },
                {
                    caption: 'hal.playFile',
                    value: 'hal.playFile(filename)',
                    meta: 'EV3dev Sound',
                    score: 1000,
                },
                // LED methods
                {
                    caption: 'hal.ledOn',
                    value: 'hal.ledOn(color, mode)',
                    meta: 'EV3dev LED',
                    score: 1000,
                },
                {
                    caption: 'hal.ledOff',
                    value: 'hal.ledOff()',
                    meta: 'EV3dev LED',
                    score: 1000,
                },
                // Common Python patterns
                {
                    caption: 'if',
                    value: 'if ${1:condition}:\n    ${2:pass}',
                    meta: 'Python',
                    score: 900,
                },
                {
                    caption: 'while',
                    value: 'while ${1:condition}:\n    ${2:pass}',
                    meta: 'Python',
                    score: 900,
                },
                {
                    caption: 'for',
                    value: 'for ${1:i} in range(${2:10}):\n    ${3:pass}',
                    meta: 'Python',
                    score: 900,
                },
                {
                    caption: 'def',
                    value: 'def ${1:function_name}(${2:params}):\n    ${3:pass}',
                    meta: 'Python',
                    score: 900,
                },
            ];
            callback(null, completions);
        },
    };
    // NQC is C-like, but its RCX commands are not part of Ace's C/C++ vocabulary.
    // Keep this completer separate from the EV3dev/Python proposals so an RCX user
    // never receives commands for a different robot platform.
    var nqcCompleter = {
        getCompletions: function (editor, session, pos, prefix, callback) {
            if (currentLanguage !== 'nqc') {
                callback(null, []);
                return;
            }
            callback(null, [
                { caption: 'SetPower', value: 'SetPower(OUT_A, NEPO_PWR(30));', meta: 'NQC ↔ Block: Motorleistung', score: 1000 },
                {
                    caption: 'OnFwd',
                    snippet: 'SetPower(OUT_A+OUT_C, NEPO_PWR(${1:30}));\nOnFwd(OUT_A); OnRev(OUT_C);',
                    meta: 'NQC ↔ Block: Motor vorwärts',
                    score: 1000,
                },
                {
                    caption: 'OnRev',
                    snippet: 'SetPower(OUT_A+OUT_C, NEPO_PWR(${1:30}));\nOnRev(OUT_A); OnFwd(OUT_C);',
                    meta: 'NQC ↔ Block: Motor rückwärts',
                    score: 1000,
                },
                { caption: 'Off', value: 'Off(OUT_A+OUT_C);', meta: 'NQC ↔ Block: Motoren stoppen', score: 1000 },
                { caption: 'Float', value: 'Float(OUT_A);', meta: 'NQC ↔ Block: Motor frei auslaufen', score: 950 },
                {
                    caption: 'turn left',
                    snippet: 'SetPower(OUT_A+OUT_C, NEPO_PWR(${1:30}));\nOnRev(OUT_A); OnRev(OUT_C);',
                    meta: 'NQC ↔ Block: Links drehen (Standardkonfiguration)',
                    score: 900,
                },
                {
                    caption: 'turn right',
                    snippet: 'SetPower(OUT_A+OUT_C, NEPO_PWR(${1:30}));\nOnFwd(OUT_A); OnFwd(OUT_C);',
                    meta: 'NQC ↔ Block: Rechts drehen (Standardkonfiguration)',
                    score: 900,
                },
                { caption: 'Wait', value: 'Wait((500) / 10);', meta: 'NQC ↔ Block: Warten', score: 1000 },
                {
                    caption: 'PlayTone',
                    snippet: 'PlayTone(${1:440}, (${2:500}) / 10);\nWait((${2:500}) / 10);',
                    meta: 'NQC ↔ Block: Ton',
                    score: 1000,
                },
                { caption: 'SetUserDisplay', value: 'SetUserDisplay(0, 0);', meta: 'NQC ↔ Block: Anzeige', score: 950 },
                { caption: 'SelectDisplay', value: 'SelectDisplay(DISPLAY_WATCH);', meta: 'NQC ↔ Block: Anzeige löschen', score: 950 },
                { caption: 'ClearTimer', value: 'ClearTimer(0);', meta: 'NQC ↔ Block: Timer zurücksetzen', score: 900 },
                { caption: 'ClearSensor', value: 'ClearSensor(SENSOR_3);', meta: 'NQC ↔ Block: Drehsensor zurücksetzen', score: 900 },
                { caption: 'SENSOR_1', value: 'SENSOR_1', meta: 'NQC ↔ Block: Sensor an Anschluss 1', score: 900 },
                { caption: 'SENSOR_2', value: 'SENSOR_2', meta: 'NQC ↔ Block: Sensor an Anschluss 2', score: 900 },
                { caption: 'SENSOR_3', value: 'SENSOR_3', meta: 'NQC ↔ Block: Sensor an Anschluss 3', score: 900 },
                { caption: 'FastTimer', value: '(FastTimer(0) * 10)', meta: 'NQC ↔ Block: Timerwert', score: 900 },
                { caption: 'encoder degrees', value: '(SENSOR_3 * 360 / 16)', meta: 'NQC ↔ Block: Drehwinkel', score: 850 },
                { caption: 'if', snippet: 'if (${1:SENSOR_1}) {\n\t${0}\n}', meta: 'NQC ↔ Block: Wenn', score: 1000 },
                {
                    caption: 'if … else',
                    snippet: 'if (${1:SENSOR_1}) {\n\t${2}\n} else {\n\t${0}\n}',
                    meta: 'NQC ↔ Block: Wenn / sonst',
                    score: 1000,
                },
                {
                    caption: 'for',
                    snippet: 'for (int ${1:i} = ${2:0}; ${1:i} < ${3:10}; ${1:i} += ${4:1}) {\n\t${0}\n}',
                    meta: 'NQC ↔ Block: Zählschleife',
                    score: 1000,
                },
                {
                    caption: 'repeat',
                    snippet: 'for (int ${1:k0} = 0; ${1:k0} < ${2:10}; ${1:k0} += 1) {\n\t${0}\n}',
                    meta: 'NQC ↔ Block: Wiederhole n-mal',
                    score: 950,
                },
                { caption: 'while', snippet: 'while (${1:SENSOR_1}) {\n\t${0}\n}', meta: 'NQC ↔ Block: Solange', score: 1000 },
                { caption: 'forever', snippet: 'while (true) {\n\t${0}\n}', meta: 'NQC ↔ Block: Wiederhole unendlich', score: 950 },
                { caption: 'break', value: 'break;', meta: 'NQC ↔ Block: Schleife abbrechen', score: 900 },
                { caption: 'continue', value: 'continue;', meta: 'NQC ↔ Block: Nächster Schleifendurchlauf', score: 900 },
                { caption: 'variable =', value: 'wert = 0;', meta: 'NQC ↔ Block: Variable setzen', score: 850 },
                { caption: 'variable +=', value: 'wert += 1;', meta: 'NQC ↔ Block: Variable ändern', score: 850 },
                { caption: 'true', value: 'true', meta: 'NQC ↔ Block: Wahrheitswert', score: 800 },
                { caption: 'false', value: 'false', meta: 'NQC ↔ Block: Wahrheitswert', score: 800 },
                { caption: 'null', value: 'null', meta: 'NQC ↔ Block: Null', score: 800 },
                { caption: 'ternary', value: '(SENSOR_1 ? 1 : 0)', meta: 'NQC ↔ Block: Falls / dann / sonst', score: 800 },
                { caption: 'logic AND', value: '(SENSOR_1 && SENSOR_2)', meta: 'NQC ↔ Block: Logisches UND', score: 800 },
                { caption: 'logic OR', value: '(SENSOR_1 || SENSOR_2)', meta: 'NQC ↔ Block: Logisches ODER', score: 800 },
                { caption: 'logic NOT', value: '!SENSOR_1', meta: 'NQC ↔ Block: Logisches NICHT', score: 800 },
                { caption: 'compare', value: '(SENSOR_2 > 50)', meta: 'NQC ↔ Block: Vergleich', score: 800 },
                { caption: 'arithmetic', value: '(wert + 1)', meta: 'NQC ↔ Block: Rechnen', score: 800 },
                { caption: 'modulo', value: '((wert) % (2))', meta: 'NQC ↔ Block: Rest einer Division', score: 800 },
                { caption: 'constrain', value: 'MIN(MAX(wert, 1), 100)', meta: 'NQC ↔ Block: Zahl begrenzen', score: 800 },
                { caption: 'Random', value: 'Random((100) - (1)) + (1)', meta: 'NQC ↔ Block: Zufallszahl', score: 800 },
                { caption: 'comment', value: '// Kommentar', meta: 'NQC: Kommentar', score: 750 },
                {
                    caption: 'wait until',
                    snippet: 'while (true) {\n\tif (${1:SENSOR_1}) {\n\t\tbreak;\n\t}\n\tWait(1);\n}',
                    meta: 'NQC ↔ Blöcke: Warte bis',
                    score: 900,
                },
                {
                    caption: 'wait with action',
                    snippet: 'while (true) {\n\tif (${1:SENSOR_1}) {\n\t\t${2:Off(OUT_A+OUT_C);}\n\t\tbreak;\n\t}\n\tWait(1);\n}',
                    meta: 'NQC ↔ Block: Warte mit Aktion',
                    score: 850,
                },
            ]);
        },
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
        langToolsForCodeView.addCompleter(nqcCompleter);
        codeView.session.on('change', function () {
            wasEdited = true;
            startNqcAutocompleteForCurrentWord(codeView);
            if (viewCodeChangeHandler)
                viewCodeChangeHandler();
        });
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
        langTools.addCompleter(nqcCompleter);
        editor.session.on('change', function () {
            if (previousLineCount !== editor.session.getLength()) {
                previousLineCount = editor.session.getLength();
                resetActiveLine(editor);
            }
            wasEdited = true;
            startNqcAutocompleteForCurrentWord(editor);
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
    function setViewCodeChangeHandler(handler) {
        viewCodeChangeHandler = handler;
    }
    exports.setViewCodeChangeHandler = setViewCodeChangeHandler;
    function getEditorCode() {
        return editor.getValue();
    }
    exports.getEditorCode = getEditorCode;
    /** Return the code shown in the editable <> side panel. */
    function getViewCode() {
        return codeView.getValue();
    }
    exports.getViewCode = getViewCode;
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
    /** Update generated additions without throwing the user's cursor back to line 1. */
    function updateViewCodePreservingCursor(sourceCode) {
        var oldLineCount = codeView.session.getLength();
        var cursor = codeView.getCursorPosition();
        codeView.setValue(sourceCode, -1);
        var addedLines = codeView.session.getLength() - oldLineCount;
        codeView.moveCursorTo(Math.max(0, cursor.row + addedLines), cursor.column);
        codeView.clearSelection();
        highlightEverySecondLine(codeView);
    }
    exports.updateViewCodePreservingCursor = updateViewCodePreservingCursor;
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
            case 'nqc':
                langToSet = 'nqc';
                break;
            case 'json':
                langToSet = 'json';
                break;
            default:
                langToSet = 'python';
        }
        if (languageFileExtension === 'nqc') {
            // The NQC mode is maintained by CodeON and needs an explicit asset
            // version because Ace loads modes outside RequireJS.
            // @ts-ignore Ace's bundled typings do not expose config.setModuleUrl.
            ace.config.setModuleUrl('ace/mode/nqc', '/libs/ace/mode-nqc.js?v=rcx-nqc-editor-20260713-3');
        }
        editor.session.setMode('ace/mode/' + langToSet);
        codeView.session.setMode('ace/mode/' + langToSet);
        previousLineCount = editor.session.getLength();
        currentLanguage = languageFileExtension === 'nqc' ? 'nqc' : langToSet;
        if (currentLanguage === 'nqc') {
            applyNqcCodeConventions(editor);
            applyNqcCodeConventions(codeView);
        }
        // Ace's default text completer repeats arbitrary words from the current
        // source (for example OUT_A or "Open" from the generated header). In NQC
        // mode show only proposals with a guaranteed graphical roundtrip.
        var languageTools = ace.require('ace/ext/language_tools');
        var completers = currentLanguage === 'nqc'
            ? [nqcCompleter]
            : [languageTools.snippetCompleter, languageTools.textCompleter, languageTools.keyWordCompleter, ev3devCompleter];
        // @ts-ignore Ace's Editor typings do not expose the completers property.
        codeView.completers = completers;
        // @ts-ignore Ace's Editor typings do not expose the completers property.
        editor.completers = completers;
    }
    exports.setCodeLanguage = setCodeLanguage;
    /** NQC follows the CodeON C-style convention: four spaces and K&R braces. */
    function applyNqcCodeConventions(ed) {
        ed.session.setTabSize(4);
        ed.session.setUseSoftTabs(true);
        ed.setBehavioursEnabled(true);
    }
    function applyDefaultSettings(ed) {
        ed.session.setUseWrapMode(true);
        ed.setShowPrintMargin(false);
    }
    /**
     * Ace's live-autocomplete option does not consistently open for the custom
     * NQC-only completer. Start it explicitly once an identifier has two letters;
     * Ace itself still filters the result list and closes it when nothing matches.
     */
    function startNqcAutocompleteForCurrentWord(ed) {
        if (currentLanguage !== 'nqc')
            return;
        window.setTimeout(function () {
            var cursor = ed.getCursorPosition();
            var beforeCursor = ed.session.getLine(cursor.row).substring(0, cursor.column);
            var word = beforeCursor.match(/[A-Za-z][A-Za-z0-9_]*$/);
            if (word && word[0].length >= 2) {
                ed.execCommand('startAutocomplete');
            }
        }, 0);
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
