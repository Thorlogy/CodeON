const assert = require('assert');
const fs = require('fs');
const path = require('path');

function field(name, value) {
    return { tagName: 'field', textContent: value, getAttribute: (attribute) => (attribute === 'name' ? name : null) };
}

function motorValue(port, side, reversed) {
    const block = {
        tagName: 'block',
        children: [field('MOTOR_DRIVE', side), field('MOTOR_REVERSE', reversed ? 'ON' : 'OFF')],
        getAttribute: (attribute) => (attribute === 'type' ? 'robBrick_motor_big' : null),
    };
    return {
        children: [block],
        getAttribute: (attribute) => (attribute === 'name' ? `M${port}` : null),
    };
}

function sensorValue(port, type) {
    const block = {
        tagName: 'block',
        children: [],
        getAttribute: (attribute) => (attribute === 'type' ? type : null),
    };
    return {
        children: [block],
        getAttribute: (attribute) => (attribute === 'name' ? `S${port}` : null),
    };
}

global.DOMParser = class {
    parseFromString() {
        const values = [
            sensorValue('1', 'robBrick_touch'),
            sensorValue('2', 'robBrick_light'),
            sensorValue('3', 'robBrick_encoder'),
            motorValue('A', 'LEFT', false),
            motorValue('C', 'RIGHT', true),
        ];
        return { getElementsByTagName: (name) => (name === 'value' ? values : []) };
    }
};

let converterModule;
global.define = (_dependencies, factory) => {
    const exports = {};
    factory(undefined, exports);
    converterModule = exports;
};

const converterPath = path.join(__dirname, '../../OpenRobertaServer/staticResources/js/helper/codeToBlocks.js');
eval(fs.readFileSync(converterPath, 'utf8'));

const configuration = '<block_set robottype="rcx" />';
const wrap = (body) => `task main() {\n${body}\n}`;
const convert = (body) => new converterModule.CodeToBlocksConverter().convertNqcToXML(wrap(body), configuration);

const sensorSetup = converterModule.ensureNqcSensorSetup(wrap('if (SENSOR_1) {\n}\nvalue = SENSOR_2;\nangle = SENSOR_3;'), configuration);
assert(sensorSetup.includes('SetSensor(SENSOR_1, SENSOR_TOUCH);'), 'touch setup must be inserted');
assert(sensorSetup.includes('SetSensor(SENSOR_2, SENSOR_LIGHT);'), 'light setup must be inserted');
assert(sensorSetup.includes('SetSensor(SENSOR_3, SENSOR_ROTATION);'), 'rotation setup must be inserted');
assert.strictEqual((sensorSetup.match(/SetSensor\(SENSOR_1/g) || []).length, 1, 'sensor setup must not be duplicated');
assert.strictEqual(converterModule.ensureNqcSensorSetup(sensorSetup, configuration), sensorSetup, 'sensor setup normalization must be idempotent');
const correctedSensorSetup = converterModule.ensureNqcSensorSetup(wrap('SetSensor(SENSOR_1, SENSOR_LIGHT);\nif (SENSOR_1) {\n}'), configuration);
assert(correctedSensorSetup.includes('SetSensor(SENSOR_1, SENSOR_TOUCH);'), 'wrong setup must follow the robot configuration');

const cases = [
    ['SetPower', 'SetPower(OUT_A, NEPO_PWR(30));', ['robActions_motor_setPower', '<field name="MOTORPORT">A</field>', '<field name="NUM">30</field>']],
    ['OnFwd', 'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnFwd(OUT_A); OnRev(OUT_C);', ['robActions_motorDiff_on', '<field name="DIRECTION">FOREWARD</field>']],
    ['OnRev', 'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnRev(OUT_A); OnFwd(OUT_C);', ['robActions_motorDiff_on', '<field name="DIRECTION">BACKWARD</field>']],
    ['Off', 'Off(OUT_A+OUT_C);', ['robActions_motorDiff_stop']],
    ['Wait', 'Wait((500) / 10);', ['robControls_wait_time', '<field name="NUM">500</field>']],
    ['PlayTone', 'PlayTone(440, (500) / 10);\nWait((500) / 10);', ['robActions_play_tone', '<field name="NUM">440</field>']],
    ['SetUserDisplay', 'SetUserDisplay(7, 0);', ['robActions_display_text', '<field name="NUM">7</field>']],
    ['SelectDisplay', 'SelectDisplay(DISPLAY_WATCH);', ['robActions_display_clear']],
    ['ClearTimer', 'ClearTimer(0);', ['robSensors_timer_reset']],
    ['ClearSensor', 'ClearSensor(SENSOR_3);', ['robSensors_encoder_reset', '<field name="SENSORPORT">3</field>']],
    [
        'while',
        'while (true) {\nWait((500) / 10);\nOff(OUT_A+OUT_C);\n}',
        ['robControls_loopForever', '<statement name="DO">', 'robControls_wait_time', 'robActions_motorDiff_stop'],
    ],
    ['if', 'if (SENSOR_1) {\nOff(OUT_A+OUT_C);\n}', ['robControls_if', 'robSensors_touch_getSample', '<statement name="DO0">']],
    [
        'if else',
        'if (SENSOR_1 == true) {\nOff(OUT_A+OUT_C);\n} else {\nWait((100) / 10);\n}',
        ['robControls_ifElse', '<mutation else="1"></mutation>', '<repetitions>', 'logic_compare', '<statement name="ELSE">'],
    ],
    ['while condition', 'while (SENSOR_1) {\nWait((100) / 10);\n}', ['controls_whileUntil', '<field name="MODE">WHILE</field>', 'robSensors_touch_getSample']],
    [
        'for',
        'for (int i = 0; i < 10; i += 1) {\nWait((100) / 10);\n}',
        ['robControls_for', '<field name="VAR">i</field>', '<value name="FROM">', '<value name="TO">', '<value name="BY">'],
    ],
    ['repeat', 'for (int k0 = 0; k0 < 5; k0 += 1) {\nOff(OUT_A+OUT_C);\n}', ['controls_repeat_ext', '<value name="TIMES">', '<field name="NUM">5</field>']],
    [
        'flow statements',
        'while (true) {\nif (SENSOR_1) { break; }\ncontinue;\n}',
        ['controls_flow_statements', '<field name="FLOW">BREAK</field>', '<field name="FLOW">CONTINUE</field>'],
    ],
    [
        'logic and arithmetic expressions',
        'if ((SENSOR_2 > 20) && !(SENSOR_1 == true)) {\nwert = (3 + 4) * 2;\nwert += 1;\n}',
        ['logic_operation', 'logic_compare', 'logic_negate', 'math_arithmetic', 'variables_set', 'robMath_change'],
    ],
    ['wait until', 'while (true) {\nif (SENSOR_1) {\nbreak;\n}\nWait(1);\n}', ['robControls_wait_for', '<value name="WAIT0">', 'robSensors_touch_getSample']],
    [
        'sensors and math functions',
        'timer = (FastTimer(0) * 10);\nangle = (SENSOR_3 * 360 / 16);\nlimited = MIN(MAX(timer, 1), 100);\nrandomValue = Random((100) - (1)) + (1);',
        ['robSensors_timer_getSample', 'robSensors_encoder_getSample', 'math_constrain', 'math_random_int'],
    ],
    [
        'ternary and comment',
        '// Entscheidung\nwert = (SENSOR_1 ? 1 : 0);',
        ['text_comment', '<field name="TEXT">Entscheidung</field>', 'logic_ternary', '<value name="THEN">', '<value name="ELSE">'],
    ],
];

for (const [name, source, expectedFragments] of cases) {
    const xml = convert(source);
    for (const fragment of expectedFragments) {
        assert(xml.includes(fragment), `${name}: expected ${fragment}\n${xml}`);
    }
}

const repeated = convert('SetPower(OUT_A+OUT_C, NEPO_PWR(42));\nOnFwd(OUT_A); OnRev(OUT_C);\nOnFwd(OUT_A); OnRev(OUT_C);');
assert.strictEqual((repeated.match(/type="robActions_motorDiff_on"/g) || []).length, 2, 'persistent SetPower must create two drive blocks');

assert.throws(
    () => convert('SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnFwd(OUT_A);'),
    /unvollständige Motor-Richtungsbefehle/,
    'partial differential direction must not silently change the program'
);

const aceSource = fs.readFileSync(path.join(__dirname, '../src/helper/aceEditor.ts'), 'utf8');
const expectedCaptions = [
    'SetPower',
    'OnFwd',
    'OnRev',
    'Off',
    'Float',
    'turn left',
    'turn right',
    'Wait',
    'PlayTone',
    'SetUserDisplay',
    'SelectDisplay',
    'ClearTimer',
    'ClearSensor',
    'SENSOR_1',
    'SENSOR_2',
    'SENSOR_3',
    'FastTimer',
    'encoder degrees',
    'if',
    'if … else',
    'for',
    'repeat',
    'while',
    'forever',
    'break',
    'continue',
    'variable =',
    'variable +=',
    'true',
    'false',
    'null',
    'ternary',
    'logic AND',
    'logic OR',
    'logic NOT',
    'compare',
    'arithmetic',
    'modulo',
    'constrain',
    'Random',
    'comment',
    'wait until',
    'wait with action',
];
for (const caption of expectedCaptions) {
    assert(aceSource.includes(`caption: '${caption}'`), `missing NQC completion: ${caption}`);
}

for (const caption of ['if', 'if … else', 'for', 'repeat', 'while', 'forever', 'wait until', 'wait with action']) {
    const escapedCaption = caption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`caption: '${escapedCaption}',[\\s\\S]{0,220}?snippet:`).test(aceSource), `${caption}: multiline completion must be an indented snippet`);
}
assert(aceSource.includes("langToSet = 'nqc';"), 'NQC must use its own Ace syntax mode');
assert(aceSource.includes('ed.session.setTabSize(4);'), 'NQC convention must use four-space indentation');
assert(aceSource.includes('ed.session.setUseSoftTabs(true);'), 'NQC convention must not insert tab characters');

const serverNqcMode = fs.readFileSync(path.join(__dirname, '../../OpenRobertaServer/staticResources/libs/ace/mode-nqc.js'), 'utf8');
const applicationNqcMode = fs.readFileSync(path.join(__dirname, '../../application/staticResources/libs/ace/mode-nqc.js'), 'utf8');
assert.strictEqual(serverNqcMode, applicationNqcMode, 'both distributions must ship the same NQC syntax mode');
for (const highlightedToken of ['task|sub', 'SetPower|OnFwd|OnRev', 'SetSensor|FastTimer', 'OUT_A|OUT_B|OUT_C', 'SENSOR_TOUCH|SENSOR_LIGHT']) {
    assert(serverNqcMode.includes(highlightedToken), `NQC syntax mode must highlight ${highlightedToken}`);
}

console.log(`NQC roundtrip coverage: ${cases.length + 2} cases passed; ${expectedCaptions.length} curated proposals present`);
