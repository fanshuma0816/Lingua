// Bundle with esbuild --bundle --platform=node --format=esm, then run node --test on the output.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { importMaterials } from "../scripts/corpus/import-materials.mjs";
import { splitCorpusArticle } from "../lib/text-chunks.js";
import { selectTextbookMaterials } from "../lib/material-corpus.js";
import { generateDutchMaterials } from "../lib/material-validation.js";
import { recordMaterial,isRepeated } from "../lib/material-history.js";
import { POST as buildLesson } from "../app/api/lesson/route.js";

const articles=JSON.parse(fs.readFileSync('data/corpus/a1-a2-materials.json','utf8'));
const ranges=[[34,81],[77,173]];
test('39 source articles retain explicit user levels and source order',()=>{
 assert.equal(articles.length,39);assert.equal(articles.filter(a=>a.level==='A1').length,17);assert.equal(articles.filter(a=>a.level==='A2').length,22);
 assert(articles.slice(0,17).every(a=>a.level==='A1'));assert(articles.slice(17).every(a=>a.level==='A2'));
 assert.equal(new Set(articles.map(a=>a.id)).size,39);
 for(const [i,a]of articles.entries()){assert.equal(a.sourceOrder,i);assert.equal(a.levelSource,'user-curated');assert(a.originalText);assert(a.text);}
});
test('importer round-trips the preserved originals, records only explicit OCR corrections and is deterministic',()=>{
 const source='# A1-A2\n\n# A1\n\n'+articles.map((a,i)=>(i===17?'# A2\n\n':'')+'### '+a.originalTitle+'\n\n'+a.originalText+'\n\n').join('');
 const first=importMaterials(source,articles[0].sourceFile),second=importMaterials(source,articles[0].sourceFile);
 assert.deepEqual(first,second);
 for(let i=0;i<39;i++)for(const key of ['id','title','level','originalText','text','corrections','version'])assert.deepEqual(first[i][key],articles[i][key]);
 const intro=articles[0];assert(intro.originalText.includes('komt®'));assert(!intro.text.includes('komt®'));
 assert.throws(()=>importMaterials('# A1\n### Empty\n\n# A2'),/Empty article/);
 assert.throws(()=>importMaterials('# A1\n### One\nHello\n### One\nHello'),/Duplicate article/);
});
test('every chunk covers only its own source, with no lost characters or changed level',()=>{
 for(const article of articles)for(const wordRange of ranges){
  const chunks=splitCorpusArticle(article,{wordRange});
  assert.equal(chunks.map(c=>article.text.slice(c.sourceRange.start,c.sourceRange.end)).join(''),article.text);
  for(const c of chunks){assert.equal(c.level,article.level);assert.equal(c.sourceArticleId,article.id);assert.equal(c.text,article.text.slice(c.sourceRange.start,c.sourceRange.end).trim());}
 }
});
test('unlabelled questions stay with their first answer',()=>{
 const article={id:'dialogue',version:'v1',level:'A1',levelSource:'user-curated',text:'Ik ga naar huis. Waar woon je?\nIk woon in Delft. Wat doe je morgen?\nIk lees een boek.'};
 const chunks=splitCorpusArticle(article,{wordRange:[3,10]});
 assert(chunks.some(c=>c.text.includes('Waar woon je?\nIk woon in Delft.')));
 assert(chunks.some(c=>c.text.includes('Wat doe je morgen?\nIk lees een boek.')));
});
test('missing figures remain in the source but are excluded from standalone recommendations',()=>{
 let flagged=0;
 for(const a of articles)for(const c of splitCorpusArticle(a,{wordRange:[34,81]}))if(c.contextWarnings.length){flagged++;assert.equal(c.recommendable,false);}
 assert(flagged>0);
});
test('A1 and A2 both return two matching-level materials for both durations without AI',async()=>{
 for(const level of ['A1','A2'])for(const words of [[40,70],[90,150]]){
  const result=await generateDutchMaterials({level,count:2,spec:{words,label:words[0]===40?'10-15':'25-35',target:words[0]===40?12:30},seed:'no-ai'},
   {enabled:false,selectCorpus:selectTextbookMaterials,complete:()=>{throw new Error('AI must not run')},parse:JSON.parse});
  assert.equal(result.materials.length,2,JSON.stringify({level,words,result}));assert.deepEqual(result.errors,[]);
  for(const m of result.materials){assert.equal(m.level,level);assert.equal(m.validatedTextLevel,level);assert.equal(m.levelSource,'user-curated');}
 }
});
test('lexical estimates and comfortable preferences never override human grades',()=>{
 let mismatch=0;
 for(const level of ['A1','A2'])for(const difficulty of [undefined,'comfortable','balanced','stretch']){
  const pool=selectTextbookMaterials({lang:'Dutch',level,wordRange:[77,173],difficulty,count:100});
  assert(pool.length>=2);
  for(const m of pool){assert.equal(m.validatedTextLevel,level);if(m.estimatedTextLevel!==level)mismatch++;}
 }
 assert(mismatch>0);assert.deepEqual(selectTextbookMaterials({lang:'Dutch',level:'B1'}),[]);assert.deepEqual(selectTextbookMaterials({lang:'Dutch',level:'B2'}),[]);
});
test('switching duration cannot recommend overlapping source spans; unseen spans remain eligible',()=>{
 const source=articles[0];let history=[];
 const small=splitCorpusArticle(source,{wordRange:ranges[0]}).filter(c=>c.recommendable);
 assert(small.length>1);history=recordMaterial(history,{...small[0],title:source.title},'completed');
 const larger=splitCorpusArticle(source,{wordRange:ranges[1]});
 for(const c of larger){
  const overlap=Math.min(c.sourceRange.end,small[0].sourceRange.end)-Math.max(c.sourceRange.start,small[0].sourceRange.start);
  if(overlap>0)assert(isRepeated(c,history));
 }
 assert(small.slice(1).some(c=>!isRepeated(c,history)));
 assert.equal(history[0].sourceArticleId,source.id);assert.deepEqual(history[0].sourceRange,small[0].sourceRange);
});
test('successive recommendations stay novel and use different articles within one batch',()=>{
 let history=[];
 for(let i=0;i<10;i++){
  const batch=selectTextbookMaterials({lang:'Dutch',level:'A2',wordRange:ranges[i%2],history,count:2,seed:String(i)});
  assert.equal(batch.length,2);assert.notEqual(batch[0].sourceArticleId,batch[1].sourceArticleId);
  for(const m of batch){assert(!isRepeated(m,history));history=recordMaterial(history,m,'completed');}
 }
});
test('lesson API preserves human grade and source identity for learning/history',async()=>{
 const m=selectTextbookMaterials({lang:'Dutch',level:'A1',wordRange:ranges[1],count:1})[0];
 const result=await buildLesson(new Request('http://local/api/lesson',{method:'POST',body:JSON.stringify({text:m.text,lang:'Dutch',level:'A1',material:m})}));
 const lesson=await result.json();assert.equal(lesson.material.validatedTextLevel,'A1');assert.equal(lesson.material.sourceArticleId,m.sourceArticleId);
 assert.equal(lesson.material.levelSource,'user-curated');assert.deepEqual(lesson.material.sourceRange,m.sourceRange);
});


test('old content-based history does not exclude every new chunk with the same article title',()=>{
 const a=articles.find(x=>x.title==='De bank');
 const chunk=splitCorpusArticle(a,{wordRange:[34,81]}).find(c=>c.recommendable);
 const old={id:'old-short-version',title:a.title,text:chunk.text};
 const history=recordMaterial([],old,'completed');
 const result=selectTextbookMaterials({lang:'Dutch',level:'A1',wordRange:[34,81],count:100,history,avoid:[old.title,old.id]});
 const remaining=result.find(m=>m.sourceArticleId===a.id);
 assert(remaining);assert(!isRepeated(remaining,history));
});
