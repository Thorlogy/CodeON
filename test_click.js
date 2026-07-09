const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('PAGE EXCEPTION:', error.message));

    try {
        console.log("Navigating...");
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
        console.log("Taking screenshot of initial state...");
        await page.screenshot({path: 'step1.png'});
        
        console.log("Selecting RCX...");
        await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.robotType'));
            for(let it of items) {
                if(it.textContent.includes('RCX')) {
                    it.click();
                    return;
                }
            }
        });
        
        await wait(3000);
        await page.screenshot({path: 'step2_after_rcx.png'});
        
        const rowsText = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.blocklyTreeRow')).map(r => r.innerText || r.textContent);
        });
        console.log("Available categories:", rowsText);
        
        console.log("Clicking Aktion category...");
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.blocklyTreeRow'));
            for(let r of rows) {
                if((r.innerText || r.textContent).includes('Aktion')) {
                    console.error("I AM CLICKING THIS: " + (r.innerText || r.textContent));
                    r.click();
                    return;
                }
            }
        });
        
        await wait(3000);
        await page.screenshot({path: 'step3_after_aktion.png'});
        
        const flyoutBlocks = await page.evaluate(() => {
            return document.querySelectorAll('.blocklyFlyout .blocklyBlockCanvas > g').length;
        });
        console.log("Blocks in flyout after click:", flyoutBlocks);
        
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
