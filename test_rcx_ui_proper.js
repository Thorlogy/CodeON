const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('PAGE ERROR LOG:', msg.text());
        }
    });
    page.on('pageerror', error => console.log('PAGE EXCEPTION:', error.message));

    try {
        console.log("Navigating...");
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
        console.log("Taking screenshot of startup...");
        await page.screenshot({ path: 'rcx_ui_step1_startup.png' });
        
        console.log("Closing popup...");
        try {
            await page.click('#startupPopup button.close');
        } catch(e) {
            console.log("Could not click popup close.");
        }
        await wait(1000);
        
        console.log("Opening robot menu...");
        await page.click('#head-navi-icon-robot');
        await wait(1000);
        
        console.log("Clicking RCX...");
        const robots = await page.$$('.robotType');
        for (const r of robots) {
            const text = await page.evaluate(el => el.textContent, r);
            if (text.includes('RCX')) {
                await r.click();
                break;
            }
        }
        await wait(2000);
        
        console.log("Opening configuration tab...");
        await page.click('#tabConfiguration');
        await wait(2000);
        
        console.log("Taking screenshot of config tab...");
        await page.screenshot({ path: 'rcx_ui_step2_config.png' });
        
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
        await page.screenshot({ path: 'rcx_ui_error_state.png' });
    } finally {
        await browser.close();
    }
})();
