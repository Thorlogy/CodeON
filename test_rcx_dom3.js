const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });

    const result = await page.evaluate(() => {
        return new Promise(resolve => {
            require(['guiState.controller', 'configuration.controller'], function(guiState, confCtrl) {
                guiState.setRobot("rcx", function() {
                    console.log("Robot set to rcx!");
                    // Switch to configuration tab
                    $('#tabConfiguration').tab('show');
                    
                    setTimeout(function() {
                        try {
                            var ws = confCtrl.getBricklyWorkspace();
                            console.log("Workspace:", ws !== null);
                            var confXML = guiState.getConfigurationXML();
                            console.log("confXML length:", confXML ? confXML.length : 0);
                            
                            resolve({
                                confXML: confXML,
                                blocks: ws ? ws.getAllBlocks().map(b => b.type) : [],
                                error: null
                            });
                        } catch(e) {
                            resolve({ error: e.message });
                        }
                    }, 2000);
                });
            });
        });
    });

    console.log("RESULT:", JSON.stringify(result, null, 2));

    await browser.close();
})();
