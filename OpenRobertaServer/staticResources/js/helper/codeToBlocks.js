/**
 * Code-to-Blocks Converter
 * Converts Python code (EV3dev API) back to Blockly blocks using pattern matching
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeToBlocksConverter = void 0;
    var NqcConversionError = /** @class */ (function (_super) {
        __extends(NqcConversionError, _super);
        function NqcConversionError(line, statement, detail) {
            var _this = _super.call(this, "NQC-Zeile ".concat(line, ": ").concat(detail, " (").concat(statement, ")")) || this;
            _this.name = 'NqcConversionError';
            return _this;
        }
        return NqcConversionError;
    }(Error));
    /**
     * Display Text Pattern: hal.drawText('text', x, y)
     */
    var DisplayTextPattern = /** @class */ (function () {
        function DisplayTextPattern() {
        }
        DisplayTextPattern.prototype.matches = function (line) {
            return /hal\.drawText\s*\(/.test(line);
        };
        DisplayTextPattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.drawText\s*\(\s*['"](.+?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robActions_display_text',
                values: {
                    OUT: {
                        type: 'text',
                        fields: { TEXT: match[1] },
                    },
                    COL: {
                        type: 'math_number',
                        fields: { NUM: match[2] },
                    },
                    ROW: {
                        type: 'math_number',
                        fields: { NUM: match[3] },
                    },
                },
            };
        };
        return DisplayTextPattern;
    }());
    /**
     * Clear Display Pattern: hal.clearDisplay()
     */
    var ClearDisplayPattern = /** @class */ (function () {
        function ClearDisplayPattern() {
        }
        ClearDisplayPattern.prototype.matches = function (line) {
            return /hal\.clearDisplay\s*\(\s*\)/.test(line);
        };
        ClearDisplayPattern.prototype.generateBlock = function (line) {
            return {
                type: 'robActions_display_clear',
            };
        };
        return ClearDisplayPattern;
    }());
    /**
     * Play Tone Pattern: hal.playTone(frequency, duration)
     */
    var PlayTonePattern = /** @class */ (function () {
        function PlayTonePattern() {
        }
        PlayTonePattern.prototype.matches = function (line) {
            return /hal\.playTone\s*\(/.test(line);
        };
        PlayTonePattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.playTone\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robActions_play_tone',
                values: {
                    FREQUENCY: {
                        type: 'math_number',
                        fields: { NUM: match[1] },
                    },
                    DURATION: {
                        type: 'math_number',
                        fields: { NUM: match[2] },
                    },
                },
            };
        };
        return PlayTonePattern;
    }());
    /**
     * Wait Pattern: hal.waitFor(milliseconds)
     */
    var WaitPattern = /** @class */ (function () {
        function WaitPattern() {
        }
        WaitPattern.prototype.matches = function (line) {
            return /hal\.waitFor\s*\(/.test(line);
        };
        WaitPattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.waitFor\s*\(\s*(\d+)\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robControls_wait_time',
                values: {
                    WAIT: {
                        type: 'math_number',
                        fields: { NUM: match[1] },
                    },
                },
            };
        };
        return WaitPattern;
    }());
    /**
     * Motor On For Pattern: hal.rotateRegulatedMotor(port, speed, distance)
     */
    var MotorOnForPattern = /** @class */ (function () {
        function MotorOnForPattern() {
        }
        MotorOnForPattern.prototype.matches = function (line) {
            return /hal\.rotateRegulatedMotor\s*\(/.test(line);
        };
        MotorOnForPattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.rotateRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*,\s*(-?\d+)\s*,\s*(\d+)\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robActions_motor_on_for',
                fields: {
                    MOTORPORT: match[1],
                },
                values: {
                    POWER: {
                        type: 'math_number',
                        fields: { NUM: match[2] },
                    },
                    DEGREE: {
                        type: 'math_number',
                        fields: { NUM: match[3] },
                    },
                },
            };
        };
        return MotorOnForPattern;
    }());
    /**
     * Motor On Pattern: hal.turnOnRegulatedMotor(port, speed)
     */
    var MotorOnPattern = /** @class */ (function () {
        function MotorOnPattern() {
        }
        MotorOnPattern.prototype.matches = function (line) {
            return /hal\.turnOnRegulatedMotor\s*\(/.test(line);
        };
        MotorOnPattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.turnOnRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*,\s*(-?\d+)\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robActions_motor_on',
                fields: {
                    MOTORPORT: match[1],
                },
                values: {
                    POWER: {
                        type: 'math_number',
                        fields: { NUM: match[2] },
                    },
                },
            };
        };
        return MotorOnPattern;
    }());
    /**
     * Motor Stop Pattern: hal.stopRegulatedMotor(port)
     */
    var MotorStopPattern = /** @class */ (function () {
        function MotorStopPattern() {
        }
        MotorStopPattern.prototype.matches = function (line) {
            return /hal\.stopRegulatedMotor\s*\(/.test(line);
        };
        MotorStopPattern.prototype.generateBlock = function (line) {
            var match = line.match(/hal\.stopRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*\)/);
            if (!match)
                return null;
            return {
                type: 'robActions_motor_stop',
                fields: {
                    MOTORPORT: match[1],
                },
            };
        };
        return MotorStopPattern;
    }());
    /**
     * Main Code-to-Blocks Converter
     */
    var CodeToBlocksConverter = /** @class */ (function () {
        function CodeToBlocksConverter() {
            this.patterns = [
                new DisplayTextPattern(),
                new ClearDisplayPattern(),
                new PlayTonePattern(),
                new WaitPattern(),
                new MotorOnForPattern(),
                new MotorOnPattern(),
                new MotorStopPattern(),
            ];
        }
        /** Convert Python code to Blockly XML. */
        CodeToBlocksConverter.prototype.convertToXML = function (pythonCode) {
            var lines = pythonCode.split('\n');
            var blocks = [];
            var yPosition = 100;
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                var trimmedLine = line.trim();
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue;
                }
                // Try to match against patterns
                for (var _a = 0, _b = this.patterns; _a < _b.length; _a++) {
                    var pattern = _b[_a];
                    if (pattern.matches(trimmedLine)) {
                        var block = pattern.generateBlock(trimmedLine);
                        if (block) {
                            block.x = 100;
                            block.y = yPosition;
                            yPosition += 60;
                            blocks.push(block);
                            break;
                        }
                    }
                }
            }
            return this.generateXML(this.chainBlocks(blocks));
        };
        /**
         * Converts the deliberately small, generated subset of NQC back to RCX
         * blocks. This is intentionally strict: silently dropping an unfamiliar
         * native command would produce a different robot program.
         */
        CodeToBlocksConverter.prototype.convertNqcToXML = function (nqcCode, configurationXml) {
            var statements = this.getNqcStatements(nqcCode);
            var blocks = this.convertNqcStatements(statements, configurationXml);
            if (blocks.length === 0) {
                throw new Error('Im task main wurden keine in Blöcke übersetzbaren NQC-Anweisungen gefunden.');
            }
            return this.generateXML(this.chainBlocks(blocks));
        };
        CodeToBlocksConverter.prototype.convertNqcStatements = function (statements, configurationXml) {
            var _this = this;
            var blocks = [];
            var powerStateByPort = {};
            var powerStateByGroup = {};
            // NQC keeps SetPower active until it is changed. Directions are only
            // pending for one graphical action; the associated power state persists.
            var pendingDirectionsByGroup = {};
            var pendingPowerGroups = {};
            var motorConfiguration = this.getNqcMotorConfiguration(configurationXml);
            var flushPendingPowerBlocks = function () {
                Object.keys(pendingPowerGroups).forEach(function (group) {
                    if (Object.keys(pendingDirectionsByGroup[group] || {}).length > 0) {
                        return;
                    }
                    var state = powerStateByGroup[group];
                    state.ports.forEach(function (port) { return blocks.push(_this.motorSetPowerBlock(port.substring(4), state.power)); });
                    delete pendingPowerGroups[group];
                    delete pendingDirectionsByGroup[group];
                });
            };
            var _loop_1 = function (index) {
                var statement = statements[index];
                var match = void 0;
                if (statement.body) {
                    flushPendingPowerBlocks();
                    // The RCX generator represents both "wait until" blocks as a
                    // small polling loop. Rebuild the original compact block.
                    if (statement.kind === 'while' &&
                        (statement.condition || '').trim().toLowerCase() === 'true' &&
                        statement.body.length === 2 &&
                        statement.body[0].kind === 'if' &&
                        statement.body[0].body &&
                        statement.body[0].body.length >= 1 &&
                        statement.body[0].body[statement.body[0].body.length - 1].text === 'break' &&
                        statement.body[1].text === 'Wait(1)') {
                        var waitContents = statement.body[0].body.slice(0, -1);
                        var waitBlock = {
                            type: waitContents.length === 0 ? 'robControls_wait_for' : 'robControls_wait',
                            values: {
                                WAIT0: this_1.nqcExpressionBlock(statement.body[0].condition || '', configurationXml, statement.line),
                            },
                        };
                        var convertedContents = this_1.chainBlocks(this_1.convertNqcStatements(waitContents, configurationXml));
                        if (convertedContents.length > 0)
                            waitBlock.statements = { DO0: convertedContents[0] };
                        blocks.push(waitBlock);
                        return out_index_1 = index, "continue";
                    }
                    var chainedBody = this_1.chainBlocks(this_1.convertNqcStatements(statement.body, configurationXml));
                    if (statement.kind === 'while') {
                        var condition = (statement.condition || '').trim();
                        var loop = condition.toLowerCase() === 'true'
                            ? { type: 'robControls_loopForever' }
                            : {
                                type: 'controls_whileUntil',
                                fields: { MODE: 'WHILE' },
                                values: { BOOL: this_1.nqcExpressionBlock(condition, configurationXml, statement.line) },
                            };
                        if (chainedBody.length > 0)
                            loop.statements = { DO: chainedBody[0] };
                        blocks.push(loop);
                        return out_index_1 = index, "continue";
                    }
                    if (statement.kind === 'if') {
                        var hasElse = statement.elseBody !== undefined;
                        var conditional = {
                            type: hasElse ? 'robControls_ifElse' : 'robControls_if',
                            values: { IF0: this_1.nqcExpressionBlock(statement.condition || '', configurationXml, statement.line) },
                        };
                        if (chainedBody.length > 0)
                            conditional.statements = { DO0: chainedBody[0] };
                        if (hasElse) {
                            conditional.mutation = { else: 1 };
                            conditional.repetitions = true;
                            var elseBlocks = this_1.chainBlocks(this_1.convertNqcStatements(statement.elseBody || [], configurationXml));
                            if (elseBlocks.length > 0) {
                                conditional.statements = __assign(__assign({}, (conditional.statements || {})), { ELSE: elseBlocks[0] });
                            }
                        }
                        blocks.push(conditional);
                        return out_index_1 = index, "continue";
                    }
                    if (statement.kind === 'for') {
                        var forParts = (statement.condition || '').match(/^int\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s*;\s*\1\s*<\s*(.+?)\s*;\s*\1\s*\+=\s*(.+)$/);
                        if (!forParts) {
                            throw new NqcConversionError(statement.line, statement.text, 'for-Schleife hat kein unterstütztes Zählmuster');
                        }
                        var isGeneratedRepeat = /^k\d+$/.test(forParts[1]) && forParts[2].trim() === '0' && forParts[4].trim() === '1';
                        var loop = {
                            type: isGeneratedRepeat ? 'controls_repeat_ext' : 'robControls_for',
                            fields: isGeneratedRepeat ? undefined : { VAR: forParts[1] },
                            values: isGeneratedRepeat
                                ? { TIMES: this_1.nqcExpressionBlock(forParts[3], configurationXml, statement.line) }
                                : {
                                    FROM: this_1.nqcExpressionBlock(forParts[2], configurationXml, statement.line),
                                    TO: this_1.nqcExpressionBlock(forParts[3], configurationXml, statement.line),
                                    BY: this_1.nqcExpressionBlock(forParts[4], configurationXml, statement.line),
                                },
                        };
                        if (chainedBody.length > 0)
                            loop.statements = { DO: chainedBody[0] };
                        blocks.push(loop);
                        return out_index_1 = index, "continue";
                    }
                    throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte Kontrollstruktur');
                }
                if ((match = statement.text.match(/^SetPower\((OUT_[ABC](?:\+OUT_[ABC])?),\s*NEPO_PWR\((-?\d+)\)\)$/))) {
                    // A second SetPower is an independent visible command unless
                    // the previous one is consumed by a following OnFwd/OnRev.
                    flushPendingPowerBlocks();
                    var ports = this_1.outputPorts(match[1]);
                    var group = ports.slice().sort().join('+');
                    var powerState_1 = { group: group, ports: ports, power: Number(match[2]) };
                    ports.forEach(function (port) { return (powerStateByPort[port] = powerState_1); });
                    powerStateByGroup[group] = powerState_1;
                    pendingDirectionsByGroup[group] = {};
                    pendingPowerGroups[group] = true;
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^On(Fwd|Rev)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                    var electricalForward_1 = match[1] === 'Fwd';
                    var commandPorts = this_1.outputPorts(match[2]);
                    var powerStates = commandPorts.map(function (port) { return powerStateByPort[port]; });
                    if (powerStates.some(function (state) { return state === undefined; })) {
                        throw new NqcConversionError(statement.line, statement.text, 'SetPower mit gleichem Motoranschluss fehlt');
                    }
                    var powerState_2 = powerStates[0];
                    if (powerStates.some(function (state) { return state.group !== powerState_2.group; })) {
                        throw new NqcConversionError(statement.line, statement.text, 'Motoranschlüsse gehören zu unterschiedlichen SetPower-Gruppen');
                    }
                    var directions_1 = pendingDirectionsByGroup[powerState_2.group] || {};
                    commandPorts.forEach(function (outputPort) {
                        var poweredPorts = powerState_2.ports;
                        if (poweredPorts.indexOf(outputPort) < 0) {
                            throw new NqcConversionError(statement.line, statement.text, "Motoranschluss ".concat(outputPort, " ist nicht in ").concat(powerState_2.group, " enthalten"));
                        }
                        directions_1[outputPort] = electricalForward_1;
                    });
                    pendingDirectionsByGroup[powerState_2.group] = directions_1;
                    if (powerState_2.ports.every(function (outputPort) { return directions_1[outputPort] !== undefined; })) {
                        delete pendingDirectionsByGroup[powerState_2.group];
                        delete pendingPowerGroups[powerState_2.group];
                        var poweredPorts_1 = powerState_2.ports;
                        if (poweredPorts_1.length === 1) {
                            var motor = motorConfiguration.find(function (candidate) { return candidate.port === poweredPorts_1[0].substring(4); });
                            var logicalForward = directions_1[poweredPorts_1[0]] !== (motor ? motor.reversed : false);
                            if (!logicalForward) {
                                throw new NqcConversionError(statement.line, statement.text, 'Rückwärtslauf eines einzelnen Motors kann nicht eindeutig in einen Block übersetzt werden');
                            }
                            blocks.push(this_1.singleMotorBlock(poweredPorts_1[0].substring(4), powerState_2.power));
                        }
                        else {
                            blocks.push(this_1.differentialMotorBlock(poweredPorts_1, directions_1, powerState_2.power, motorConfiguration, statement));
                        }
                    }
                    return out_index_1 = index, "continue";
                }
                // No direction command followed the pending SetPower. Preserve it
                // as one graphical set-power block per addressed RCX output.
                flushPendingPowerBlocks();
                if ((match = statement.text.match(/^(Off|Float)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                    var port = match[2];
                    if (match[1] === 'Float') {
                        this_1.outputPorts(port).forEach(function (outputPort) {
                            return blocks.push({ type: 'robActions_motor_stop', fields: { MOTORPORT: outputPort.substring(4), MODE: 'FLOAT' } });
                        });
                    }
                    else if (port.indexOf('+') >= 0) {
                        blocks.push({ type: 'robActions_motorDiff_stop' });
                    }
                    else {
                        blocks.push({ type: 'robActions_motor_stop', fields: { MOTORPORT: port.substring(4) } });
                    }
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^Wait\(\((-?\d+)\)\s*\/\s*10\)$/))) {
                    blocks.push(this_1.waitBlock(Number(match[1])));
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^PlayTone\((-?\d+),\s*\((-?\d+)\)\s*\/\s*10\)$/))) {
                    blocks.push(this_1.toneBlock(Number(match[1]), Number(match[2])));
                    // The NQC generator emits a matching Wait directly afterwards.
                    var following = statements[index + 1];
                    if (following && following.text === "Wait((".concat(match[2], ") / 10)")) {
                        index++;
                    }
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^SetUserDisplay\((-?\d+),\s*0\)$/))) {
                    blocks.push({ type: 'robActions_display_text', values: { OUT: this_1.numberBlock(Number(match[1])) } });
                    return out_index_1 = index, "continue";
                }
                if (statement.text === 'SelectDisplay(DISPLAY_WATCH)') {
                    blocks.push({ type: 'robActions_display_clear' });
                    return out_index_1 = index, "continue";
                }
                if (statement.text === 'ClearTimer(0)') {
                    blocks.push({ type: 'robSensors_timer_reset' });
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^ClearSensor\(SENSOR_([123])\)$/))) {
                    blocks.push({ type: 'robSensors_encoder_reset', fields: { SENSORPORT: match[1] } });
                    return out_index_1 = index, "continue";
                }
                if (statement.text === 'break' || statement.text === 'continue') {
                    blocks.push({ type: 'controls_flow_statements', fields: { FLOW: statement.text.toUpperCase() } });
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^([A-Za-z_]\w*)\s*\+=\s*(.+)$/))) {
                    blocks.push({
                        type: 'robMath_change',
                        values: {
                            VAR: { type: 'variables_get', mutation: { datatype: 'Number' }, fields: { VAR: match[1] } },
                            DELTA: this_1.nqcExpressionBlock(match[2], configurationXml, statement.line),
                        },
                    });
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
                    blocks.push({
                        type: 'variables_set',
                        mutation: { datatype: 'Number' },
                        fields: { VAR: match[1] },
                        values: { VALUE: this_1.nqcExpressionBlock(match[2], configurationXml, statement.line) },
                    });
                    return out_index_1 = index, "continue";
                }
                if ((match = statement.text.match(/^\/\/\s?(.*)$/))) {
                    blocks.push({ type: 'text_comment', fields: { TEXT: match[1] } });
                    return out_index_1 = index, "continue";
                }
                // Sensor setup is represented by the robot configuration, not a
                // program block. Generated setup lines are therefore safe to skip.
                if (statement.text.match(/^SetSensor\(SENSOR_[123],\s*SENSOR_(TOUCH|LIGHT|ROTATION|CELSIUS)\)$/)) {
                    return out_index_1 = index, "continue";
                }
                throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte NQC-Anweisung');
                out_index_1 = index;
            };
            var this_1 = this, out_index_1;
            for (var index = 0; index < statements.length; index++) {
                _loop_1(index);
                index = out_index_1;
            }
            flushPendingPowerBlocks();
            if (Object.keys(pendingDirectionsByGroup).some(function (group) { return Object.keys(pendingDirectionsByGroup[group]).length > 0; })) {
                throw new Error('NQC enthält unvollständige Motor-Richtungsbefehle. Die Blöcke wurden nicht verändert.');
            }
            return blocks;
        };
        CodeToBlocksConverter.prototype.getNqcStatements = function (code) {
            var main = /task\s+main\s*\(\s*\)\s*\{/m.exec(code);
            if (!main || main.index === undefined) {
                throw new Error('NQC benötigt einen task main() { ... }-Block.');
            }
            var openBrace = main.index + main[0].lastIndexOf('{');
            var closeBrace = this.findMatchingBrace(code, openBrace);
            if (closeBrace < 0) {
                throw new Error('Der task main() enthält eine nicht geschlossene geschweifte Klammer.');
            }
            var bodyStartLine = code.substring(0, openBrace + 1).split('\n').length;
            var body = code.substring(openBrace + 1, closeBrace);
            return this.parseNqcBody(body, bodyStartLine);
        };
        CodeToBlocksConverter.prototype.parseNqcBody = function (body, startLine) {
            var result = [];
            var index = 0;
            var lineAt = function (offset) { return startLine + body.substring(0, offset).split('\n').length - 1; };
            while (index < body.length) {
                while (index < body.length && /\s/.test(body[index]))
                    index++;
                if (index >= body.length)
                    break;
                if (body.substring(index, index + 2) === '//') {
                    var newline = body.indexOf('\n', index);
                    var end = newline < 0 ? body.length : newline;
                    result.push({ line: lineAt(index), text: body.substring(index, end).trim() });
                    index = end;
                    continue;
                }
                var control = null;
                for (var _i = 0, _a = ['while', 'if', 'for']; _i < _a.length; _i++) {
                    var keyword = _a[_i];
                    control = this.readNqcControlHeader(body, index, keyword);
                    if (control)
                        break;
                }
                if (control) {
                    var closeBrace = this.findMatchingBrace(body, control.openBrace);
                    if (closeBrace < 0) {
                        throw new NqcConversionError(lineAt(index), control.text, 'nicht geschlossene geschweifte Klammer');
                    }
                    var parsed = {
                        line: lineAt(index),
                        text: control.text,
                        kind: control.kind,
                        condition: control.condition,
                        body: this.parseNqcBody(body.substring(control.openBrace + 1, closeBrace), lineAt(control.openBrace + 1)),
                    };
                    index = closeBrace + 1;
                    if (control.kind === 'if') {
                        while (index < body.length && /\s/.test(body[index]))
                            index++;
                        var elseMatch = /^else\s*\{/i.exec(body.substring(index));
                        if (elseMatch) {
                            var elseOpen = index + elseMatch[0].lastIndexOf('{');
                            var elseClose = this.findMatchingBrace(body, elseOpen);
                            if (elseClose < 0) {
                                throw new NqcConversionError(lineAt(index), 'else', 'nicht geschlossene geschweifte Klammer');
                            }
                            parsed.elseBody = this.parseNqcBody(body.substring(elseOpen + 1, elseClose), lineAt(elseOpen + 1));
                            index = elseClose + 1;
                        }
                    }
                    result.push(parsed);
                    continue;
                }
                var semicolon = body.indexOf(';', index);
                var brace = body.indexOf('{', index);
                if (semicolon < 0 || (brace >= 0 && brace < semicolon)) {
                    var end = brace >= 0 ? brace : body.length;
                    var unsupported = body.substring(index, end).trim().replace(/\s+/g, ' ');
                    throw new NqcConversionError(lineAt(index), unsupported || body[index], 'nicht unterstützte oder unvollständige NQC-Anweisung');
                }
                var text = body.substring(index, semicolon).trim().replace(/\s+/g, ' ');
                if (text)
                    result.push({ line: lineAt(index), text: text });
                index = semicolon + 1;
            }
            return result;
        };
        CodeToBlocksConverter.prototype.readNqcControlHeader = function (body, start, keyword) {
            var keywordMatch = new RegExp("^".concat(keyword, "\\b"), 'i').exec(body.substring(start));
            if (!keywordMatch)
                return null;
            var cursor = start + keywordMatch[0].length;
            while (cursor < body.length && /\s/.test(body[cursor]))
                cursor++;
            if (body[cursor] !== '(')
                return null;
            var closeParen = this.findMatchingDelimiter(body, cursor, '(', ')');
            if (closeParen < 0)
                return null;
            var condition = body.substring(cursor + 1, closeParen).trim();
            cursor = closeParen + 1;
            while (cursor < body.length && /\s/.test(body[cursor]))
                cursor++;
            if (body[cursor] !== '{')
                return null;
            return { kind: keyword, condition: condition, openBrace: cursor, text: "".concat(keyword, " (").concat(condition, ")") };
        };
        CodeToBlocksConverter.prototype.findMatchingDelimiter = function (text, open, opening, closing) {
            var depth = 0;
            for (var index = open; index < text.length; index++) {
                if (text[index] === opening)
                    depth++;
                if (text[index] === closing) {
                    depth--;
                    if (depth === 0)
                        return index;
                }
            }
            return -1;
        };
        CodeToBlocksConverter.prototype.findMatchingBrace = function (text, openBrace) {
            var depth = 0;
            for (var index = openBrace; index < text.length; index++) {
                if (text[index] === '{')
                    depth++;
                if (text[index] === '}') {
                    depth--;
                    if (depth === 0)
                        return index;
                }
            }
            return -1;
        };
        CodeToBlocksConverter.prototype.numberBlock = function (value) {
            return { type: 'math_number', fields: { NUM: value } };
        };
        /** Translate the expression subset emitted by RcxNqcVisitor back to value blocks. */
        CodeToBlocksConverter.prototype.nqcExpressionBlock = function (expression, configurationXml, line) {
            var _a, _b;
            var source = expression.trim();
            while (source[0] === '(' && this.findMatchingDelimiter(source, 0, '(', ')') === source.length - 1) {
                source = source.substring(1, source.length - 1).trim();
            }
            if (/^-?\d+$/.test(source))
                return this.numberBlock(Number(source));
            if (/^(true|false)$/i.test(source)) {
                return { type: 'logic_boolean', fields: { BOOL: source.toUpperCase() } };
            }
            if (/^null$/i.test(source))
                return { type: 'logic_null' };
            var match;
            if ((match = source.match(/^SENSOR_([123])$/))) {
                var port = match[1];
                return { type: this.getNqcSensorBlockType(port, configurationXml), fields: { SENSORPORT: port } };
            }
            if (source.replace(/\s+/g, '').toLowerCase() === 'fasttimer(0)*10') {
                return { type: 'robSensors_timer_getSample' };
            }
            if ((match = source.replace(/\s+/g, '').match(/^SENSOR_([123])\*360\/16$/))) {
                return { type: 'robSensors_encoder_getSample', fields: { SENSORPORT: match[1] } };
            }
            if ((match = source.match(/^MIN\s*\(\s*MAX\s*\((.*)\)\s*,\s*(.*)\)$/i))) {
                var maxArgs = this.splitTopLevelArguments(match[1]);
                if (maxArgs.length === 2) {
                    return {
                        type: 'math_constrain',
                        values: {
                            VALUE: this.nqcExpressionBlock(maxArgs[0], configurationXml, line),
                            LOW: this.nqcExpressionBlock(maxArgs[1], configurationXml, line),
                            HIGH: this.nqcExpressionBlock(match[2], configurationXml, line),
                        },
                    };
                }
            }
            if ((match = source.match(/^Random\s*\(\s*\((.*)\)\s*-\s*\((.*)\)\s*\)\s*\+\s*\((.*)\)$/i))) {
                return {
                    type: 'math_random_int',
                    values: {
                        FROM: this.nqcExpressionBlock(match[3], configurationXml, line),
                        TO: this.nqcExpressionBlock(match[1], configurationXml, line),
                    },
                };
            }
            if (source[0] === '!') {
                return {
                    type: 'logic_negate',
                    values: { BOOL: this.nqcExpressionBlock(source.substring(1), configurationXml, line) },
                };
            }
            var question = this.findTopLevelOperator(source, ['?']);
            if (question) {
                var remainder = source.substring(question.index + 1);
                var colon = this.findTopLevelOperator(remainder, [':']);
                if (colon) {
                    return {
                        type: 'logic_ternary',
                        values: {
                            IF: this.nqcExpressionBlock(source.substring(0, question.index), configurationXml, line),
                            THEN: this.nqcExpressionBlock(remainder.substring(0, colon.index), configurationXml, line),
                            ELSE: this.nqcExpressionBlock(remainder.substring(colon.index + 1), configurationXml, line),
                        },
                    };
                }
            }
            var operators = [
                { symbols: ['||', '&&'], type: 'logic_operation', field: 'OP', values: ['A', 'B'] },
                { symbols: ['==', '!=', '<=', '>=', '<', '>'], type: 'logic_compare', field: 'OP', values: ['A', 'B'] },
                { symbols: ['+', '-'], type: 'math_arithmetic', field: 'OP', values: ['A', 'B'] },
                { symbols: ['*', '/'], type: 'math_arithmetic', field: 'OP', values: ['A', 'B'] },
                { symbols: ['%'], type: 'math_modulo', field: '', values: ['DIVIDEND', 'DIVISOR'] },
            ];
            var blocklyOperators = {
                '||': 'OR',
                '&&': 'AND',
                '==': 'EQ',
                '!=': 'NEQ',
                '<': 'LT',
                '<=': 'LTE',
                '>': 'GT',
                '>=': 'GTE',
                '+': 'ADD',
                '-': 'MINUS',
                '*': 'MULTIPLY',
                '/': 'DIVIDE',
            };
            for (var _i = 0, operators_1 = operators; _i < operators_1.length; _i++) {
                var group = operators_1[_i];
                var found = this.findTopLevelOperator(source, group.symbols);
                if (found) {
                    var block = {
                        type: group.type,
                        values: (_a = {},
                            _a[group.values[0]] = this.nqcExpressionBlock(source.substring(0, found.index), configurationXml, line),
                            _a[group.values[1]] = this.nqcExpressionBlock(source.substring(found.index + found.operator.length), configurationXml, line),
                            _a),
                    };
                    if (group.field)
                        block.fields = (_b = {}, _b[group.field] = blocklyOperators[found.operator], _b);
                    return block;
                }
            }
            if (/^[A-Za-z_]\w*$/.test(source)) {
                return { type: 'variables_get', mutation: { datatype: 'Number' }, fields: { VAR: source } };
            }
            throw new NqcConversionError(line, expression, 'Ausdruck kann noch nicht eindeutig in einen Block übersetzt werden');
        };
        CodeToBlocksConverter.prototype.findTopLevelOperator = function (source, operators) {
            var depth = 0;
            for (var index = source.length - 1; index >= 0; index--) {
                if (source[index] === ')')
                    depth++;
                if (source[index] === '(')
                    depth--;
                if (depth !== 0)
                    continue;
                for (var _i = 0, operators_2 = operators; _i < operators_2.length; _i++) {
                    var operator = operators_2[_i];
                    var start = index - operator.length + 1;
                    if (start >= 0 && source.substring(start, index + 1) === operator) {
                        if (operator === '-' && (start === 0 || /[+\-*/%<>=!&(,]/.test(source[start - 1])))
                            continue;
                        return { index: start, operator: operator };
                    }
                }
            }
            return null;
        };
        CodeToBlocksConverter.prototype.splitTopLevelArguments = function (source) {
            var result = [];
            var depth = 0;
            var start = 0;
            for (var index = 0; index < source.length; index++) {
                if (source[index] === '(')
                    depth++;
                if (source[index] === ')')
                    depth--;
                if (source[index] === ',' && depth === 0) {
                    result.push(source.substring(start, index).trim());
                    start = index + 1;
                }
            }
            result.push(source.substring(start).trim());
            return result;
        };
        CodeToBlocksConverter.prototype.getNqcSensorBlockType = function (port, configurationXml) {
            var defaults = {
                '1': 'robSensors_touch_getSample',
                '2': 'robSensors_light_getSample',
                '3': 'robSensors_encoder_getSample',
            };
            if (!configurationXml)
                return defaults[port];
            var document = new DOMParser().parseFromString(configurationXml, 'text/xml');
            var sensorTypes = {
                robBrick_touch: 'robSensors_touch_getSample',
                robBrick_light: 'robSensors_light_getSample',
                robBrick_encoder: 'robSensors_encoder_getSample',
                robBrick_temperature: 'robSensors_temperature_getSample',
            };
            var value = Array.from(document.getElementsByTagName('value')).find(function (candidate) { return candidate.getAttribute('name') === "S".concat(port); });
            var sensor = value && Array.from(value.children).find(function (child) { return child.tagName.toLowerCase() === 'block'; });
            return (sensor && sensorTypes[sensor.getAttribute('type') || '']) || defaults[port];
        };
        CodeToBlocksConverter.prototype.outputPorts = function (portExpression) {
            return portExpression.split('+');
        };
        CodeToBlocksConverter.prototype.getNqcMotorConfiguration = function (configurationXml) {
            if (!configurationXml) {
                return [];
            }
            var document = new DOMParser().parseFromString(configurationXml, 'text/xml');
            var result = [];
            Array.from(document.getElementsByTagName('value')).forEach(function (value) {
                var name = value.getAttribute('name') || '';
                var portMatch = name.match(/^M([ABC])$/);
                if (!portMatch) {
                    return;
                }
                var motor = Array.from(value.children).find(function (child) { return child.tagName.toLowerCase() === 'block'; });
                if (!motor || motor.getAttribute('type') !== 'robBrick_motor_big') {
                    return;
                }
                var fields = {};
                Array.from(motor.children).forEach(function (child) {
                    if (child.tagName.toLowerCase() === 'field') {
                        fields[child.getAttribute('name') || ''] = (child.textContent || '').trim();
                    }
                });
                if (fields.MOTOR_DRIVE === 'LEFT' || fields.MOTOR_DRIVE === 'RIGHT') {
                    result.push({ port: portMatch[1], side: fields.MOTOR_DRIVE, reversed: fields.MOTOR_REVERSE === 'ON' });
                }
            });
            return result;
        };
        CodeToBlocksConverter.prototype.differentialMotorBlock = function (poweredPorts, directions, power, configuration, statement) {
            var motors = poweredPorts.map(function (outputPort) { return configuration.find(function (motor) { return motor.port === outputPort.substring(4); }); });
            var left = motors.find(function (motor) { return motor && motor.side === 'LEFT'; });
            var right = motors.find(function (motor) { return motor && motor.side === 'RIGHT'; });
            if (!left || !right) {
                throw new NqcConversionError(statement.line, statement.text, 'linker und rechter Motor fehlen in der Roboterkonfiguration');
            }
            var leftForward = directions["OUT_".concat(left.port)] !== left.reversed;
            var rightForward = directions["OUT_".concat(right.port)] !== right.reversed;
            if (leftForward === rightForward) {
                return this.driveBlock(leftForward ? 'FOREWARD' : 'BACKWARD', power);
            }
            return this.turnBlock(leftForward ? 'RIGHT' : 'LEFT', power);
        };
        CodeToBlocksConverter.prototype.driveBlock = function (direction, power) {
            return { type: 'robActions_motorDiff_on', fields: { DIRECTION: direction }, values: { POWER: this.numberBlock(power) } };
        };
        CodeToBlocksConverter.prototype.turnBlock = function (direction, power) {
            return { type: 'robActions_motorDiff_turn', fields: { DIRECTION: direction }, values: { POWER: this.numberBlock(power) } };
        };
        CodeToBlocksConverter.prototype.singleMotorBlock = function (port, power) {
            return { type: 'robActions_motor_on', fields: { MOTORPORT: port }, values: { POWER: this.numberBlock(power) } };
        };
        CodeToBlocksConverter.prototype.motorSetPowerBlock = function (port, power) {
            return { type: 'robActions_motor_setPower', fields: { MOTORPORT: port }, values: { POWER: this.numberBlock(power) } };
        };
        CodeToBlocksConverter.prototype.waitBlock = function (milliseconds) {
            return { type: 'robControls_wait_time', values: { WAIT: this.numberBlock(milliseconds) } };
        };
        CodeToBlocksConverter.prototype.toneBlock = function (frequency, duration) {
            return {
                type: 'robActions_play_tone',
                values: { FREQUENCE: this.numberBlock(frequency), DURATION: this.numberBlock(duration) },
            };
        };
        CodeToBlocksConverter.prototype.chainBlocks = function (blocks) {
            for (var index = 0; index < blocks.length - 1; index++) {
                blocks[index].next = blocks[index + 1];
            }
            return blocks.length ? [blocks[0]] : [];
        };
        /**
         * Generate Open Roberta Blockly XML from block definitions.
         * This Blockly build expects a block_set root, not the newer <xml> root.
         */
        CodeToBlocksConverter.prototype.generateXML = function (blocks) {
            var xml = '<block_set xmlns="http://de.fhg.iais.roberta.blockly" robottype="rcx" xmlversion="3.1" description="" tags="">\n';
            xml += '  <instance x="100" y="100">\n';
            for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
                var block = blocks_1[_i];
                var current = block;
                while (current) {
                    xml += this.blockToXML(current, 2, false);
                    current = current.next;
                }
            }
            xml += '  </instance>\n';
            xml += '</block_set>';
            return xml;
        };
        /**
         * Convert a single block definition to XML
         */
        CodeToBlocksConverter.prototype.blockToXML = function (block, indent, includeNext) {
            var _this = this;
            if (includeNext === void 0) { includeNext = true; }
            var indentStr = '  '.repeat(indent);
            var xml = "".concat(indentStr, "<block type=\"").concat(block.type, "\"");
            if (block.x !== undefined && block.y !== undefined) {
                xml += " x=\"".concat(block.x, "\" y=\"").concat(block.y, "\"");
            }
            xml += '>\n';
            if (block.mutation) {
                var attributes = Object.entries(block.mutation)
                    .map(function (_a) {
                    var name = _a[0], value = _a[1];
                    return " ".concat(_this.xmlEscape(name), "=\"").concat(_this.xmlEscape(String(value)), "\"");
                })
                    .join('');
                xml += "".concat(indentStr, "  <mutation").concat(attributes, "></mutation>\n");
            }
            if (block.repetitions)
                xml += "".concat(indentStr, "  <repetitions>\n");
            var childIndent = block.repetitions ? "".concat(indentStr, "    ") : "".concat(indentStr, "  ");
            var childDepth = block.repetitions ? indent + 3 : indent + 2;
            // Add fields
            if (block.fields) {
                for (var _i = 0, _a = Object.entries(block.fields); _i < _a.length; _i++) {
                    var _b = _a[_i], name_1 = _b[0], value = _b[1];
                    xml += "".concat(childIndent, "<field name=\"").concat(this.xmlEscape(name_1), "\">").concat(this.xmlEscape(String(value)), "</field>\n");
                }
            }
            // Add values (nested blocks)
            if (block.values) {
                for (var _c = 0, _d = Object.entries(block.values); _c < _d.length; _c++) {
                    var _e = _d[_c], name_2 = _e[0], valueBlock = _e[1];
                    xml += "".concat(childIndent, "<value name=\"").concat(name_2, "\">\n");
                    xml += this.blockToXML(valueBlock, childDepth);
                    xml += "".concat(childIndent, "</value>\n");
                }
            }
            // Add statement inputs (for example the body of a forever loop).
            if (block.statements) {
                for (var _f = 0, _g = Object.entries(block.statements); _f < _g.length; _f++) {
                    var _h = _g[_f], name_3 = _h[0], statementBlock = _h[1];
                    xml += "".concat(childIndent, "<statement name=\"").concat(name_3, "\">\n");
                    xml += this.blockToXML(statementBlock, childDepth);
                    xml += "".concat(childIndent, "</statement>\n");
                }
            }
            if (block.repetitions)
                xml += "".concat(indentStr, "  </repetitions>\n");
            // Add next block
            if (includeNext && block.next) {
                xml += "".concat(indentStr, "  <next>\n");
                xml += this.blockToXML(block.next, indent + 2);
                xml += "".concat(indentStr, "  </next>\n");
            }
            xml += "".concat(indentStr, "</block>\n");
            return xml;
        };
        CodeToBlocksConverter.prototype.xmlEscape = function (value) {
            return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        };
        return CodeToBlocksConverter;
    }());
    exports.CodeToBlocksConverter = CodeToBlocksConverter;
});
