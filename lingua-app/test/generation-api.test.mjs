import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { GET as balance } from '../app/api/account/entitlements/route.js';
import { POST as generate } from '../app/api/lesson/route.js';
import { POST as confirm } from '../app/api/lesson/[lessonId]/confirm/route.js';
import { GET as readLesson } from '../app/api/lesson/[lessonId]/route.js';
import { GET as lookupRequest } from '../app/api/lesson/requests/[requestId]/route.js';
import { POST as claim } from '../app/api/lesson/claim/route.js';
import { POST as save } from '../app/api/learning/save/route.js';
import { GET as history } from '../app/api/learning/records/route.js';
import { POST as analyze } from '../app/api/analyze/route.js';
import { POST as chat } from '../app/api/chat/route.js';
import { POST as tts } from '../app/api/tts/route.js';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
let db;const originalFetch=globalThis.fetch,uid=randomUUID(),other=randomUUID(),emailUid=randomUUID();
function request(path,body,headers={}){return new Request(`http://localhost${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',origin:'http://localhost',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function json(response,status=200){assert.equal(response.status,status,await response.clone().text());return response.json();}
before(async()=>{
 process.env.MONETIZATION_MODE='test';process.env.MONETIZATION_TEST_USER_IDS=uid;
 process.env.GUEST_SIGNING_SECRET='test-only-guest-secret-over-32-characters';
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.example';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
 create table public.lesson_sessions(id uuid primary key,user_id uuid,created_at timestamptz);insert into auth.users values('${uid}'),('${other}'),('${emailUid}');`);
 await db.exec(await readFile('supabase/migrations/20261106_generation_entitlements.sql','utf8'));
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname;
  if(path==='/auth/v1/user'){
   const token=options.headers.Authorization;
   if(token==='Bearer verified-email')return Response.json({id:emailUid,email:'Preview@Example.com',email_confirmed_at:new Date().toISOString(),is_anonymous:false});
   if(token==='Bearer unverified-email')return Response.json({id:emailUid,email:'preview@example.com',email_confirmed_at:null});
   if(token==='Bearer forged-metadata')return Response.json({id:emailUid,email:'other@example.com',email_confirmed_at:new Date().toISOString(),user_metadata:{email:'preview@example.com',email_verified:true}});
   if(token==='Bearer anonymous-email')return Response.json({id:emailUid,email:'preview@example.com',email_confirmed_at:new Date().toISOString(),is_anonymous:true});
   return Response.json({id:token==='Bearer good'?uid:other});
  }
  if(path==='/rest/v1/rpc/lingua_generation'){
   const p=JSON.parse(options.body);
   try {const r=await db.query('select public.lingua_generation($1,$2,$3,$4,$5) result',[p.p_action,p.p_environment,p.p_subject,p.p_user_id,JSON.stringify(p.p_args)]);return Response.json(r.rows[0].result);}
   catch(error){return Response.json({error:error.message},{status:500});}
  }
  throw new Error(`Unexpected network call: ${url}`);
 };
});
after(async()=>{globalThis.fetch=originalFetch;await db.close();});
test('guest -> complete course -> one debit -> sign in -> 3 extra credits -> free restore',async()=>{
 const boot=await balance(request('/api/account/entitlements'));
 const cookie=boot.headers.get('set-cookie').split(';')[0];assert.equal((await boot.json()).available,1);
 const h={cookie};const requestId=randomUUID();const input={requestId,text:'Ik ga vandaag naar de markt. Ik koop brood en melk.',lang:'Dutch',level:'A2',goal:'General fluency'};
 const lesson=await json(await generate(request('/api/lesson',input,h)));
 assert.ok(lesson.lessonId);assert.ok(lesson.sents.length);
 assert.equal((await json(await balance(request('/api/account/entitlements',undefined,h)))).used,0);
 const duplicate=await json(await generate(request('/api/lesson',input,h)));assert.equal(duplicate.lessonId,lesson.lessonId);
 const params={params:{lessonId:lesson.lessonId}};
 const outcome=await json(await confirm(request(`/api/lesson/${lesson.lessonId}/confirm`,{},h),params));assert.equal(outcome.entitlements.used,1);
 await json(await confirm(request(`/api/lesson/${lesson.lessonId}/confirm`,{},h),params));
 await json(await generate(request('/api/lesson',{...input,requestId:randomUUID()},h)),401);
 const headers={...h,Authorization:'Bearer good'};
 await json(await claim(request('/api/lesson/claim',{},headers)));
 assert.equal((await json(await balance(request('/api/account/entitlements',undefined,headers)))).available,3);
 const restored=await json(await readLesson(request('/api/lesson/x',undefined,headers),params));assert.equal(restored.lesson.lessonId,lesson.lessonId);
 for(let i=0;i<2;i++)await json(await save(request('/api/learning/save',{lessonId:lesson.lessonId,interactionSnapshot:{},stats:{}},headers)));
 assert.equal((await json(await history(request('/api/learning/records',undefined,headers)))).lessons.length,1);
 await json(await readLesson(request('/api/lesson/x',undefined,h),params),404);
});
test('account allowlist, forged cookie and cross-origin calls cannot bypass permissions',async()=>{
 await json(await balance(request('/api/account/entitlements',undefined,{Authorization:'Bearer other'})),403);
 await json(await generate(request('/api/lesson',{requestId:randomUUID(),text:'Ik ga naar huis.'},{cookie:`lingua_guest_test=${randomUUID()}.9999999999999.invalid`})),401);
 await json(await generate(request('/api/lesson',{text:'Hello'},{origin:'https://other.example'})),403);
});
test('learning APIs reject missing course identity before any AI fallback',async()=>{
 const headers={Authorization:'Bearer good'};
 for(const [handler,path,body] of [[analyze,'analyze',{mode:'translate',sentences:['unrelated']}],[chat,'chat',{mode:'chat'}],[tts,'tts',{text:'unrelated'}]]){
  await json(await handler(request(`/api/${path}`,body,headers)),404);
 }
});
test('an owned lesson cannot authorize unrelated analysis or speech',async()=>{
 const headers={Authorization:'Bearer good'},requestId=randomUUID();
 const lesson=await json(await generate(request('/api/lesson',{requestId,text:'Ik ga naar de markt.',lang:'Dutch'},headers)));
 await json(await confirm(request('/api/lesson/x/confirm',{},headers),{params:{lessonId:lesson.lessonId}}));
 await json(await analyze(request('/api/analyze',{lessonId:lesson.lessonId,mode:'translate',sentences:['This unrelated paragraph must not be analyzed.']},headers)),403);
 await json(await tts(request('/api/tts',{lessonId:lesson.lessonId,text:'This unrelated paragraph must not be spoken.'},headers)),403);
 const valid=await tts(request('/api/tts',{lessonId:lesson.lessonId,text:'Ik ga naar de markt.'},headers));assert.equal(valid.status,204);
});
test('feature off keeps the old unmetered course API and does not touch new tables',async()=>{
 process.env.MONETIZATION_MODE='off';
 const before=(await db.query('select count(*) n from generation_requests')).rows[0].n;
 const lesson=await json(await generate(request('/api/lesson',{text:'Ik ga naar school.',lang:'Dutch'})));
 assert.ok(lesson.sents.length);assert.equal(lesson.lessonId,undefined);
 assert.equal((await json(await balance(request('/api/account/entitlements')))).enabled,false);
 assert.equal((await db.query('select count(*) n from generation_requests')).rows[0].n,before);
 process.env.MONETIZATION_MODE='test';
});

test('a new approved verified email signs in normally and gets one grant; metadata cannot bypass admission',async()=>{
 process.env.MONETIZATION_TEST_EMAILS=' preview@example.com ';
 const h={Authorization:'Bearer verified-email'};
 for(let i=0;i<3;i++)assert.equal((await json(await balance(request('/api/account/entitlements',undefined,h)))).granted,3);
 for(const token of ['unverified-email','forged-metadata','anonymous-email'])
  await json(await balance(request('/api/account/entitlements',undefined,{Authorization:`Bearer ${token}`})),403);
 process.env.MONETIZATION_TEST_EMAILS='';
 await json(await balance(request('/api/account/entitlements',undefined,h)),403);
});
test('signing in during a guest request recovers that request and spends only the guest hold',async()=>{
 process.env.MONETIZATION_TEST_EMAILS='preview@example.com';
 const boot=await balance(request('/api/account/entitlements'));
 const cookie=boot.headers.get('set-cookie').split(';')[0],guest={cookie},requestId=randomUUID();
 const lesson=await json(await generate(request('/api/lesson',{requestId,text:'Ik lees een boek.',lang:'Dutch'},guest)));
 const account={cookie,Authorization:'Bearer verified-email'};
 const before=(await json(await balance(request('/api/account/entitlements',undefined,account)))).available;
 const recovered=await json(await lookupRequest(request(`/api/lesson/requests/${requestId}`,undefined,account),{params:{requestId}}));
 assert.equal(recovered.lesson.lessonId,lesson.lessonId);
 const params={params:{lessonId:lesson.lessonId}};
 await json(await readLesson(request('/api/lesson/x',undefined,account),params));
 await json(await confirm(request('/api/lesson/x/confirm',{},account),params));
 await json(await confirm(request('/api/lesson/x/confirm',{},account),params));
 assert.equal((await json(await balance(request('/api/account/entitlements',undefined,account)))).available,before);
 assert.equal((await json(await balance(request('/api/account/entitlements',undefined,guest)))).used,1);
 await json(await lookupRequest(request('/api/lesson/requests/x',undefined,guest),{params:{requestId}}),404);
 // A second signed-in account with the same browser cookie still cannot claim or query it.
 await json(await lookupRequest(request('/api/lesson/requests/x',undefined,{cookie,Authorization:'Bearer good'}),{params:{requestId}}),404);
 await json(await readLesson(request('/api/lesson/x',undefined,{cookie,Authorization:'Bearer good'}),params),404);
 process.env.MONETIZATION_TEST_EMAILS='';
});
