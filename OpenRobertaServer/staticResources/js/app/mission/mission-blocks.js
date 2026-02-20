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

    console.log('[MissionBlocks] Custom blocks registered.');
})();
