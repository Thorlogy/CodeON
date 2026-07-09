const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Simulate user switching to RCX
    await page.evaluate(() => {
        // Change robot to RCX (assuming there's an API for this, or just hack the workspace)
        const INIT = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
        INIT.device = 'rcx';
        Blockly.getMainWorkspace = () => INIT;
    });

    await page.evaluate(() => {
        const ws = Blockly.getMainWorkspace();
        // Try creating all rcx sensors to see if they crash or become UNSUPPORTED
        ['touch', 'light', 'encoder', 'timer'].forEach(sensor => {
            try {
                const b = ws.newBlock('robSensors_' + sensor + '_getSample');
                b.initSvg();
                console.log('SUCCESS: ' + sensor + ' (inputs: ' + b.inputList.length + ')');
                b.dispose();
            } catch (e) {
                console.log('ERROR ' + sensor + ':', e.message);
            }
        });
        
        try {
            const b = ws.newBlock('robSensors_getSample');
            b.initSvg();
            console.log('SUCCESS: getSample' + ' (inputs: ' + b.inputList.length + ')');
            b.dispose();
        } catch (e) {
            console.log('ERROR getSample:', e.message);
        }
    });
    
    await browser.close();
})();
