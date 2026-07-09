const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setCacheEnabled(false); // disable cache

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR STACK:', error.stack));
    page.on('response', response => {
        if (!response.ok()) {
            console.log('RESPONSE NOT OK:', response.url(), response.status());
        }
    });

    console.log('Navigating to localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    console.log('Selecting RCX...');
    await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        for (let img of imgs) {
            if (img.src.includes('rcx.jpg')) {
                img.click();
                return;
            }
        }
    });
    
    console.log('Waiting for workspace...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await browser.close();
})();
