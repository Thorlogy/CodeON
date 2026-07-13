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
    mutation?: { [key: string]: string | number | boolean };
    repetitions?: boolean;
    next?: BlockDefinition;
}

interface NqcStatement {
    line: number;
    text: string;
    kind?: 'while' | 'if' | 'for';
    condition?: string;
    body?: NqcStatement[];
    elseBody?: NqcStatement[];
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

/**
 * Add or correct the SetSensor statements that the graphical RCX generator
 * normally emits from the active robot configuration.
 */
export function ensureNqcSensorSetup(code: string, configurationXml?: string): string {
    if (!configurationXml || !/task\s+main\s*\(\s*\)\s*\{/m.test(code)) return code;

    const configuration = new DOMParser().parseFromString(configurationXml, 'text/xml');
    const sensorModes: { [blockType: string]: string } = {
        robBrick_touch: 'SENSOR_TOUCH',
        robBrick_light: 'SENSOR_LIGHT',
        robBrick_encoder: 'SENSOR_ROTATION',
        robBrick_temperature: 'SENSOR_CELSIUS',
    };
    const configuredModes: { [port: string]: string } = {};
    Array.from(configuration.getElementsByTagName('value')).forEach((value) => {
        const port = (value.getAttribute('name') || '').match(/^S([123])$/);
        if (!port) return;
        const block = Array.from(value.children).find((child) => child.tagName.toLowerCase() === 'block');
        const mode = block && sensorModes[block.getAttribute('type') || ''];
        if (mode) configuredModes[port[1]] = mode;
    });

    const searchableCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const usedPorts: string[] = [];
    const sensorReference = /\bSENSOR_([123])\b/g;
    let sensorMatch: RegExpExecArray | null;
    while ((sensorMatch = sensorReference.exec(searchableCode)) !== null) {
        if (usedPorts.indexOf(sensorMatch[1]) < 0) usedPorts.push(sensorMatch[1]);
    }
    let normalized = code;
    const missing: string[] = [];

    usedPorts.forEach((port) => {
        const mode = configuredModes[port];
        if (!mode) return;
        const setup = `SetSensor(SENSOR_${port}, ${mode});`;
        const existing = new RegExp(`(^[\\t ]*)SetSensor\\(\\s*SENSOR_${port}\\s*,\\s*SENSOR_(?:TOUCH|LIGHT|ROTATION|CELSIUS)\\s*\\);`, 'im');
        if (existing.test(normalized)) {
            normalized = normalized.replace(existing, (_statement, indentation) => `${indentation}${setup}`);
        } else {
            missing.push(`    ${setup}`);
        }
    });

    if (missing.length === 0) return normalized;
    const main = /task\s+main\s*\(\s*\)\s*\{/m.exec(normalized)!;
    const insertionPoint = main.index + main[0].length;
    const remainder = normalized.substring(insertionPoint);
    return normalized.substring(0, insertionPoint) + '\n' + missing.join('\n') + (remainder.startsWith('\n') ? '' : '\n') + remainder;
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
                // The RCX generator represents both "wait until" blocks as a
                // small polling loop. Rebuild the original compact block.
                if (
                    statement.kind === 'while' &&
                    (statement.condition || '').trim().toLowerCase() === 'true' &&
                    statement.body.length === 2 &&
                    statement.body[0].kind === 'if' &&
                    statement.body[0].body &&
                    statement.body[0].body.length >= 1 &&
                    statement.body[0].body![statement.body[0].body!.length - 1].text === 'break' &&
                    statement.body[1].text === 'Wait(1)'
                ) {
                    const waitContents = statement.body[0].body!.slice(0, -1);
                    const waitBlock: BlockDefinition = {
                        type: waitContents.length === 0 ? 'robControls_wait_for' : 'robControls_wait',
                        values: {
                            WAIT0: this.nqcExpressionBlock(statement.body[0].condition || '', configurationXml, statement.line),
                        },
                    };
                    const convertedContents = this.chainBlocks(this.convertNqcStatements(waitContents, configurationXml));
                    if (convertedContents.length > 0) waitBlock.statements = { DO0: convertedContents[0] };
                    blocks.push(waitBlock);
                    continue;
                }
                const chainedBody = this.chainBlocks(this.convertNqcStatements(statement.body, configurationXml));
                if (statement.kind === 'while') {
                    const condition = (statement.condition || '').trim();
                    const loop: BlockDefinition =
                        condition.toLowerCase() === 'true'
                            ? { type: 'robControls_loopForever' }
                            : {
                                  type: 'controls_whileUntil',
                                  fields: { MODE: 'WHILE' },
                                  values: { BOOL: this.nqcExpressionBlock(condition, configurationXml, statement.line) },
                              };
                    if (chainedBody.length > 0) loop.statements = { DO: chainedBody[0] };
                    blocks.push(loop);
                    continue;
                }
                if (statement.kind === 'if') {
                    const hasElse = statement.elseBody !== undefined;
                    const conditional: BlockDefinition = {
                        type: hasElse ? 'robControls_ifElse' : 'robControls_if',
                        values: { IF0: this.nqcExpressionBlock(statement.condition || '', configurationXml, statement.line) },
                    };
                    if (chainedBody.length > 0) conditional.statements = { DO0: chainedBody[0] };
                    if (hasElse) {
                        conditional.mutation = { else: 1 };
                        conditional.repetitions = true;
                        const elseBlocks = this.chainBlocks(this.convertNqcStatements(statement.elseBody || [], configurationXml));
                        if (elseBlocks.length > 0) {
                            conditional.statements = { ...(conditional.statements || {}), ELSE: elseBlocks[0] };
                        }
                    }
                    blocks.push(conditional);
                    continue;
                }
                if (statement.kind === 'for') {
                    const forParts = (statement.condition || '').match(
                        /^int\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s*;\s*\1\s*<\s*(.+?)\s*;\s*\1\s*\+=\s*(.+)$/
                    );
                    if (!forParts) {
                        throw new NqcConversionError(statement.line, statement.text, 'for-Schleife hat kein unterstütztes Zählmuster');
                    }
                    const isGeneratedRepeat = /^k\d+$/.test(forParts[1]) && forParts[2].trim() === '0' && forParts[4].trim() === '1';
                    const loop: BlockDefinition = {
                        type: isGeneratedRepeat ? 'controls_repeat_ext' : 'robControls_for',
                        fields: isGeneratedRepeat ? undefined : { VAR: forParts[1] },
                        values: isGeneratedRepeat
                            ? { TIMES: this.nqcExpressionBlock(forParts[3], configurationXml, statement.line) }
                            : {
                                  FROM: this.nqcExpressionBlock(forParts[2], configurationXml, statement.line),
                                  TO: this.nqcExpressionBlock(forParts[3], configurationXml, statement.line),
                                  BY: this.nqcExpressionBlock(forParts[4], configurationXml, statement.line),
                              },
                    };
                    if (chainedBody.length > 0) loop.statements = { DO: chainedBody[0] };
                    blocks.push(loop);
                    continue;
                }
                throw new NqcConversionError(statement.line, statement.text, 'nicht unterstützte Kontrollstruktur');
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

            if (statement.text === 'break' || statement.text === 'continue') {
                blocks.push({ type: 'controls_flow_statements', fields: { FLOW: statement.text.toUpperCase() } });
                continue;
            }

            if ((match = statement.text.match(/^([A-Za-z_]\w*)\s*\+=\s*(.+)$/))) {
                blocks.push({
                    type: 'robMath_change',
                    values: {
                        VAR: { type: 'variables_get', mutation: { datatype: 'Number' }, fields: { VAR: match[1] } },
                        DELTA: this.nqcExpressionBlock(match[2], configurationXml, statement.line),
                    },
                });
                continue;
            }

            if ((match = statement.text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
                blocks.push({
                    type: 'variables_set',
                    mutation: { datatype: 'Number' },
                    fields: { VAR: match[1] },
                    values: { VALUE: this.nqcExpressionBlock(match[2], configurationXml, statement.line) },
                });
                continue;
            }

            if ((match = statement.text.match(/^\/\/\s?(.*)$/))) {
                blocks.push({ type: 'text_comment', fields: { TEXT: match[1] } });
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
        const body = code.substring(openBrace + 1, closeBrace);
        return this.parseNqcBody(body, bodyStartLine);
    }

    private parseNqcBody(body: string, startLine: number): NqcStatement[] {
        const result: NqcStatement[] = [];
        let index = 0;
        const lineAt = (offset: number) => startLine + body.substring(0, offset).split('\n').length - 1;
        while (index < body.length) {
            while (index < body.length && /\s/.test(body[index])) index++;
            if (index >= body.length) break;

            if (body.substring(index, index + 2) === '//') {
                const newline = body.indexOf('\n', index);
                const end = newline < 0 ? body.length : newline;
                result.push({ line: lineAt(index), text: body.substring(index, end).trim() });
                index = end;
                continue;
            }

            let control: { kind: 'while' | 'if' | 'for'; condition: string; openBrace: number; text: string } | null = null;
            for (const keyword of ['while', 'if', 'for'] as Array<'while' | 'if' | 'for'>) {
                control = this.readNqcControlHeader(body, index, keyword);
                if (control) break;
            }
            if (control) {
                const closeBrace = this.findMatchingBrace(body, control.openBrace);
                if (closeBrace < 0) {
                    throw new NqcConversionError(lineAt(index), control.text, 'nicht geschlossene geschweifte Klammer');
                }
                const parsed: NqcStatement = {
                    line: lineAt(index),
                    text: control.text,
                    kind: control.kind,
                    condition: control.condition,
                    body: this.parseNqcBody(body.substring(control.openBrace + 1, closeBrace), lineAt(control.openBrace + 1)),
                };
                index = closeBrace + 1;
                if (control.kind === 'if') {
                    while (index < body.length && /\s/.test(body[index])) index++;
                    const elseMatch = /^else\s*\{/i.exec(body.substring(index));
                    if (elseMatch) {
                        const elseOpen = index + elseMatch[0].lastIndexOf('{');
                        const elseClose = this.findMatchingBrace(body, elseOpen);
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

    private readNqcControlHeader(
        body: string,
        start: number,
        keyword: 'while' | 'if' | 'for'
    ): { kind: 'while' | 'if' | 'for'; condition: string; openBrace: number; text: string } | null {
        const keywordMatch = new RegExp(`^${keyword}\\b`, 'i').exec(body.substring(start));
        if (!keywordMatch) return null;
        let cursor = start + keywordMatch[0].length;
        while (cursor < body.length && /\s/.test(body[cursor])) cursor++;
        if (body[cursor] !== '(') return null;
        const closeParen = this.findMatchingDelimiter(body, cursor, '(', ')');
        if (closeParen < 0) return null;
        const condition = body.substring(cursor + 1, closeParen).trim();
        cursor = closeParen + 1;
        while (cursor < body.length && /\s/.test(body[cursor])) cursor++;
        if (body[cursor] !== '{') return null;
        return { kind: keyword, condition, openBrace: cursor, text: `${keyword} (${condition})` };
    }

    private findMatchingDelimiter(text: string, open: number, opening: string, closing: string): number {
        let depth = 0;
        for (let index = open; index < text.length; index++) {
            if (text[index] === opening) depth++;
            if (text[index] === closing) {
                depth--;
                if (depth === 0) return index;
            }
        }
        return -1;
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

    /** Translate the expression subset emitted by RcxNqcVisitor back to value blocks. */
    private nqcExpressionBlock(expression: string, configurationXml: string | undefined, line: number): BlockDefinition {
        let source = expression.trim();
        while (source[0] === '(' && this.findMatchingDelimiter(source, 0, '(', ')') === source.length - 1) {
            source = source.substring(1, source.length - 1).trim();
        }

        if (/^-?\d+$/.test(source)) return this.numberBlock(Number(source));
        if (/^(true|false)$/i.test(source)) {
            return { type: 'logic_boolean', fields: { BOOL: source.toUpperCase() } };
        }
        if (/^null$/i.test(source)) return { type: 'logic_null' };

        let match: RegExpMatchArray | null;
        if ((match = source.match(/^SENSOR_([123])$/))) {
            const port = match[1];
            return { type: this.getNqcSensorBlockType(port, configurationXml), fields: { SENSORPORT: port } };
        }
        if (source.replace(/\s+/g, '').toLowerCase() === 'fasttimer(0)*10') {
            return { type: 'robSensors_timer_getSample' };
        }
        if ((match = source.replace(/\s+/g, '').match(/^SENSOR_([123])\*360\/16$/))) {
            return { type: 'robSensors_encoder_getSample', fields: { SENSORPORT: match[1] } };
        }
        if ((match = source.match(/^MIN\s*\(\s*MAX\s*\((.*)\)\s*,\s*(.*)\)$/i))) {
            const maxArgs = this.splitTopLevelArguments(match[1]);
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

        const question = this.findTopLevelOperator(source, ['?']);
        if (question) {
            const remainder = source.substring(question.index + 1);
            const colon = this.findTopLevelOperator(remainder, [':']);
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

        const operators: Array<{ symbols: string[]; type: string; field: string; values: [string, string] }> = [
            { symbols: ['||', '&&'], type: 'logic_operation', field: 'OP', values: ['A', 'B'] },
            { symbols: ['==', '!=', '<=', '>=', '<', '>'], type: 'logic_compare', field: 'OP', values: ['A', 'B'] },
            { symbols: ['+', '-'], type: 'math_arithmetic', field: 'OP', values: ['A', 'B'] },
            { symbols: ['*', '/'], type: 'math_arithmetic', field: 'OP', values: ['A', 'B'] },
            { symbols: ['%'], type: 'math_modulo', field: '', values: ['DIVIDEND', 'DIVISOR'] },
        ];
        const blocklyOperators: { [operator: string]: string } = {
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
        for (const group of operators) {
            const found = this.findTopLevelOperator(source, group.symbols);
            if (found) {
                const block: BlockDefinition = {
                    type: group.type,
                    values: {
                        [group.values[0]]: this.nqcExpressionBlock(source.substring(0, found.index), configurationXml, line),
                        [group.values[1]]: this.nqcExpressionBlock(
                            source.substring(found.index + found.operator.length),
                            configurationXml,
                            line
                        ),
                    },
                };
                if (group.field) block.fields = { [group.field]: blocklyOperators[found.operator] };
                return block;
            }
        }

        if (/^[A-Za-z_]\w*$/.test(source)) {
            return { type: 'variables_get', mutation: { datatype: 'Number' }, fields: { VAR: source } };
        }
        throw new NqcConversionError(line, expression, 'Ausdruck kann noch nicht eindeutig in einen Block übersetzt werden');
    }

    private findTopLevelOperator(source: string, operators: string[]): { index: number; operator: string } | null {
        let depth = 0;
        for (let index = source.length - 1; index >= 0; index--) {
            if (source[index] === ')') depth++;
            if (source[index] === '(') depth--;
            if (depth !== 0) continue;
            for (const operator of operators) {
                const start = index - operator.length + 1;
                if (start >= 0 && source.substring(start, index + 1) === operator) {
                    if (operator === '-' && (start === 0 || /[+\-*/%<>=!&(,]/.test(source[start - 1]))) continue;
                    return { index: start, operator };
                }
            }
        }
        return null;
    }

    private splitTopLevelArguments(source: string): string[] {
        const result: string[] = [];
        let depth = 0;
        let start = 0;
        for (let index = 0; index < source.length; index++) {
            if (source[index] === '(') depth++;
            if (source[index] === ')') depth--;
            if (source[index] === ',' && depth === 0) {
                result.push(source.substring(start, index).trim());
                start = index + 1;
            }
        }
        result.push(source.substring(start).trim());
        return result;
    }

    private getNqcSensorBlockType(port: string, configurationXml?: string): string {
        const defaults: { [port: string]: string } = {
            '1': 'robSensors_touch_getSample',
            '2': 'robSensors_light_getSample',
            '3': 'robSensors_encoder_getSample',
        };
        if (!configurationXml) return defaults[port];
        const document = new DOMParser().parseFromString(configurationXml, 'text/xml');
        const sensorTypes: { [type: string]: string } = {
            robBrick_touch: 'robSensors_touch_getSample',
            robBrick_light: 'robSensors_light_getSample',
            robBrick_encoder: 'robSensors_encoder_getSample',
            robBrick_temperature: 'robSensors_temperature_getSample',
        };
        const value = Array.from(document.getElementsByTagName('value')).find((candidate) => candidate.getAttribute('name') === `S${port}`);
        const sensor = value && Array.from(value.children).find((child) => child.tagName.toLowerCase() === 'block');
        return (sensor && sensorTypes[sensor.getAttribute('type') || '']) || defaults[port];
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

        if (block.mutation) {
            const attributes = Object.entries(block.mutation)
                .map(([name, value]) => ` ${this.xmlEscape(name)}="${this.xmlEscape(String(value))}"`)
                .join('');
            xml += `${indentStr}  <mutation${attributes}></mutation>\n`;
        }

        if (block.repetitions) xml += `${indentStr}  <repetitions>\n`;
        const childIndent = block.repetitions ? `${indentStr}    ` : `${indentStr}  `;
        const childDepth = block.repetitions ? indent + 3 : indent + 2;

        // Add fields
        if (block.fields) {
            for (const [name, value] of Object.entries(block.fields)) {
                xml += `${childIndent}<field name="${this.xmlEscape(name)}">${this.xmlEscape(String(value))}</field>\n`;
            }
        }

        // Add values (nested blocks)
        if (block.values) {
            for (const [name, valueBlock] of Object.entries(block.values)) {
                xml += `${childIndent}<value name="${name}">\n`;
                xml += this.blockToXML(valueBlock, childDepth);
                xml += `${childIndent}</value>\n`;
            }
        }

        // Add statement inputs (for example the body of a forever loop).
        if (block.statements) {
            for (const [name, statementBlock] of Object.entries(block.statements)) {
                xml += `${childIndent}<statement name="${name}">\n`;
                xml += this.blockToXML(statementBlock, childDepth);
                xml += `${childIndent}</statement>\n`;
            }
        }

        if (block.repetitions) xml += `${indentStr}  </repetitions>\n`;

        // Add next block
        if (includeNext && block.next) {
            xml += `${indentStr}  <next>\n`;
            xml += this.blockToXML(block.next, indent + 2);
            xml += `${indentStr}  </next>\n`;
        }

        xml += `${indentStr}</block>\n`;
        return xml;
    }

    private xmlEscape(value: string): string {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
}
