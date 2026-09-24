// Isolated browser regression against a running local CodeON server.
// Requires externally available Playwright (NODE_PATH); no hardware is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--rcj-baseline');
const deployed = process.argv.includes('--deployed');
const files = [
    'main.js',
    'app/roberta/controller/menu.controller.js',
    'app/roberta/controller/connection.controller.js',
    'app/roberta/controller/guiState.controller.js',
    'app/roberta/controller/progList.controller.js',
    'app/nepostackmachine/interpreter.robotBridgeBehaviour.js',
    'app/roberta/controller/configuration.controller.js',
    'app/roberta/controller/connections/connections.js',
];

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage();
        await page.addInitScript(() => {
            window.WebSocket = class { constructor() { throw new Error('Hardware disabled by regression test'); } };
            // Menu click sounds are not under test; rapid headless clicks
            // otherwise race play()/pause() in the existing UI audio helper.
            HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
        });
        // Test candidate resources without changing the running installation.
        for (const file of baseline || deployed ? [] : files) {
            const source = fs.readFileSync(path.join(root, 'OpenRobertaServer/staticResources/js', file), 'utf8');
            assert.equal(source, fs.readFileSync(path.join(root, 'application/staticResources/js', file), 'utf8'));
            await page.route('**/js/' + file + '*', route => route.fulfill({ contentType: 'application/javascript', body: source }));
        }
        if (!baseline && !deployed) {
            await page.route(url => url.pathname === '/', route => route.fulfill({
                contentType: 'text/html',
                body: fs.readFileSync(path.join(root, 'application/staticResources/index.html'), 'utf8'),
            }));
            for (const language of ['de', 'en']) {
                await page.route('**/blockly/msg/js/' + language + '.js*', route => route.fulfill({
                    contentType: 'application/javascript',
                    body: fs.readFileSync(path.join(root, 'application/staticResources/blockly/msg/js/' + language + '.js'), 'utf8'),
                }));
            }
        }
        const errors = [];
        const galleryRequests = [];
        page.on('request', request => {
            if (request.url().includes('/program/gallery') || (request.postData() || '').includes('shareWithGallery')) {
                galleryRequests.push(request.url());
            }
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.text().startsWith('XML_FAILURE')) errors.push(message.text()); });
        await page.goto(process.env.CODEON_TEST_URL || 'http://localhost:1999/', { waitUntil: 'domcontentloaded' });
        await page.locator('button.pick').first().waitFor();
        await page.evaluate(() => {
            const original = Blockly.Xml.textToDom;
            Blockly.Xml.textToDom = function (xml) {
                try { return original.apply(this, arguments); }
                catch (error) { console.error('XML_FAILURE', xml); throw error; }
            };
        });
        await page.locator('button.pick').nth(baseline ? 2 : process.argv.includes('--cozmo-first') ? 3 : 0).click();
        await page.waitForFunction(() => require('guiState.controller').getBlocklyWorkspace());
        assert.equal(await page.locator('#head-navigation-gallery, #tabGalleryList, #galleryList, #share-with-gallery').count(), 0);
        // Reproduce replacement of navigation DOM after initialization:
        // direct bindings on the old node must not be required.
        await page.evaluate(() => {
            const item = document.getElementById('head-navigation-robot-status');
            item.replaceWith(item.cloneNode(true));
        });
        // Include both directions, repeated Cozmo entry, built-in Edison and
        // configurable RCX/Apitor/RCJ. A callback proves reset completed.
        for (const robot of baseline ? ['rcj'] : ['cozmo', 'rcx', 'cozmo', 'apitor', 'cozmo', 'edisonv2', 'cozmo', 'rcj', 'cozmo']) {
            const result = await page.evaluate(robot => new Promise(resolve => {
                const timeout = setTimeout(() => resolve({ timeout: true }), 8000);
                require('robot.controller').switchRobot(robot, {}, true, () => {
                    clearTimeout(timeout);
                    const gui = require('guiState.controller');
                    resolve({ robot: gui.getRobot(), blocks: gui.getBlocklyWorkspace().getAllBlocks().map(b => b.type) });
                });
            }), robot);
            assert.equal(result.robot, robot, JSON.stringify(result));
            assert.deepEqual(result.blocks, ['robControls_start']);
            await page.waitForFunction(robot => require('connection.controller').getConnectionRobotName() === robot, robot);
            // Available before any hardware program starts, for every system.
            assert.equal(await page.locator('#codeon-cozmo-status').count(), 0);
            await page.locator('#head-navi-tooltip-robot-status').click();
            await page.locator('#codeon-cozmo-status').waitFor({ state: 'visible' });
            assert.ok((await page.locator('#codeon-cozmo-status-details').innerText()).length > 0);
            await page.locator('#head-navi-tooltip-robot-status').click();
            await page.locator('#codeon-cozmo-status').waitFor({ state: 'hidden' });
            await page.locator('#head-navi-tooltip-robot-status').click();
            await page.locator('#codeon-cozmo-status').waitFor({ state: 'visible' });
            await page.locator('#head-navi-tooltip-robot-status').click();
            // RCJ's unchanged server default has a separately reproduced
            // robConf_colour error. Here we test its workspace transition only.
            if (robot === 'rcj' && !baseline) {
                console.log('RCJ workspace switch passed (compilation excluded: known baseline failure).');
                continue;
            }
            if (robot === 'cozmo') {
                await page.evaluate(() => {
                    const gui = require('guiState.controller');
                    const workspace = gui.getBlocklyWorkspace();
                    const toolbox = Blockly.Xml.textToDom(gui.getProgramToolbox());
                    const drive = toolbox.querySelector('block[type="actions_motorDiff_on_for"]');
                    const block = Blockly.Xml.domToBlock(drive.cloneNode(true), workspace);
                    workspace.getTopBlocks().find(b => b.type === 'robControls_start').nextConnection.connect(block.previousConnection);
                });
            }
            const compiled = await page.evaluate(() => new Promise(resolve => {
                const gui = require('guiState.controller');
                const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(gui.getBlocklyWorkspace()));
                const timeout = setTimeout(() => resolve({ timeout: true }), 8000);
                require('program.model').runInSim('Regression', undefined, xml, undefined, gui.getLanguage(), result => {
                    clearTimeout(timeout);
                    resolve({ rc: result.rc, message: result.message, hasCode: !!result.compiledCode });
                });
            }));
            assert.equal(compiled.rc, 'ok', robot + ': ' + JSON.stringify(compiled));
            console.log('Switch and simulation compilation passed:', robot);
        }
        await page.locator('#simButton').click();
        await page.locator('#simDiv').waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('#simButton').classList.contains('rightActive'));
        console.log('Cozmo SIM panel opened successfully.');
        const status = await page.evaluate(async () => {
            const { RobotBridgeBehaviour: Behaviour } = require('interpreter.robotBridgeBehaviour');
            let respond;
            const bridge = { command: () => Promise.resolve(), sensor: () => new Promise(resolve => { respond = resolve; }) };
            Behaviour.activateStatus();
            document.getElementById('codeon-cozmo-status')?.remove();
            const first = new Behaviour(bridge);
            const panel = () => document.getElementById('codeon-cozmo-status');
            const toggle = () => panel().querySelector('button');
            const details = () => document.getElementById('codeon-cozmo-status-details');
            const checks = [!!panel(), panel().hidden, !details().hidden];
            Behaviour.toggleStatus('cozmo', 'Cozmo');
            checks.push(!panel().hidden);
            Behaviour.toggleStatus('cozmo', 'Cozmo');
            first.setTaskContext('test', 'Test', 1);
            checks.push(panel().hidden); // Sensor/status refresh must not reopen it.
            Behaviour.toggleStatus('cozmo', 'Cozmo');
            checks.push(!panel().hidden);
            toggle().click();
            checks.push(details().hidden, toggle().getAttribute('aria-expanded') === 'false');
            first.close();
            checks.push(details().hidden);
            const second = new Behaviour(bridge);
            checks.push(details().hidden);
            toggle().click();
            checks.push(!details().hidden);
            second.close();
            // Real connection teardown on robot switch must remove the panel.
            await new Promise(resolve => require('robot.controller').switchRobot('rcx', {}, true, resolve));
            checks.push(!panel());
            respond({ value: { liftHeight: 70 } });
            await Promise.resolve();
            checks.push(!panel());
            Behaviour.activateStatus();
            const third = new Behaviour(bridge);
            checks.push(!!panel(), panel().hidden);
            third.close();
            Behaviour.deactivateStatus();
            return checks;
        });
        assert.ok(status.every(Boolean), JSON.stringify(status));
        await page.goto((process.env.CODEON_TEST_URL || 'http://localhost:1999/').replace(/\/$/, '') + '/?loadSystem=cozmo&gallery=1', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof require === 'function' && require.defined('guiState.controller') && typeof require('guiState.controller').getBlocklyWorkspace === 'function' && require('guiState.controller').getBlocklyWorkspace());
        await page.locator('#head-navi-tooltip-robot-status').click();
        await page.locator('#codeon-cozmo-status').waitFor({ state: 'visible' });
        await page.screenshot({ path: '/tmp/codeon-robot-status-menu.png' });
        assert.deepEqual(galleryRequests, []);
        assert.deepEqual(errors, []);
        console.log('Status toggle, program end, restart, robot switch and delayed response passed.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
