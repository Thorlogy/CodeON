#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repositoryRoot, 'OpenRobertaRobot', 'constantsSource.txt');
const javaPath = path.join(
    repositoryRoot,
    'OpenRobertaRobot',
    'src',
    'main',
    'java',
    'de',
    'fhg',
    'iais',
    'roberta',
    'util',
    'basic',
    'C.java'
);
const typescriptPath = path.join(
    repositoryRoot,
    'OpenRobertaWeb',
    'src',
    'app',
    'nepostackmachine',
    'interpreter.constants.ts'
);

function normalizeNewlines(content) {
    return content.replace(/\r\n/g, '\n');
}

function parseConstants(source) {
    const normalizedSource = normalizeNewlines(source);
    const lines = normalizedSource.endsWith('\n') ? normalizedSource.slice(0, -1).split('\n') : normalizedSource.split('\n');

    return lines.map((line, index) => {
        if (!line.trim()) {
            return { java: '', typescript: '' };
        }

        if (line.trimStart().startsWith('//')) {
            return { java: `    ${line.trimStart()}`, typescript: line.trimStart() };
        }

        const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/);
        if (!match) {
            throw new Error(`Unsupported constants syntax at line ${index + 1}: ${line}`);
        }

        const [, name, value] = match;
        const isString = value.startsWith('"');
        const javaType = isString ? 'String' : /^[-+]?\d+$/.test(value) ? 'int' : 'double';
        const typescriptType = isString ? 'string' : 'number';

        return {
            java: `    public static final ${javaType} ${name} = ${value};`,
            typescript: `export const ${name}: ${typescriptType} = ${value};`,
        };
    });
}

function generateOutputs(source) {
    const constants = parseConstants(source);
    return {
        java: `package de.fhg.iais.roberta.util.basic;\n\npublic class C {\n${constants.map((constant) => constant.java).join('\n')}\n}\n`,
        typescript: `\n${constants.map((constant) => constant.typescript).join('\n')}\n`,
    };
}

function checkOutput(outputPath, expectedContent) {
    const actualContent = normalizeNewlines(fs.readFileSync(outputPath, 'utf8'));
    if (actualContent === expectedContent) {
        return true;
    }

    console.error(`Generated constants are stale: ${path.relative(repositoryRoot, outputPath)}`);
    return false;
}

const outputs = generateOutputs(fs.readFileSync(sourcePath, 'utf8'));
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
    const javaIsCurrent = checkOutput(javaPath, outputs.java);
    const typescriptIsCurrent = checkOutput(typescriptPath, outputs.typescript);
    if (!javaIsCurrent || !typescriptIsCurrent) {
        console.error('Run `npm run generate:constants` and commit the generated files.');
        process.exit(1);
    }
    console.log('Generated Java and TypeScript constants are current.');
} else {
    fs.writeFileSync(javaPath, outputs.java);
    fs.writeFileSync(typescriptPath, outputs.typescript);
    console.log('Generated Java and TypeScript constants.');
}
