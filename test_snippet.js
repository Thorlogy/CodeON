const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    
    // Wait for Blockly to load
    await page.waitForTimeout(3000);
    
    // Switch to RCX (assuming it's default or we need to click it, but the snippet works anyway)
    // The snippet:
    await page.evaluate(() => {
        var ws = Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : Blockly.mainWorkspace;
        console.log('1) workspace:', !!ws, '| device:', ws && (ws.device || (ws.options && ws.options.device)));
        var tb = ws && ws.toolbox_;
        console.log('2) toolbox_:', !!tb, '| flyout_:', !!(tb && tb.flyout_));

        var row = document.querySelector('.blocklyTreeRow');
        if (row) {
            var r = row.getBoundingClientRect();
            var top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            console.log('3) Element über "Aktion":', top ? top.tagName + '.' + top.className : 'null',
                '| gehört zur Toolbox?', !!(top && top.closest('.blocklyToolboxDiv')));
        } else { console.log('3) KEINE .blocklyTreeRow gefunden!'); }

        try {
            var first = tb.tree_.getChildAt(0);
            console.log('4) erste Kategorie:', first && first.getHtml());
            tb.tree_.setSelectedItem(first);
            var fly = tb.flyout_;
            var vis = fly && fly.isVisible && fly.isVisible();
            var bb = fly && fly.svgGroup_ && fly.svgGroup_.getBoundingClientRect();
            console.log('4) setSelectedItem OK | Flyout sichtbar?', vis, '| Flyout-Box:', JSON.stringify(bb));
        } catch (e) { console.error('4) CRASH beim Öffnen:', e); }

        try { ws.newBlock('robActions_motorDiff_on').dispose(); console.log('5) Aktions-Block: OK'); }
        catch (e) { console.error('5) Aktions-Block CRASH:', e); }
        try { ws.newBlock('robSensors_touch_getSample').dispose(); console.log('6) Sensor-Block: OK'); }
        catch (e) { console.error('6) Sensor-Block CRASH:', e); }
    });
    
    await browser.close();
})();
