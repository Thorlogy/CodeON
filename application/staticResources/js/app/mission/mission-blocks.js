/**
 * mission-blocks.js
 * Custom Blockly block definitions for the Mission App.
 * Loaded after blockly_compressed.js and blocks_compressed.js.
 */
(function () {
    'use strict';

    // ── robControls_start ──────────────────────────────────────────
    if (!Blockly.Blocks['robControls_start']) {
        Blockly.Blocks['robControls_start'] = {
            init: function () {
                this.jsonInit({
                    type: 'robControls_start',
                    message0: '🚀 Start',
                    nextStatement: null,
                    colour: 160,
                    tooltip: 'Startblock. Das Programm beginnt hier.',
                    helpUrl: ''
                });
                this.setDeletable(false);
            }
        };
    }

    // ── robActions_motorDiff_on_for ────────────────────────────────
    if (!Blockly.Blocks['robActions_motorDiff_on_for']) {
        Blockly.Blocks['robActions_motorDiff_on_for'] = {
            init: function () {
                this.setColour(210);
                this.appendDummyInput().appendField('🚗 Fahre');
                this.appendValueInput('POWER').setCheck('Number').appendField('% Leistung');
                this.appendValueInput('DISTANCE').setCheck('Number').appendField('cm');
                this.setInputsInline(true);
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Fahre eine bestimmte Strecke vorwärts.');
            }
        };
    }

    // ── robActions_motorDiff_turn ──────────────────────────────────
    if (!Blockly.Blocks['robActions_motorDiff_turn']) {
        Blockly.Blocks['robActions_motorDiff_turn'] = {
            init: function () {
                this.setColour(210);
                this.appendDummyInput().appendField('↩️ Drehe');
                this.appendValueInput('POWER').setCheck('Number').appendField('% Leistung');
                this.appendValueInput('DEGREES').setCheck('Number').appendField('Grad');
                this.setInputsInline(true);
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Drehe den Roboter um eine bestimmte Gradzahl.');
            }
        };
    }

    // ── robActions_motorDiff_stop ──────────────────────────────────
    if (!Blockly.Blocks['robActions_motorDiff_stop']) {
        Blockly.Blocks['robActions_motorDiff_stop'] = {
            init: function () {
                this.jsonInit({
                    type: 'robActions_motorDiff_stop',
                    message0: '⛔ Stop',
                    previousStatement: null,
                    nextStatement: null,
                    colour: 210,
                    tooltip: 'Stoppe den Roboter.',
                    helpUrl: ''
                });
            }
        };
    }

    // ── robControls_wait_time ──────────────────────────────────────
    if (!Blockly.Blocks['robControls_wait_time']) {
        Blockly.Blocks['robControls_wait_time'] = {
            init: function () {
                this.jsonInit({
                    type: 'robControls_wait_time',
                    message0: '⏳ Warte %1 ms',
                    args0: [
                        { type: 'input_value', name: 'WAIT', check: 'Number' }
                    ],
                    previousStatement: null,
                    nextStatement: null,
                    colour: 120,
                    tooltip: 'Warte eine bestimmte Zeit (in Millisekunden).',
                    helpUrl: ''
                });
            }
        };
    }

    // ══ SCHLEIFEN / LOOPS ══════════════════════════════════════════

    // ── robControls_repeat (Wiederhole N mal) ──────────────────────
    if (!Blockly.Blocks['robControls_repeat']) {
        Blockly.Blocks['robControls_repeat'] = {
            init: function () {
                this.setColour(300);
                this.appendValueInput('TIMES')
                    .setCheck('Number')
                    .appendField('🔁 Wiederhole');
                this.appendDummyInput().appendField('mal');
                this.appendStatementInput('DO').appendField('tue');
                this.setInputsInline(true);
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Wiederhole die Blöcke darin N-mal.');
            }
        };
    }

    // ── robControls_loopForever (Wiederhole immer) ─────────────────
    if (!Blockly.Blocks['robControls_loopForever']) {
        Blockly.Blocks['robControls_loopForever'] = {
            init: function () {
                this.setColour(300);
                this.appendDummyInput().appendField('🔁 Wiederhole immer');
                this.appendStatementInput('DO').appendField('tue');
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Endlosschleife – läuft bis Stopp gedrückt wird.');
            }
        };
    }

    // ── robControls_repeat_until (Wiederhole bis) ──────────────────
    if (!Blockly.Blocks['robControls_repeat_until']) {
        Blockly.Blocks['robControls_repeat_until'] = {
            init: function () {
                this.setColour(300);
                this.appendValueInput('CONDITION')
                    .setCheck('Boolean')
                    .appendField('🔁 Wiederhole bis');
                this.appendStatementInput('DO').appendField('tue');
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Wiederhole, bis die Bedingung wahr ist.');
            }
        };
    }

    // ══ LOGIK / IF-ELSE ════════════════════════════════════════════

    // ── robControls_if (Wenn…dann…sonst) ──────────────────────────
    if (!Blockly.Blocks['robControls_if']) {
        Blockly.Blocks['robControls_if'] = {
            init: function () {
                this.setColour(210);
                this.appendValueInput('IF0')
                    .setCheck('Boolean')
                    .appendField('❓ Wenn');
                this.appendStatementInput('DO0').appendField('dann');
                this.appendStatementInput('ELSE').appendField('sonst');
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
                this.setTooltip('Führe verschiedene Blöcke aus, je nach Bedingung.');
            }
        };
    }

    // ══ SENSOREN ═══════════════════════════════════════════════════

    // ── robSensors_ultrasonic_get (Ultraschall-Abstand) ────────────
    if (!Blockly.Blocks['robSensors_ultrasonic_get']) {
        Blockly.Blocks['robSensors_ultrasonic_get'] = {
            init: function () {
                this.jsonInit({
                    type: 'robSensors_ultrasonic_get',
                    message0: '🔊 Abstand (cm)',
                    output: 'Number',
                    colour: 65,
                    tooltip: 'Gibt den Abstand zum nächsten Hindernis in cm zurück (0–255).',
                    helpUrl: ''
                });
            }
        };
    }

    // ── robSensors_color_get (Farbsensor) ─────────────────────────
    if (!Blockly.Blocks['robSensors_color_get']) {
        Blockly.Blocks['robSensors_color_get'] = {
            init: function () {
                this.jsonInit({
                    type: 'robSensors_color_get',
                    message0: '🎨 Farbe',
                    output: 'String',
                    colour: 65,
                    tooltip: 'Gibt die erkannte Farbe zurück (green, none).',
                    helpUrl: ''
                });
            }
        };
    }

    // ── robSensors_touch_get (Taster) ──────────────────────────────
    if (!Blockly.Blocks['robSensors_touch_get']) {
        Blockly.Blocks['robSensors_touch_get'] = {
            init: function () {
                this.jsonInit({
                    type: 'robSensors_touch_get',
                    message0: '👋 Taster gedrückt?',
                    output: 'Boolean',
                    colour: 65,
                    tooltip: 'Gibt an, ob der Taster (Bumper) vorne gedrückt ist.',
                    helpUrl: ''
                });
            }
        };
    }

    console.log('[MissionBlocks] Custom blocks registered.');

})();
