const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1280,1024'] });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setCacheEnabled(false);

    console.log('Navigating to localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    
    console.log('Selecting RCX...');
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
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/rcx_loaded.png' });

    console.log('Opening right menu Info...');
    await page.evaluate(() => {
        const infoBtn = document.querySelector('#head-navigation-info');
        if(infoBtn) infoBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/rcx_info_menu.png' });

    console.log('Opening category Aktion...');
    await page.evaluate(() => {
        // Trying to click the Aktion category in blockly toolbox
        const labels = document.querySelectorAll('.blocklyTreeLabel');
        for (let label of labels) {
            if (label.innerText.includes('Aktion')) {
                label.click();
                return;
            }
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/rcx_category_aktion.png' });

    await browser.close();
    console.log('Done!');
})();
