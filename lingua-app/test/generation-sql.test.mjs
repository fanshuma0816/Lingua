// Run with PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node --test test/generation-sql.test.mjs
// Embedded PostgreSQL executes the real migration and transactions, without production access.
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
let db;
const user=randomUUID(), other=randomUUID(), guest=`guest:${randomUUID()}`;
async function action(subject,name,args={},environment='test') {
 const uid=subject.startsWith('user:')?subject.slice(5):null;
 return (await db.query('select public.lingua_generation($1,$2,$3,$4,$5) as result',[name,environment,subject,uid,JSON.stringify(args)])).rows[0].result;
}
async function ready(subject,requestId=randomUUID(),environment='test') {
 const hold=await action(subject,'reserve',{requestId,hash:'same'},environment);
 assert.equal(hold.acquired,true);
 const result=await action(subject,'store',{requestId,snapshot:{text:'Ik ga naar huis.',sents:['Ik ga naar huis.'],lang:'Dutch',level:'A2',material:{}}},environment);
 return {requestId,lessonId:result.lesson.lessonId};
}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);
 create table public.lesson_sessions(id uuid primary key,user_id uuid,created_at timestamptz);
 insert into auth.users values('${user}'),('${other}');`);
 const sql=await readFile(new URL('../supabase/migrations/20261106_generation_entitlements.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql); // migration can be run again safely
});
after(async()=>{await db.close();});
test('guest reservation, repeated requests and delivery debit once',async()=>{
 assert.equal((await action(guest,'balance')).available,1);
 const {requestId,lessonId}=await ready(guest);
 assert.equal((await action(guest,'balance')).used,0);
 assert.equal((await action(guest,'balance')).available,0);
 assert.equal((await action(guest,'reserve',{requestId,hash:'changed'})).error,'request_conflict');
 assert.equal((await action(guest,'reserve',{requestId,hash:'same'})).lesson.lessonId,lessonId);
 assert.equal((await action(guest,'reserve',{requestId:randomUUID(),hash:'same'})).error,'sign_in_required');
 await Promise.all([action(guest,'confirm',{lessonId}),action(guest,'confirm',{lessonId})]);
 assert.equal((await action(guest,'balance')).used,1);
 assert.equal((await action(guest,'read',{lessonId})).delivered,true);
 assert.equal((await action(guest,'reserve',{requestId:randomUUID(),hash:'same'})).error,'sign_in_required');
});
test('new and returning accounts receive one grant; failed and expired holds are released',async()=>{
 const subject=`user:${user}`;
 for(let i=0;i<4;i++)assert.equal((await action(subject,'balance')).granted,3);
 const requestId=randomUUID();await action(subject,'reserve',{requestId,hash:'x'});
 await action(subject,'release',{requestId});assert.equal((await action(subject,'balance')).available,3);
 const readyLesson=await ready(subject);
 await db.query("update generation_requests set expires_at=now()-interval '1 second' where request_key=$1",[readyLesson.requestId]);
 assert.equal((await action(subject,'confirm',{lessonId:readyLesson.lessonId})).error,'request_expired');
 assert.equal((await action(subject,'balance')).available,3);
 assert.equal((await action(subject,'read',{lessonId:readyLesson.lessonId})).error,'request_expired');
});
test('simultaneous requests never reserve more than the allowance',async()=>{
 const subject=`user:${other}`;
 const results=await Promise.all(Array.from({length:8},()=>action(subject,'reserve',{requestId:randomUUID(),hash:'x'})));
 assert.equal(results.filter(r=>r.acquired).length,3);
 assert.equal(results.filter(r=>r.error==='quota_exhausted').length,5);
});
test('guest claiming does not consume account credits and cannot be claimed twice',async()=>{
 const result=await action(guest,'history');const lessonId=result.lessons[0].id;
 await action(`user:${user}`,'claim',{guest});await action(`user:${other}`,'claim',{guest});
 assert.equal((await action(`user:${user}`,'read',{lessonId})).delivered,true);
 assert.equal((await action(`user:${other}`,'read',{lessonId})).error,'lesson_not_found');
 assert.equal((await action(guest,'read',{lessonId})).error,'lesson_not_found');
 assert.equal((await action(`user:${user}`,'balance')).used,0);
 await action(`user:${user}`,'save',{lessonId,progress:{path:'/done'}});
 await action(`user:${user}`,'save',{lessonId,progress:{path:'/preview'}});
 assert.equal((await action(`user:${user}`,'read',{lessonId})).progress.path,'/preview');
});
test('test and production identities, records and balances are isolated',async()=>{
 const subject=`user:${user}`;
 assert.equal((await action(subject,'balance',{},'production')).available,3);
 const testHistory=await action(subject,'history');
 assert.equal((await action(subject,'read',{lessonId:testHistory.lessons[0].id},'production')).error,'lesson_not_found');
 assert.equal((await action(subject,'history',{},'production')).lessons.length,0);
});
test('exhausted accounts can read courses and the ledger never doubles',async()=>{
 const subject=`user:${user}`;
 let last;
 for(let i=0;i<3;i++){last=await ready(subject);await action(subject,'confirm',{lessonId:last.lessonId});}
 assert.equal((await action(subject,'balance')).used,3);
 assert.equal((await action(subject,'balance')).available,0);
 await action(subject,'confirm',{lessonId:last.lessonId});
 assert.equal((await action(subject,'balance')).used,3);
 assert.equal((await action(subject,'read',{lessonId:last.lessonId})).delivered,true);
});
test('browser roles cannot execute mutations or read new tables',async()=>{
 const r=await db.query(`select has_function_privilege('anon','public.lingua_generation(text,text,text,uuid,jsonb)','EXECUTE') a,
 has_function_privilege('authenticated','public.lingua_generation(text,text,text,uuid,jsonb)','EXECUTE') b,
 has_table_privilege('anon','public.generated_lessons','SELECT') c,
 has_table_privilege('authenticated','public.generation_grants','UPDATE') d`);
 assert.deepEqual(r.rows[0],{a:false,b:false,c:false,d:false});
});
test('rate limits and maintenance expire only unfinished requests',async()=>{
 const subject=`guest:${randomUUID()}`;
 for(let i=0;i<2;i++)assert.equal((await action(subject,'rate',{key:'test-limit',limit:2})).ok,true);
 assert.equal((await action(subject,'rate',{key:'test-limit',limit:2})).error,'rate_limited');
 const pending=await ready(subject);
 await db.query("update generation_requests set expires_at=now()-interval '1 second' where request_key=$1",[pending.requestId]);
 assert.equal((await db.query('select public.lingua_expire_generation_requests() n')).rows[0].n>=1,true);
 assert.equal((await action(subject,'balance')).used,0);
 assert.equal((await action(subject,'balance')).available,1);
});

test('course analysis is retained, first successful result wins, and review is free',async()=>{
 const subject=`user:${user}`,course=(await action(subject,'history')).lessons.find(l=>l.generated);
 const before=(await action(subject,'balance')).used;
 const first={lessonId:course.id,key:'quiz:en',result:{items:[{q:'Original question'}]}};
 await action(subject,'analysis_put',first);
 await action(subject,'analysis_put',{...first,result:{items:[{q:'Replacement question'}]}});
 assert.deepEqual((await action(subject,'analysis_get',{lessonId:course.id,key:'quiz:en'})).result,first.result);
 assert.equal((await action(subject,'balance')).used,before);
 assert.equal((await action(`user:${other}`,'analysis_get',{lessonId:course.id,key:'quiz:en'})).error,'lesson_not_found');
});
