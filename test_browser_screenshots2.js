const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setCacheEnabled(false);

    console.log('Navigating to localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        for (let img of imgs) {
            if (img.src.includes('rcx.jpg')) {
                img.click();
                return;
            }
        }
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Opening category Aktion...');
    await page.evaluate(() => {
        // Click the whole row, not just the label
        const rows = document.querySelectorAll('.blocklyTreeRow');
        for (let row of rows) {
            if (row.innerText.includes('Aktion')) {
                row.click();
                return;
            }
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/rcx_category_aktion_fixed.png' });

    await browser.close();
    console.log('Done!');
})();
