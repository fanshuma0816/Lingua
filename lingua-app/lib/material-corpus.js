import fs from "fs";
import path from "path";
import { analyzeDifficulty } from "./cefr.mjs";
import { splitCorpusArticle } from "./text-chunks.js";
import { isRepeated, recordMaterial } from "./material-history.js";

let corpusCache = null;
function loadCorpus() {
  if(!corpusCache) corpusCache=JSON.parse(fs.readFileSync(path.join(process.cwd(),"data","corpus","a1-a2-materials.json"),"utf8"));
  return corpusCache;
}
function seededRandom(seed) {
  let h=2166136261;
  for(const ch of String(seed||Date.now())){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return ()=>{h+=h<<13;h^=h>>>7;h+=h<<3;h^=h>>>17;h+=h<<5;return ((h>>>0)%1000000)/1000000;};
}
export function selectTextbookMaterials({lang,level,topics=[],avoid=[],history=[],difficulty,wordRange=[34,81],count=2,duration,targetMinutes,seed}) {
  const target=String(level||"").slice(0,2);
  if(lang!=="Dutch" || !["A1","A2"].includes(target))return [];
  const avoidSet=new Set(avoid.map(x=>String(x).toLowerCase()));
  const random=seededRandom(seed), preference={comfortable:0.10,balanced:0.18,stretch:0.26}[difficulty];
  const candidates=[];
  for(const article of loadCorpus()) {
    if(article.level!==target || article.levelSource!=="user-curated")continue;
    for(const chunk of splitCorpusArticle(article,{wordRange})) {
      if(!chunk.recommendable)continue;
      const analysis=analyzeDifficulty(chunk.text,target);
      candidates.push({...chunk,title:article.title,parts:[article.title],source:article.source,
        targetUserLevel:target,validatedTextLevel:article.level,estimatedTextLevel:analysis.validatedTextLevel,
        hardWordRatio:analysis.hardWordRatio,difficultyTier:analysis.difficultyTier,vocabularyAnnotations:analysis.annotations,
        duration,targetMinutes,resultSource:"textbook",corpusVersion:article.corpusVersion,
        topicScore:Number(!topics[0] || article.tags.includes(topics[0])),
        preferenceScore:preference===undefined?0:Math.abs(analysis.hardWordRatio-preference),random:random()});
    }
  }
  candidates.sort((a,b)=>b.topicScore-a.topicScore || a.preferenceScore-b.preferenceScore || a.random-b.random);
  const selected=[],articles=new Set();let working=history;
  for(const candidate of candidates) {
    if(selected.length>=count)break;
    if(articles.has(candidate.sourceArticleId) || avoidSet.has(candidate.id.toLowerCase()) || isRepeated(candidate,working))continue;
    // Legacy title exclusions apply only when there is no structured history for this title.
    const structured=history.some(r=>r?.sourceArticleId===candidate.sourceArticleId
      || !r?.legacy && String(r?.title||"").toLowerCase()===candidate.title.toLowerCase() && r?.shingles?.length);
    if(!structured && avoidSet.has(candidate.title.toLowerCase()))continue;
    const {topicScore,preferenceScore,random,...material}=candidate;
    selected.push(material);articles.add(material.sourceArticleId);working=recordMaterial(working,material);
  }
  return selected;
}
