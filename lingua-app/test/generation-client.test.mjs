import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {DB,setLearningScope} from '../lib/storage.js';
import {rememberGeneration,generationToContinue,associateGenerationLesson} from '../lib/generation-continuation.js';
import {createLesson,confirmLesson,getEntitlements,refreshEntitlements,publishQuotaChange} from '../lib/lesson-api-client.js';
class MemoryStorage {
 constructor(){this.data=new Map();}
 getItem(k){return this.data.has(k)?this.data.get(k):null;}
 setItem(k,v){this.data.set(k,String(v));}
 removeItem(k){this.data.delete(k);}
}
const original={fetch:globalThis.fetch,window:globalThis.window,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,BroadcastChannel:globalThis.BroadcastChannel};
const payload={text:'Ik lees een boek.',lang:'Dutch',level:'A2'};
const user='77777777-7777-4777-8777-777777777777';
function auth(id=user){DB.set('authSession',{accessToken:'verified-token',expiresAt:Math.floor(Date.now()/1000)+3600,user:{id}});}
before(()=>{
 globalThis.localStorage=new MemoryStorage();globalThis.sessionStorage=new MemoryStorage();
 globalThis.window=new EventTarget();window.localStorage=localStorage;window.location={pathname:'/find'};
 globalThis.BroadcastChannel=undefined;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://db.example';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-public-key';
});
after(()=>{Object.assign(globalThis,original);});
test('two tabs share durable recovery but do not overwrite their active lesson or pending request',()=>{
 setLearningScope('test:shared');const first=sessionStorage;
 DB.set('currentLesson',{lessonId:'course-a'});DB.set('pendingGeneration',{requestId:'request-a'});
 globalThis.sessionStorage=new MemoryStorage();
 assert.equal(DB.get('currentLesson',null).lessonId,'course-a');
 DB.set('currentLesson',{lessonId:'course-b'});DB.set('pendingGeneration',{requestId:'request-b'});
 globalThis.sessionStorage=first;
 assert.equal(DB.get('currentLesson',null).lessonId,'course-a');
 assert.equal(DB.get('pendingGeneration',null).requestId,'request-a');
});
test('a login continuation survives guest sign-in but cannot cross environments or existing accounts',()=>{
 const guest=rememberGeneration(payload,{environment:'test',path:'/find'});
 assert.equal(generationToContinue('test',user).id,guest.id);
 assert.equal(generationToContinue('production',user),null);
 rememberGeneration(payload,{environment:'test',userId:user,path:'/import'});
 assert.equal(generationToContinue('test','another-account'),null);
});
test('signing in during an unresolved guest request queries the original result without a second POST',async()=>{
 setLearningScope('test:guest');auth();
 const requestId='88888888-8888-4888-8888-888888888888';
 rememberGeneration(payload,{environment:'test',requestId,recover:true});
 let posts=0,queries=0;
 globalThis.fetch=async(path,options={})=>{
  if(path==='/api/account/entitlements')return Response.json({enabled:true,environment:'test',signedIn:true,remaining:3,reserved:0,canGenerate:true});
  if(path===`/api/lesson/requests/${requestId}`){queries++;return Response.json({status:'ready',lesson:{lessonId:'same-course'}});}
  if(options.method==='POST')posts++;
  throw new Error('Unexpected request '+path);
 };
 assert.equal((await createLesson(payload)).lessonId,'same-course');assert.equal(posts,0);assert.equal(queries,1);
});
test('an account switch during confirmation does not clear another account request or intent',async()=>{
 setLearningScope(`test:${user}`);auth();DB.set('pendingGeneration',{requestId:'original-request'});
 const intent=rememberGeneration(payload,{environment:'test',userId:user,requestId:'original-request',recover:true});
 globalThis.fetch=async()=>{auth('99999999-9999-4999-8999-999999999999');return Response.json({delivered:true,entitlements:{environment:'test'}});};
 await assert.rejects(confirmLesson('course-a'),error=>error.code==='account_changed');
 assert.equal(DB.get('pendingGeneration',null).requestId,'original-request');
 assert.equal(DB.get('generationContinuation',null).id,intent.id);
});
test('late confirmation cannot delete a newer intent from another tab',async()=>{
 setLearningScope(`test:${user}`);auth();DB.set('pendingGeneration',{requestId:'old-request'});
 rememberGeneration(payload,{environment:'test',userId:user,requestId:'old-request',recover:true});
 let next;
 globalThis.fetch=async()=>{
  DB.set('pendingGeneration',{requestId:'new-request'});
  next=rememberGeneration({...payload,text:'Ik ga naar huis.'},{environment:'test',userId:user,requestId:'new-request',recover:true});
  return Response.json({delivered:true,entitlements:{environment:'test'}});
 };
 await confirmLesson('course-a');
 assert.equal(DB.get('generationContinuation',null).id,next.id);
 assert.equal(DB.get('pendingGeneration',null).requestId,'new-request');
});

test('confirming an older course preserves an already-existing newer continuation',async()=>{
 setLearningScope(`test:${user}`);auth();DB.set('pendingGeneration',{requestId:'original-request'});
 const next=rememberGeneration(payload,{environment:'test',userId:user,requestId:'new-request',recover:true});
 associateGenerationLesson('new-request','course-b');
 globalThis.fetch=async()=>Response.json({delivered:true,entitlements:{environment:'test'}});
 await confirmLesson('course-a');
 assert.equal(DB.get('generationContinuation',null).id,next.id);
});
test('confirming the associated course clears its continuation without issuing a new request',async()=>{
 setLearningScope(`test:${user}`);auth();DB.set('pendingGeneration',{requestId:'own-request'});
 rememberGeneration(payload,{environment:'test',userId:user,requestId:'own-request',recover:true});associateGenerationLesson('own-request','course-a');
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({delivered:true,entitlements:{environment:'test'}});};
 await confirmLesson('course-a');assert.equal(calls,1);assert.equal(DB.get('generationContinuation',null),null);
});

test('a slow earlier balance response cannot overwrite a later quota change',async()=>{
 auth();let resolveFirst,started;const firstStarted=new Promise(resolve=>{started=resolve;});let calls=0;
 const response=remaining=>Response.json({enabled:true,environment:'test',signedIn:true,remaining,reserved:0,canGenerate:!!remaining});
 globalThis.fetch=async()=>{calls++;if(calls===1){started();return new Promise(resolve=>{resolveFirst=resolve;});}return response(0);};
 const older=getEntitlements({fresh:true});await firstStarted;
 publishQuotaChange('test',user);
 assert.equal((await refreshEntitlements()).remaining,0);
 resolveFirst(response(1));assert.equal((await older).remaining,0);
});
