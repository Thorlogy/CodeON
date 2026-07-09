const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {
        if(msg.type() === 'error') console.log('ERROR:', msg.text());
        if(msg.text().includes('TypeError') || msg.text().includes('Exception')) console.log('EXCEPTION:', msg.text());
    });
    page.on('pageerror', e => console.log('PAGE_ERROR:', e.message));
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Select RCX
    await page.evaluate(() => {
        document.querySelectorAll('.robotType').forEach(el => {
            if (el.textContent.includes('RCX')) el.click();
        });
    });
    await new Promise(r => setTimeout(r, 3000));
    
    // Open Aktion flyout
    await page.evaluate(() => {
        document.querySelectorAll('.blocklyTreeRow').forEach(c => {
            if(c.textContent.includes('Aktion') || c.textContent.includes('Action')) c.click();
        });
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Drag first block in Aktion
    const dragRes = await page.evaluate(async () => {
        try {
            const ws = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
            const flyout = ws.getFlyout();
            const blocks = flyout.getWorkspace().getTopBlocks(false);
            if(blocks.length === 0) return "No blocks in Aktion";
            
            const b = blocks[0];
            const svg = b.getSvgRoot();
            const box = svg.getBoundingClientRect();
            
            // simulate mousedown
            const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: box.left + 10, clientY: box.top + 10 });
            svg.dispatchEvent(mousedown);
            
            // simulate mousemove to drag
            const mousemove = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 });
            document.dispatchEvent(mousemove);
            
            // simulate mouseup
            const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 });
            document.dispatchEvent(mouseup);
            
            // Wait for events to process
            await new Promise(r => setTimeout(r, 500));
            
            // Check if block was added to main workspace
            const wsBlocks = ws.getTopBlocks(false);
            return "Drag dispatched on " + b.type + ". Blocks on workspace: " + wsBlocks.map(w => w.type).join(', ');
        } catch(e) {
            return e.message;
        }
    });
    console.log("Drag result:", dragRes);
    
    await new Promise(r => setTimeout(r, 1000));
    await browser.close();
})();
