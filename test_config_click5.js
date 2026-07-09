const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    page.on('response', async response => {
        if (response.url().includes('setRobot')) {
            const text = await response.text();
            console.log('setRobot Response:', text);
        }
    });

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    // Click the logo to open robot selection
    await page.click('.img-nepo');
    await new Promise(r => setTimeout(r, 1000));
    
    // Click the RCX robot
    const clicked = await page.evaluate(() => {
        const rcxBtn = document.querySelector('a[data-internalid="rcx"]');
        if (rcxBtn) {
            rcxBtn.click();
            return true;
        }
        return false;
    });
    
    console.log("Clicked RCX:", clicked);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if configurationUsed is true in GUISTATE
    const confUsed = await page.evaluate(() => {
        return window.GUISTATE ? window.GUISTATE.gui.configurationUsed : "no GUISTATE on window";
    });
    console.log("configurationUsed:", confUsed);

    await browser.close();
})();
