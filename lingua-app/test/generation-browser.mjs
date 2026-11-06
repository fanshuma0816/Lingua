// Browser smoke tests use mocked API responses; never point these at production.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {generateLesson} from '../lib/lesson-client.js';
const url=process.env.PHASE1_PREVIEW_URL||'http://127.0.0.1:3107';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url))throw new Error('Local preview URL required');
const browser=await chromium.launch({headless:true});
const text='Ik ga vandaag naar de markt. Ik koop brood en melk. Daarna ga ik naar huis.';
const material={id:'smoke-material',title:'Smoke lesson',text,lang:'Dutch',targetUserLevel:'A2',validatedTextLevel:'A2',recommendationVersion:2,resultSource:'textbook',difficultyTier:'balanced'};
try {
 for(const [lang,width] of [['en',1280],['zh',390]]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let generations=0,confirmations=0,used=0,progress={path:'/scan'},saved=null;
  await page.addInitScript(({lang,material})=>{
   if(!localStorage.getItem('lingua:smoke-init')){
    localStorage.setItem('lingua:uiLang',JSON.stringify(lang));
    localStorage.setItem('lingua:genMaterials',JSON.stringify([material]));
    localStorage.setItem('lingua:smoke-init','1');
   }
  },{lang,material});
  const balance=()=>({enabled:true,environment:'test',signedIn:false,granted:1,remaining:1-used,available:1-used,reserved:0,canGenerate:!used});
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/api/account/entitlements')return send(balance());
   if(path==='/api/lesson'&&route.request().method()==='POST'){
    generations++;saved={...generateLesson(text,'Dutch','A2 — Elementary','General fluency'),text,lessonId:'11111111-1111-4111-8111-111111111111',localLessonId:'11111111-1111-4111-8111-111111111111',environment:'test',ownerId:null};return send(saved);
   }
   if(path.endsWith('/confirm')){confirmations++;used=1;return send({delivered:true,entitlements:balance()});}
   if(path.endsWith('/progress')){progress=route.request().postDataJSON();return send({ok:true});}
   if(path.startsWith('/api/lesson/'))return send({lesson:saved,progress,delivered:true});
   if(path==='/api/learning/records')return send({lessons:saved?[{id:saved.lessonId,generated:true,lang:'Dutch',level:'A2',lesson_snapshot:saved,material_title:'Smoke lesson',stats:{},completed_at:new Date().toISOString()}]:[],nextOffset:null});
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.waitForSelector('.generated-card');
  await page.locator('.generated-card').first().click();
  // The existing action below the material cards starts the course.
  await page.locator('.material-results-head .btn-primary').click();
  await page.waitForURL('**/scan');await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.endsWith('currentLesson')&&JSON.parse(localStorage[k])?.delivered));
  assert.equal(generations,1);assert.ok(confirmations>=1);
  await page.reload();await page.waitForSelector('.scanw');assert.equal(generations,1);
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  await page.goto(`${url}/progress`);await page.waitForSelector('.history-card');
  await page.locator('.history-card summary').click();await page.locator('.history-detail .btn-primary').click();
  await page.waitForURL(/\/(scan|preview)$/);assert.equal(generations,1);
  assert.deepEqual(errors,[]);console.log(`${lang} ${width}px: generation, confirmation, reload, free review passed`);
  if(process.env.PHASE1_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PHASE1_SCREENSHOT_DIR}/${lang}-restored.png`,fullPage:true});
  await page.goto(`${url}/find`);
  await page.getByRole('button',{name:lang==='zh'?'生成学习材料':'Generate materials',exact:true}).click();
  await page.waitForSelector('[role=alert]');assert.equal(generations,1);assert.equal(await page.locator('.scanw').count(),0);
  console.log(`${lang}: exhausted guest is blocked without local generation`);
  await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();let attempts=0;
 await page.addInitScript(material=>localStorage.setItem('lingua:genMaterials',JSON.stringify([material])),material);
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/account/entitlements')return route.fulfill({json:{enabled:true,environment:'test',signedIn:false,remaining:1,reserved:0,canGenerate:true}});
  if(path==='/api/lesson'){attempts++;return route.fulfill({status:401,json:{error:'sign_in_required'}});}
  return route.fulfill({status:204,body:''});
 });
 await page.goto(`${url}/find`);await page.waitForSelector('.generated-card');
 await page.locator('.material-results-head .btn-primary').click();await page.waitForSelector('[role=alert]');
 assert.equal(attempts,1);assert.equal(await page.locator('.scanw').count(),0);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':currentLesson')).length),0);
 console.log('permission failure: no local generation and no lesson stored');await context.close();
} finally {await browser.close();}
