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
            var blocks = [];
            var powerStateByPort = {};
            // NQC keeps SetPower active until it is changed. Directions are only
            // pending for one graphical action; the associated power state persists.
            var pendingDirectionsByGroup = {};
            var pendingPowerGroups = {};
            var motorConfiguration = this.getNqcMotorConfiguration(configurationXml);
            var _loop_1 = function (index) {
                var statement = statements[index];
                var match = void 0;
                if ((match = statement.text.match(/^SetPower\((OUT_[ABC](?:\+OUT_[ABC])?),\s*NEPO_PWR\((-?\d+)\)\)$/))) {
                    var ports = this_1.outputPorts(match[1]);
                    var group = ports.slice().sort().join('+');
                    var powerState_1 = { group: group, ports: ports, power: Number(match[2]) };
                    ports.forEach(function (port) { return (powerStateByPort[port] = powerState_1); });
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
                if ((match = statement.text.match(/^(Off|Float)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                    var port = match[2];
                    if (port.indexOf('+') >= 0) {
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
                throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte NQC-Anweisung');
                out_index_1 = index;
            };
            var this_1 = this, out_index_1;
            for (var index = 0; index < statements.length; index++) {
                _loop_1(index);
                index = out_index_1;
            }
            if (Object.keys(pendingPowerGroups).length > 0) {
                throw new Error('NQC enthält SetPower ohne nachfolgendes OnFwd oder OnRev. Die Blöcke wurden nicht verändert.');
            }
            if (Object.keys(pendingDirectionsByGroup).some(function (group) { return Object.keys(pendingDirectionsByGroup[group]).length > 0; })) {
                throw new Error('NQC enthält unvollständige Motor-Richtungsbefehle. Die Blöcke wurden nicht verändert.');
            }
            if (blocks.length === 0) {
                throw new Error('Im task main wurden keine in Blöcke übersetzbaren NQC-Anweisungen gefunden.');
            }
            return this.generateXML(this.chainBlocks(blocks));
        };
        CodeToBlocksConverter.prototype.getNqcStatements = function (code) {
            var main = code.match(/task\s+main\s*\(\s*\)\s*\{([\s\S]*?)\}/);
            if (!main || main.index === undefined) {
                throw new Error('NQC benötigt einen task main() { ... }-Block.');
            }
            var bodyStartLine = code.substring(0, main.index + main[0].indexOf('{') + 1).split('\n').length;
            var body = main[1].replace(/\/\/.*$/gm, '');
            var result = [];
            body.split(';').forEach(function (part) {
                var text = part.trim().replace(/\s+/g, ' ');
                if (text) {
                    var offset = body.indexOf(part);
                    result.push({ line: bodyStartLine + body.substring(0, offset).split('\n').length - 1, text: text });
                }
            });
            return result;
        };
        CodeToBlocksConverter.prototype.numberBlock = function (value) {
            return { type: 'math_number', fields: { NUM: value } };
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
            if (includeNext === void 0) { includeNext = true; }
            var indentStr = '  '.repeat(indent);
            var xml = "".concat(indentStr, "<block type=\"").concat(block.type, "\"");
            if (block.x !== undefined && block.y !== undefined) {
                xml += " x=\"".concat(block.x, "\" y=\"").concat(block.y, "\"");
            }
            xml += '>\n';
            // Add fields
            if (block.fields) {
                for (var _i = 0, _a = Object.entries(block.fields); _i < _a.length; _i++) {
                    var _b = _a[_i], name_1 = _b[0], value = _b[1];
                    xml += "".concat(indentStr, "  <field name=\"").concat(name_1, "\">").concat(value, "</field>\n");
                }
            }
            // Add values (nested blocks)
            if (block.values) {
                for (var _c = 0, _d = Object.entries(block.values); _c < _d.length; _c++) {
                    var _e = _d[_c], name_2 = _e[0], valueBlock = _e[1];
                    xml += "".concat(indentStr, "  <value name=\"").concat(name_2, "\">\n");
                    xml += this.blockToXML(valueBlock, indent + 2);
                    xml += "".concat(indentStr, "  </value>\n");
                }
            }
            // Add next block
            if (includeNext && block.next) {
                xml += "".concat(indentStr, "  <next>\n");
                xml += this.blockToXML(block.next, indent + 2);
                xml += "".concat(indentStr, "  </next>\n");
            }
            xml += "".concat(indentStr, "</block>\n");
            return xml;
        };
        return CodeToBlocksConverter;
    }());
    exports.CodeToBlocksConverter = CodeToBlocksConverter;
});
