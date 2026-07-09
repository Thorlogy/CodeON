const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {
        if(msg.type() === 'error' || msg.text().includes('Exception') || msg.text().includes('TypeError')) {
            console.log('BROWSER_ERROR:', msg.text());
        }
    });
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    await new Promise(r => setTimeout(r, 3000));
    
    await page.evaluate(() => {
        document.querySelectorAll('.blocklyTreeRow').forEach(c => {
            if(c.textContent.includes('Aktion') || c.textContent.includes('Action')) c.click();
        });
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const dragRes = await page.evaluate(async () => {
        try {
            const ws = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
            const flyout = ws.getToolbox() ? ws.getToolbox().getFlyout() : ws.getFlyout();
            if(!flyout) return "No flyout";
            const blocks = flyout.getWorkspace().getTopBlocks(false);
            if(blocks.length === 0) return "No blocks in Aktion";
            
            const b = blocks[0];
            const svg = b.getSvgRoot();
            const box = svg.getBoundingClientRect();
            
            const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10 });
            svg.dispatchEvent(mousedown);
            
            const mousemove = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 });
            document.dispatchEvent(mousemove);
            
            const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 });
            document.dispatchEvent(mouseup);
            
            await new Promise(r => setTimeout(r, 500));
            return "Drag done. Blocks on workspace: " + ws.getTopBlocks(false).map(w => w.type).join(', ');
        } catch(e) {
            return "ERROR: " + e.stack;
        }
    });
    console.log("Drag result:", dragRes);
    await browser.close();
})();
