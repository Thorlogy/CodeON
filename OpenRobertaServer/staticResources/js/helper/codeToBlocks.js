/**
 * Code-to-Blocks Converter
 * Converts Python code (EV3dev API) back to Blockly blocks using pattern matching
 */
define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeToBlocksConverter = void 0;
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
                        fields: { TEXT: match[1] }
                    },
                    COL: {
                        type: 'math_number',
                        fields: { NUM: match[2] }
                    },
                    ROW: {
                        type: 'math_number',
                        fields: { NUM: match[3] }
                    }
                }
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
                type: 'robActions_display_clear'
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
                        fields: { NUM: match[1] }
                    },
                    DURATION: {
                        type: 'math_number',
                        fields: { NUM: match[2] }
                    }
                }
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
                        fields: { NUM: match[1] }
                    }
                }
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
                    MOTORPORT: match[1]
                },
                values: {
                    POWER: {
                        type: 'math_number',
                        fields: { NUM: match[2] }
                    },
                    DEGREE: {
                        type: 'math_number',
                        fields: { NUM: match[3] }
                    }
                }
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
                    MOTORPORT: match[1]
                },
                values: {
                    POWER: {
                        type: 'math_number',
                        fields: { NUM: match[2] }
                    }
                }
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
                    MOTORPORT: match[1]
                }
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
        /**
         * Convert Python code to Blockly XML
         */
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
            return this.generateXML(blocks);
        };
        /**
         * Generate Blockly XML from block definitions
         */
        CodeToBlocksConverter.prototype.generateXML = function (blocks) {
            var xml = '<xml xmlns="https://developers.google.com/blockly/xml">\n';
            for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
                var block = blocks_1[_i];
                xml += this.blockToXML(block, 1);
            }
            xml += '</xml>';
            return xml;
        };
        /**
         * Convert a single block definition to XML
         */
        CodeToBlocksConverter.prototype.blockToXML = function (block, indent) {
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
            if (block.next) {
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
