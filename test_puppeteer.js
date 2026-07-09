const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
        // Hide tables
        document.querySelectorAll('.tab-pane:not(#program)').forEach(e => {
            e.style.display = 'none';
            e.style.pointerEvents = 'none';
        });
        document.getElementById('header').style.pointerEvents = 'none';
    });
    // Init rcx workspace
    await page.evaluate(() => {
        const INIT = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
        INIT.device = 'rcx';
        Blockly.getMainWorkspace = () => INIT;
    });
    await page.evaluate(() => {
        const ws = Blockly.getMainWorkspace();
        // Try creating all rcx sensors
        ['touch', 'light', 'encoder', 'timer'].forEach(sensor => {
            try {
                const b = ws.newBlock('robSensors_' + sensor + '_getSample');
                b.dispose();
                console.log('SUCCESS: ' + sensor);
            } catch (e) {
                console.log('ERROR ' + sensor + ':', e.message);
            }
        });
        // Try getSample
        try {
            const b = ws.newBlock('robSensors_getSample');
            b.dispose();
            console.log('SUCCESS: getSample');
        } catch (e) {
            console.log('ERROR getSample:', e.message);
        }
    });
    await browser.close();
})();
