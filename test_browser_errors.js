const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => {
        console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
    });
    page.on('response', response => {
        if (!response.ok()) {
            console.log('RESPONSE NOT OK:', response.url(), response.status());
        }
    });

    console.log('Navigating to localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    console.log('Selecting RCX...');
    // We wait for the robot group selection
    await page.waitForSelector('#simDetail');
    // We can evaluate scripts to trigger the RCX selection
    await page.evaluate(() => {
        // try to find rcx in the list and click it
        const elements = document.querySelectorAll('.robotType');
        for (let el of elements) {
            if (el.dataset.type === 'rcx') {
                el.click();
                return;
            }
        }
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Done.');
    await browser.close();
})();
