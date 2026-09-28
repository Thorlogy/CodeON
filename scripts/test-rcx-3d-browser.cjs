// Requires external Playwright/Chrome; runs against an isolated local server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  page.on('console',msg=>{if(msg.text().includes('EXCEPTION')) {errors.push(msg.text());console.error('Wrapped error:',msg.text());}});
  await page.addInitScript(()=>{window.WebSocket=class{constructor(){throw Error('Hardware disabled in test');}};HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
  await page.goto(process.env.CODEON_TEST_URL||'http://127.0.0.1:1998/');
  await page.locator('button.pick').first().click();
  await page.waitForFunction(()=>require('guiState.controller').getBlocklyWorkspace());
  async function acknowledgeRcxWarning(){
   const dialog=page.locator('#show-message');
   if(await dialog.isVisible()){
    const text=await dialog.innerText();
    assert.ok(text.includes('Die lokale RCX-Übertragung ist noch nicht gestartet.'),text);
    await dialog.getByRole('button',{name:'OK',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
   }
  }
  // Keep the original focused sequence for comparison. The default includes
  // the previously failing RCX -> Apitor transition and must pass without it.
  const sequence=process.argv.includes('--via-cozmo')
   ? ['rcx','cozmo','apitor','cozmo','rcx','cozmo','edisonv2','cozmo','rcj','cozmo','rcx']
   : ['rcx','cozmo','rcx','apitor','rcx','edisonv2','rcj','cozmo','rcx'];
  for(const robot of sequence){
   console.log('Testing:',robot);
   const switched=await page.evaluate(robot=>new Promise(resolve=>{const timeout=setTimeout(()=>resolve(false),10000);require('robot.controller').switchRobot(robot,{},true,()=>{clearTimeout(timeout);resolve(true);});}),robot);
   if(!switched){console.log('Switch diagnostics:',await page.evaluate(()=>({robot:require('guiState.controller').getRobot(),dialogs:[...document.querySelectorAll('.modal.show')].map(e=>e.textContent.trim())})));await page.screenshot({path:'/tmp/codeon-switch-failure.png'});}
   assert.ok(switched,'Robot switch callback missing: '+robot+' '+JSON.stringify(errors));
   await page.waitForFunction(robot=>require('connection.controller').getConnectionRobotName()===robot,robot);
   await acknowledgeRcxWarning();
   if(robot==='rcx') await page.evaluate(()=>{
    const gui=require('guiState.controller'),ws=gui.getBlocklyWorkspace();
    const toolbox=Blockly.Xml.textToDom(gui.getProgramToolbox());
    let tail=ws.getTopBlocks().find(b=>b.type==='robControls_start');
    for(const type of ['robActions_motorDiff_on','robControls_wait_time','robActions_motorDiff_stop']){
     const node=toolbox.querySelector('block[type="'+type+'"]');
     if(!node)throw Error('Missing toolbox block '+type);
     const block=Blockly.Xml.domToBlock(node.cloneNode(true),ws);
     tail.nextConnection.connect(block.previousConnection);tail=block;
    }
   });
   await page.locator('#simButton').click();
   await page.waitForFunction(()=>document.querySelector('#simButton').classList.contains('rightActive'));
   await page.locator('#sim3dToggle').click();
   const expected=robot==='rcx'?'rcx':robot==='cozmo'?'cozmo':'generic';
   await page.waitForFunction(expected=>window.CodeOnSim3D.getDebugState().enabled&&window.CodeOnSim3D.getDebugState().robotModel===expected,expected);
   const state=await page.evaluate(()=>CodeOnSim3D.getDebugState());
   assert.equal(state.cozmoCubePresent,robot==='cozmo');
   if(robot==='rcx'){
    assert.ok(state.robotParts.includes('rcxVisualModel'));
    assert.ok(!state.robotParts.includes('cozmoLift')&&!state.robotParts.includes('touchBumper'));
    // Real compiled program through UI, twice; renderer must follow the simulator.
    for(let run=0;run<2;run++){
     const before=await page.evaluate(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return {x:r.pose.x,y:r.pose.y};});
     await page.locator('#simControl').click();
     await page.waitForFunction(()=>document.querySelector('#simControl').classList.contains('typcn-media-stop'));
     await page.waitForFunction(()=>document.querySelector('#simControl').classList.contains('typcn-media-play-outline'));
     const after=await page.evaluate(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return {x:r.pose.x,y:r.pose.y,wheels:CodeOnSim3D.getDebugState().wheelRotation};});
     assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>.1,'RCX program moved');
     assert.ok(Math.abs(after.wheels.left)+Math.abs(after.wheels.right)>0,'wheels animated');
    }
    await page.screenshot({path:process.env.RCX_SCREENSHOT||'/tmp/codeon-rcx-integrated.png'});
   }
   const poseBefore=await page.evaluate(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return JSON.stringify({pose:r.pose,sensors:Object.keys(r).filter(k=>r[k]&&typeof r[k].getValue==='function')});});
   await page.locator('#sim3dToggle').click();
   await page.waitForFunction(()=>!CodeOnSim3D.isEnabled());
   await page.locator('#sim3dToggle').click();
   await page.waitForFunction(()=>CodeOnSim3D.isEnabled());
   const poseAfter=await page.evaluate(()=>{const r=require('simulation.roberta').SimulationRoberta.Instance.scene.robots[0];return JSON.stringify({pose:r.pose,sensors:Object.keys(r).filter(k=>r[k]&&typeof r[k].getValue==='function')});});
   assert.equal(poseAfter,poseBefore,'2D/3D view switch must preserve state');
   await page.locator('#simButton').click();
   await page.waitForFunction(()=>!document.querySelector('#simButton').classList.contains('rightActive'));
   await page.waitForFunction(()=>!document.querySelector('.fromRight.shifting')&&!document.querySelector('#simDiv.rightActive'));
   console.log('PASS browser model and 2D/3D switch:',robot);
  }
  assert.deepEqual(errors,[]);console.log('PASS tested sequence '+sequence.join(' -> ')+', RCX drive/stop/restart, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
