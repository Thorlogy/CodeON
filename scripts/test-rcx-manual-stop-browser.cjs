'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().includes('EXCEPTION'))errors.push(m.text());});
  await page.addInitScript(()=>{window.WebSocket=class{constructor(){throw Error('Hardware disabled');}};HTMLMediaElement.prototype.play=()=>Promise.resolve();});
  await page.goto(process.env.CODEON_TEST_URL||'http://127.0.0.1:1998/');
  await page.locator('button.pick').first().click();
  await page.waitForFunction(()=>require('guiState.controller').getBlocklyWorkspace());
  for(const threeD of [false,true])for(const kind of ['running','ended','explicit']){
   await page.evaluate(kind=>{
    const gui=require('guiState.controller'),ws=gui.getBlocklyWorkspace();
    ws.getAllBlocks().filter(b=>b.type!=='robControls_start'&&!b.getParent()).forEach(b=>b.dispose(false));
    const start=ws.getTopBlocks().find(b=>b.type==='robControls_start');
    if(start.getNextBlock())start.getNextBlock().dispose(false);
    const toolbox=Blockly.Xml.textToDom(gui.getProgramToolbox());let tail=start;
    const types=['robActions_motorDiff_on'];
    if(kind!=='ended')types.push('robControls_wait_time');
    if(kind==='explicit')types.push('robActions_motorDiff_stop');
    for(const type of types){const b=Blockly.Xml.domToBlock(toolbox.querySelector('block[type="'+type+'"]').cloneNode(true),ws);if(type==='robControls_wait_time')b.getInputTargetBlock('WAIT').setFieldValue(kind==='running'?'10000':'500','NUM');tail.nextConnection.connect(b.previousConnection);tail=b;}
   },kind);
   await page.locator('#simButton').click();
   await page.waitForFunction(()=>document.querySelector('#simButton').classList.contains('rightActive'));
   await page.waitForFunction(()=>require('simulation.roberta').SimulationRoberta.Instance.scene.robots.length);
   if(threeD!==await page.evaluate(()=>CodeOnSim3D.isEnabled()))await page.locator('#sim3dToggle').click();
   const dialog=page.locator('#show-message');
   if(await dialog.isVisible()){assert.match(await dialog.innerText(),/lokale RCX-Übertragung/);await dialog.getByRole('button',{name:'OK',exact:true}).click();await dialog.waitFor({state:'hidden'});}
   for(let run=0;run<2;run++){
    await page.locator('#simControl').click();
    await page.waitForFunction(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return Math.abs(r.chassis.left.speed)>0;});
    if(kind!=='running')await page.waitForFunction(()=>!require('simulation.roberta').SimulationRoberta.Instance.isInterpreterRunning());
    if(kind!=='explicit'){
     assert.ok(await page.locator('#simControl').evaluate(e=>e.classList.contains('typcn-media-stop')),'Stop remains available while RCX motor outputs are active');
     await page.locator('#simControl').click();
    }
    await page.waitForTimeout(150);
    const state=await page.evaluate(()=>{const s=require('simulation.roberta').SimulationRoberta.Instance,r=s.scene.robots[0];return {running:s.isInterpreterRunning(),left:r.chassis.left.speed,right:r.chassis.right.speed,pose:JSON.stringify({x:r.pose.x,y:r.pose.y,theta:r.pose.theta})};});
    assert.equal(state.running,false);assert.equal(state.left,0);assert.equal(state.right,0);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>JSON.stringify((p=>({x:p.x,y:p.y,theta:p.theta}))(require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0].pose))),state.pose,'Robot stays stopped');
    assert.ok(await page.locator('#simControl').evaluate(e=>e.classList.contains('typcn-media-play-outline')));
   }
   await page.locator('#simButton').click();await page.waitForFunction(()=>!document.querySelector('.fromRight.shifting')&&!document.querySelector('#simDiv.rightActive'));
   assert.deepEqual(errors,[]);console.log('PASS',threeD?'3D':'2D',kind,'stop/restart');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
