const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });

    const blocks = await page.evaluate(() => {
        return {
            'robBrick_RCX-Brick': !!Blockly.Blocks['robBrick_RCX-Brick'],
            'robBrick_motor_big': !!Blockly.Blocks['robBrick_motor_big'],
            'robBrick_touch': !!Blockly.Blocks['robBrick_touch'],
            'robBrick_light': !!Blockly.Blocks['robBrick_light'],
            'robBrick_temperature': !!Blockly.Blocks['robBrick_temperature'],
            'confXML': GUISTATE_C.getConfigurationXML ? GUISTATE_C.getConfigurationXML() : null,
            'progXML': GUISTATE_C.getProgramXML ? GUISTATE_C.getProgramXML() : null,
            'robot': GUISTATE_C.getRobot ? GUISTATE_C.getRobot() : null
        };
    });

    console.log("Blocks before RCX:", JSON.stringify(blocks, null, 2));

    await page.evaluate(() => {
        GUISTATE_C.setRobot("rcx", function() { console.log("Robot set to rcx!"); });
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const blocksAfter = await page.evaluate(() => {
        try {
            var confXML = GUISTATE_C.getConfigurationXML();
            var ws = Blockly.getMainWorkspace();
            var dom = Blockly.Xml.textToDom(confXML, ws);
            return {
                'confXML': confXML,
                'domCreated': !!dom,
                'robot': GUISTATE_C.getRobot()
            };
        } catch(e) {
            return { error: e.message };
        }
    });

    console.log("Blocks after RCX:", JSON.stringify(blocksAfter, null, 2));

    await browser.close();
})();
