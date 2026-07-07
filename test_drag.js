const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:8080/mission.html', { waitUntil: 'networkidle0' });
        
        // Take an initial screenshot
        await page.screenshot({ path: 'test_drag_init.png' });
        
        // Wait for Blockly to load
        await page.waitForFunction(() => typeof Blockly !== 'undefined' && Blockly.getMainWorkspace() !== null);
        
        // Find the "ACTION" category row and click it
        const actionCat = await page.$('.blocklyTreeRow');
        if (actionCat) {
            console.log("Found category, clicking...");
            await actionCat.click();
            await page.waitForTimeout(500);
            
            // Take a screenshot after opening category
            await page.screenshot({ path: 'test_drag_cat_open.png' });
            
            // Try to find a block in the flyout
            const blocks = await page.$$('.blocklyFlyout .blocklyDraggable');
            console.log("Found draggable blocks in flyout:", blocks.length);
            
            if (blocks.length > 0) {
                const blockBox = await blocks[0].boundingBox();
                console.log("Block bounding box:", blockBox);
                
                // Try to drag the block to the workspace (e.g. at x: 400, y: 200)
                await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
                await page.mouse.down();
                await page.mouse.move(400, 200, { steps: 10 });
                await page.mouse.up();
                
                await page.waitForTimeout(500);
                await page.screenshot({ path: 'test_drag_after_drop.png' });
                
                // Check if block was added to workspace
                const workspaceBlocks = await page.evaluate(() => Blockly.getMainWorkspace().getAllBlocks().length);
                console.log("Blocks in workspace after drop:", workspaceBlocks);
            }
        } else {
            console.log("No category found.");
        }
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
})();
