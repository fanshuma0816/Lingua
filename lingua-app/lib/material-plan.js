import { MAX_DOCUMENT_CHARS, MIN_LEARNABLE_WORDS } from "../config/constants.js";
import { analyzeDifficulty, materialId } from "./cefr.mjs";
import { prepareImport } from "./text-chunks.js";
import { cleanText } from "./text.js";

function wordCount(text){ return (String(text||"").match(/[\p{L}\p{N}]+/gu)||[]).length; }

function estimateSegmentMinutes(segment, learnerLevel){
  const words=wordCount(segment?.text||segment);
  const rank={A1:0,A2:1,B1:2,B2:3,C1:4}[String(learnerLevel||"A2").slice(0,2)]??1;
  const base=Math.max(10,Math.round((8+words/(rank<2?7:9))/5)*5);
  return {min:Math.max(10,base-5),max:Math.min(60,base+5)};
}

function pageRangeFor(text,start,end,pageMap){
  if(!Array.isArray(pageMap)||!pageMap.length)return {pageStart:null,pageEnd:null};
  const hits=pageMap.filter(page=>page.end>start&&page.start<end);
  return {pageStart:hits[0]?.pageNumber||null,pageEnd:hits.at(-1)?.pageNumber||null};
}

function createMaterialPlan(rawText,{sourceType="pasted",displayName="My material",pageMap=[],level="A2 — Elementary",goal="General fluency",targetMin=30,fileSize=null,pageCount=null}={}){
  const original=String(rawText||"");
  if(original.length>MAX_DOCUMENT_CHARS)throw new Error("document_too_large");
  const cleanedText=cleanText(original);
  if(wordCount(cleanedText)<MIN_LEARNABLE_WORDS)throw new Error("not_enough_text");
  const prepared=prepareImport(cleanedText,{level,targetMin});
  const id=materialId(cleanedText);
  const segments=prepared.chunks.map((chunk,index)=>{
    const minutes=estimateSegmentMinutes(chunk,level);
    const pages=pageRangeFor(cleanedText,chunk.start,chunk.end,pageMap);
    const analysis=chunk.analysis||analyzeDifficulty(chunk.text,level);
    return {...chunk,localId:`${id}:${index}`,index,title:`Part ${index+1}`,...pages,
      estimatedMinutesMin:minutes.min,estimatedMinutesMax:minutes.max,
      materialLevel:analysis.validatedTextLevel,difficultyLabel:analysis.difficultyTier,status:"pending"};
  });
  return {localId:id,displayName:String(displayName||"My material").slice(0,180),sourceType,sourceHash:id,
    cleanedText,language:"Dutch",level,goal,targetMinutes:Number(targetMin)||30,
    originalCharCount:original.length,cleanedCharCount:cleanedText.length,fileSize,pageCount,
    segmentCount:segments.length,segments,planningVersion:1};
}

function materialStatus(segments){
  const list=Array.isArray(segments)?segments:[];
  if(list.length&&list.every(x=>x.status==="completed"))return "completed";
  if(list.some(x=>x.status!=="pending"))return "in_progress";
  return "pending";
}

export { createMaterialPlan, estimateSegmentMinutes, materialStatus, wordCount };
