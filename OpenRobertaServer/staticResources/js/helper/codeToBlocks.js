/**
 * Code-to-Blocks Converter
 * Converts Python code (EV3dev API) back to Blockly blocks using pattern matching
 */

/**
 * Display Text Pattern: hal.drawText('text', x, y)
 */
class DisplayTextPattern {
    matches(line) {
        return /hal\.drawText\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.drawText\s*\(\s*['"](.+?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (!match) return null;

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
    }
}

/**
 * Clear Display Pattern: hal.clearDisplay()
 */
class ClearDisplayPattern {
    matches(line) {
        return /hal\.clearDisplay\s*\(\s*\)/.test(line);
    }

    generateBlock(line) {
        return {
            type: 'robActions_display_clear'
        };
    }
}

/**
 * Play Tone Pattern: hal.playTone(frequency, duration)
 */
class PlayTonePattern {
    matches(line) {
        return /hal\.playTone\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.playTone\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (!match) return null;

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
    }
}

/**
 * Wait Pattern: hal.waitFor(milliseconds)
 */
class WaitPattern {
    matches(line) {
        return /hal\.waitFor\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.waitFor\s*\(\s*(\d+)\s*\)/);
        if (!match) return null;

        return {
            type: 'robControls_wait_time',
            values: {
                WAIT: {
                    type: 'math_number',
                    fields: { NUM: match[1] }
                }
            }
        };
    }
}

/**
 * Motor On For Rotation Pattern: hal.motorOnForRotation(port, speed, degrees)
 * This is the actual API used by EV3 leJOS code generator
 */
class MotorOnForRotationPattern {
    matches(line) {
        return /hal\.motorOnForRotation\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.motorOnForRotation\s*\(\s*['"]([A-D])['"]\s*,\s*(-?\d+)\s*,\s*(\d+)\s*\)/);
        if (!match) return null;

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
    }
}

/**
 * Motor On For Pattern: hal.rotateRegulatedMotor(port, speed, distance)
 */
class MotorOnForPattern {
    matches(line) {
        return /hal\.rotateRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.rotateRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*,\s*(-?\d+)\s*,\s*(\d+)\s*\)/);
        if (!match) return null;

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
    }
}

/**
 * Motor On Pattern: hal.turnOnRegulatedMotor(port, speed)
 */
class MotorOnPattern {
    matches(line) {
        return /hal\.turnOnRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.turnOnRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*,\s*(-?\d+)\s*\)/);
        if (!match) return null;

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
    }
}

/**
 * Motor Stop Pattern: hal.stopRegulatedMotor(port)
 */
class MotorStopPattern {
    matches(line) {
        return /hal\.stopRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line) {
        const match = line.match(/hal\.stopRegulatedMotor\s*\(\s*['"]([A-D])['"]\s*\)/);
        if (!match) return null;

        return {
            type: 'robActions_motor_stop',
            fields: {
                MOTORPORT: match[1]
            }
        };
    }
}

/**
 * Main Code-to-Blocks Converter
 */
class CodeToBlocksConverter {
    constructor() {
        this.patterns = [
            new DisplayTextPattern(),
            new ClearDisplayPattern(),
            new PlayTonePattern(),
            new WaitPattern(),
            new MotorOnForRotationPattern(),
            new MotorOnForPattern(),
            new MotorOnPattern(),
            new MotorStopPattern(),
        ];
    }

    /**
     * Extract the content of the run() function from Python code
     */
    extractRunFunction(pythonCode) {
        const lines = pythonCode.split('\n');
        const runFunctionLines = [];
        let inRunFunction = false;
        let runFunctionIndent = 0;

        for (const line of lines) {
            // Check if we're entering the run() function
            if (/^def\s+run\s*\(\s*\)\s*:/.test(line)) {
                inRunFunction = true;
                // Get the base indentation level (should be 0 for top-level function)
                runFunctionIndent = line.search(/\S/);
                continue;
            }

            if (inRunFunction) {
                // Check if we've exited the run() function
                // (found another function definition or class at the same or lower indent level)
                const currentIndent = line.search(/\S/);
                if (currentIndent !== -1 && currentIndent <= runFunctionIndent && line.trim()) {
                    // We've exited the run() function
                    break;
                }

                // Add lines that are inside the run() function
                if (line.trim()) {
                    runFunctionLines.push(line);
                }
            }
        }

        return runFunctionLines.join('\n');
    }

    /**
     * Convert Python code to Blockly XML
     */
    convertToXML(pythonCode) {
        // Extract only the run() function content
        const runFunctionCode = this.extractRunFunction(pythonCode);
        const lines = runFunctionCode.split('\n');
        const blocks = [];
        let yPosition = 100;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            // Try to match against patterns
            for (const pattern of this.patterns) {
                if (pattern.matches(trimmedLine)) {
                    const block = pattern.generateBlock(trimmedLine);
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
    }

    /**
     * Generate Blockly XML from block definitions
     */
    generateXML(blocks) {
        // Open Roberta uses a custom Blockly.Xml.textToDom that requires:
        // 1. Root element to be 'block_set' (not 'xml')
        // 2. Namespace: http://de.fhg.iais.roberta.blockly
        // 3. Blocks wrapped in <instance> tags
        let xml = '<block_set xmlns="http://de.fhg.iais.roberta.blockly" robottype="ev3" xmlversion="3.1" description="" tags="">\n';

        for (const block of blocks) {
            // Wrap each block in an instance tag
            xml += `  <instance x="${block.x}" y="${block.y}">\n`;
            xml += this.blockToXML(block, 2);
            xml += '  </instance>\n';
        }

        xml += '</block_set>';
        return xml;
    }

    /**
     * Convert a single block definition to XML
     */
    blockToXML(block, indent) {
        const indentStr = '  '.repeat(indent);
        let xml = `${indentStr}<block type="${block.type}"`;

        if (block.x !== undefined && block.y !== undefined) {
            xml += ` x="${block.x}" y="${block.y}"`;
        }

        // Add intask attribute required by Open Roberta
        xml += ' intask="true"';

        xml += '>\n';

        // Add fields
        if (block.fields) {
            for (const [name, value] of Object.entries(block.fields)) {
                xml += `${indentStr}  <field name="${name}">${value}</field>\n`;
            }
        }

        // Add values (nested blocks)
        if (block.values) {
            for (const [name, valueBlock] of Object.entries(block.values)) {
                xml += `${indentStr}  <value name="${name}">\n`;
                xml += this.blockToXML(valueBlock, indent + 2);
                xml += `${indentStr}  </value>\n`;
            }
        }

        // Add next block
        if (block.next) {
            xml += `${indentStr}  <next>\n`;
            xml += this.blockToXML(block.next, indent + 2);
            xml += `${indentStr}  </next>\n`;
        }

        xml += `${indentStr}</block>\n`;
        return xml;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CodeToBlocksConverter };
}
