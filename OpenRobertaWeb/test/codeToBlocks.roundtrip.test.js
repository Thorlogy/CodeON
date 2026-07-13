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

global.DOMParser = class {
    parseFromString() {
        const values = [motorValue('A', 'LEFT', false), motorValue('C', 'RIGHT', true)];
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

const cases = [
    ['SetPower', 'SetPower(OUT_A, NEPO_PWR(30));', ['robActions_motor_setPower', '<field name="MOTORPORT">A</field>', '<field name="NUM">30</field>']],
    [
        'OnFwd',
        'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnFwd(OUT_A); OnRev(OUT_C);',
        ['robActions_motorDiff_on', '<field name="DIRECTION">FOREWARD</field>'],
    ],
    [
        'OnRev',
        'SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnRev(OUT_A); OnFwd(OUT_C);',
        ['robActions_motorDiff_on', '<field name="DIRECTION">BACKWARD</field>'],
    ],
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
];

for (const [name, source, expectedFragments] of cases) {
    const xml = convert(source);
    for (const fragment of expectedFragments) {
        assert(xml.includes(fragment), `${name}: expected ${fragment}\n${xml}`);
    }
}

const repeated = convert(
    'SetPower(OUT_A+OUT_C, NEPO_PWR(42));\nOnFwd(OUT_A); OnRev(OUT_C);\nOnFwd(OUT_A); OnRev(OUT_C);'
);
assert.strictEqual((repeated.match(/type="robActions_motorDiff_on"/g) || []).length, 2, 'persistent SetPower must create two drive blocks');

assert.throws(
    () => convert('SetPower(OUT_A+OUT_C, NEPO_PWR(30));\nOnFwd(OUT_A);'),
    /unvollständige Motor-Richtungsbefehle/,
    'partial differential direction must not silently change the program'
);

console.log(`NQC roundtrip coverage: ${cases.length + 2} cases passed`);
