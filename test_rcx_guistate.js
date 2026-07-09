const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    try {
        await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
        await wait(2000);
        
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
        
        const confXML = await page.evaluate(() => {
            return typeof GUISTATE_C !== 'undefined' ? GUISTATE_C.getConfigurationStandard() : 'no GUISTATE_C';
        });
        console.log("DEFAULT CONFIG XML:\n", confXML);
        
        const topBlock = await page.evaluate(() => {
            return typeof GUISTATE_C !== 'undefined' ? GUISTATE_C.getConfigurationConf().toplevelblock : 'no toplevelblock';
        });
        console.log("TOP LEVEL BLOCK:\n", topBlock);

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
