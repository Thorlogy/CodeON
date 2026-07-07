const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("Navigating to http://localhost:1999...");
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait a bit for robots to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("Taking screenshot...");
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/d594f8c7-4dfc-4d17-b4d9-36059cc03cc2/test_ui_2.png' });
    console.log("Screenshot saved to test_ui_2.png!");
    
    await browser.close();
})();
