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

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
        return new Promise(resolve => {
            require(['guiState.controller'], function(guiState) {
                window.guiState = guiState;
                guiState.setRobot("rcx", function() {
                    console.log("Robot set to rcx!");
                    resolve();
                });
            });
        });
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    await browser.close();
})();
