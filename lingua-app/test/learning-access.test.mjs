// Run: node test/learning-access.test.mjs
// Full SQL integration: LEARNING_SQL_TEST_MODULE=/absolute/path/to/pglite/dist/index.js node test/learning-access.test.mjs
// The optional runner lives outside project dependencies. No remote database or email is used.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'lingua-allowance-tests-'));
let db;
async function bundle(contents,name){
 const output=path.join(temp,name+'.cjs');
 await build({stdin:{contents,resolveDir:root,sourcefile:name+'.js'},bundle:true,platform:'node',format:'cjs',target:'node18',outfile:output,logLevel:'silent'});
 return require(output);
}
const api=await bundle(`export {POST as generate} from './app/api/lesson/route.js';
export {GET as access} from './app/api/account/entitlements/route.js';
export {POST as confirm} from './app/api/lesson/[lessonId]/confirm/route.js';
export {GET as read} from './app/api/lesson/[lessonId]/route.js';
export {POST as save} from './app/api/learning/save/route.js';
export {GET as records} from './app/api/learning/records/route.js';
export {learningAccessMode} from './config/commercial.js';`,'api');
const oldEnv={...process.env};const originalFetch=global.fetch;
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const req=(url='/',body,token,cookie)=>new Request('http://localhost:4179'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const input={text:'Ik ga naar de markt. Ik koop brood en kaas. Daarna ga ik naar huis.',lang:'Dutch',level:'A2 — Elementary',goal:'General fluency'};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
try{
 process.env.LEARNING_ACCESS_MODE='off';delete process.env.LEARNING_ACCESS_ENVIRONMENT;delete process.env.VERCEL_ENV;
 await test('default off does not contact storage or restrict generation',async()=>{
  global.fetch=()=>{throw Error('Off mode touched the database');};
  assert.deepEqual(await (await api.access(req())).json(),{enabled:false,mode:'off'});
  const r=await api.generate(req('/api/lesson',input));assert.equal(r.status,200);assert((await r.json()).sents.length);
 });
 await test('test mode rejected outside staging and on production',()=>{
  assert.throws(()=>api.learningAccessMode({LEARNING_ACCESS_MODE:'test'}));
  assert.throws(()=>api.learningAccessMode({LEARNING_ACCESS_MODE:'test',LEARNING_ACCESS_ENVIRONMENT:'staging',VERCEL_ENV:'production'}));
  assert.equal(api.learningAccessMode({LEARNING_ACCESS_MODE:'test',LEARNING_ACCESS_ENVIRONMENT:'staging'}),'test');
 });
 await test('origin and malformed input are rejected',async()=>{
  const r=await api.generate(new Request('http://localhost:4179/api/lesson',{method:'POST',headers:{origin:'https://other.test'},body:JSON.stringify(input)}));assert.equal(r.status,403);
  assert.equal((await api.generate(req('/api/lesson',{text:''}))).status,400);
 });
 // The browser restoration helper must not request a fresh generation.
 const memory=new Map();global.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const client=await bundle(`export {restoreLessonRecord} from './lib/learning-access-client.js'; export {buildCompletedLessonPayload} from './lib/learning-sync.js';`,'client');
 await test('legacy snapshots restore without generation and preserve progress',()=>{
  const restored=client.restoreLessonRecord({id:'legacy',local_lesson_id:'course-123',input_text:input.text,lang:input.lang,level:input.level,
   lesson_snapshot:{sentences:['Ik ga naar de markt.'],markedWords:['markt']},saved_options:{resumePath:'/learn/vocabulary'},completed_steps:['understanding'],interaction_snapshot:{recall:{answers:{0:'answer'}}}});
  assert(restored.lesson.recommended);assert(Array.isArray(restored.lesson.topics));assert.equal(restored.resumePath,'/learn/vocabulary');assert.equal(restored.lesson.localLessonId,'legacy:legacy');assert.deepEqual(restored.completedSteps,['understanding']);
  assert.match(memory.get('lingua:recallAnswers'),/answer/);
  const payload=client.buildCompletedLessonPayload({lesson:{...restored.lesson,material:{id:'material-id'}},text:input.text,completedSteps:[],completed:false});
  assert.equal(payload.localLessonId,'legacy:legacy');assert.equal(payload.completed,false);
 });
 if(!process.env.LEARNING_SQL_TEST_MODULE){console.log('SQL integration not run: set LEARNING_SQL_TEST_MODULE to a local PGlite module.');}
 else{
  const {PGlite}=await import(process.env.LEARNING_SQL_TEST_MODULE);db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);');
  const setup=await fs.readFile(path.join(root,'SETUP.md'),'utf8');
  await db.exec(setup.match(/create table if not exists public.profiles \([\s\S]*?\n\);/)[0]);
  await db.exec(setup.match(/create table if not exists public.lesson_sessions \([\s\S]*?\n\);/)[0]);
  await db.query('insert into auth.users(id) values($1),($2)',[A,B]);
  const migration=await fs.readFile(path.join(root,'supabase/migrations/20261106_lesson_allowances.sql'),'utf8');
  await test('migration applies and reruns without deleting old records',async()=>{await db.exec(migration);await db.exec(migration);});
  async function rpc(name,args){
   assert.match(name,/^learning_[a-z_]+_v1$/);
   const entries=Object.entries(args),params=entries.map(([k],i)=>`${k} => $${i+1}`).join(',');
   return (await db.query(`select public.${name}(${params}) value`,entries.map(([,v])=>v))).rows[0].value;
  }
  global.fetch=async(url,options={})=>{
   const u=new URL(url);
   if(u.pathname==='/auth/v1/user'){
    const token=new Headers(options.headers).get('authorization')?.slice(7);
    return Response.json(token==='token-a'?{id:A,email:'a@example.test'}:token==='token-b'?{id:B,email:'b@example.test'}:{error:'invalid'},{status:['token-a','token-b'].includes(token)?200:401});
   }
   if(u.pathname.startsWith('/rest/v1/rpc/'))return Response.json(await rpc(u.pathname.split('/').pop(),JSON.parse(options.body)));
   if(u.pathname==='/rest/v1/profiles')return Response.json([]);
   if(u.pathname==='/rest/v1/lesson_sessions'){
    const user=u.searchParams.get('user_id')?.slice(3);const limit=Number(u.searchParams.get('limit')||20),offset=Number(u.searchParams.get('offset')||0);
    return Response.json((await db.query('select * from lesson_sessions where user_id=$1 order by created_at desc,id desc limit $2 offset $3',[user,limit,offset])).rows);
   }
   if(u.pathname==='/rest/v1/learning_courses_v1'){
    const owner=u.searchParams.get('owner_key')?.slice(3),offset=Number(u.searchParams.get('offset')||0);
    return Response.json((await db.query("select * from learning_courses_v1 where owner_key=$1 and status='confirmed' and saved_at is not null order by created_at desc,id desc limit 20 offset $2",[owner,offset])).rows);
   }
   throw Error('Unexpected network request: '+url);
  };
  Object.assign(process.env,{LEARNING_ACCESS_MODE:'test',LEARNING_ACCESS_ENVIRONMENT:'staging',NEXT_PUBLIC_SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'fake-server-key',LEARNING_GUEST_SECRET:'test-secret-at-least-thirty-two-characters'});
  delete process.env.VERCEL_ENV;
  let cookie,guestId;
  await test('guest cookie, reserve, recover, confirm, and one-time debit',async()=>{
   const a=await api.access(req());cookie=a.headers.get('set-cookie').split(';')[0];assert.match(a.headers.get('set-cookie'),/HttpOnly/);assert.equal((await a.json()).remaining,1);
   const r=await api.generate(req('/api/lesson',{...input,requestId:randomUUID()},null,cookie));assert.equal(r.status,200);
   const course=await r.json();guestId=course.serverLessonId;
   const after=await (await api.access(req('/',undefined,null,cookie))).json();assert.equal(after.used,0);assert.equal(after.reserved,1);
   const recovered=await (await api.generate(req('/api/lesson',{...input,text:'Andere tekst.',requestId:randomUUID()},null,cookie))).json();assert.equal(recovered.serverLessonId,guestId);assert.equal(recovered.text,input.text);
   for(let i=0;i<2;i++)assert.equal((await api.confirm(req('/',{},null,cookie),{params:{lessonId:guestId}})).status,200);
   const state=await (await api.access(req('/',undefined,null,cookie))).json();assert.equal(state.used,1);assert.equal(state.remaining,0);
   const denied=await api.generate(req('/',{...input,requestId:randomUUID()},null,cookie));assert.equal(denied.status,403);assert.equal((await denied.json()).error,'registration_required');
  });
  await test('guest course claimed on login with three additional account generations',async()=>{
   const state=await (await api.access(req('/',undefined,'token-a',cookie))).json();assert.equal(state.remaining,3);
   assert.equal((await api.read(req('/',undefined,'token-a'),{params:{lessonId:guestId}})).status,200);
   assert.equal((await api.read(req('/',undefined,'token-b'),{params:{lessonId:guestId}})).status,404);
   assert.equal((await (await api.access(req('/',undefined,'token-a',cookie))).json()).total,3);
  });
  await test('ready guest course can be claimed before confirmation without charging account',async()=>{
   const a=await api.access(req()),other=a.headers.get('set-cookie').split(';')[0];
   const c=await (await api.generate(req('/',{...input,requestId:randomUUID()},null,other))).json();
   const state=await (await api.access(req('/',undefined,'token-b',other))).json();assert.equal(state.remaining,3);
   const confirm=await api.confirm(req('/',{},'token-b',other),{params:{lessonId:c.serverLessonId}});assert.equal(confirm.status,200);
   assert.equal((await confirm.json()).entitlement.remaining,3);
  });
  await test('account gets exactly three confirmed courses, replay never double-debits',async()=>{
   for(let i=0;i<3;i++){
    const requestId=randomUUID();const generated=await api.generate(req('/',{...input,requestId},'token-a'));assert.equal(generated.status,200);
    const c=await generated.json();
    await api.confirm(req('/',{},'token-a'),{params:{lessonId:c.serverLessonId}});
    await api.confirm(req('/',{},'token-a'),{params:{lessonId:c.serverLessonId}});
    const replay=await (await api.generate(req('/',{...input,requestId},'token-a'))).json();assert.equal(replay.serverLessonId,c.serverLessonId);
   }
   const denied=await api.generate(req('/',{...input,requestId:randomUUID()},'token-a'));assert.equal((await denied.json()).error,'allowance_exhausted');
   assert.equal((await (await api.access(req('/',undefined,'token-a'))).json()).used,3);
  });
  await test('parallel reservation, failure release and lease expiry',async()=>{
   const owner='g:concurrency';
   const base={p_owner:owner,p_limit:1,p_hash:'hash',p_source:input.text,p_pro:false};
   const [a,b]=await Promise.all([rpc('learning_reserve_v1',{...base,p_request:randomUUID()}),rpc('learning_reserve_v1',{...base,p_request:randomUUID()})]);
   assert(a.course);assert.equal(b.error,'generation_in_progress');
   await rpc('learning_fail_v1',{p_owner:owner,p_id:a.course.id});assert.equal((await rpc('learning_allowance_v1',{p_owner:owner,p_limit:1})).remaining,1);
   const c=await rpc('learning_reserve_v1',{...base,p_request:randomUUID()});
   await db.query("update learning_courses_v1 set lease_until=now()-interval '1 second' where id=$1",[c.course.id]);
   assert.equal((await rpc('learning_allowance_v1',{p_owner:owner,p_limit:1})).remaining,1);
  });
  await test('save/re-save uses one managed course and review consumes no quota',async()=>{
   const payload={serverLessonId:guestId,lang:input.lang,level:input.level,completed:false,resumePath:'/learn/vocabulary',completedSteps:['understanding'],lessonSnapshot:{focus:{vocab:[]}},stats:{vocabCount:2}};
   for(let i=0;i<2;i++)assert.equal((await api.save(req('/',payload,'token-a',cookie))).status,200);
   assert.equal((await db.query('select count(*)::int n from learning_courses_v1 where id=$1',[guestId])).rows[0].n,1);
   const record=(await (await api.read(req('/',undefined,'token-a'),{params:{lessonId:guestId}})).json()).record;
   const pendingRestore=client.restoreLessonRecord({...record,status:'ready'});assert.equal(pendingRestore.lesson.usageConfirmed,false);
   assert.equal(record.saved_options.resumePath,'/learn/vocabulary');assert.equal(record.completed_at,null);
   assert.equal((await api.save(req('/',payload,'token-b'))).status,404);
   const all=await (await api.records(req('/',undefined,'token-a'))).json();assert(all.lessons.some(x=>x.id===guestId));
   assert.equal((await (await api.access(req('/',undefined,'token-a'))).json()).used,3);
  });
  await test('legacy save upserts without marking drafts complete, later updates preserve completion',async()=>{
   const payload={localLessonId:'legacy-distinct-course',lang:input.lang,level:input.level,inputText:input.text,completed:false,completedSteps:[],lessonSnapshot:{sentences:['test']},material:{},stats:{}};
   for(let i=0;i<2;i++)assert.equal((await api.save(req('/',payload,'token-a'))).status,200);
   let rows=(await db.query('select * from lesson_sessions where user_id=$1',[A])).rows;assert.equal(rows.length,1);assert.equal(rows[0].completed_at,null);
   await api.save(req('/',{...payload,completed:true},'token-a'));
   await api.save(req('/',payload,'token-a'));
   rows=(await db.query('select * from lesson_sessions where user_id=$1',[A])).rows;assert.equal(rows.length,1);assert(rows[0].completed_at);
  });
  await test('legacy records sharing a material ID remain distinct when updated',async()=>{
   const first=randomUUID(),second=randomUUID();
   await db.query("insert into lesson_sessions(id,user_id,local_lesson_id,lang,level) values($1,$3,'same-material','Dutch','A2'),($2,$3,'same-material','Dutch','A2')",[first,second,A]);
   const payload={localLessonId:'legacy:'+first,legacySessionId:first,lang:'Dutch',level:'A2',completed:false,completedSteps:[],lessonSnapshot:{sentences:['saved course']},material:{},stats:{}};
   assert.equal((await api.save(req('/',payload,'token-a'))).status,200);
   const rows=(await db.query('select id,local_lesson_id from lesson_sessions where id=$1 or id=$2 order by id',[first,second])).rows;
   assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id===first).local_lesson_id,'legacy:'+first);assert.equal(rows.find(r=>r.id===second).local_lesson_id,'same-material');
   assert.equal((await api.save(req('/',payload,'token-b'))).status,404);
  });
  await test('simulated Pro is staging-only and does not consume free quota',async()=>{
   process.env.LEARNING_TEST_PRO_USER_IDS=B;
   const before=await (await api.access(req('/',undefined,'token-b'))).json();
   const c=await (await api.generate(req('/',{...input,requestId:randomUUID()},'token-b'))).json();
   const confirmed=await (await api.confirm(req('/',{},'token-b'),{params:{lessonId:c.serverLessonId}})).json();
   assert.equal(confirmed.entitlement.remaining,before.remaining);assert.equal(confirmed.entitlement.pro,true);
   process.env.LEARNING_ACCESS_MODE='live';assert.equal((await (await api.access(req('/',undefined,'token-b'))).json()).pro,false);
   process.env.LEARNING_ACCESS_MODE='test';
  });
  await test('invalid identity, forged cookie and direct database execution are rejected',async()=>{
   assert.equal((await api.access(req('/',undefined,'invalid',cookie))).status,401);
   const forged=await api.access(req('/',undefined,null,'lingua_learning_guest='+randomUUID()+'.'+'0'.repeat(64)));assert(forged.headers.get('set-cookie'));
   const permissions=(await db.query("select has_function_privilege('anon','learning_confirm_v1(text,uuid)','execute') allowed")).rows[0];assert.equal(permissions.allowed,false);
  });
  if(process.env.LEARNING_BROWSER_TEST==='1'){
   const {chromium}=require('playwright');
   const shim=path.join(temp,'navigation.js');
   await fs.writeFile(shim,`import {useSyncExternalStore} from '${root}/node_modules/react/index.js';
const notify=()=>window.dispatchEvent(new Event('popstate'));
const router={push(p){history.pushState({},'',p);setTimeout(notify,0);},replace(p){history.replaceState({},'',p);setTimeout(notify,0);}};
const subscribe=fn=>{window.addEventListener('popstate',fn);return ()=>window.removeEventListener('popstate',fn);};
export function useRouter(){return router;}export function usePathname(){return useSyncExternalStore(subscribe,()=>location.pathname,()=>'/');}export function useSearchParams(){return new URLSearchParams(location.search);}`);
   const result=await build({entryPoints:[path.join(root,'scripts/prototype/entry.jsx')],bundle:true,format:'iife',jsx:'automatic',loader:{'.js':'jsx'},define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://database.test"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"fake-anon-key"','process.env':'{}'},alias:{'next/navigation':shim},write:false,logLevel:'silent'});
   const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+await fs.readFile(path.join(root,'app/globals.css'),'utf8')+'</style><div id="root"></div><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
   const browser=await chromium.launch({headless:true});const errors=[];
   async function pageFor(width,account=false,lang='en'){
    const p=await browser.newPage({viewport:{width,height:950}});
    p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message);});p.on('dialog',d=>d.accept());
    await p.addInitScript(({account,lang,B})=>{localStorage.setItem('lingua:uiLang',JSON.stringify(lang));if(account)localStorage.setItem('lingua:authSession',JSON.stringify({accessToken:'token-b',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id:B,email:'b@example.test'}}));},{account,lang,B});
    await p.route('**/*',async route=>{
     const q=route.request(),u=new URL(q.url());
     if(q.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
     if(u.hostname==='database.test'){
      const r=await global.fetch(q.url(),{headers:q.headers()});return route.fulfill({status:r.status,contentType:'application/json',body:await r.text()});
     }
     if(u.pathname.startsWith('/api/')){
      const request=new Request(q.url(),{method:q.method(),headers:q.headers(),...(q.method()==='GET'?{}:{body:q.postData()})});
      let result;
      if(u.pathname==='/api/account/entitlements')result=await api.access(request);
      else if(u.pathname==='/api/lesson')result=await api.generate(request);
      else if(u.pathname==='/api/learning/save')result=await api.save(request);
      else if(u.pathname==='/api/learning/records')result=await api.records(request);
      else if(/^\/api\/lesson\/[^/]+\/confirm$/.test(u.pathname))result=await api.confirm(request,{params:{lessonId:u.pathname.split('/')[3]}});
      else if(/^\/api\/lesson\/[^/]+$/.test(u.pathname))result=await api.read(request,{params:{lessonId:u.pathname.split('/')[3]}});
      else result=new Response(null,{status:204});
      return route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:result.status===204?'':await result.text()});
     }
     return route.abort();
    });
    await p.goto('http://localhost:4179/import');await p.locator('textarea').waitFor();return p;
   }
   try{
    delete process.env.LEARNING_TEST_PRO_USER_IDS;
    for(const [width,lang]of [[1440,'en'],[390,'zh']]){
     await test(`browser ${width}px ${lang}: generate, confirm, refresh, guest gate`,async()=>{
      const p=await pageFor(width,false,lang);
      await p.locator('.learning-allowance').waitFor();
      await p.locator('textarea').fill(input.text);
      await p.locator('button.btn-primary').last().click();
      await p.waitForURL('**/scan');
      const next=p.locator('button').filter({hasText:lang==='zh'?'就这些':'Looks good'});
      await next.waitFor({timeout:5000}).catch(async e=>{await p.screenshot({path:'/private/tmp/lingua-access-browser-error.png',fullPage:true});console.log((await p.locator('body').innerText()).slice(0,1200));throw e;});
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('lingua:currentLesson'))?.usageConfirmed===true);
      const course=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingua:currentLesson')));
      await p.reload();await p.locator('.scanw').first().waitFor();
      assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lingua:currentLesson')).serverLessonId),course.serverLessonId);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.goto('http://localhost:4179/import');await p.locator('textarea').fill(input.text);await p.locator('button.btn-primary').last().click();
      await p.locator('[role="dialog"]').waitFor();assert.match(await p.locator('[role="dialog"]').innerText(),lang==='zh'?/额外 3 次/:/3 additional/);
      await p.close();
     });
    }
    await test('browser account: save, Progress restore and no new generation',async()=>{
     const p=await pageFor(1440,true);
     await p.locator('textarea').fill(input.text);await p.locator('button.btn-primary').last().click();await p.waitForURL('**/scan');
     await p.waitForFunction(()=>JSON.parse(localStorage.getItem('lingua:currentLesson'))?.usageConfirmed===true);
     await p.locator('.learning-course-notice button').last().click();
     await p.getByText('Lesson saved to your account.',{exact:true}).waitFor();
     const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('lingua:currentLesson')).serverLessonId);
     await p.goto('http://localhost:4179/progress');await p.locator('.history-card').first().waitFor();
     const card=p.locator('.history-card').filter({has:p.locator('button')}).first();await card.locator('summary').click();
     await card.getByRole('button',{name:'Continue lesson',exact:true}).click();await p.waitForURL('**/scan');await p.locator('.scanw').first().waitFor();
     assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('lingua:currentLesson')).serverLessonId),id);
     await p.close();
    });
    assert.deepEqual(errors,[]);
   }finally{await browser.close();}
  }

 }
 console.log(`${passed} learning access checks passed.`);
}finally{
 global.fetch=originalFetch;delete global.localStorage;
 for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);
 if(db)await db.close();await fs.rm(temp,{recursive:true,force:true});
}
