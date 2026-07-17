const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '../src/app/simulation/simulationLogic/simulation.light.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleUnderTest, moduleUnderTest.exports, require);
const { calculateAmbientLight } = moduleUnderTest.exports;

const lamp = (x, y, intensity = 100, range = 100) => ({ x, y, intensity, range });

assert.strictEqual(calculateAmbientLight(0, 0, 0, [lamp(50, 0)]), 50, 'distance falloff');
assert.strictEqual(calculateAmbientLight(0, 0, 0, [lamp(0, 50)]), 0, 'lamp outside cone');
assert.strictEqual(calculateAmbientLight(0, 0, 0, [lamp(101, 0)]), 0, 'lamp outside range');
assert.strictEqual(calculateAmbientLight(0, 0, 0, [lamp(0, 0), lamp(0, 0)]), 100, 'combined light is capped');
assert.strictEqual(calculateAmbientLight(0, 0, Math.PI, [lamp(-50, 0)]), 50, 'wrapped direction');

console.log('simulation.light tests passed');
