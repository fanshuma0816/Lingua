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
  const balance=()=>({enabled:true,environment:'test',signedIn:false,granted:1,used,remaining:1-used,available:1-used,reserved:0,canGenerate:!used});
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/api/account/entitlements')return send(balance());
   if(path==='/api/lesson'&&route.request().method()==='POST'){
    generations++;saved={...generateLesson(text,'Dutch','A2 — Elementary','General fluency'),text,lessonId:'11111111-1111-4111-8111-111111111111',localLessonId:'11111111-1111-4111-8111-111111111111',environment:'test',ownerId:null};return send(saved);
   }
   if(path.endsWith('/confirm')){confirmations++;used=1;return send({delivered:true,entitlements:balance()});}
   if(path.endsWith('/progress')){progress=route.request().postDataJSON();return send({ok:true});}
   if(path.startsWith('/api/lesson/'))return send({lesson:saved,progress,delivered:!!used});
   if(path==='/api/learning/records')return send({lessons:saved?[{id:saved.lessonId,generated:true,lang:'Dutch',level:'A2',lesson_snapshot:saved,material_title:'Smoke lesson',stats:{},completed_at:new Date().toISOString()}]:[],nextOffset:null});
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.waitForSelector('.generated-card');
  await page.locator('.quota-status').waitFor();
  await page.getByText(lang==='zh'?'剩余 1 次免费生成':'1 free generation left',{exact:true}).waitFor();
  assert.equal(await page.locator('.quota-status-identity').innerText(),lang==='zh'?'游客':'Guest');
  if(lang==='zh'){await page.getByRole('button',{name:'Toggle light / dark',exact:true}).click();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(9, 9, 11)');}
  await page.locator('.quota-status-details>summary').click();
  await page.getByText(lang==='zh'?'已保存课程免费复习；从收藏材料生成新课会使用次数。':'Saved lessons are free to review. Generating a new lesson from saved material uses a generation.',{exact:true}).waitFor();
  await page.getByText(lang==='zh'?'推荐和查看材料不会使用课程生成次数。':'Recommending and viewing materials does not use a lesson generation.',{exact:true}).waitFor();
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  if(process.env.PHASE1_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PHASE1_SCREENSHOT_DIR}/${lang}-quota-policy.png`,fullPage:true});
  await page.locator('.quota-status-details>summary').click();
  await page.locator('.generated-card').first().click();
  // The existing action below the material cards starts the course.
  await page.locator('.material-results-head .btn-primary').click();
  await page.waitForURL('**/scan');await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.endsWith('currentLesson')&&JSON.parse(localStorage[k])?.delivered));
  assert.equal(generations,1);assert.ok(confirmations>=1);
  await page.getByText(lang==='zh'?'剩余 0 次免费生成':'0 free generations left',{exact:true}).waitFor();
  await page.getByText(lang==='zh'?'本课程可免费继续学习或复习。':'Continue or review this lesson for free.',{exact:true}).waitFor();
  await page.reload();await page.waitForSelector('.scanw');assert.equal(generations,1);
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  await page.goto(`${url}/progress`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.history-card');
  await page.locator('.history-card summary').click();await page.locator('.history-detail .btn-primary').click();
  await page.waitForURL(/\/(scan|preview)$/);assert.equal(generations,1);
  assert.deepEqual(errors,[]);console.log(`${lang} ${width}px: generation, confirmation, reload, free review passed`);
  if(process.env.PHASE1_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PHASE1_SCREENSHOT_DIR}/${lang}-restored.png`,fullPage:true});
  await page.goto(`${url}/find`);
  await page.getByRole('button',{name:lang==='zh'?'生成学习材料':'Generate materials',exact:true}).click();
  await page.waitForSelector('.quota-operation-notice');assert.equal(generations,1);assert.equal(await page.locator('.scanw').count(),0);
  console.log(`${lang}: exhausted guest is blocked without local generation`);
  await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();let attempts=0;
 await page.addInitScript(material=>localStorage.setItem('lingua:genMaterials',JSON.stringify([material])),material);
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/account/entitlements')return route.fulfill({json:{enabled:true,environment:'test',signedIn:false,granted:1,used:0,remaining:1,available:1,reserved:0,canGenerate:true}});
  if(path==='/api/lesson'){attempts++;return route.fulfill({status:401,json:{error:'sign_in_required'}});}
  return route.fulfill({status:204,body:''});
 });
 await page.goto(`${url}/find`);await page.waitForSelector('.generated-card');
 await page.locator('.material-results-head .btn-primary').click();await page.waitForSelector('.quota-operation-notice');
 assert.equal(attempts,1);assert.equal(await page.locator('.scanw').count(),0);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':currentLesson')).length),0);
 console.log('permission failure: no local generation and no lesson stored');await context.close();

 // A failed confirmation remains on the original course. Retry only confirms it.
 {
  const context=await browser.newContext(),page=await context.newPage();let posts=0,checks=0,used=0;
  await page.addInitScript(material=>localStorage.setItem('lingua:genMaterials',JSON.stringify([material])),material);
  const lesson={...generateLesson(text,'Dutch','A2 — Elementary','General fluency'),text,lessonId:'22222222-2222-4222-8222-222222222222',localLessonId:'22222222-2222-4222-8222-222222222222',environment:'test',ownerId:null};
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/account/entitlements')return route.fulfill({json:{enabled:true,environment:'test',signedIn:false,granted:1,used,remaining:1-used,available:1-used,reserved:0,canGenerate:!used}});
   if(path==='/api/lesson'){posts++;return route.fulfill({json:lesson});}
   if(path.endsWith('/confirm')){checks++;if(checks===1)return route.fulfill({status:503,json:{error:'service_unavailable'}});used=1;return route.fulfill({json:{delivered:true,entitlements:{enabled:true,environment:'test',signedIn:false,granted:1,used:1,remaining:0,available:0,reserved:0,canGenerate:false}}});}
   if(path.startsWith('/api/lesson/')&&!path.endsWith('/progress'))return route.fulfill({json:{lesson,progress:{path:'/scan'},delivered:!!used}});
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.locator('.material-results-head .btn-primary').click();await page.waitForURL('**/scan');
  await page.getByRole('button',{name:'Check this lesson again',exact:true}).waitFor();
  assert.equal(await page.locator('.step-skip').isDisabled(),true);
  assert.equal(posts,1);assert.equal(used,0);
  await page.getByRole('button',{name:'Check this lesson again',exact:true}).click();
  await page.getByText('This new lesson has used 1 generation. Reopening it is free.',{exact:true}).waitFor();
  assert.equal(posts,1);assert.equal(checks,2);assert.equal(used,1);
  console.log('uncertain confirmation: stays on original course; retry debits once');await context.close();
 }
 // New-account sign-in is simulated here; real mail/provider verification is a separate deployment checklist.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let guestUsed=0,accountUsed=0,newCourses=0;const lessons=new Map();
  const accountId='33333333-3333-4333-8333-333333333333';
  await page.addInitScript(material=>localStorage.setItem('lingua:genMaterials',JSON.stringify([material])),material);
  const balances=signed=>({enabled:true,environment:'test',signedIn:signed,granted:signed?3:1,used:signed?accountUsed:guestUsed,remaining:(signed?3-accountUsed:1-guestUsed),available:(signed?3-accountUsed:1-guestUsed),reserved:0,canGenerate:signed?accountUsed<3:!guestUsed});
  await context.route('**/api/**',route=>{
   const request=route.request(),path=new URL(request.url()).pathname,signed=!!request.headers().authorization;
   if(path==='/api/account/entitlements')return route.fulfill({json:balances(signed)});
   if(path==='/api/lesson/claim'){for(const l of lessons.values())if(l.delivered)l.ownerId=accountId;return route.fulfill({json:{ok:true}});}
   if(path==='/api/lesson'){
    if(!signed&&guestUsed)return route.fulfill({status:401,json:{error:'sign_in_required'}});
    if(signed&&accountUsed>=3)return route.fulfill({status:402,json:{error:'quota_exhausted'}});
    newCourses++;const id=`44444444-4444-4444-8444-${String(newCourses).padStart(12,'0')}`;
    const l={...generateLesson(text,'Dutch','A2 — Elementary','General fluency'),text,lessonId:id,localLessonId:id,environment:'test',ownerId:signed?accountId:null};lessons.set(id,l);return route.fulfill({json:l});
   }
   const id=path.split('/')[3],l=lessons.get(id);
   if(path.endsWith('/confirm')){if(!l.delivered){if(signed)accountUsed++;else guestUsed++;l.delivered=true;}return route.fulfill({json:{delivered:true,entitlements:balances(signed)}});}
   if(path.endsWith('/progress'))return route.fulfill({json:{ok:true}});
   if(l){if(l.ownerId&&!signed)return route.fulfill({status:404,json:{error:'lesson_not_found'}});return route.fulfill({json:{lesson:l,progress:{path:'/scan'},delivered:!!l.delivered}});}
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.locator('.material-results-head .btn-primary').click();
  await page.waitForURL('**/scan');await page.getByText('This new lesson has used 1 generation. Reopening it is free.',{exact:true}).waitFor();
  await page.goto(`${url}/find`);await page.locator('.material-results-head .btn-primary').click();await page.getByRole('dialog').waitFor();
  await page.evaluate(accountId=>{
   localStorage.setItem('lingua:authSession',JSON.stringify({accessToken:'verified-preview-token',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id:accountId,email:'preview@example.com'}}));
   window.dispatchEvent(new CustomEvent('lingua-auth-complete'));
  },accountId);
  await page.getByRole('button',{name:'Continue generating',exact:true}).waitFor();
  assert.equal(newCourses,1);assert.equal(accountUsed,0);assert.equal(guestUsed,1);
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  if(process.env.PHASE1_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PHASE1_SCREENSHOT_DIR}/login-continuation-mobile.png`,fullPage:true});
  await page.getByRole('button',{name:'Continue generating',exact:true}).click();
  await page.waitForURL('**/scan');await page.getByText('This new lesson has used 1 generation. Reopening it is free.',{exact:true}).waitFor();
  assert.equal(newCourses,2);assert.equal(accountUsed,1);assert.equal(guestUsed,1);
  // Two tabs receive quota changes without replacing the active lesson state.
  const second=await context.newPage();await second.goto(`${url}/find`);
  await second.getByText('2 free generations left',{exact:false}).waitFor();
  await page.goto(`${url}/find`);await page.locator('.material-results-head .btn-primary').click();await page.waitForURL('**/scan');
  await page.getByText('This new lesson has used 1 generation. Reopening it is free.',{exact:true}).waitFor();
  await second.getByText('1 free generation left',{exact:false}).waitFor();
  assert.equal(accountUsed,2);assert.deepEqual(errors,[]);
  // Signing in again cannot refill the allowance or generate a course.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('lingua-auth-complete')));
  await page.goto(`${url}/find`);await page.getByText('1 free generation left',{exact:false}).waitFor();
  assert.equal(newCourses,3);assert.equal(accountUsed,2);
  console.log('guest -> sign-in -> explicit continuation; extra 3 credits, no auto-generation; two-tab quota sync');
  await context.close();
 }

 // The displayed number excludes reserved quota; read failures and loading never become zero.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const user='55555555-5555-4555-8555-555555555555';let fail=false,hold=false,release,startHeld,posts=0;const heldStarted=new Promise(resolve=>{startHeld=resolve;});
  let balance={enabled:true,environment:'test',signedIn:true,pro:false,granted:3,used:1,remaining:2,reserved:1,available:1,canGenerate:true};
  await page.addInitScript(user=>{
   localStorage.setItem('lingua:uiLang',JSON.stringify('zh'));
   localStorage.setItem('lingua:authSession',JSON.stringify({accessToken:'verified-preview-token',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id:user,email:'preview@example.com'}}));
  },user);
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/account/entitlements'){
    if(fail)return route.fulfill({status:503,json:{error:'service_unavailable'}});
    if(hold)await new Promise(resolve=>{release=resolve;startHeld();});
    return route.fulfill({json:balance});
   }
   if(path==='/api/lesson/claim')return route.fulfill({json:{ok:true}});
   if(path==='/api/lesson')posts++;
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.getByText('剩余 1 次免费生成',{exact:true}).waitFor();
  assert.equal(await page.locator('.quota-status-identity').innerText(),'免费账户');
  await page.getByText('1 次处理中',{exact:true}).waitFor();
  await page.locator('.quota-status-details>summary').click();
  assert.equal(await page.locator('.quota-status-policy li').count(),3);
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+1),true);
  if(process.env.PHASE1_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.PHASE1_SCREENSHOT_DIR}/zh-free-reserved.png`,fullPage:true});
  fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('button',{name:'重试',exact:true}).waitFor();
  await page.getByText('上次余额 · 暂未更新',{exact:true}).waitFor();
  await page.getByText('剩余 1 次免费生成',{exact:true}).waitFor();
  assert.equal(await page.getByText('剩余 0 次免费生成',{exact:true}).count(),0);
  assert.equal(await page.locator('.quota-status-breakdown').count(),0);
  fail=false;hold=true;
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await page.getByText('更新中…',{exact:true}).waitFor();
  assert.equal(await page.getByText('剩余 0 次免费生成',{exact:true}).count(),0);
  await heldStarted;balance={...balance,used:3,remaining:0,reserved:0,available:0,canGenerate:false};hold=false;release();
  await page.getByText('剩余 0 次免费生成',{exact:true}).waitFor();
  await page.getByText('免费生成次数已用完，已保存课程仍可免费复习。',{exact:true}).waitFor();
  assert.equal(posts,0);console.log('quota hints: available excludes holds; failed/loading reads never appear as zero');await context.close();
 }
 // Exhausted users can still open saved lessons, and saved material distinguishes new generation.
 {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();let posts=0;
  const user='66666666-6666-4666-8666-666666666666',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const lesson={...generateLesson(text,'Dutch','A2 — Elementary','General fluency'),text,lessonId:id,localLessonId:id,environment:'test',ownerId:user};
  const segments=[{id:'old',title:'Existing lesson',status:'completed',lessonId:id,text,word_count:15},{id:'new',title:'Next section',status:'pending',word_count:15}];
  const material={id:'saved-material',display_name:'Saved material',language:'Dutch',learner_level:'A2 — Elementary',source_type:'pasted',segments};
  await page.addInitScript(user=>localStorage.setItem('lingua:authSession',JSON.stringify({accessToken:'verified-preview-token',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id:user,email:'preview@example.com'}})),user);
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/account/entitlements')return route.fulfill({json:{enabled:true,environment:'test',signedIn:true,pro:false,granted:3,used:3,remaining:0,reserved:0,available:0,canGenerate:false}});
   if(path==='/api/lesson/claim')return route.fulfill({json:{ok:true}});
   if(path==='/api/learning/records')return route.fulfill({json:{lessons:[{id,generated:true,lang:'Dutch',level:'A2',material_title:'Saved lesson',lesson_snapshot:lesson,stats:{}}],nextOffset:null}});
   if(path===`/api/lesson/${id}`)return route.fulfill({json:{lesson,progress:{path:'/preview'},delivered:true}});
   if(path==='/api/collection/list')return route.fulfill({json:{materials:[material],words:[],grammar:[]}});
   if(path==='/api/materials/saved-material')return route.fulfill({json:{material}});
   if(path==='/api/lesson')posts++;
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/progress`);await page.getByText('0 free generations left',{exact:true}).waitFor();
  await page.locator('.history-card summary').click();await page.getByRole('button',{name:'Review · free',exact:true}).click();
  await page.waitForURL('**/preview');await page.getByText('Continue or review this lesson for free.',{exact:true}).waitFor();
  await page.goto(`${url}/collection/materials`);
  await page.getByRole('button',{name:'Generate next lesson',exact:true}).waitFor();
  await page.getByRole('button',{name:'Review · free',exact:true}).waitFor();
  await page.getByRole('button',{name:'Review · free',exact:true}).click();await page.waitForURL('**/preview');
  assert.equal(posts,0);console.log('quota hints: zero balance still permits free review; saved material labels are explicit');await context.close();
 }
 {
  const context=await browser.newContext(),page=await context.newPage();
  await page.route('**/api/**',route=>route.fulfill({json:{enabled:false}}));
  await page.goto(`${url}/find`);await page.getByRole('button',{name:'Generate materials',exact:true}).waitFor();
  assert.equal(await page.locator('.quota-status').count(),0);assert.equal(await page.locator('.quota-cost-hint').count(),0);
  console.log('quota hints: feature-off preview has no fabricated balance or benefits badge');await context.close();
 }
 // Failed quota reads must never block either login entry or email submission.
 for(const entry of ['sidebar','progress']){
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let posts=0;
  await page.route('**/api/**',route=>{
   if(route.request().method()==='POST')posts++;
   return route.fulfill({status:503,json:{error:'database_unavailable'}});
  });
  await page.route('**/auth/v1/otp?**',route=>route.fulfill({status:200,json:{}}));
  await page.goto(`${url}/${entry==='progress'?'progress':'find'}`);
  await page.getByText('Remaining lessons unavailable.',{exact:true}).waitFor();
  assert.equal(await page.locator('.quota-status-details').getAttribute('open'),null);
  assert.equal(await page.locator('.quota-operation-notice').count(),0);
  await page.getByRole('button',{name:entry==='progress'?'Sign in to save progress':'Sign in to save',exact:true}).click();
  await page.waitForURL('**/login');
  assert.equal(await page.locator('.quota-status').count(),0);
  await page.locator('#login-email').fill('preview@example.com');
  await page.locator('button[type="submit"]').click();
  await page.getByText(/Check your email for your account link/).waitFor();
  assert.equal(posts,0);
  await page.evaluate(()=>{
   localStorage.setItem('lingua:authSession',JSON.stringify({accessToken:'test-signed-in',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id:'88888888-8888-4888-8888-888888888888'}}));
   window.dispatchEvent(new Event('lingua-auth-complete'));
  });
  await page.waitForURL(`**/${entry==='progress'?'progress':'find'}`);
  await page.getByText('Remaining lessons unavailable.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('quota service failure does not block sidebar/progress login or email submission');
 // An uncertain generation can only be checked by its original request ID.
 {
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  let posts=0,checks=0,requestId;
  await page.addInitScript(material=>localStorage.setItem('lingua:genMaterials',JSON.stringify([material])),material);
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/account/entitlements')return route.fulfill({json:{enabled:true,environment:'test',signedIn:false,granted:1,used:0,remaining:1,available:1,reserved:0,canGenerate:true}});
   if(path==='/api/lesson') {posts++;requestId=route.request().postDataJSON().requestId;return route.fulfill({status:503,json:{error:'service_unavailable'}});}
   if(path.startsWith('/api/lesson/requests/')) {checks++;if(requestId)assert.ok(path.endsWith(requestId));return route.fulfill({status:503,json:{error:'service_unavailable'}});}
   return route.fulfill({status:204,body:''});
  });
  await page.goto(`${url}/find`);await page.locator('.material-results-head .btn-primary').click();
  await page.getByRole('button',{name:'Check status',exact:true}).click();
  await page.waitForFunction(()=>!!document.querySelector('.quota-operation-notice button:not([disabled])'));
  assert.equal(posts,1);assert.equal(checks,2);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();
  assert.equal(await page.locator('.quota-operation-notice').count(),0);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.endsWith('pendingGeneration'))),true);
  await context.close();
 }
 console.log('uncertain generation: check original request without a second POST; dismissal preserves recovery');
} finally {await browser.close();}
