const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => {
        if(msg.type() === 'error') console.log('ERROR:', msg.text());
    });
    
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    
    const dragSurfaceStyle = await page.evaluate(() => {
        const ds = document.querySelector('.blocklyBlockDragSurface');
        if (!ds) return "No drag surface found";
        return {
            display: window.getComputedStyle(ds).display,
            zIndex: window.getComputedStyle(ds).zIndex,
            pointerEvents: window.getComputedStyle(ds).pointerEvents,
            visibility: window.getComputedStyle(ds).visibility
        };
    });
    console.log("Drag surface style:", dragSurfaceStyle);
    
    await browser.close();
})();
