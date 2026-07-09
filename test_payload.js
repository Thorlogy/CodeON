const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('program') || url.includes('conf')) {
            console.log("URL:", url, "STATUS:", response.status());
            const text = await response.text().catch(e => e.message);
            console.log("RESPONSE TEXT START:", text.substring(0, 100), "...");
        }
    });
    
    page.on('pageerror', e => console.error("PAGE ERROR:", e));
    page.on('console', msg => {
        if(msg.type() === 'error') console.log("PAGE CONSOLE ERROR:", msg.text());
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
