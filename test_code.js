const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('/rest/')) {
            console.log("URL:", url, "STATUS:", response.status());
            const text = await response.text().catch(e => e.message);
            console.log("RESPONSE:", text);
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
        
        console.log("Clicking Code generation tab...");
        await page.evaluate(() => {
            // Find the code button
            const btn = document.querySelector('#headNavigationCodeTab');
            if(btn) btn.click();
            else console.log("Code button not found, clicking the first right menu button");
            const rightMenu = document.querySelectorAll('#rightMenu .nav-item');
            if(rightMenu && rightMenu.length > 0) rightMenu[0].click();
        });
        
        await wait(3000);
        
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
