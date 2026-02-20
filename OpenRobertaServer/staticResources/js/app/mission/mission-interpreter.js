/**
 * mission-interpreter.js
 * Reads blocks from the Blockly workspace and
 * converts them into a flat array of movement commands
 * that the 3D simulation can execute step-by-step.
 *
 * Commands:
 *   { type: 'drive',  distance: cm,  speed: 0-100 }
 *   { type: 'turn',   degrees: °,    speed: 0-100 }
 *   { type: 'stop' }
 *   { type: 'wait',   ms: number }
 */
window.MissionInterpreter = (function () {
    'use strict';

    /**
     * Extract a numeric value from a child input on a block.
     * Falls back to `defaultVal` if no child block is attached.
     */
    function getNumberInput(block, inputName, defaultVal) {
        var child = block.getInputTargetBlock(inputName);
        if (child && child.type === 'math_number') {
            return parseFloat(child.getFieldValue('NUM')) || defaultVal;
        }
        return defaultVal;
    }

    /**
     * Walk the linked list of statement blocks starting at `block`.
     * Returns an array of command objects.
     */
    function walkBlocks(block, commands) {
        if (!block) return;

        var type = block.type;

        if (type === 'robControls_start') {
            // recurse into body
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robActions_motorDiff_on_for') {
            var speed = getNumberInput(block, 'POWER', 50);
            var distance = getNumberInput(block, 'DISTANCE', 30);
            // OpenRoberta uses uppercase: 'FOREWARD' / 'BACKWARD' (note typo)
            var dir = (block.getFieldValue('DIRECTION') || 'FOREWARD').toUpperCase();
            if (dir === 'BACKWARD' || dir === 'BACKWARDS') distance = -distance;
            commands.push({ type: 'drive', distance: distance, speed: speed });
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robActions_motorDiff_turn') {
            var speed = getNumberInput(block, 'POWER', 50);
            var degrees = getNumberInput(block, 'DEGREES', 90);
            // OpenRoberta uses uppercase for DIRECTION field: 'RIGHT' / 'LEFT'
            // (the field is called DIRECTION on the turn block too)
            var turnDir = (block.getFieldValue('TURN') || block.getFieldValue('DIRECTION') || 'RIGHT').toUpperCase();
            if (turnDir === 'LEFT') degrees = -degrees;   // left = negative = counter-clockwise
            commands.push({ type: 'turn', degrees: degrees, speed: speed });
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robActions_motorDiff_stop') {
            commands.push({ type: 'stop' });
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robActions_build_ramp') {
            var x0 = getNumberInput(block, 'X0', 0);
            var y0 = getNumberInput(block, 'Y0', 0);
            var z0 = getNumberInput(block, 'Z0', 5);
            var x1 = getNumberInput(block, 'X1', 0);
            var y1 = getNumberInput(block, 'Y1', 2);
            var z1 = getNumberInput(block, 'Z1', 15);
            var w = getNumberInput(block, 'WIDTH', 4);
            commands.push({ type: 'build_ramp', x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1, width: w });
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robActions_build_obstacle') {
            var oX = getNumberInput(block, 'X', 5);
            var oZ = getNumberInput(block, 'Z', 5);
            var oW = getNumberInput(block, 'WIDTH', 2);
            var oH = getNumberInput(block, 'HEIGHT', 2);
            var oD = getNumberInput(block, 'DEPTH', 2);
            commands.push({ type: 'build_obstacle', x: oX, z: oZ, w: oW, h: oH, d: oD });
            walkBlocks(block.getNextBlock(), commands);

        } else if (type === 'robControls_wait_time') {
            var ms = getNumberInput(block, 'WAIT', 1000);
            commands.push({ type: 'wait', ms: ms });
            walkBlocks(block.getNextBlock(), commands);

        } else {
            // Unknown block – skip and continue
            console.warn('[MissionInterpreter] Unknown block type:', type);
            walkBlocks(block.getNextBlock(), commands);
        }
    }

    /**
     * Parse the given Blockly workspace.
     * Returns an array of commands or null if no start block found.
     */
    function parse(workspace) {
        if (!workspace) {
            console.error('[MissionInterpreter] No workspace provided.');
            return null;
        }

        var allBlocks = workspace.getAllBlocks(false);
        var startBlock = null;
        for (var i = 0; i < allBlocks.length; i++) {
            if (allBlocks[i].type === 'robControls_start') {
                startBlock = allBlocks[i];
                break;
            }
        }

        if (!startBlock) {
            console.warn('[MissionInterpreter] No robControls_start block found.');
            return null;
        }

        var commands = [];
        walkBlocks(startBlock, commands);
        console.log('[MissionInterpreter] Parsed commands:', commands);
        return commands;
    }

    return { parse: parse };
})();
