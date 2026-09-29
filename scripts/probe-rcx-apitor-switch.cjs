// Read-only baseline probe. BASELINE_ROOT must point to unchanged resources.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const failures=[];
  page.on('console',m=>{if(m.text().includes('EXCEPTION'))failures.push(m.text());});
  await page.addInitScript(()=>{window.WebSocket=class{constructor(){throw Error('Hardware disabled in test');}};HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
  await page.route('http://127.0.0.1:1998/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()==='GET'&&(url.pathname==='/'||/\.(html|js|css)$/.test(url.pathname))){
    const resource=path.resolve(process.env.BASELINE_ROOT,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(resource.startsWith(path.resolve(process.env.BASELINE_ROOT)+path.sep)&&fs.existsSync(resource)){
     return route.fulfill({path:resource});
    }
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:1998/');await page.locator('button.pick').first().click();
  await page.waitForFunction(()=>require('guiState.controller').getBlocklyWorkspace());
  const result=await page.evaluate(()=>new Promise(resolve=>{setTimeout(()=>resolve('callback missing'),5000);require('robot.controller').switchRobot('apitor',{},true,()=>resolve('callback completed'));}));
  console.log(JSON.stringify({baselineRoot:process.env.BASELINE_ROOT,result,failures},null,2));
  if(!failures.some(f=>f.includes("Existing toolbox has categories")))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
