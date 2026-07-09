const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

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
        
        const toolboxHTML = await page.evaluate(() => {
            const toolbox = document.querySelector('.blocklyToolboxDiv');
            return toolbox ? toolbox.innerHTML : 'No toolbox found';
        });
        console.log("Toolbox HTML length:", toolboxHTML.length);
        if (toolboxHTML.length < 1000) console.log(toolboxHTML);
        
        const flyoutHTML = await page.evaluate(() => {
            const flyout = document.querySelector('.blocklyFlyout');
            return flyout ? flyout.innerHTML : 'No flyout found';
        });
        console.log("Flyout HTML length:", flyoutHTML.length);
        if (flyoutHTML.length < 1000) console.log(flyoutHTML);

        console.log("Done.");
    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
