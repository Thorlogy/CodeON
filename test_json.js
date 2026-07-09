const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    
    page.on('response', async response => {
        if (response.url().includes('/program/')) {
            const json = await response.json().catch(e => null);
            if (json) {
                console.log("URL:", response.url());
                console.log("RESPONSE JSON rc:", json.rc);
                if (json.rc === 'error') {
                    console.log("ERROR MESSAGE:", json.message);
                }
            }
        }
    });

    try {
        console.log("Navigating...");
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
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
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
