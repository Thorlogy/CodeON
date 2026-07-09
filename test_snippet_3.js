const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    await page.evaluate(async () => {
        // click #tabProgram
        document.getElementById('tabProgram').click();
        await new Promise(r => setTimeout(r, 1000));
        var ws = Blockly.getMainWorkspace();
        ws.device = 'rcx';
        
        for (var a in sensors) {
            if (sensors.hasOwnProperty(a)) {
                try {
                    var b = ws.newBlock('robSensors_' + a + '_getSample');
                    b.dispose();
                } catch(e) {
                    console.log('CRASH SENSOR:', a);
                }
            }
        }
    });
    await browser.close();
})();
