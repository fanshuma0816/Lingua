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

function cleanText(raw){
  let t=String(raw||"").normalize("NFKC").replace(/\r\n?/g,"\n");
  t=t.replace(/[\uFFFD\u200B-\u200D\uFEFF]/g,"");
  t=t.replace(/&(?:amp;)+/gi,"&").replace(/&nbsp;/gi," ").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
  t=t.replace(/[“”„]/g,'"').replace(/[‘’‚]/g,"'").replace(/[‐‑‒–—―]/g,"-");
  const timeline=/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?[^\n]*$/;
  const subtitle=/^\s*WEBVTT\b/m.test(t)||t.split("\n").some(line=>timeline.test(line));
  if(subtitle){
    const lines=t.split("\n"), cues=[]; let cue=[];
    const flush=()=>{ if(cue.length) cues.push(cue.join(" ").trim()); cue=[]; };
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(!line || timeline.test(line)){flush();continue;}
      if(/^WEBVTT\b|^(Kind|Language):/i.test(line)) continue;
      if(timeline.test((lines[i+1]||"").trim()) && (/^\d+$/.test(line)||i===0||!lines[i-1].trim())) continue; // cue identifier
      const content=line.replace(/<\/?(?:c(?:\.[\w-]+)?|v(?:\s+[^>]+)?|i|b|u)>/gi,"")
        .replace(/\[(music|muziek|applause|applaus|laughter|gelach|inaudible|onverstaanbaar|crosstalk|silence)\]/gi,"").trim();
      if(content) cue.push(content);
    }
    flush();
    const out=[];
    for(const value of cues){
      const previous=out[out.length-1]||"";
      if(value===previous) continue;
      if(previous && value.startsWith(previous+" ")){out[out.length-1]=value;continue;}
      // Remove only multiword overlap between adjacent rolling caption cues.
      const a=previous.split(/\s+/),b=value.split(/\s+/); let overlap=0;
      for(let n=Math.min(a.length,b.length);n>=3;n--){if(a.slice(-n).join(" ")===b.slice(0,n).join(" ")){overlap=n;break;}}
      const rest=b.slice(overlap).join(" "); if(rest) out.push(rest);
    }
    t=out.join("\n");
  }
  t=t.replace(/^\s{0,3}#{1,6}\s+/gm,"").replace(/^\s{0,3}>\s?/gm,"")
    .replace(/^\s*```[^\n]*$/gm,"").replace(/!\[([^\]]*)\]\([^\n)]*\)/g,"$1")
    .replace(/\[([^\]]+)\]\([^\n)]*\)/g,"$1")
    .replace(/\*\*([^*\n]+)\*\*/g,"$1").replace(/__([^_\n]+)__/g,"$1")
    .replace(/`([^`\n]+)`/g,"$1");
  return t.replace(/[ \t]+/g," ").replace(/ *\n */g,"\n")
    .replace(/\s+([,.;:!?])/g,"$1").replace(/\n{3,}/g,"\n\n").trim();
}

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
