// Bundle with esbuild --bundle --platform=node --format=esm, then run node --test on the output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { cleanText } from '../lib/text.js';
import { prepareImport, MAX_DOCUMENT_CHARS } from '../lib/text-chunks.js';
import { activeHistory, isRepeated, recordMaterial, readMaterialHistory } from '../lib/material-history.js';
import { validateGeneratedMaterial, generateDutchMaterials } from '../lib/material-validation.js';
import { selectTextbookMaterials } from '../lib/material-corpus.js';
import { materialId } from '../lib/cefr.mjs';
import { POST as buildLesson } from '../app/api/lesson/route.js';

const sampleSource=fs.readFileSync('services/api.js','utf8');
const samples=[...sampleSource.matchAll(/\{title:"([^"]+)",source:"[^"]+",level:[^\n]*?text:"((?:[^"\\]|\\.)*)"\}/g)].map(m=>({title:m[1],text:JSON.parse('"'+m[2]+'"')}));
const story=samples.find(m=>m.title.includes('thuiswerken'));
const spec={words:[90,150],label:'25-35',target:30};
const review=(m,overrides={})=>({id:m.id||materialId(m.text),language:'Dutch',level:'B2',tier:'balanced',vocabulary:'Common words with some abstract terms',syntax:'Subordinate clauses and contrast',comprehension:'Compare two perspectives',evidence:m.text.slice(0,45),...overrides});
function mockAI({badFirst=false,alwaysBad=false,duplicate=false}={}){
 let generations=0,checks=0;
 return {get generations(){return generations},get checks(){return checks},
 complete:async messages=>{
  if(messages[0].content.startsWith('Independently')){
   checks++;
   const input=JSON.parse(messages[1].content.split('Texts: ')[1]);
   return {reviews:input.map(m=>review(m,{tier:alwaysBad||badFirst&&checks===1?'over':'balanced'}))};
  }
  generations++;
  return {materials:[{...story,text:duplicate?story.text:story.text}]};
 }};
}
const dependencies=ai=>({enabled:true,parse:x=>x,complete:ai.complete,selectCorpus:()=>{throw new Error('B1/B2 must not use corpus')}});

test('ordinary times, numbers, repetition and paragraphs survive cleanup',()=>{
 const input='Om 12:30 begint de les.\n\n2026\n\nJa.\nJa.';
 assert.equal(cleanText(input),input);
});
test('subtitle cleanup removes cues and rolling duplicates, preserving spoken time',()=>{
 const input='WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nWij gaan morgen samen\n\n2\n00:00:02.000 --> 00:00:03.000\nWij gaan morgen samen naar school om 12:30.\n';
 assert.equal(cleanText(input),'Wij gaan morgen samen naar school om 12:30.');
 assert.equal(cleanText(cleanText(input)),cleanText(input));
});
test('markdown and encoded entities are cleaned idempotently',()=>{
 const input='# Titel\n\n**Hallo** [wereld](https://example.com). &amp;nbsp; &amp;quot;dag&amp;quot;';
 const clean=cleanText(input); assert(!clean.includes('https:'));assert(!clean.includes('**'));
 assert.equal(cleanText(clean),clean);
});
test('long imports preserve every cleaned character and original source, with stable chunk IDs',()=>{
 const input=Array.from({length:25},(_,i)=>`Dit is paragraaf ${i}. Ik ga vandaag naar school. Daar leer ik Nederlands met mijn vrienden. Daarna ga ik naar huis om 12:30.`).join('\n\n');
 const doc=prepareImport(input,{level:'A2'});
 assert(input.length>1200);assert(doc.chunks.length>1);assert.equal(doc.originalText,input);
 assert.equal(doc.chunks.map(c=>doc.cleanedText.slice(c.start,c.end)).join(''),doc.cleanedText);
 for(const c of doc.chunks){assert.equal(doc.cleanedText.slice(c.start,c.end).trim(),c.text);assert(c.text.endsWith('.'));}
 assert.deepEqual(prepareImport(input,{level:'A2'}),doc);
 assert.equal(doc.text,doc.chunks[doc.selectedChunkIndex].text);
});
test('short text and long unbroken sentences are never truncated',()=>{
 const short='Ik ga naar huis.\n\nDaar drink ik thee.';
 assert.equal(prepareImport(short).text,short);
 const sentence='Ik '+Array(500).fill('en jij').join(' ')+' ga naar huis.';
 assert.equal(prepareImport(sentence).chunks.length,1);
 assert.equal(prepareImport(sentence).text,sentence);
 assert.throws(()=>prepareImport('x'.repeat(MAX_DOCUMENT_CHARS+1)),/document_too_large/);
});
test('dialogue turns stay intact',()=>{
 const turns=Array.from({length:20},(_,i)=>`Sanne: Ik lees boek ${i}. Het is een goed boek. Daarna drink ik thee.`);
 const doc=prepareImport(turns.join('\n'),{targetMin:15});
 for(const turn of turns)assert(doc.chunks.some(c=>c.text.includes(turn)));
});
test('punctuation changes and renamed characters cannot evade duplicate checks',()=>{
 const material={id:'original',text:story.text};
 const history=recordMaterial([],material,'completed',1);
 assert(isRepeated({text:story.text.toUpperCase().replaceAll('.', '!')},history,Date.now()));
 const renamed={text:'Noor gaat vandaag naar school met haar vrienden. Noor leest een mooi boek in de klas en schrijft daarna een brief aan haar moeder. Na de les fietst Noor rustig naar huis en maakt zij het avondeten klaar.'};
 assert(isRepeated({text:renamed.text.replaceAll('Noor','Sara')},recordMaterial([],renamed,'completed')));
});
test('shown history expires, started/completed records persist and never downgrade',()=>{
 let h=recordMaterial([],story,'shown',1);assert.equal(activeHistory(h,8*86400000).length,0);
 h=recordMaterial(h,story,'completed',2);h=recordMaterial(h,story,'shown',3);
 assert.equal(h[0].status,'completed');assert.equal(h.length,1);assert(isRepeated(story,h,8*86400000));
});
test('legacy history migration persists instead of resetting cooldown',()=>{
 const store=new Map([['lingua:recentMaterials',JSON.stringify(['m_abc','Title','Title'])]]);
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const first=readMaterialHistory();assert.equal(first.length,2);assert.deepEqual(readMaterialHistory(),first);
 delete globalThis.localStorage;
});
test('A1/A2 corpus does not silently shrink requested length or repeat completed material',()=>{
 assert.equal(selectTextbookMaterials({lang:'Dutch',level:'A2',wordRange:[77,173]}).length,0);
 const initial=selectTextbookMaterials({lang:'Dutch',level:'A2',wordRange:[34,81],count:20});assert(initial.length>0);
 let history=[];for(const m of initial)history=recordMaterial(history,m,'completed');
 assert.equal(selectTextbookMaterials({lang:'Dutch',level:'A2',history,wordRange:[34,81]}).length,0);
});
test('B1/B2 use AI directly; no corpus/sample fallback when unavailable',async()=>{
 for(const level of ['B1','B2']){
  const ai=mockAI();const deps=dependencies(ai);
  const result=await generateDutchMaterials({level,spec,count:1},deps);
  assert.equal(result.materials.length,1);assert.equal(result.materials[0].resultSource,'ai');assert.equal(ai.generations,1);
  const unavailable=await generateDutchMaterials({level,spec},{...deps,enabled:false});assert.equal(unavailable.materials.length,0);assert.equal(unavailable.errors[0].code,'ai_unavailable');
 }
});
test('failed difficulty assessment receives at most one repair',async()=>{
 const ai=mockAI({badFirst:true});const result=await generateDutchMaterials({level:'B2',spec,count:1},dependencies(ai));
 assert.equal(ai.generations,2);assert.equal(result.materials.length,1);
 const bad=mockAI({alwaysBad:true});const rejected=await generateDutchMaterials({level:'B2',spec,count:1},dependencies(bad));
 assert.equal(bad.generations,2);assert.equal(rejected.materials.length,0);
});
test('AI repeats are rejected even when generator ignores history',async()=>{
 const ai=mockAI();const history=recordMaterial([],story,'completed');
 const result=await generateDutchMaterials({level:'B2',spec,count:1,history},dependencies(ai));
 assert.equal(result.materials.length,0);assert.equal(ai.generations,2);assert.equal(ai.checks,0);
});
test('generation transport failures do not fall back or start difficulty repairs',async()=>{
 let calls=0;const ai={complete:async()=>{calls++;throw new Error('network')}};
 const result=await generateDutchMaterials({level:'B2',spec,count:1},dependencies(ai));
 assert.equal(result.materials.length,0);assert.equal(result.errors[0].code,'generation_failed');assert.equal(calls,1);
});
test('independent assessment must have evidence and match requested difficulty',()=>{
 assert(!validateGeneratedMaterial(story.text,'B2',review(story,{evidence:'invented unrelated quotation'})).ok);
 assert(!validateGeneratedMaterial(story.text,'B2',review(story,{tier:'comfortable'})).ok);
 assert(validateGeneratedMaterial(story.text,'B2',review(story,{tier:'comfortable'}),'comfortable').ok);
});
test('lesson API and local import preparation use exactly the same selected chunk',async()=>{
 const text=Array.from({length:40},(_,i)=>`Paragraaf ${i}. Vandaag ga ik naar school en daarna naar huis. Ik lees daar een boek en drink thee.`).join('\n\n');
 const expected=prepareImport(text,{level:'A2',targetMin:null});
 const response=await buildLesson(new Request('http://local/api/lesson',{method:'POST',body:JSON.stringify({text,lang:'Dutch',level:'A2'})}));
 assert.equal(response.status,200);const lesson=await response.json();
 assert.equal(lesson.text,expected.text);assert.equal(lesson.material.id,materialId(expected.text));assert.equal(lesson.importChunkId,expected.selectedChunkId);
 assert.equal(lesson.sourceDocument.originalText,text);assert(lesson.sents.join(' ').length<text.length);
});
test('generated materials bypass long-document splitting and retain validated metadata',async()=>{
 const material={id:materialId(story.text),validatedTextLevel:'B2',difficultyTier:'balanced',targetUserLevel:'B2'};
 const response=await buildLesson(new Request('http://local/api/lesson',{method:'POST',body:JSON.stringify({text:story.text,lang:'Dutch',level:'B2',material})}));
 const lesson=await response.json();assert.equal(lesson.text,story.text);assert.equal(lesson.sourceDocument,undefined);assert.equal(lesson.material.validatedTextLevel,'B2');
});


test('subtitle text immediately before the next timeline is preserved',()=>{
 const input='00:00:01.000 --> 00:00:02.000\nIk lees een boek.\n00:00:02.000 --> 00:00:03.000\nDaarna drink ik thee.';
 assert.equal(cleanText(input),'Ik lees een boek.\nDaarna drink ik thee.');
});
