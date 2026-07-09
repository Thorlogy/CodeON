const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    // Evaluate in page to select RCX
    await page.evaluate(() => {
        if (window.setRobot) {
            setRobot('rcx');
        } else {
            console.log("no setRobot");
        }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const confUsed = await page.evaluate(() => GUISTATE_C ? GUISTATE_C.isConfigurationUsed() : "No GUISTATE_C");
    console.log("GUISTATE_C.isConfigurationUsed():", confUsed);
    
    await browser.close();
})();
