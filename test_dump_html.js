const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    const html = await page.evaluate(() => document.body.innerHTML);
    const fs = require('fs');
    fs.writeFileSync('page_dump.html', html);
    console.log('Saved page_dump.html');
    
    await browser.close();
})();
