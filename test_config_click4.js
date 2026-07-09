const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    // Intercept responses to check what the API returns!
    page.on('response', async response => {
        if (response.url().includes('setRobot')) {
            console.log('setRobot Response:', await response.json());
        }
    });

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    // Click to select RCX directly
    await page.evaluate(() => {
        setRobot('rcx');
    });
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
