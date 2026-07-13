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
    statements?: { [key: string]: BlockDefinition };
    next?: BlockDefinition;
}

interface NqcStatement {
    line: number;
    text: string;
    body?: NqcStatement[];
}

interface PatternMatcher {
    matches(line: string): boolean;
    generateBlock(line: string): BlockDefinition | null;
}

interface NqcMotorConfiguration {
    port: string;
    side: 'LEFT' | 'RIGHT';
    reversed: boolean;
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
            type: 'robActions_display_clear',
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
                    fields: { NUM: match[1] },
                },
                DURATION: {
                    type: 'math_number',
                    fields: { NUM: match[2] },
                },
            },
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
                    fields: { NUM: match[1] },
                },
            },
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
                MOTORPORT: match[1],
            },
            values: {
                POWER: {
                    type: 'math_number',
                    fields: { NUM: match[2] },
                },
            },
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
                MOTORPORT: match[1],
            },
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
    convertNqcToXML(nqcCode: string, configurationXml?: string): string {
        const statements = this.getNqcStatements(nqcCode);
        const blocks = this.convertNqcStatements(statements, configurationXml);
        if (blocks.length === 0) {
            throw new Error('Im task main wurden keine in Blöcke übersetzbaren NQC-Anweisungen gefunden.');
        }
        return this.generateXML(this.chainBlocks(blocks));
    }

    private convertNqcStatements(statements: NqcStatement[], configurationXml?: string): BlockDefinition[] {
        const blocks: BlockDefinition[] = [];
        const powerStateByPort: {
            [port: string]: { group: string; ports: string[]; power: number };
        } = {};
        const powerStateByGroup: { [group: string]: { group: string; ports: string[]; power: number } } = {};
        // NQC keeps SetPower active until it is changed. Directions are only
        // pending for one graphical action; the associated power state persists.
        const pendingDirectionsByGroup: { [group: string]: { [port: string]: boolean } } = {};
        const pendingPowerGroups: { [group: string]: boolean } = {};
        const motorConfiguration = this.getNqcMotorConfiguration(configurationXml);
        const flushPendingPowerBlocks = () => {
            Object.keys(pendingPowerGroups).forEach((group) => {
                if (Object.keys(pendingDirectionsByGroup[group] || {}).length > 0) {
                    return;
                }
                const state = powerStateByGroup[group];
                state.ports.forEach((port) => blocks.push(this.motorSetPowerBlock(port.substring(4), state.power)));
                delete pendingPowerGroups[group];
                delete pendingDirectionsByGroup[group];
            });
        };

        for (let index = 0; index < statements.length; index++) {
            const statement = statements[index];
            let match: RegExpMatchArray | null;

            if (statement.body) {
                flushPendingPowerBlocks();
                if (statement.text !== 'while (true)') {
                    throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte Kontrollstruktur');
                }
                const loop: BlockDefinition = { type: 'robControls_loopForever' };
                const chainedBody = this.chainBlocks(this.convertNqcStatements(statement.body, configurationXml));
                if (chainedBody.length > 0) {
                    loop.statements = { DO: chainedBody[0] };
                }
                blocks.push(loop);
                continue;
            }

            if ((match = statement.text.match(/^SetPower\((OUT_[ABC](?:\+OUT_[ABC])?),\s*NEPO_PWR\((-?\d+)\)\)$/))) {
                // A second SetPower is an independent visible command unless
                // the previous one is consumed by a following OnFwd/OnRev.
                flushPendingPowerBlocks();
                const ports = this.outputPorts(match[1]);
                const group = ports.slice().sort().join('+');
                const powerState = { group, ports, power: Number(match[2]) };
                ports.forEach((port) => (powerStateByPort[port] = powerState));
                powerStateByGroup[group] = powerState;
                pendingDirectionsByGroup[group] = {};
                pendingPowerGroups[group] = true;
                continue;
            }

            if ((match = statement.text.match(/^On(Fwd|Rev)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                const electricalForward = match[1] === 'Fwd';
                const commandPorts = this.outputPorts(match[2]);
                const powerStates = commandPorts.map((port) => powerStateByPort[port]);
                if (powerStates.some((state) => state === undefined)) {
                    throw new NqcConversionError(statement.line, statement.text, 'SetPower mit gleichem Motoranschluss fehlt');
                }
                const powerState = powerStates[0];
                if (powerStates.some((state) => state.group !== powerState.group)) {
                    throw new NqcConversionError(
                        statement.line,
                        statement.text,
                        'Motoranschlüsse gehören zu unterschiedlichen SetPower-Gruppen'
                    );
                }
                const directions = pendingDirectionsByGroup[powerState.group] || {};
                commandPorts.forEach((outputPort) => {
                    const poweredPorts = powerState.ports;
                    if (poweredPorts.indexOf(outputPort) < 0) {
                        throw new NqcConversionError(
                            statement.line,
                            statement.text,
                            `Motoranschluss ${outputPort} ist nicht in ${powerState.group} enthalten`
                        );
                    }
                    directions[outputPort] = electricalForward;
                });
                pendingDirectionsByGroup[powerState.group] = directions;

                if (powerState.ports.every((outputPort) => directions[outputPort] !== undefined)) {
                    delete pendingDirectionsByGroup[powerState.group];
                    delete pendingPowerGroups[powerState.group];
                    const poweredPorts = powerState.ports;
                    if (poweredPorts.length === 1) {
                        const motor = motorConfiguration.find((candidate) => candidate.port === poweredPorts[0].substring(4));
                        const logicalForward = directions[poweredPorts[0]] !== (motor ? motor.reversed : false);
                        if (!logicalForward) {
                            throw new NqcConversionError(
                                statement.line,
                                statement.text,
                                'Rückwärtslauf eines einzelnen Motors kann nicht eindeutig in einen Block übersetzt werden'
                            );
                        }
                        blocks.push(this.singleMotorBlock(poweredPorts[0].substring(4), powerState.power));
                    } else {
                        blocks.push(
                            this.differentialMotorBlock(poweredPorts, directions, powerState.power, motorConfiguration, statement)
                        );
                    }
                }
                continue;
            }

            // No direction command followed the pending SetPower. Preserve it
            // as one graphical set-power block per addressed RCX output.
            flushPendingPowerBlocks();

            if ((match = statement.text.match(/^(Off|Float)\((OUT_[ABC](?:\+OUT_[ABC])?)\)$/))) {
                const port = match[2];
                if (match[1] === 'Float') {
                    this.outputPorts(port).forEach((outputPort) =>
                        blocks.push({ type: 'robActions_motor_stop', fields: { MOTORPORT: outputPort.substring(4), MODE: 'FLOAT' } })
                    );
                } else if (port.indexOf('+') >= 0) {
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

            if ((match = statement.text.match(/^ClearSensor\(SENSOR_([123])\)$/))) {
                blocks.push({ type: 'robSensors_encoder_reset', fields: { SENSORPORT: match[1] } });
                continue;
            }

            // Sensor setup is represented by the robot configuration, not a
            // program block. Generated setup lines are therefore safe to skip.
            if (statement.text.match(/^SetSensor\(SENSOR_[123],\s*SENSOR_(TOUCH|LIGHT|ROTATION|CELSIUS)\)$/)) {
                continue;
            }

            throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte NQC-Anweisung');
        }

        flushPendingPowerBlocks();
        if (Object.keys(pendingDirectionsByGroup).some((group) => Object.keys(pendingDirectionsByGroup[group]).length > 0)) {
            throw new Error('NQC enthält unvollständige Motor-Richtungsbefehle. Die Blöcke wurden nicht verändert.');
        }
        return blocks;
    }

    private getNqcStatements(code: string): NqcStatement[] {
        const main = /task\s+main\s*\(\s*\)\s*\{/m.exec(code);
        if (!main || main.index === undefined) {
            throw new Error('NQC benötigt einen task main() { ... }-Block.');
        }
        const openBrace = main.index + main[0].lastIndexOf('{');
        const closeBrace = this.findMatchingBrace(code, openBrace);
        if (closeBrace < 0) {
            throw new Error('Der task main() enthält eine nicht geschlossene geschweifte Klammer.');
        }
        const bodyStartLine = code.substring(0, openBrace + 1).split('\n').length;
        const body = code.substring(openBrace + 1, closeBrace).replace(/\/\/.*$/gm, '');
        return this.parseNqcBody(body, bodyStartLine);
    }

    private parseNqcBody(body: string, startLine: number): NqcStatement[] {
        const result: NqcStatement[] = [];
        let index = 0;
        const lineAt = (offset: number) => startLine + body.substring(0, offset).split('\n').length - 1;
        while (index < body.length) {
            while (index < body.length && /\s/.test(body[index])) index++;
            if (index >= body.length) break;

            const remaining = body.substring(index);
            const whileMatch = /^while\s*\(\s*true\s*\)\s*\{/i.exec(remaining);
            if (whileMatch) {
                const openBrace = index + whileMatch[0].lastIndexOf('{');
                const closeBrace = this.findMatchingBrace(body, openBrace);
                if (closeBrace < 0) {
                    throw new NqcConversionError(lineAt(index), 'while (true)', 'nicht geschlossene geschweifte Klammer');
                }
                result.push({
                    line: lineAt(index),
                    text: 'while (true)',
                    body: this.parseNqcBody(body.substring(openBrace + 1, closeBrace), lineAt(openBrace + 1)),
                });
                index = closeBrace + 1;
                continue;
            }

            const semicolon = body.indexOf(';', index);
            const brace = body.indexOf('{', index);
            if (semicolon < 0 || (brace >= 0 && brace < semicolon)) {
                const end = brace >= 0 ? brace : body.length;
                const unsupported = body.substring(index, end).trim().replace(/\s+/g, ' ');
                throw new NqcConversionError(
                    lineAt(index),
                    unsupported || body[index],
                    'nicht unterstützte oder unvollständige NQC-Anweisung'
                );
            }
            const text = body.substring(index, semicolon).trim().replace(/\s+/g, ' ');
            if (text) result.push({ line: lineAt(index), text });
            index = semicolon + 1;
        }
        return result;
    }

    private findMatchingBrace(text: string, openBrace: number): number {
        let depth = 0;
        for (let index = openBrace; index < text.length; index++) {
            if (text[index] === '{') depth++;
            if (text[index] === '}') {
                depth--;
                if (depth === 0) return index;
            }
        }
        return -1;
    }

    private numberBlock(value: number): BlockDefinition {
        return { type: 'math_number', fields: { NUM: value } };
    }

    private outputPorts(portExpression: string): string[] {
        return portExpression.split('+');
    }

    private getNqcMotorConfiguration(configurationXml?: string): NqcMotorConfiguration[] {
        if (!configurationXml) {
            return [];
        }
        const document = new DOMParser().parseFromString(configurationXml, 'text/xml');
        const result: NqcMotorConfiguration[] = [];
        Array.from(document.getElementsByTagName('value')).forEach((value) => {
            const name = value.getAttribute('name') || '';
            const portMatch = name.match(/^M([ABC])$/);
            if (!portMatch) {
                return;
            }
            const motor = Array.from(value.children).find((child) => child.tagName.toLowerCase() === 'block');
            if (!motor || motor.getAttribute('type') !== 'robBrick_motor_big') {
                return;
            }
            const fields: { [name: string]: string } = {};
            Array.from(motor.children).forEach((child) => {
                if (child.tagName.toLowerCase() === 'field') {
                    fields[child.getAttribute('name') || ''] = (child.textContent || '').trim();
                }
            });
            if (fields.MOTOR_DRIVE === 'LEFT' || fields.MOTOR_DRIVE === 'RIGHT') {
                result.push({ port: portMatch[1], side: fields.MOTOR_DRIVE, reversed: fields.MOTOR_REVERSE === 'ON' });
            }
        });
        return result;
    }

    private differentialMotorBlock(
        poweredPorts: string[],
        directions: { [port: string]: boolean },
        power: number,
        configuration: NqcMotorConfiguration[],
        statement: { line: number; text: string }
    ): BlockDefinition {
        const motors = poweredPorts.map((outputPort) => configuration.find((motor) => motor.port === outputPort.substring(4)));
        const left = motors.find((motor) => motor && motor.side === 'LEFT');
        const right = motors.find((motor) => motor && motor.side === 'RIGHT');
        if (!left || !right) {
            throw new NqcConversionError(statement.line, statement.text, 'linker und rechter Motor fehlen in der Roboterkonfiguration');
        }
        const leftForward = directions[`OUT_${left.port}`] !== left.reversed;
        const rightForward = directions[`OUT_${right.port}`] !== right.reversed;
        if (leftForward === rightForward) {
            return this.driveBlock(leftForward ? 'FOREWARD' : 'BACKWARD', power);
        }
        return this.turnBlock(leftForward ? 'RIGHT' : 'LEFT', power);
    }

    private driveBlock(direction: string, power: number): BlockDefinition {
        return { type: 'robActions_motorDiff_on', fields: { DIRECTION: direction }, values: { POWER: this.numberBlock(power) } };
    }

    private turnBlock(direction: string, power: number): BlockDefinition {
        return { type: 'robActions_motorDiff_turn', fields: { DIRECTION: direction }, values: { POWER: this.numberBlock(power) } };
    }

    private singleMotorBlock(port: string, power: number): BlockDefinition {
        return { type: 'robActions_motor_on', fields: { MOTORPORT: port }, values: { POWER: this.numberBlock(power) } };
    }

    private motorSetPowerBlock(port: string, power: number): BlockDefinition {
        return { type: 'robActions_motor_setPower', fields: { MOTORPORT: port }, values: { POWER: this.numberBlock(power) } };
    }

    private waitBlock(milliseconds: number): BlockDefinition {
        return { type: 'robControls_wait_time', values: { WAIT: this.numberBlock(milliseconds) } };
    }

    private toneBlock(frequency: number, duration: number): BlockDefinition {
        return {
            type: 'robActions_play_tone',
            values: { FREQUENCE: this.numberBlock(frequency), DURATION: this.numberBlock(duration) },
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

        // Add statement inputs (for example the body of a forever loop).
        if (block.statements) {
            for (const [name, statementBlock] of Object.entries(block.statements)) {
                xml += `${indentStr}  <statement name="${name}">\n`;
                xml += this.blockToXML(statementBlock, indent + 2);
                xml += `${indentStr}  </statement>\n`;
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
