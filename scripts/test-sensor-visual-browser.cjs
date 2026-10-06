// External Playwright/Chrome; isolated server/database, hardware disabled.
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
    const browser = await chromium.launch({channel:'chrome',headless:true});
    try {
        const page = await browser.newPage({viewport:{width:1500,height:1000}});
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        page.on('console',message=>{if(message.text().includes('EXCEPTION')) errors.push(message.text());});
        await page.addInitScript(()=>{
            window.WebSocket=class {constructor(){throw Error('Hardware disabled in test');}};
            HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
        });
        await page.goto(process.env.CODEON_TEST_URL || 'http://127.0.0.1:1998/');
        await page.locator('button.pick').first().click();
        await page.waitForFunction(()=>require('guiState.controller').getBlocklyWorkspace());
        await page.evaluate(()=>new Promise((resolve,reject)=>require(['robot.rcx','robot.rcj','robot.sensors'],()=>resolve(),reject)));
        const families=process.argv.includes('--sensor-only')?['rcx','rcj','rcx']:['rcx','rcj','cozmo','apitor','edisonv2','rcx'];
        for(const family of families) {
            const switched=await page.evaluate(family=>new Promise(resolve=>{
                const timer=setTimeout(()=>resolve(false),10000);
                require('robot.controller').switchRobot(family,{},true,()=>{clearTimeout(timer);resolve(true);});
            }),family);
            if(!switched)console.error('Switch diagnostics',family,{errors,dialog:await page.locator('#show-message').innerText(),robot:await page.evaluate(()=>require('guiState.controller').getRobot())});
            assert.ok(switched,'switch '+family);
            const dialog=page.locator('#show-message');
            if(await dialog.isVisible()){
                assert.match(await dialog.innerText(),/Die lokale RCX-Übertragung ist noch nicht gestartet\./);
                await dialog.getByRole('button',{name:'OK',exact:true}).click();
                await dialog.waitFor({state:'hidden'});
            }
            await page.locator('#simButton').click();
            await page.waitForFunction(()=>document.querySelector('#simButton').classList.contains('rightActive'));
            await page.waitForFunction(()=>{
                const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                return !!r;
            });
            const result=await page.evaluate(()=>{
                const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                const snapshot=()=>JSON.stringify({config:r.configuration,pose:r.pose,sensors:Object.keys(r.configuration.SENSORS).map(k=>{
                    const s=r[k];return s?{key:k,port:s.port,x:s.x,y:s.y,theta:s.theta,value:s.value,light:s.lightValue,distance:s.distance}:null;
                })});
                const before=snapshot();
                const types={rcx:require('robot.rcx').default,rcj:require('robot.rcj').default,sensors:require('robot.sensors')};
                const descriptors=CodeOnSensorVisuals.describe(r,types);
                return {name:r.constructor.name,config:r.configuration.SENSORS,descriptors,unchanged:before===snapshot(),colourInstancePresent:!!r.F};
            });
            console.log('Instance',family,result.name,JSON.stringify(result.config));
            assert.ok(result.unchanged,'read-only');
            const expected=family==='rcx'?['LIGHT','TOUCH']:family==='rcj'?['COLOUR','INDUCTIVE','ULTRASONIC']:[];
            assert.deepEqual(result.descriptors.map(s=>s.type).sort(),expected);
            await page.locator('#sim3dToggle').click();
            await page.waitForFunction(count=>CodeOnSim3D.isEnabled()&&CodeOnSim3D.getDebugState().configuredSensors.count===count,expected.length);
            const visual=await page.evaluate(()=>CodeOnSim3D.getDebugState().configuredSensors);
            assert.equal(visual.groups,expected.length);
            if(expected.length){
                await page.screenshot({path:'/tmp/codeon-sensors-'+family+'.png'});
                // Test adapter refresh with a controlled configuration mutation in
                // this isolated page only. Restore the original entry afterwards.
                const key=result.descriptors[0].configurationKey;
                await page.evaluate(key=>{
                    const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    window.savedSensor=r.configuration.SENSORS[key];delete r.configuration.SENSORS[key];
                },key);
                await page.waitForFunction(count=>CodeOnSim3D.getDebugState().configuredSensors.count===count,expected.length-1);
                await page.evaluate(key=>{
                    require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0].configuration.SENSORS[key]=window.savedSensor;
                    delete window.savedSensor;
                },key);
                await page.waitForFunction(count=>CodeOnSim3D.getDebugState().configuredSensors.count===count,expected.length);
                const restored=await page.evaluate(()=>CodeOnSim3D.getDebugState().configuredSensors);
                assert.equal(restored.revision,visual.revision+2,'remove and restore rebuild exactly once each');
                await page.locator('#sim3dToggle').click();
                await page.waitForFunction(()=>!CodeOnSim3D.isEnabled());
                await page.locator('#sim3dToggle').click();
                await page.waitForFunction(()=>CodeOnSim3D.isEnabled());
                assert.equal(await page.evaluate(()=>CodeOnSim3D.getDebugState().configuredSensors.revision),restored.revision,'view switch reuses attachments');
            }
            console.log('PASS 3D configuration attachments',family,visual);
            if(family==='rcj'){
                const ultrasonic=result.descriptors.find(s=>s.type==='ULTRASONIC');
                assert.equal(ultrasonic.configurationKey,'U');assert.equal(ultrasonic.hardwarePort,'D');
                assert.equal(result.config.F.TYPE,'COLOR');
                assert.equal(result.colourInstancePresent,true);
                const samples=await page.evaluate(()=>{
                    const live=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];
                    const Sensor=require('robot.sensors').ColorSensorHex;
                    if(!(live.F instanceof Sensor)) throw Error('Missing real RCJ colour instance');
                    // Controlled surfaces and a separate sensor: do not disturb the running scene.
                    const sensor=new Sensor(live.F.port,live.F.x,live.F.y,live.F.theta,live.F.r);
                    const canvas=document.createElement('canvas'),overlay=document.createElement('canvas');
                    canvas.width=overlay.width=100;canvas.height=overlay.height=100;
                    const ctx=canvas.getContext('2d'),draw=overlay.getContext('2d');
                    const readings=[];
                    for(const fill of ['#ff0000','#ffffff','#000000']){
                        ctx.fillStyle=fill;ctx.fillRect(0,0,100,100);
                        const values={};sensor.updateSensor(true,.016,{pose:{x:40,y:40,theta:0}},values,ctx,draw);
                        // Exercise the same behaviour API used by GET_SAMPLE instructions.
                        const Behaviour=require('interpreter.robotSimBehaviour').RobotSimBehaviour;
                        const behaviour=new Behaviour();behaviour.hardwareState.sensors=values;
                        const queried=[];
                        for(const mode of ['colorhex','light']) behaviour.getSample({push:value=>queried.push(value)},'rcj','color','F',mode);
                        readings.push({values,queried});
                    }
                    return readings;
                });
                assert.equal(samples[0].values.color.F.colorhex.toLowerCase(),'#fa010c','Existing simulator red palette');
                assert.deepEqual(samples[0].values.color.F.rgb,[255,0,0]);
                assert.ok(Math.abs(samples[0].values.light.F.light-100/3)<.01);
                assert.ok(samples[1].values.light.F.light>99.9);
                assert.equal(samples[2].values.light.F.light,0);
                for(const sample of samples) assert.deepEqual(sample.queried,[sample.values.color.F.colorhex,sample.values.color.F.light]);
                console.log('PASS real RCJ colour/light sampling: red, white, black.');
            }
            console.log('PASS real configuration/instances',family,JSON.stringify(result.descriptors));
            await page.locator('#simButton').click();
            await page.waitForFunction(()=>!document.querySelector('#simDiv.rightActive')&&!document.querySelector('.fromRight.shifting'));
        }
        assert.deepEqual(errors,[]);
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
