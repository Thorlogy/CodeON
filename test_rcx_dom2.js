const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0' });

    const result = await page.evaluate(() => {
        try {
            var xml = `<block_set xmlns="http://de.fhg.iais.roberta.blockly" robottype="rcx" xmlversion="3.1" description="" tags="">
    <instance x="0" y="0">
        <block type="robBrick_RCX-Brick" id="1" intask="true" deletable="false">
            <field name="WHEEL_DIAMETER">8.16</field>
            <field name="TRACK_WIDTH">11.5</field>
            <value name="S1">
                <block type="robBrick_touch" id="2" intask="true"/>
            </value>
            <value name="S2">
                <block type="robBrick_light" id="3" intask="true"/>
            </value>
            <value name="S3">
                <block type="robBrick_temperature" id="4" intask="true"/>
            </value>
            <value name="MA">
                <block type="robBrick_motor_big" id="5" intask="true">
                    <field name="MOTOR_REGULATION">FALSE</field>
                    <field name="MOTOR_REVERSE">OFF</field>
                    <field name="MOTOR_DRIVE">LEFT</field>
                </block>
            </value>
            <value name="MC">
                <block type="robBrick_motor_big" id="6" intask="true">
                    <field name="MOTOR_REGULATION">FALSE</field>
                    <field name="MOTOR_REVERSE">OFF</field>
                    <field name="MOTOR_DRIVE">RIGHT</field>
                </block>
            </value>
        </block>
    </instance>
</block_set>`;
            var ws = Blockly.getMainWorkspace();
            ws.clear();
            var dom = Blockly.Xml.textToDom(xml, ws);
            Blockly.Xml.domToWorkspace(dom, ws);
            return {
                blocks: ws.getAllBlocks().map(b => b.type)
            };
        } catch(e) {
            return { error: e.message };
        }
    });

    console.log("RESULT:", JSON.stringify(result, null, 2));

    await browser.close();
})();
