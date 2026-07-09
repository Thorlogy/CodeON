const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Select RCX
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Test creating a valid block programmatically
    const validBlockResult = await page.evaluate(() => {
        try {
            const ws = Blockly.getMainWorkspace();
            const b = ws.newBlock('robSensors_touch_getSample');
            b.initSvg();
            b.render();
            return "SUCCESS: touch block rendered. Output connection: " + !!b.outputConnection;
        } catch (e) {
            return "ERROR: " + e.message;
        }
    });
    console.log("Valid Block Result:", validBlockResult);
    
    await browser.close();
})();
