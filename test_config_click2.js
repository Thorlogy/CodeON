const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    console.log("Waiting for robot selection...");
    await page.waitForSelector('.robotType');
    
    // Select RCX
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    
    console.log("Waiting for program tab...");
    // Wait until #program is active
    await page.waitForFunction(() => {
        const el = document.querySelector('#program');
        return el && el.classList.contains('active');
    }, { timeout: 10000 });
    
    let activeTab = await page.evaluate(() => document.querySelector('.tab-pane.active').id);
    console.log("Active tab after selecting RCX:", activeTab);
    
    // Now click the configuration tab
    console.log("Clicking Configuration Tab...");
    await page.evaluate(() => {
        document.querySelector('#head-navigation-configuration-edit').click();
    });
    
    // Check what happens
    await new Promise(r => setTimeout(r, 2000));
    activeTab = await page.evaluate(() => document.querySelector('.tab-pane.active').id);
    console.log("Active tab after clicking config:", activeTab);
    
    const confUsed = await page.evaluate(() => GUISTATE_C ? GUISTATE_C.isConfigurationUsed() : "No GUISTATE_C");
    console.log("GUISTATE_C.isConfigurationUsed():", confUsed);
    
    await browser.close();
})();
