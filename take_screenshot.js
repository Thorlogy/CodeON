const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    let reloading = false;
    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) reloading = true;
    });

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    // Switch robot to RCX but don't await the promise if it reloads!
    await page.evaluate(() => {
        require(['guiState.controller'], function(guiState) {
            guiState.setRobot("rcx");
        });
    });
    
    // Wait for either reload or timeout
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (reloading) {
        console.log("Page reloaded, waiting for networkidle0...");
        await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    }

    // Switch to Configuration tab
    await page.evaluate(() => {
        $('#tabConfiguration').tab('show');
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await page.screenshot({path: 'rcx_config_tab2.png'});
    console.log("Screenshot saved to rcx_config_tab2.png");
    await browser.close();
})();
