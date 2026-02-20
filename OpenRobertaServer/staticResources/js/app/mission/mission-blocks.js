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

    // ── robActions_build_ramp ──────────────────────────────────────
    if (!Blockly.Blocks['robActions_build_ramp']) {
        Blockly.Blocks['robActions_build_ramp'] = {
            init: function () {
                this.jsonInit({
                    type: 'robActions_build_ramp',
                    message0: '🌉 Baue Rampe | Start (X: %1 Y: %2 Z: %3) | Ende (X: %4 Y: %5 Z: %6) | Breite: %7',
                    args0: [
                        { type: 'input_value', name: 'X0', check: 'Number' },
                        { type: 'input_value', name: 'Y0', check: 'Number' },
                        { type: 'input_value', name: 'Z0', check: 'Number' },
                        { type: 'input_value', name: 'X1', check: 'Number' },
                        { type: 'input_value', name: 'Y1', check: 'Number' },
                        { type: 'input_value', name: 'Z1', check: 'Number' },
                        { type: 'input_value', name: 'WIDTH', check: 'Number' }
                    ],
                    inputsInline: false,
                    previousStatement: null,
                    nextStatement: null,
                    colour: 260,
                    tooltip: 'Baue eine 3D Rampe von (X0,Y0,Z0) nach (X1,Y1,Z1).',
                    helpUrl: ''
                });
            }
        };
    }

    // ── robActions_build_obstacle ──────────────────────────────────
    if (!Blockly.Blocks['robActions_build_obstacle']) {
        Blockly.Blocks['robActions_build_obstacle'] = {
            init: function () {
                this.jsonInit({
                    type: 'robActions_build_obstacle',
                    message0: '🧱 Baue Hindernis | Pos (X: %1 Z: %2) | Größe (B: %3 H: %4 T: %5)',
                    args0: [
                        { type: 'input_value', name: 'X', check: 'Number' },
                        { type: 'input_value', name: 'Z', check: 'Number' },
                        { type: 'input_value', name: 'WIDTH', check: 'Number' },
                        { type: 'input_value', name: 'HEIGHT', check: 'Number' },
                        { type: 'input_value', name: 'DEPTH', check: 'Number' }
                    ],
                    inputsInline: false,
                    previousStatement: null,
                    nextStatement: null,
                    colour: 260,
                    tooltip: 'Baue ein Hindernis (Quader).',
                    helpUrl: ''
                });
            }
        };
    }

    console.log('[MissionBlocks] Custom blocks registered.');
})();
