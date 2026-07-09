const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    
    // Wait for Blockly to load
    await new Promise(r => setTimeout(r, 3000));
    
    await page.evaluate(() => {
        var row = document.querySelector('.blocklyTreeRow');
        if (!row) return console.log('No blocklyTreeRow');
        var r = row.getBoundingClientRect();
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        
        var top1 = document.elementFromPoint(x, y);
        console.log('Top element 1:', top1 && top1.tagName, top1 && top1.id, top1 && top1.className);
        
        if (top1 && top1.id === 'header') {
            top1.style.pointerEvents = 'none';
            var top2 = document.elementFromPoint(x, y);
            console.log('Top element 2 (after hiding header):', top2 && top2.tagName, top2 && top2.id, top2 && top2.className);
            if (top2) {
                top2.style.pointerEvents = 'none';
                var top3 = document.elementFromPoint(x, y);
                console.log('Top element 3 (after hiding top2):', top3 && top3.tagName, top3 && top3.id, top3 && top3.className);
            }
        }
    });
    
    await browser.close();
})();
