/*
 important note:
    AceAjax types are incomplete some typing errors have to be suppressed with it-ignore
*/

let codeView: AceAjax.Editor;
let editor: AceAjax.Editor;
let currentLanguage: string;
let wasEdited: boolean = false;
let previousLineCount: number = 0;
let initialized: boolean = false;

// EV3dev API Autocomplete Completer
const ev3devCompleter = {
    getCompletions: function (editor: any, session: any, pos: any, prefix: string, callback: any) {
        if (currentLanguage !== 'python') {
            callback(null, []);
            return;
        }
        const completions = [
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

// NQC is C-like, but its RCX commands are not part of Ace's C/C++ vocabulary.
// Keep this completer separate from the EV3dev/Python proposals so an RCX user
// never receives commands for a different robot platform.
const nqcCompleter = {
    getCompletions: function (editor: any, session: any, pos: any, prefix: string, callback: any) {
        if (currentLanguage !== 'nqc') {
            callback(null, []);
            return;
        }
        callback(null, [
            { caption: 'SetPower', value: 'SetPower(OUT_A, NEPO_PWR(30));', meta: 'NQC ↔ Block: Motorleistung', score: 1000 },
            {
                caption: 'OnFwd',
                value: 'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnFwd(OUT_A); OnRev(OUT_C);',
                meta: 'NQC ↔ Block: Motor vorwärts',
                score: 1000,
            },
            {
                caption: 'OnRev',
                value: 'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnRev(OUT_A); OnFwd(OUT_C);',
                meta: 'NQC ↔ Block: Motor rückwärts',
                score: 1000,
            },
            { caption: 'Off', value: 'Off(OUT_A+OUT_C);', meta: 'NQC ↔ Block: Motoren stoppen', score: 1000 },
            { caption: 'Wait', value: 'Wait((500) / 10);', meta: 'NQC ↔ Block: Warten', score: 1000 },
            {
                caption: 'PlayTone',
                value: 'PlayTone(440, (500) / 10);\nWait((500) / 10);',
                meta: 'NQC ↔ Block: Ton',
                score: 1000,
            },
            { caption: 'SetUserDisplay', value: 'SetUserDisplay(0, 0);', meta: 'NQC ↔ Block: Anzeige', score: 950 },
            { caption: 'SelectDisplay', value: 'SelectDisplay(DISPLAY_WATCH);', meta: 'NQC ↔ Block: Anzeige löschen', score: 950 },
            { caption: 'ClearTimer', value: 'ClearTimer(0);', meta: 'NQC ↔ Block: Timer zurücksetzen', score: 900 },
            { caption: 'ClearSensor', value: 'ClearSensor(SENSOR_3);', meta: 'NQC ↔ Block: Drehsensor zurücksetzen', score: 900 },
            { caption: 'while', value: 'while (true) {\n    \n}', meta: 'NQC ↔ Block: Wiederhole unendlich', score: 900 },
        ]);
    }
};

export function init() {
    if (initialized) return;

    initialized = true;
    ace.require('ace/ext/language_tools');

    codeView = ace.edit('codeContent');
    applyDefaultSettings(codeView);
    codeView.setOptions({
        readOnly: false,  // Changed from true to false to enable editing
        highlightActiveLine: true,  // Changed from false to enable active line highlighting
        highlightGutterLine: true,  // Changed from false to enable gutter line highlighting
        enableBasicAutocompletion: true,  // Added for autocomplete
        enableSnippets: true,  // Added for snippets
        enableLiveAutocompletion: true,  // Added for live autocomplete
    });

    // Add custom EV3dev completer to codeView as well
    // @ts-ignore
    const langToolsForCodeView = ace.require('ace/ext/language_tools');
    langToolsForCodeView.addCompleter(ev3devCompleter);
    langToolsForCodeView.addCompleter(nqcCompleter);

    codeView.session.on('change', function () {
        wasEdited = true;
        startNqcAutocompleteForCurrentWord(codeView);
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
    const langTools = ace.require('ace/ext/language_tools');
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

    editor.session.on('changeFold', () => {
        resetActiveLine(editor);
    });

    editor.selection.on('changeSelection', () => {
        resetActiveLine(editor);
    });

    codeView.session.on('changeFold', () => {
        highlightEverySecondLine(codeView);
    });

    $(window).resize(function () {
        codeView.resize();
        editor.resize();
    });
}

export function wasEditedByUser() {
    return wasEdited;
}

export function getCurrentLanguage() {
    return currentLanguage;
}

export function setWasEditedByUser(edited: boolean) {
    wasEdited = edited;
}

export function getEditorCode() {
    return editor.getValue();
}

/** Return the code shown in the editable <> side panel. */
export function getViewCode() {
    return codeView.getValue();
}

export function setEditorCode(sourceCode: string) {
    editor.setValue(sourceCode, 0);
    editor.clearSelection();
    editor.focus();
    resetActiveLine(editor);
}

export function setViewCode(sourceCode: string) {
    codeView.setValue(sourceCode, 0);
    codeView.clearSelection();
    codeView.moveCursorTo(0, 0);
    highlightEverySecondLine(codeView);
}

export function setCodeLanguage(languageFileExtension: string) {
    let langToSet: string;
    switch (languageFileExtension) {
        case 'py':
            langToSet = 'python';
            break;
        case 'java':
            langToSet = 'java';
            break;
        case 'ino':
        case 'nxc':
        case 'nqc':
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

    currentLanguage = languageFileExtension === 'nqc' ? 'nqc' : langToSet;

    // Ace's default text completer repeats arbitrary words from the current
    // source (for example OUT_A or "Open" from the generated header). In NQC
    // mode show only proposals with a guaranteed graphical roundtrip.
    const languageTools = ace.require('ace/ext/language_tools');
    const completers =
        currentLanguage === 'nqc'
            ? [nqcCompleter]
            : [languageTools.snippetCompleter, languageTools.textCompleter, languageTools.keyWordCompleter, ev3devCompleter];
    // @ts-ignore Ace's Editor typings do not expose the completers property.
    codeView.completers = completers;
    // @ts-ignore Ace's Editor typings do not expose the completers property.
    editor.completers = completers;
}

function applyDefaultSettings(ed: AceAjax.Editor) {
    ed.session.setUseWrapMode(true);
    ed.setShowPrintMargin(false);
}

/**
 * Ace's live-autocomplete option does not consistently open for the custom
 * NQC-only completer. Start it explicitly once an identifier has two letters;
 * Ace itself still filters the result list and closes it when nothing matches.
 */
function startNqcAutocompleteForCurrentWord(ed: AceAjax.Editor) {
    if (currentLanguage !== 'nqc') return;
    window.setTimeout(() => {
        const cursor = ed.getCursorPosition();
        const beforeCursor = ed.session.getLine(cursor.row).substring(0, cursor.column);
        const word = beforeCursor.match(/[A-Za-z][A-Za-z0-9_]*$/);
        if (word && word[0].length >= 2) {
            ed.execCommand('startAutocomplete');
        }
    }, 0);
}

function resetActiveLine(ed: AceAjax.Editor) {
    ed.setHighlightActiveLine(false);
    // @ts-ignore
    if (ed.getSelectedText().length == 0) {
        ed.setHighlightActiveLine(true);
    }
}

function getNumberOfVisibleRows(ed: AceAjax.Editor) {
    let hiddenRows: number = 0;

    //TODO add fold type once AceAjax typings are complete
    //@ts-ignore
    ed.session.getAllFolds().forEach(function (fold: any) {
        let startRow: number = fold.start.row;
        let endRow: number = fold.end.row;
        hiddenRows += endRow - startRow;
    });

    return ed.session.getLength() - hiddenRows;
}

// Function to style every second line
function highlightEverySecondLine(ed: AceAjax.Editor) {
    for (let id in ed.session.getMarkers(false)) {
        ed.session.removeMarker(Number(id));
    }

    for (let i = 0; i < getNumberOfVisibleRows(ed); i++) {
        if (i % 2 === 1) {
            ed.session.addGutterDecoration(i, 'ace_lineBackgroundGrey');
            ed.session.highlightLines(i, i, 'ace_lineBackgroundGrey', false);
        } else {
            ed.session.highlightLines(i, i, 'ace_lineBackgroundWhite', false);
        }
    }
}
