/**
 * Code-to-Blocks Converter
 * Converts Python code (EV3dev API) back to Blockly blocks using pattern matching
 */

interface BlockDefinition {
    type: string;
    x?: number;
    y?: number;
    fields?: { [key: string]: any };
    values?: { [key: string]: BlockDefinition };
    next?: BlockDefinition;
}

interface PatternMatcher {
    matches(line: string): boolean;
    generateBlock(line: string): BlockDefinition | null;
}

/**
 * Display Text Pattern: hal.drawText('text', x, y)
 */
class DisplayTextPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.drawText\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
class ClearDisplayPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.clearDisplay\s*\(\s*\)/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
        return {
            type: 'robActions_display_clear'
        };
    }
}

/**
 * Play Tone Pattern: hal.playTone(frequency, duration)
 */
class PlayTonePattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.playTone\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
class WaitPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.waitFor\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
 * Motor On For Pattern: hal.rotateRegulatedMotor(port, speed, distance)
 */
class MotorOnForPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.rotateRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
class MotorOnPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.turnOnRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
class MotorStopPattern implements PatternMatcher {
    matches(line: string): boolean {
        return /hal\.stopRegulatedMotor\s*\(/.test(line);
    }

    generateBlock(line: string): BlockDefinition | null {
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
export class CodeToBlocksConverter {
    private patterns: PatternMatcher[];

    constructor() {
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
    convertToXML(pythonCode: string): string {
        const lines = pythonCode.split('\n');
        const blocks: BlockDefinition[] = [];
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
    private generateXML(blocks: BlockDefinition[]): string {
        let xml = '<xml xmlns="https://developers.google.com/blockly/xml">\n';

        for (const block of blocks) {
            xml += this.blockToXML(block, 1);
        }

        xml += '</xml>';
        return xml;
    }

    /**
     * Convert a single block definition to XML
     */
    private blockToXML(block: BlockDefinition, indent: number): string {
        const indentStr = '  '.repeat(indent);
        let xml = `${indentStr}<block type="${block.type}"`;

        if (block.x !== undefined && block.y !== undefined) {
            xml += ` x="${block.x}" y="${block.y}"`;
        }

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
