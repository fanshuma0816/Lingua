import assert from 'node:assert/strict';
import {test} from 'node:test';
import {quotaPresentation} from '../lib/quota-presentation.js';
const account={enabled:true,signedIn:true,pro:false,granted:3,used:1,remaining:2,reserved:0,available:2};
test('the visible balance is available, with held quota shown separately',()=>{
 const view=quotaPresentation({...account,reserved:1,available:1});
 assert.equal(view.available,1);assert.equal(view.reserved,1);assert.equal(view.used,1);assert.equal(view.granted,3);assert.equal(view.state,'reserved');
});
test('guest and free account have distinct identities without inventing a grant',()=>{
 const guest=quotaPresentation({enabled:true,signedIn:false,pro:false,granted:1,used:0,remaining:1,reserved:0,available:1});
 assert.equal(guest.identity,'guest');assert.equal(guest.granted,1);
 assert.equal(quotaPresentation(account).identity,'free');
});
test('loading or failed reads never present a cached count as current or as zero',()=>{
 for(const status of ['loading','error']){
  const view=quotaPresentation(account,{status});
  assert.equal(Object.hasOwn(view,'available'),false);assert.equal(Object.hasOwn(view,'used'),false);
 }
 assert.equal(quotaPresentation(account,{status:'error'}).state,'unavailable');
});
test('a genuine last credit and exhausted balance remain distinguishable',()=>{
 assert.equal(quotaPresentation({...account,used:2,remaining:1,available:1}).state,'last');
 const zero=quotaPresentation({...account,used:3,remaining:0,available:0});
 assert.equal(zero.state,'exhausted');assert.equal(zero.available,0);
});
test('missing, malformed, negative or inconsistent counters are unknown, not clamped to zero',()=>{
 for(const field of ['granted','used','remaining','reserved','available']){
  for(const value of [undefined,null,-1,NaN,Infinity,'2',1.5])assert.equal(quotaPresentation({...account,[field]:value}).state,'unavailable');
 }
 assert.equal(quotaPresentation({...account,available:3}).state,'unavailable');
 assert.equal(quotaPresentation({...account,used:0}).state,'unavailable');
});
test('disabled mode and an explicit Pro response do not show a fabricated free-account badge',()=>{
 assert.equal(quotaPresentation({enabled:false}).state,'off');
 assert.equal(quotaPresentation({...account,pro:true}).state,'off');
 assert.equal(quotaPresentation(null).state,'unavailable');
});
test('presentation neither mutates server data nor derives permission from a displayed count',()=>{
 const frozen=Object.freeze({...account,canGenerate:true});
 const result=quotaPresentation(frozen);
 assert.equal(result.available,2);assert.equal(Object.hasOwn(result,'canGenerate'),false);
 assert.deepEqual(frozen,{...account,canGenerate:true});
 assert.equal(quotaPresentation({...account,canGenerate:false}).state,'unavailable');
});
