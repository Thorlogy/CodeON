/**
 * mission-interpreter.js  –  v2: Tree-based AST (dynamic runtime)
 * ─────────────────────────────────────────────────────────────────
 *
 * parse(workspace) → AST Node tree
 *
 * AST Node types:
 *   { type:'sequence', body:[ node, ... ] }
 *   { type:'drive',    distance, speed }
 *   { type:'turn',     degrees, speed }
 *   { type:'stop' }
 *   { type:'wait',     ms }
 *   { type:'repeat',   times: N,  body: node }
 *   { type:'repeat_forever',       body: node }
 *   { type:'repeat_until', cond: expr, body: node }
 *   { type:'if',       cond: expr, thenBody: node, elseBody: node|null }
 *
 * Expr Node types (used inside conditions):
 *   { type:'sensor_ultrasonic' }          → number (cm)
 *   { type:'sensor_color' }               → string ('black','white',...)
 *   { type:'sensor_touch' }               → boolean
 *   { type:'number',   value: N }
 *   { type:'string',   value: 'x' }
 *   { type:'boolean',  value: true|false }
 *   { type:'compare',  op: '<'|'>'|'='|'<='|'>='|'!=' , left: expr, right: expr }
 *   { type:'logic',    op: 'AND'|'OR',    left: expr, right: expr }
 *   { type:'not',      expr: expr }
 */
window.MissionInterpreter = (function () {
    'use strict';

    // ── Helpers ────────────────────────────────────────────────────

    function getNumberInput(block, inputName, defaultVal) {
        var child = block.getInputTargetBlock(inputName);
        if (!child) return defaultVal;
        // math_number
        if (child.type === 'math_number') {
            return parseFloat(child.getFieldValue('NUM')) || defaultVal;
        }
        // If it's an expression block, parse it as an expr node and evaluate statically if possible
        var expr = parseExpr(child);
        if (expr && expr.type === 'number') return expr.value;
        return defaultVal;
    }

    function getExprInput(block, inputName) {
        var child = block.getInputTargetBlock(inputName);
        if (!child) return null;
        return parseExpr(child);
    }

    // ── Expression parser ──────────────────────────────────────────

    function parseExpr(block) {
        if (!block) return null;
        var t = block.type;

        // Numbers
        if (t === 'math_number') {
            return { type: 'number', value: parseFloat(block.getFieldValue('NUM')) || 0 };
        }
        // Booleans
        if (t === 'logic_boolean') {
            return { type: 'boolean', value: block.getFieldValue('BOOL') === 'TRUE' };
        }
        // Text
        if (t === 'text') {
            return { type: 'string', value: block.getFieldValue('TEXT') || '' };
        }

        // Logic NOT
        if (t === 'logic_negate') {
            return { type: 'not', expr: getExprInput(block, 'BOOL') };
        }
        // Logic AND / OR
        if (t === 'logic_operation') {
            return {
                type: 'logic',
                op: block.getFieldValue('OP') || 'AND',
                left: getExprInput(block, 'A'),
                right: getExprInput(block, 'B')
            };
        }
        // Comparison (<, >, =, etc.)
        if (t === 'logic_compare') {
            return {
                type: 'compare',
                op: block.getFieldValue('OP') || 'EQ',
                left: getExprInput(block, 'A'),
                right: getExprInput(block, 'B')
            };
        }
        // Math arithmetic
        if (t === 'math_arithmetic') {
            return {
                type: 'arithmetic',
                op: block.getFieldValue('OP') || 'ADD',
                left: getExprInput(block, 'A'),
                right: getExprInput(block, 'B')
            };
        }

        // Sensor blocks
        if (t === 'robSensors_ultrasonic_get') {
            return { type: 'sensor_ultrasonic' };
        }
        if (t === 'robSensors_color_get') {
            return { type: 'sensor_color' };
        }
        if (t === 'robSensors_touch_get') {
            return { type: 'sensor_touch' };
        }

        // Fallback: unknown expression
        console.warn('[MissionInterpreter] Unknown expr block:', t);
        return { type: 'number', value: 0 };
    }

    // ── Statement parser ───────────────────────────────────────────

    /**
     * Parse a linked list of statement blocks into an array of AST nodes.
     */
    function parseStatements(block) {
        var nodes = [];
        var cur = block;
        while (cur) {
            var node = parseStatement(cur);
            if (node) nodes.push(node);
            cur = cur.getNextBlock();
        }
        return nodes;
    }

    /**
     * Parse a single statement block into an AST node (ignoring getNextBlock).
     */
    function parseStatement(block) {
        if (!block) return null;
        var t = block.type;

        // ── Start block: drill into body ───────────────────────────
        if (t === 'robControls_start') {
            var inner = block.getNextBlock();
            return inner ? { type: 'sequence', body: parseStatements(inner) } : null;
        }

        // ── Drive ──────────────────────────────────────────────────
        if (t === 'robActions_motorDiff_on_for') {
            var speed = getNumberInput(block, 'POWER', 50);
            var distance = getNumberInput(block, 'DISTANCE', 30);
            var dir = (block.getFieldValue('DIRECTION') || 'FOREWARD').toUpperCase();
            if (dir === 'BACKWARD' || dir === 'BACKWARDS') distance = -distance;
            return { type: 'drive', distance: distance, speed: speed };
        }

        // ── Turn ───────────────────────────────────────────────────
        if (t === 'robActions_motorDiff_turn') {
            var speed = getNumberInput(block, 'POWER', 50);
            var degrees = getNumberInput(block, 'DEGREES', 90);
            var turnDir = (block.getFieldValue('TURN') || block.getFieldValue('DIRECTION') || 'RIGHT').toUpperCase();
            if (turnDir === 'LEFT') degrees = -degrees;
            return { type: 'turn', degrees: degrees, speed: speed };
        }

        // ── Stop ───────────────────────────────────────────────────
        if (t === 'robActions_motorDiff_stop') {
            return { type: 'stop' };
        }

        // ── Wait ───────────────────────────────────────────────────
        if (t === 'robControls_wait_time') {
            var ms = getNumberInput(block, 'WAIT', 1000);
            return { type: 'wait', ms: ms };
        }

        // ── Repeat N times ─────────────────────────────────────────
        if (t === 'robControls_loopForever' || t === 'controls_repeat_forever') {
            var bodyBlock = block.getInputTargetBlock('DO') || block.getInputTargetBlock('SUBSTACK');
            return {
                type: 'repeat_forever',
                body: { type: 'sequence', body: bodyBlock ? parseStatements(bodyBlock) : [] }
            };
        }
        if (t === 'robControls_repeat' || t === 'controls_repeat_ext' || t === 'controls_repeat') {
            var times = getNumberInput(block, 'TIMES', 3);
            var bodyBlock = block.getInputTargetBlock('DO') || block.getInputTargetBlock('SUBSTACK');
            return {
                type: 'repeat',
                times: times,
                body: { type: 'sequence', body: bodyBlock ? parseStatements(bodyBlock) : [] }
            };
        }

        // ── Repeat until ───────────────────────────────────────────
        if (t === 'robControls_repeat_until' || t === 'controls_whileUntil') {
            var cond = getExprInput(block, 'CONDITION') || getExprInput(block, 'BOOL');
            var bodyBlock = block.getInputTargetBlock('DO') || block.getInputTargetBlock('SUBSTACK');
            var mode = block.getFieldValue('MODE') || 'UNTIL';
            return {
                type: 'repeat_until',
                mode: mode,         // 'UNTIL' → repeat until cond true; 'WHILE' → repeat while cond true
                cond: cond,
                body: { type: 'sequence', body: bodyBlock ? parseStatements(bodyBlock) : [] }
            };
        }

        // ── If / If-Else ───────────────────────────────────────────
        if (t === 'robControls_if' || t === 'controls_if') {
            var cond = getExprInput(block, 'IF0') || getExprInput(block, 'IF');
            var thenBlock = block.getInputTargetBlock('DO0') || block.getInputTargetBlock('DO');
            var elseBlock = block.getInputTargetBlock('ELSE');
            return {
                type: 'if',
                cond: cond,
                thenBody: { type: 'sequence', body: thenBlock ? parseStatements(thenBlock) : [] },
                elseBody: elseBlock ? { type: 'sequence', body: parseStatements(elseBlock) } : null
            };
        }

        // Unknown – skip
        console.warn('[MissionInterpreter] Unknown statement block:', t);
        return null;
    }

    // ── Public API ─────────────────────────────────────────────────

    /**
     * Parse a Blockly workspace → AST node tree.
     * Returns null if no start block found.
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

        var ast = parseStatement(startBlock);
        console.log('[MissionInterpreter] AST:', JSON.stringify(ast, null, 2));
        return ast;
    }

    return { parse: parse };
})();
