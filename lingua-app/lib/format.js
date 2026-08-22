import { words } from "./text";

function progressPct(elapsed,estimate){ return Math.min(92,Math.max(12,Math.round((elapsed/Math.max(1,estimate))*100))); }

function fmtTime(sec){
  const s=Math.max(0,Math.round(sec||0)); const m=Math.floor(s/60); const r=String(s%60).padStart(2,"0");
  return `${m}:${r}`;
}

function scrollToTop(){
  if(typeof window==="undefined") return;
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));
}

function durationSpec(label){
  const nums=String(label||"").match(/\d+/g)?.map(Number)||[];
  // Full-lesson time is capped at 60 min, so no tier can exceed it.
  const min=Math.min(60,nums[0]||45), max=Math.min(60,nums[1]||min);
  let words=[140,240], vocab=[10,18];
  if(max<=15){ words=[40,70]; vocab=[4,6]; }
  else if(max<=35){ words=[90,150]; vocab=[7,12]; }
  return {min,max,target:Math.round((min+max)/2),words,vocab,label:`${min}-${max}`};
}

function clampToDuration(mins,label){
  const spec=durationSpec(label);
  return Math.max(spec.min,Math.min(spec.max,mins||spec.target));
}

function estimateAudioSeconds(text,rate=1){
  const wc=words(text||"").length;
  return Math.max(8,Math.round((wc/1.9)/(rate||1)));
}

function stableHash(input){
  const s=typeof input==="string"?input:JSON.stringify(input);
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(36);
}

function normalizePoint(s){ return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim(); }

function hasCjk(s){ return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(s||"")); }

function compactQuote(s,max=92){
  const clean=String(s||"").replace(/\s+/g," ").trim();
  return clean.length>max ? clean.slice(0,max).replace(/\s+\S*$/,"")+"…" : clean;
}

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

export { clamp, clampToDuration, compactQuote, durationSpec, estimateAudioSeconds, fmtTime, hasCjk, normalizePoint, progressPct, scrollToTop, stableHash };
