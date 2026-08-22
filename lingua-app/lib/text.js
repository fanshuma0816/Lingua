function meaningParts(e){
  if(!e) return {simple:null,detail:null};
  const raw=(e.meaning||"").trim();
  const simple=(e.simpleMeaning||e.simple||"").trim() || raw.split(/[—:.;,]/)[0].split(/\s+/).slice(0,3).join(" ");
  const detail=(e.detail||e.explanation||"").trim() || (raw && raw!==simple ? raw : "");
  return {simple:simple||null,detail:detail||null};
}

function grammarExamples(g){
  if(!g) return [];
  if(Array.isArray(g.examples)) return g.examples.map(x=>typeof x==="string"?{sentence:x,translation:""}:x).filter(x=>x&&x.sentence).slice(0,3);
  if(g.example) return [{sentence:g.example,translation:g.translation||""}];
  return [];
}

function cleanText(raw){ let t=String(raw||"").normalize("NFKC");
  t=t.replace(/[\uFFFD\u200B-\u200D\uFEFF]/g,"");
  t=t.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
  t=t.replace(/[“”„]/g,'"').replace(/[‘’‚]/g,"'").replace(/[‐‑‒–—―]/g,"-");
  t=t.replace(/^\s*WEBVTT[^\n]*$/gim," ");
  t=t.replace(/^\s*(kind:\s*captions|language:\s*\w+|subscribe|like and subscribe|advertentie|reclame)\s*$/gim," ");
  t=t.replace(/\[(music|muziek|applause|applaus|laughter|gelach|inaudible|onverstaanbaar|crosstalk|silence)\]/gi," ");
  t=t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*(?:-->|-\s*>|→)\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g," ");
  t=t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g," ");
  t=t.replace(/^\s*\d+\s*$/gm," ").replace(/-->/g," ");
  t=t.replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/giu,"$1$2");
  t=t.replace(/[ \t]*\n[ \t]*/g,"\n").replace(/[ \t]{2,}/g," ");
  t=t.replace(/\s+([,.;:!?])/g,"$1").replace(/([¿¡])\s+/g,"$1");
  t=t.replace(/([!?]){3,}/g,"$1$1").replace(/([,;:]){2,}/g,"$1").replace(/\.{4,}/g,"...");
  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    if(out.length && !/[.!?。！？:;]$/.test(out[out.length-1]) && /^[\p{Ll}'"]/u.test(line)) out[out.length-1]+=" "+line;
    else out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g,"\n\n").trim(); }

const STOP=new Set(("the a an and or but of to in on for with at by from as is are was were be been being this that these those it its i you he she we they my your our their not no so if then than into about over under out up down el la los las de que y a en un una por con para se su lo le les des du le la un une et ou de à dans pour qui ne pas ce cette der die das und ist im den").split(" "));

function words(text){return (text.toLowerCase().match(/[\p{L}][\p{L}'’-]{2,}/gu)||[]);}

function pickVocab(text,n){ const ws=words(text); const freq={};
  ws.forEach(w=>{if(!STOP.has(w)&&w.length>3)freq[w]=(freq[w]||0)+1;});
  const uniq=[...new Set(ws)].filter(w=>!STOP.has(w)&&w.length>3);
  uniq.sort((a,b)=>(b.length+(freq[b]||0))-(a.length+(freq[a]||0)));
  return uniq.slice(0,n); }

const ABBR="Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|e\\.g|i\\.e|bijv|enz|nr|resp|approx|no|No|Inc|Ltd|Co";

function sentencesOf(text){
  if(!text) return [];
  let t=text.replace(/\s*[•·▪‣◦]\s*/g,"\n").replace(/\r/g,"\n");
  const out=[];
  const abbrRe=new RegExp("\\b(?:"+ABBR+")\\.$","i");
  let buf="",quote=null;
  const push=()=>{ const p=buf.replace(/\s+/g," ").trim(); if(p) out.push(p); buf=""; };
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    buf+=ch;
    if(ch==="\""||ch==="“"||ch==="”"){
      const closing=!!quote;
      quote=closing ? null : ch;
      if(closing && /[.!?…。！？]/u.test(t[i-1]||"") && /^\s+[A-ZÀ-ÖØ-Þ]/.test(t.slice(i+1))) push();
      continue;
    }
    if(ch==="\n"){ push(); quote=null; continue; }
    if(quote) continue;
    if(/[.!?…。！？]/u.test(ch)){
      const prev=buf.trim();
      if(ch==="."&&abbrRe.test(prev)) continue;
      const rest=t.slice(i+1);
      const m=rest.match(/^\s+([\s\S]?)/u);
      if(!m) continue;
      const next=m[1]||"";
      if(/[A-ZÀ-ÖØ-Þ"“'(\[]/.test(next)) push();
    }else if(/[;；]/u.test(ch)){
      const rest=t.slice(i+1);
      if(/^\s+[A-ZÀ-ÖØ-Þ]/.test(rest)) push();
    }
  }
  push();
  const merged=[];
  for(const s of out){ if(s.length<10&&merged.length) merged[merged.length-1]+=" "+s; else merged.push(s); }
  return merged.filter(s=>s.length>3);
}

function contextFor(word,sents){ const s=sents.find(x=>x.toLowerCase().includes(word.toLowerCase())); return s||null; }

function expressionsInSentence(s){ const ws=words(s); const out=[]; for(let i=0;i<ws.length-1;i++){ const a=ws[i],b=ws[i+1];
  if(a.length>3&&b.length>3&&!STOP.has(a)&&!STOP.has(b)){ out.push(a+" "+b); } } return out.slice(0,2); }

export { ABBR, STOP, cleanText, contextFor, expressionsInSentence, grammarExamples, meaningParts, pickVocab, sentencesOf, words };
