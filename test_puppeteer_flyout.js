const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {
        if(msg.type() === 'error') console.log('ERROR:', msg.text());
    });
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Select RCX
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    await new Promise(r => setTimeout(r, 3000));
    
    // Click "Sensoren" category
    await page.evaluate(() => {
        const categories = document.querySelectorAll('.blocklyTreeRow');
        for(let c of categories) {
            if(c.textContent.includes('Sensoren') || c.textContent.includes('Sensors')) {
                c.click();
            }
        }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // List blocks in flyout
    const blocks = await page.evaluate(() => {
        const flyout = Blockly.getMainWorkspace ? Blockly.getMainWorkspace().getFlyout() : Blockly.mainWorkspace.getFlyout();
        if(!flyout) return "No flyout";
        const blocks = flyout.getWorkspace().getTopBlocks(false);
        return blocks.map(b => b.type);
    });
    console.log("Blocks in flyout:", blocks);
    
    // Simulate clicking the first block
    const clickResult = await page.evaluate(() => {
        try {
            const flyout = Blockly.getMainWorkspace ? Blockly.getMainWorkspace().getFlyout() : Blockly.mainWorkspace.getFlyout();
            const blocks = flyout.getWorkspace().getTopBlocks(false);
            if(blocks.length > 0) {
                const b = blocks[0];
                const target = b.getSvgRoot();
                const evt = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
                target.dispatchEvent(evt);
                const evt2 = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
                target.dispatchEvent(evt2);
                return "Clicked block " + b.type;
            }
            return "No blocks to click";
        } catch(e) {
            return "Click error: " + e.message;
        }
    });
    console.log("Click result:", clickResult);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Check main workspace
    const wsBlocks = await page.evaluate(() => {
        const ws = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
        return ws.getTopBlocks(false).map(b => b.type);
    });
    console.log("Blocks in main workspace:", wsBlocks);
    
    await browser.close();
})();
