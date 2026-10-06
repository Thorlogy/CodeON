// External Playwright/Chrome, isolated server/database only; no hardware.
// Edits real Blockly configuration blocks, then uses the normal tabs and SIM
// compile path. Never injects configuration into a simulation robot.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withoutGrabber=process.argv.includes('--without-grabber');
(async()=>{
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try{
        const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('console',message=>{if(message.text().includes('EXCEPTION'))errors.push(message.text());});
        await page.addInitScript(()=>{
            window.WebSocket=class{constructor(){throw Error('Hardware disabled in test');}};
            HTMLMediaElement.prototype.play=()=>Promise.resolve();
        });
        await page.goto(process.env.CODEON_TEST_URL||'http://127.0.0.1:1998/');
        await page.locator('button.pick').first().click();
        await page.waitForFunction(()=>require('guiState.controller').getBlocklyWorkspace());
        async function acknowledge(){
            const dialog=page.locator('#show-message');
            if(await dialog.isVisible()){
                assert.match(await dialog.innerText(),/Die lokale RCX-Übertragung ist noch nicht gestartet\./);
                await dialog.getByRole('button',{name:'OK',exact:true}).click();
                await dialog.waitFor({state:'hidden'});
            }
        }
        async function testRcjDriveLifecycle(hasGrabber){
            // Actual RCJ Blockly drive/wait program, not direct motor injection.
            for(const threeD of [false,true])for(const manual of [false,true]){
                if(threeD!==await page.evaluate(()=>CodeOnSim3D.isEnabled()))await page.locator('#sim3dToggle').click();
                await page.evaluate(manual=>{
                    const gui=require('guiState.controller'),ws=gui.getBlocklyWorkspace();
                    const start=ws.getTopBlocks().find(b=>b.type==='robControls_start');
                    if(start.getNextBlock())start.getNextBlock().dispose(false);
                    const toolbox=Blockly.Xml.textToDom(gui.getProgramToolbox());let tail=start;
                    for(const type of ['actions_motorDiff_on','robControls_wait_time']){
                        const node=toolbox.querySelector('block[type="'+type+'"]');
                        if(!node)throw Error('Missing RCJ block '+type);
                        const block=Blockly.Xml.domToBlock(node.cloneNode(true),ws);
                        if(type==='robControls_wait_time')block.getInputTargetBlock('WAIT').setFieldValue(manual?'10000':'500','NUM');
                        tail.nextConnection.connect(block.previousConnection);tail=block;
                    }
                },manual);
                const before=await page.evaluate(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return {x:r.pose.x,y:r.pose.y};});
                await page.locator('#simControl').click();
                await page.waitForFunction(before=>{
                    const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    return Math.hypot(r.pose.x-before.x,r.pose.y-before.y)>.1;
                },before);
                if(manual)await page.locator('#simControl').click();
                await page.waitForFunction(()=>{
                    const sim=require('simulation.roberta').SimulationRoberta.Instance,c=sim.scene.robots[0].chassis;
                    return !sim.isInterpreterRunning()&&c.left.speed===0&&c.right.speed===0;
                });
                const stopped=await page.evaluate(()=>{
                    const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    return {pose:JSON.stringify(r.pose),hasGrabber:!!r.chassis.manipulator};
                });
                assert.equal(stopped.hasGrabber,hasGrabber);
                await page.waitForTimeout(250);
                assert.equal(await page.evaluate(()=>JSON.stringify(require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0].pose)),stopped.pose);
                assert.deepEqual(errors,[]);
                console.log('PASS RCJ',hasGrabber?'with grabber':'without grabber',threeD?'3D':'2D',manual?'manual stop/restart':'normal end');
            }
        }
        for(const family of process.argv.includes('--rcj-only')||withoutGrabber?['rcj']:process.argv.includes('--rcx-only')?['rcx']:['rcx','rcj']){
            const switched=await page.evaluate(family=>new Promise(resolve=>{
                const timer=setTimeout(()=>resolve(false),10000);
                require('robot.controller').switchRobot(family,{},true,()=>{clearTimeout(timer);resolve(true);});
            }),family);
            assert.ok(switched);await acknowledge();
            const cases=withoutGrabber?[['ultrasonic','ultrasonic','ultrasonic','ultrasonic']]:family==='rcx'?
                [['touch','light','light'],['touch','touch','light'],['light'],[],['touch','light']]:
                [['touch','touch','colour'],['colour','colour'],['ultrasonic'],['ultrasonic','ultrasonic'],
                 ['ultrasonic','ultrasonic','ultrasonic'],
                 ['inductive'],[],['colour','ultrasonic','inductive']];
            for(const types of cases){
                await page.locator('#tabConfiguration').click();
                await page.waitForFunction(()=>document.querySelector('#configuration').classList.contains('active'));
                // configurationToBricklyWorkspace suppresses load events for 500 ms.
                // Edit only after that existing initialization guard has expired.
                await page.waitForTimeout(550);
                const edited=await page.evaluate(({family,types,withoutGrabber})=>{
                    const ws=require('configuration.controller').getBricklyWorkspace();
                    if(family==='rcx'){
                        const brick=ws.getAllBlocks().find(b=>b.type==='robBrick_RCX-Brick');
                        if(!brick)throw Error('Missing RCX brick');
                        for(const name of ['S1','S2','S3']){
                            const previous=brick.getInputTargetBlock(name);if(previous)previous.dispose(false);
                        }
                        types.forEach((type,index)=>{
                            const b=ws.newBlock('robBrick_'+type);b.initSvg();b.render();
                            brick.getInput('S'+(index+1)).connection.connect(b.outputConnection);
                        });
                    }else{
                        for(const b of ws.getAllBlocks()){
                            if(['robConf_colour','robConf_ultrasonic','robConf_touch','robConf_inductive'].includes(b.type)||(withoutGrabber&&b.getFieldValue('NAME')==='Grabber'))b.dispose(false);
                        }
                        types.forEach((type,index)=>{
                            const b=ws.newBlock('robConf_'+type);b.initSvg();b.render();
                            b.setFieldValue('S'+(index+1),'NAME');b.setFieldValue((withoutGrabber?['C','D','E','F']:['C','D','F'])[index],'PORT');
                            b.moveBy(240+index*140,100);
                        });
                    }
                    return ws.getAllBlocks().map(b=>({type:b.type,name:b.getFieldValue('NAME'),port:b.getFieldValue('PORT')}));
                },{family,types,withoutGrabber});
                await page.waitForFunction(()=>!require('guiState.controller').isConfigurationSaved());
                await page.locator('#tabProgram').click();
                await page.waitForFunction(()=>document.querySelector('#program').classList.contains('active'));
                await page.locator('#simButton').click();
                await page.waitForFunction(()=>document.querySelector('#simButton').classList.contains('rightActive'));
                await acknowledge();
                await page.evaluate(()=>new Promise((resolve,reject)=>require(['robot.rcx','robot.rcj','robot.sensors'],resolve,reject)));
                const expected=types.map(type=>({touch:'TOUCH',light:'LIGHT',colour:'COLOUR',ultrasonic:'ULTRASONIC',inductive:'INDUCTIVE'})[type]).sort();
                await page.waitForFunction(({family,expected})=>{
                    const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    if(!r)return false;
                    const registry={rcx:require('robot.rcx').default,rcj:require('robot.rcj').default,sensors:require('robot.sensors')};
                    return r instanceof registry[family]&&JSON.stringify(CodeOnSensorVisuals.describe(r,registry).map(d=>d.type).sort())===JSON.stringify(expected);
                },{family,expected});
                const descriptors=await page.evaluate(()=>{
                    const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    const registry={rcx:require('robot.rcx').default,rcj:require('robot.rcj').default,sensors:require('robot.sensors')};
                    const descriptors=CodeOnSensorVisuals.describe(r,registry);
                    for(const d of descriptors){
                        const sensor=r[d.configurationKey];
                        if(typeof sensor.draw!=='function'||sensor.x!==d.x||sensor.y!==d.y)throw Error('2D sensor origin mismatch');
                    }
                    return descriptors;
                });
                assert.equal(descriptors.length,types.length);
                const lights=descriptors.filter(d=>d.type==='LIGHT'||d.type==='COLOUR');
                assert.deepEqual(lights.map(d=>d.y).sort((a,b)=>a-b),lights.map((_,i)=>(i+1)*10-5*(lights.length+1)));
                for(const d of descriptors.filter(d=>d.type==='TOUCH')){
                    assert.equal(d.side,family==='rcx'?'front':'back');
                    assert.equal(d.mountX,family==='rcx'?25:-32,'Actual chassis contact edge');
                }
                const touch=descriptors.filter(d=>d.type==='TOUCH');
                if(family==='rcx'&&touch.length>1)assert.equal(new Set(touch.map(d=>d.mountY)).size,touch.length,'RCX touch markers have separate positions on one front edge');
                if(family==='rcj')for(const d of descriptors)assert.equal(d.hardwarePort,edited.find(b=>b.name===d.configurationKey).port);
                const ultrasonic=descriptors.filter(d=>d.type==='ULTRASONIC');
                if(ultrasonic.length>1)assert.equal(new Set(ultrasonic.map(d=>JSON.stringify([d.x,d.y,d.theta]))).size,ultrasonic.length);
                if(!await page.evaluate(()=>CodeOnSim3D.isEnabled()))await page.locator('#sim3dToggle').click();
                const groups=family==='rcx'?types.length:types.length-Math.max(0,types.filter(t=>t==='touch').length-1);
                await page.waitForFunction(({count,groups})=>{
                    const state=CodeOnSim3D.getDebugState().configuredSensors;
                    return state.count===count&&state.groups===groups;
                },{count:types.length,groups},{timeout:10000}).catch(async error=>{
                    console.error('3D mismatch',family,types,descriptors,await page.evaluate(()=>CodeOnSim3D.getDebugState()));
                    throw error;
                });
                const expectedNames=expected.filter((t,i,a)=>family==='rcx'||t!=='TOUCH'||i===a.indexOf(t)).map(t=>'configuredSensor:'+t);
                await page.waitForFunction(expectedNames=>{
                    const names=CodeOnSim3D.getDebugState().robotParts.filter(n=>n.startsWith('configuredSensor:')).sort();
                    return JSON.stringify(names)===JSON.stringify(expectedNames.slice().sort());
                },expectedNames,{timeout:10000});
                const names=await page.evaluate(()=>CodeOnSim3D.getDebugState().robotParts.filter(n=>n.startsWith('configuredSensor:')));
                assert.deepEqual(names.sort(),expectedNames.sort(),'No stale sensor types');
                if(types.length===3&&types[0]==='touch'){
                    if(family==='rcj'){
                        const sideMount=await page.evaluate(()=>{
                            const context=CodeOnSim3D.getSensorMountContext();
                            const sensor=context&&context.sensors.find(item=>item.type==='COLOUR');
                            return !!sensor&&CodeOnSim3D.setSensorMount(sensor.id,'right');
                        });
                        assert.equal(sideMount,true,'RCJ colour sensor can be mounted on the side through the public SIM API');
                        await page.waitForTimeout(250);
                        await page.screenshot({path:'/tmp/codeon-editor-rcj-mounted-3d.png'});
                        assert.equal(await page.evaluate(()=>CodeOnSim3D.resetSensorMounts()),true);
                    }
                    await page.screenshot({path:'/tmp/codeon-editor-'+family+'-3d.png'});
                    await page.locator('#sim3dToggle').click();await page.waitForFunction(()=>!CodeOnSim3D.isEnabled());
                    await page.screenshot({path:'/tmp/codeon-editor-'+family+'-2d.png'});
                    const mounted=await page.evaluate(family=>{
                        const robot=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                        const registry={rcx:require('robot.rcx').default,rcj:require('robot.rcj').default,sensors:require('robot.sensors')};
                        const sensors=CodeOnSensorVisuals.describe(robot,registry),sensor=sensors[0];
                        if(!CodeOnSensorMounts.write(null,family,sensor.id,'right',sensors))throw Error('Cannot save test mount');
                        const calls=[];
                        const ctx=Object.fromEntries(['save','restore','setLineDash','beginPath','moveTo','lineTo','stroke','fill','arc','fillText'].map(name=>[name,(...args)=>calls.push([name,...args])]));
                        const count=CodeOnSensorOverlay2D.draw(ctx,robot,registry);
                        return {count,marked:calls.some(call=>call[0]==='fillText'&&call[1]===sensor.configurationKey),linked:calls.some(call=>call[0]==='moveTo'&&call[1]===sensor.mountX&&call[2]===sensor.mountY),unchanged:robot[sensor.configurationKey].x===sensor.x&&robot[sensor.configurationKey].y===sensor.y};
                    },family);
                    assert.deepEqual(mounted,{count:1,marked:true,linked:true,unchanged:true},'Saved mount reaches the live 2D renderer without moving the sensor');
                    await page.waitForTimeout(150);
                    await page.screenshot({path:'/tmp/codeon-editor-'+family+'-mounted-2d.png'});
                    assert.equal(await page.evaluate(family=>{
                        const robot=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                        const registry={rcx:require('robot.rcx').default,rcj:require('robot.rcj').default,sensors:require('robot.sensors')};
                        return CodeOnSensorMounts.clear(null,family,CodeOnSensorVisuals.describe(robot,registry));
                    },family),true,'Test mount is removed afterward');
                }
                if(family==='rcj'&&(withoutGrabber||types.join(',')==='colour,ultrasonic,inductive'))await testRcjDriveLifecycle(!withoutGrabber);
                await page.locator('#simButton').click();
                await page.waitForFunction(()=>!document.querySelector('.fromRight.shifting')&&!document.querySelector('#simDiv.rightActive'),null,{timeout:10000}).catch(async error=>{
                    await page.screenshot({path:'/tmp/codeon-editor-close-failure.png'});
                    console.error('Close mismatch',family,errors,await page.evaluate(()=>({button:document.querySelector('#simButton').className,panels:[...document.querySelectorAll('.fromRight')].map(e=>[e.id,e.className]),dialog:document.querySelector('#show-message').innerText})));
                    throw error;
                });
                assert.deepEqual(errors,[]);
                console.log('PASS editor -> compiler -> 2D sensors -> 3D:',family,types.join(',')||'no sensors');
            }
        }
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
