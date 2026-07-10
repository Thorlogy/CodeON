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

class NqcConversionError extends Error {
    constructor(line: number, statement: string, detail: string) {
        super(`NQC-Zeile ${line}: ${detail} (${statement})`);
        this.name = 'NqcConversionError';
    }
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

    /** Convert Python code to Blockly XML. */
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

        return this.generateXML(this.chainBlocks(blocks));
    }

    /**
     * Converts the deliberately small, generated subset of NQC back to RCX
     * blocks. This is intentionally strict: silently dropping an unfamiliar
     * native command would produce a different robot program.
     */
    convertNqcToXML(nqcCode: string): string {
        const statements = this.getNqcStatements(nqcCode);
        const blocks: BlockDefinition[] = [];
        const powerByPort: { [port: string]: number } = {};

        for (let index = 0; index < statements.length; index++) {
            const statement = statements[index];
            let match: RegExpMatchArray | null;

            if ((match = statement.text.match(/^SetPower\((OUT_[ABC](?:\+OUT_[ABC])?),\s*NEPO_PWR\((-?\d+)\)\)$/))) {
                powerByPort[match[1]] = Number(match[2]);
                continue;
            }

            if ((match = statement.text.match(/^On(Fwd|Rev)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                const direction = match[1];
                const port = match[2];
                const power = powerByPort[port];
                if (power === undefined) {
                    throw new NqcConversionError(statement.line, statement.text, 'SetPower mit gleichem Motoranschluss fehlt');
                }
                delete powerByPort[port];
                if (port.indexOf('+') >= 0) {
                    blocks.push(this.driveBlock(direction === 'Fwd' ? 'FOREWARD' : 'BACKWARD', power));
                } else if (direction === 'Fwd') {
                    blocks.push(this.singleMotorBlock(port.substring(4), power));
                } else {
                    throw new NqcConversionError(statement.line, statement.text, 'OnRev für einen einzelnen Motor kann nicht eindeutig in einen Block übersetzt werden');
                }
                continue;
            }

            if ((match = statement.text.match(/^(Off|Float)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                const port = match[2];
                if (port.indexOf('+') >= 0) {
                    blocks.push({ type: 'robActions_motorDiff_stop' });
                } else {
                    blocks.push({ type: 'robActions_motor_stop', fields: { MOTORPORT: port.substring(4) } });
                }
                continue;
            }

            if ((match = statement.text.match(/^Wait\(\((-?\d+)\)\s*\/\s*10\)$/))) {
                blocks.push(this.waitBlock(Number(match[1])));
                continue;
            }

            if ((match = statement.text.match(/^PlayTone\((-?\d+),\s*\((-?\d+)\)\s*\/\s*10\)$/))) {
                blocks.push(this.toneBlock(Number(match[1]), Number(match[2])));
                // The NQC generator emits a matching Wait directly afterwards.
                const following = statements[index + 1];
                if (following && following.text === `Wait((${match[2]}) / 10)`) {
                    index++;
                }
                continue;
            }

            if ((match = statement.text.match(/^SetUserDisplay\((-?\d+),\s*0\)$/))) {
                blocks.push({ type: 'robActions_display_text', values: { OUT: this.numberBlock(Number(match[1])) } });
                continue;
            }

            if (statement.text === 'SelectDisplay(DISPLAY_WATCH)') {
                blocks.push({ type: 'robActions_display_clear' });
                continue;
            }

            if (statement.text === 'ClearTimer(0)') {
                blocks.push({ type: 'robSensors_timer_reset' });
                continue;
            }

            throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte NQC-Anweisung');
        }

        if (Object.keys(powerByPort).length > 0) {
            throw new Error('NQC enthält SetPower ohne nachfolgendes OnFwd oder OnRev. Die Blöcke wurden nicht verändert.');
        }
        if (blocks.length === 0) {
            throw new Error('Im task main wurden keine in Blöcke übersetzbaren NQC-Anweisungen gefunden.');
        }
        return this.generateXML(this.chainBlocks(blocks));
    }

    private getNqcStatements(code: string): Array<{ line: number; text: string }> {
        const main = code.match(/task\s+main\s*\(\s*\)\s*\{([\s\S]*?)\}/);
        if (!main || main.index === undefined) {
            throw new Error('NQC benötigt einen task main() { ... }-Block.');
        }
        const bodyStartLine = code.substring(0, main.index + main[0].indexOf('{') + 1).split('\n').length;
        const body = main[1].replace(/\/\/.*$/gm, '');
        const result: Array<{ line: number; text: string }> = [];
        body.split(';').forEach((part) => {
            const text = part.trim().replace(/\s+/g, ' ');
            if (text) {
                const offset = body.indexOf(part);
                result.push({ line: bodyStartLine + body.substring(0, offset).split('\n').length - 1, text });
            }
        });
        return result;
    }

    private numberBlock(value: number): BlockDefinition {
        return { type: 'math_number', fields: { NUM: value } };
    }

    private driveBlock(direction: string, power: number): BlockDefinition {
        return { type: 'robActions_motorDiff_on', fields: { DIRECTION: direction }, values: { POWER: this.numberBlock(power) } };
    }

    private singleMotorBlock(port: string, power: number): BlockDefinition {
        return { type: 'robActions_motor_on', fields: { MOTORPORT: port }, values: { POWER: this.numberBlock(power) } };
    }

    private waitBlock(milliseconds: number): BlockDefinition {
        return { type: 'robControls_wait_time', values: { WAIT: this.numberBlock(milliseconds) } };
    }

    private toneBlock(frequency: number, duration: number): BlockDefinition {
        return {
            type: 'robActions_play_tone',
            values: { FREQUENCE: this.numberBlock(frequency), DURATION: this.numberBlock(duration) }
        };
    }

    private chainBlocks(blocks: BlockDefinition[]): BlockDefinition[] {
        for (let index = 0; index < blocks.length - 1; index++) {
            blocks[index].next = blocks[index + 1];
        }
        return blocks.length ? [blocks[0]] : [];
    }

    /**
     * Generate Open Roberta Blockly XML from block definitions.
     * This Blockly build expects a block_set root, not the newer <xml> root.
     */
    private generateXML(blocks: BlockDefinition[]): string {
        let xml = '<block_set xmlns="http://de.fhg.iais.roberta.blockly" robottype="rcx" xmlversion="3.1" description="" tags="">\n';
        xml += '  <instance x="100" y="100">\n';

        for (const block of blocks) {
            let current: BlockDefinition | undefined = block;
            while (current) {
                xml += this.blockToXML(current, 2, false);
                current = current.next;
            }
        }

        xml += '  </instance>\n';
        xml += '</block_set>';
        return xml;
    }

    /**
     * Convert a single block definition to XML
     */
    private blockToXML(block: BlockDefinition, indent: number, includeNext = true): string {
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
        if (includeNext && block.next) {
            xml += `${indentStr}  <next>\n`;
            xml += this.blockToXML(block.next, indent + 2);
            xml += `${indentStr}  </next>\n`;
        }

        xml += `${indentStr}</block>\n`;
        return xml;
    }
}
