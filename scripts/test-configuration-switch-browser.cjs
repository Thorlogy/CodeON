// External Playwright/Chrome, isolated server and database only. No hardware.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.text().includes('EXCEPTION')) errors.push(message.text());
        });
        await page.addInitScript(() => {
            window.WebSocket = class { constructor() { throw Error('Hardware disabled in test'); } };
            HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
        });
        await page.goto(process.env.CODEON_TEST_URL || 'http://127.0.0.1:1998/');
        await page.locator('button.pick').first().click();
        await page.waitForFunction(() => require('guiState.controller').getBlocklyWorkspace());

        async function switchTo(robot) {
            const completed = await page.evaluate(robot => new Promise(resolve => {
                const timer = setTimeout(() => resolve(false), 10000);
                require('robot.controller').switchRobot(robot, {}, true, () => {
                    clearTimeout(timer);
                    resolve(true);
                });
            }), robot);
            assert.ok(completed, 'Switch callback: ' + robot);
            await page.waitForFunction(robot => require('connection.controller').getConnectionRobotName() === robot, robot);
            const dialog = page.locator('#show-message');
            if (await dialog.isVisible()) {
                assert.match(await dialog.innerText(), /Die lokale RCX-Übertragung ist noch nicht gestartet\./);
                await dialog.getByRole('button', { name: 'OK', exact: true }).click();
                await dialog.waitFor({ state: 'hidden' });
            }
            // Allow queued Blockly changes to settle before checking for stale events.
            await page.waitForTimeout(550);
            return page.evaluate(() => {
                const gui = require('guiState.controller');
                const config = require('configuration.controller');
                const ws = config.getBricklyWorkspace();
                const signature = () => ws.getAllBlocks().map(block => ({
                    type: block.type,
                    fields: block.inputList.flatMap(input => input.fieldRow.filter(field => field.name).map(field => [field.name, field.getValue()])),
                })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
                const before = signature();
                config.reloadView();
                return {
                    robot: gui.getRobot(), id: ws.id,
                    categories: ws.options.hasCategories,
                    toolbox: !!ws.options.languageTree,
                    before, after: signature(),
                    workspaces: document.querySelectorAll('#bricklyDiv > svg.blocklySvg').length,
                    startBlocks: gui.getBlocklyWorkspace().getTopBlocks().filter(b => b.type === 'robControls_start').length,
                    configurationUsed: gui.isConfigurationUsed(),
                };
            });
        }

        const robots = ['rcx', 'apitor', 'cozmo', 'edisonv2', 'rcj'];
        let pairs = 0;
        for (const from of robots) {
            for (const to of robots.filter(robot => robot !== from)) {
                const previous = await switchTo(from);
                const next = await switchTo(to);
                assert.equal(next.robot, to);
                assert.equal(next.workspaces, 1, 'No duplicate configuration workspace');
                assert.equal(next.startBlocks, 1, 'Program initialized after switch');
                assert.equal(next.toolbox, to !== 'cozmo');
                assert.equal(next.categories, to !== 'cozmo' && to !== 'apitor');
                assert.deepEqual(next.after, next.before, 'Reload preserves configuration blocks/fields');
                if (to === 'cozmo') assert.equal(next.before.length, 0, 'Fixed Cozmo stays empty');
                if (to === 'edisonv2') assert.equal(next.configurationUsed, false, 'Built-in Edison unchanged');
                if (to === 'apitor') assert.ok(next.before.length > 0, 'Apitor configuration remains present');
                const modeChanged = previous.toolbox !== next.toolbox || previous.categories !== next.categories;
                assert.equal(previous.id !== next.id, modeChanged, 'Recreate only on toolbox mode change');
                assert.deepEqual(errors, []);
                pairs++;
                console.log('PASS', from, '->', to);
            }
        }
        // Compile/open SIM for every robot after the switch matrix.
        for (const robot of robots) {
            await switchTo(robot);
            await page.locator('#simButton').click();
            await page.waitForFunction(() => document.querySelector('#simButton').classList.contains('rightActive'));
            await page.waitForFunction(() => require('simulation.roberta').SimulationRoberta.Instance.scene.robots.length > 0);
            const stopped = await page.evaluate(() => {
                const sim = require('simulation.roberta').SimulationRoberta.Instance;
                const robot = sim.scene.robots[0];
                if (require('guiState.controller').getRobot() === 'cozmo') robot.chassis.holdLiftPosition(0.6);
                const lift = robot.chassis.liftPosition;
                sim.stopProgram();
                return { persistent: sim.hasPersistentMotorOutputs(), lift, after: robot.chassis.liftPosition };
            });
            assert.equal(stopped.persistent, false, 'No spurious retained motor outputs');
            assert.equal(stopped.after, stopped.lift, 'Explicit stop does not lower Cozmo lift');
            await page.locator('#simButton').click();
            await page.waitForFunction(() => !document.querySelector('.fromRight.shifting') && !document.querySelector('#simDiv.rightActive'));
            assert.deepEqual(errors, []);
            console.log('PASS simulation initialization:', robot);
        }
        console.log('PASS', pairs, 'directed transitions, reload preservation, all five SIM initializations.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
