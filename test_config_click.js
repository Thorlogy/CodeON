const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Select RCX
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Check initial active tab
    let activeTab = await page.evaluate(() => document.querySelector('.tab-pane.active').id);
    console.log("Initial active tab:", activeTab);
    
    // Click Configuration Tab
    console.log("Clicking Configuration Tab...");
    await page.evaluate(() => {
        document.querySelector('#head-navigation-configuration-edit').click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Check active tab after 1s
    activeTab = await page.evaluate(() => document.querySelector('.tab-pane.active').id);
    console.log("Active tab after 1s:", activeTab);
    
    // Check configuration tab visibility
    const confStyle = await page.evaluate(() => {
        const conf = document.getElementById('configuration');
        return {
            display: window.getComputedStyle(conf).display,
            visibility: window.getComputedStyle(conf).visibility,
            opacity: window.getComputedStyle(conf).opacity,
            classList: Array.from(conf.classList)
        };
    });
    console.log("Configuration tab style:", confStyle);
    
    // Check if configuration workspace has blocks
    const blocksCount = await page.evaluate(() => {
        if (!window.Blockly || !Blockly.getMainWorkspace) return "Blockly not ready";
        // How to get config workspace?
        // Usually GUISTATE.gui.bricklyWorkspace or just window.bricklyWorkspace
        if (window.bricklyWorkspace) return window.bricklyWorkspace.getAllBlocks().length;
        return "No bricklyWorkspace";
    });
    console.log("Configuration blocks count:", blocksCount);
    
    await browser.close();
})();
