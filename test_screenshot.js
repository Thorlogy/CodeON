const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 1024 });

    console.log('Navigating to localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved to screenshot.png');
    
    await browser.close();
})();
