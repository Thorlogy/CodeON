const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));

    try {
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
        console.log("Clicking RCX via evaluate...");
        await page.evaluate(() => {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
            document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
            document.body.classList.remove('modal-open');
            const items = Array.from(document.querySelectorAll('.robotType'));
            for(let it of items) {
                if(it.textContent.includes('RCX')) {
                    it.click();
                    return;
                }
            }
        });
        
        await wait(2000);
        
        console.log("Switching to config tab...");
        await page.evaluate(() => {
            document.getElementById('tabConfiguration').click();
        });
        
        await wait(3000);
        
        console.log("Taking screenshot of configuration tab...");
        await page.screenshot({ path: 'rcx_config_error.png' });
        
        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
