const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
        return new Promise(resolve => {
            require(['guiState.controller'], function(guiState) {
                window.guiState = guiState;
                guiState.setRobot("rcx", function() {
                    console.log("Robot set to rcx!");
                    resolve();
                });
            });
        });
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await page.evaluate(() => {
        try {
            var confXML = window.guiState.getConfigurationXML();
            var ws = Blockly.getMainWorkspace();
            var dom = Blockly.Xml.textToDom(confXML, ws);
            Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, ws);
            return {
                confXML: confXML,
                blocks: ws.getAllBlocks().map(b => b.type)
            };
        } catch(e) {
            return { error: e.message };
        }
    });

    console.log("RESULT:", JSON.stringify(result, null, 2));

    await browser.close();
})();
