const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            console.log('PAGE LOG:', msg.type(), msg.text());
        }
    });
    page.on('pageerror', error => console.log('PAGE EXCEPTION:', error.message, error.stack));

    try {
        console.log("Navigating...");
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
        console.log("Setting robot to RCX via GUI...");
        await page.evaluate(() => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
            document.body.classList.remove('modal-open');
        });
        await wait(500);
        await page.click('#head-navi-icon-robot');
        await wait(1000);
        const robots = await page.$$('.robotType');
        for (const r of robots) {
            const text = await page.evaluate(el => el.textContent, r);
            if (text.includes('RCX')) {
                await r.click();
                break;
            }
        }
        await wait(3000);
        
        console.log("Switching to Configuration...");
        await page.click('#tabConfiguration');
        await wait(2000);
        
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
