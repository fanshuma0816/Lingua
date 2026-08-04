"use client";
import { useState, useEffect, useRef } from "react";



const DB={ get(k,d){try{return JSON.parse(localStorage.getItem("lingua:"+k))??d}catch(e){return d}},
  set(k,v){localStorage.setItem("lingua:"+k,JSON.stringify(v))},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x))} };

const LANG_CODE={Spanish:"es-ES",French:"fr-FR",German:"de-DE",Italian:"it-IT",Portuguese:"pt-PT",
  Dutch:"nl-NL",English:"en-US",Japanese:"ja-JP",Korean:"ko-KR","Mandarin Chinese":"zh-CN",Arabic:"ar-SA",Russian:"ru-RU"};
const TTS_OK=typeof window!=="undefined" && "speechSynthesis" in window;
// High-quality AI voice via /api/tts, with the browser voice as fallback.
// ttsMode caches the outcome so we don't re-probe the API on every click.
let ttsMode=null;            // null=unknown, "api", "browser"
let activeHandle=null;
function browserSpeak(handle,text,lang,rate){
  if(!("speechSynthesis" in window)){ if(handle.onend)handle.onend(); return; }
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance((text||"").slice(0,4500)); u.lang=LANG_CODE[lang]||"en-US"; u.rate=rate;
  u.onend=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); };
  handle._synth=true; window.speechSynthesis.speak(u);
}
function speak(text,lang,rate=1){
  stopSpeak();
  const handle={_cancelled:false,onend:null};
  activeHandle=handle;
  if(ttsMode==="browser"){ browserSpeak(handle,text,lang,rate); return handle; }
  (async()=>{
    try{
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:(text||"").slice(0,4000),lang,rate})});
      if(res.ok && (res.headers.get("content-type")||"").includes("audio")){
        ttsMode="api";
        const url=URL.createObjectURL(await res.blob());
        if(handle._cancelled){ URL.revokeObjectURL(url); return; }
        const a=new Audio(url); handle._audio=a;
        a.onended=()=>{ URL.revokeObjectURL(url); if(!handle._cancelled&&handle.onend)handle.onend(); };
        try{ await a.play(); }catch(e){ if(!handle._cancelled) browserSpeak(handle,text,lang,rate); }
        return;
      }
      ttsMode="browser";
    }catch(e){ /* network/route error → fall back */ }
    if(!handle._cancelled) browserSpeak(handle,text,lang,rate);
  })();
  return handle;
}
function stopSpeak(){
  if(activeHandle){ activeHandle._cancelled=true; if(activeHandle._audio){ try{activeHandle._audio.pause();}catch(e){} } activeHandle=null; }
  if(typeof window!=="undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function cleanText(raw){ let t=raw||"";
  t=t.replace(/\[(music|applause|laughter|inaudible|crosstalk|silence)\]/gi," ");
  t=t.replace(/\d{1,2}:\d{2}(:\d{2})?(\.\d+)?/g," ");
  t=t.replace(/^\s*\d+\s*$/gm," ").replace(/-->/g," ")
   .replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n");
  return t.trim(); }

/* ---------- MOCK AI (swap for real OpenAI later) ---------- */
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
  let t=text.replace(/\s*[•·▪‣◦]\s*/g,"\n");
  const primary=new RegExp("(?<!\\b(?:"+ABBR+")\\.)(?<=[.!?…。！？])\\s+(?=[\\p{Lu}\"“'(\\[])|\\s*[;；]\\s+(?=[\\p{Lu}])|\\s*\\n+\\s*","u");
  const secondary=/(?<=[\p{Ll})\]])(?<!\b\p{Lu}[\p{Ll}à-ÿ]{2,})\s+(?=[\p{Lu}][\p{Ll}à-ÿ]{3,}\b(?!\s+[\p{Lu}]))/u;
  const MAX=110,out=[];
  for(let p of t.split(primary)){
    if(p==null) continue;
    p=p.replace(/\s+/g," ").trim(); if(!p) continue;
    if(p.length>MAX) p.split(secondary).forEach(x=>{x=x.trim();if(x)out.push(x);});
    else out.push(p);
  }
  const merged=[];
  for(const s of out){ if(s.length<10&&merged.length) merged[merged.length-1]+=" "+s; else merged.push(s); }
  return merged.filter(s=>s.length>3);
}
function contextFor(word,sents){ const s=sents.find(x=>x.toLowerCase().includes(word.toLowerCase())); return s||null; }
function expressionsInSentence(s){ const ws=words(s); const out=[]; for(let i=0;i<ws.length-1;i++){ const a=ws[i],b=ws[i+1];
  if(a.length>3&&b.length>3&&!STOP.has(a)&&!STOP.has(b)){ out.push(a+" "+b); } } return out.slice(0,2); }
const POS=["noun","verb","adjective","adverb","phrase"];
const LEVELS=["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate","C1 — Advanced"];
function levelIdx(l){ const p=(l||"").slice(0,2); return Math.max(0,LEVELS.findIndex(x=>x.startsWith(p))); }
function recommendLevel(text,sents){ const ws=words(text); if(!ws.length) return LEVELS[1];
  const avgLen=ws.reduce((a,w)=>a+w.length,0)/ws.length; const avgSent=ws.length/(sents.length||1);
  const score=avgLen+avgSent*0.4;
  if(score<7)return LEVELS[0]; if(score<8.5)return LEVELS[1]; if(score<10)return LEVELS[2]; if(score<12)return LEVELS[3]; return LEVELS[4]; }

const TOPIC_KEYWORDS={
  Technology:["technology","computer","software","internet","digital","data","robot","device","online","machine","algorithm","artificial","intelligence"],
  Environment:["climate","energy","environment","solar","renewable","carbon","pollution","nature","planet","sustainable","emissions","wind","ecosystem","forest"],
  Health:["health","medical","doctor","disease","brain","mental","exercise","diet","patient","medicine","wellness","sleep","body"],
  Business:["business","company","market","money","economy","finance","invest","startup","customer","profit","trade","price","industry"],
  Travel:["travel","country","city","trip","journey","flight","hotel","tourist","abroad","destination","adventure"],
  Food:["food","cook","recipe","meal","restaurant","kitchen","taste","dish","ingredient","dinner","flavour"],
  Education:["school","student","learn","teacher","study","education","university","class","knowledge","course","exam"],
  Sports:["game","team","player","sport","match","football","soccer","score","training","athlete","championship"],
  Science:["science","research","experiment","scientist","theory","discovery","space","physics","biology","chemistry","universe"],
  Culture:["music","film","book","story","history","culture","tradition","festival","artist","painting","poem"],
  Society:["people","society","community","government","social","public","policy","politics","rights","citizen"],
};
function inferTopics(text){ const ws=words(text); const wl=ws.join(" ");
  const scored=Object.entries(TOPIC_KEYWORDS).map(([k,list])=>[k,list.reduce((a,w)=>a+(wl.includes(w)?1:0),0)]).filter(x=>x[1]>0);
  scored.sort((a,b)=>b[1]-a[1]);
  if(scored.length) return scored.slice(0,3).map(x=>x[0]);
  return pickVocab(text,2).map(w=>w.replace(/^./,c=>c.toUpperCase())); }

function altered(sentence,pool){ const toks=sentence.split(/(\s+)/);
  const idxs=toks.map((t,i)=>({t,i})).filter(o=>/[\p{L}]{4,}/u.test(o.t));
  if(!idxs.length)return sentence+" (variant)";
  const pick=idxs[Math.floor(Math.random()*idxs.length)];
  const rep=pool[Math.floor(Math.random()*pool.length)]||"different";
  const clone=[...toks]; clone[pick.i]=rep; return clone.join(""); }
function quizItems(sents,pool,count){ const items=[]; const used=new Set(); const pickable=sents.filter(s=>s.length<160);
  for(let k=0;k<count&&pickable.length;k++){ let ci; do{ci=Math.floor(Math.random()*pickable.length);}while(used.has(ci)&&used.size<pickable.length);
    used.add(ci); const correct=pickable[ci]; const opts=[{t:correct,ok:true}]; let g=0;
    while(opts.length<4&&g++<20){ const d=altered(correct,pool); if(d!==correct&&!opts.some(o=>o.t===d)) opts.push({t:d,ok:false}); }
    for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
    items.push({correct,options:opts}); } return items; }

function generateLesson(text,lang,level,goal){ const chars=text.length; const sents=sentencesOf(text);
  const vocabCount=Math.min(16,Math.max(8,Math.round(chars/150)));
  const vlist=pickVocab(text,vocabCount);
  const vocab=vlist.map((w,i)=>({word:w.replace(/^./,c=>c.toUpperCase()),pos:POS[i%POS.length],context:contextFor(w,sents)}));
  const recommended=recommendLevel(text,sents);
  return { lang,level,goal,charCount:chars,sents,vocab,vocabCount,vlist,recommended,
    topics:inferTopics(text),
    diff:Math.max(1,Math.min(5,3+(levelIdx(recommended)-levelIdx(level)))),
    grammarFocus:["Common tenses used in the passage","Word order & sentence position","Connective & opinion phrases"],
    comprehension:quizItems([...sents].sort((a,b)=>a.split(/\s+/).length-b.split(/\s+/).length),vlist,3),
    recognition:quizItems(sents,vlist,3) }; }

/* ---------- flow + Delft teaching notes ---------- */
const STEPS=[
  {phase:"Learning",title:"Listen",min:3},
  {phase:"Learning",title:"Watch · your language",min:3},
  {phase:"Learning",title:"Listen & Read",min:3},
  {phase:"Testing",title:"Comprehension check",min:3},
  {phase:"Grammar & Vocabulary",title:"Grammar & Vocabulary",min:7},
  {phase:"Testing",title:"Sentence recognition",min:3},
  {phase:"Practicing",title:"Practice · with subtitles",min:5},
  {phase:"Practicing",title:"Practice · no subtitles",min:5},
  {phase:"Practicing",title:"Understand everything",min:3},
  {phase:"Using",title:"Practice with AI",min:6},
];
const TOTAL_MIN=STEPS.reduce((a,s)=>a+s.min,0);
/* collapsed plan blocks (grammar kept as its own block) */
const PLAN_BLOCKS=[
  {name:"Learning",icon:"🎧",items:["Listen","Watch in your language","Listen & read"],min:9},
  {name:"Grammar & Vocabulary",icon:"🔍",items:["Sentence-by-sentence study"],min:7},
  {name:"Testing",icon:"✅",items:["Comprehension check","Sentence recognition"],min:6},
  {name:"Practicing",icon:"🗣️",items:["With subtitles","No subtitles","Understand everything"],min:13},
  {name:"Using",icon:"💬",items:["Write & talk with AI"],min:6},
];

/* ---------- shared ---------- */
function Loading(){
  const steps=["📖 Reading your text…","✂️ Splitting it into sentences…","🌍 Translating each line…","🔑 Finding the key words…","✍️ Writing fresh examples…","❓ Preparing your quiz…","✨ Almost ready…"];
  const [i,setI]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setI(x=>Math.min(x+1,steps.length-1)),3200); return ()=>clearInterval(t); },[]);
  return (<div className="center" style={{textAlign:"center"}}>
    <div className="tface pulse" style={{margin:"0 auto 18px",width:56,height:56,fontSize:28}}>📖</div>
    <div style={{fontWeight:600,fontSize:18}}>Building your lesson…</div>
    <div className="muted" style={{marginTop:10,minHeight:22,fontSize:15}}>{steps[i]}</div>
    <div className="track" style={{maxWidth:280,margin:"18px auto 0"}}><span style={{width:((i+1)/steps.length*100)+"%",transition:"width .6s ease"}}/></div>
    <div className="tiny muted" style={{marginTop:16,maxWidth:340,marginLeft:"auto",marginRight:"auto",lineHeight:1.6}}>
      A real AI is translating your text and writing the lesson — this usually takes <b>20–40 seconds</b>. Thanks for your patience! 💛
    </div>
  </div>);
}
const Brand=()=>(<div className="brand"><div className="logo">L</div>Lingua</div>);
const Stat=({k,v})=>(<div className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>);
function Stars({n}){ return <span>{[1,2,3,4,5].map(i=><span key={i} className={"star"+(i<=n?"":" off")}>★</span>)}</span>; }
function Teacher({children}){ return <div className="teacher"><div className="tface">👩‍🏫</div><div className="tmsg">{children}</div></div>; }
function Purpose({children}){ return <div className="purpose">{children}</div>; }
function CheckIn({children}){ return <div className="checkin"><span>💛</span><span>{children}</span></div>; }

function FullPlayer({text,lang,label,sub}){
  const [playing,setPlaying]=useState(false); const [rate,setRate]=useState(1);
  useEffect(()=>()=>stopSpeak(),[]);
  function toggle(){ if(playing){stopSpeak();setPlaying(false);return;} const u=speak(text,lang,rate); if(u){u.onend=()=>setPlaying(false);setPlaying(true);} }
  function setR(r){ setRate(r); if(playing){const u=speak(text,lang,r); if(u)u.onend=()=>setPlaying(false);} }
  return (<div className="player">
    <button className="playbtn" onClick={toggle}>{playing?"❚❚":"▶"}</button>
    <div style={{flex:1}}><div style={{fontWeight:600}}>{label||"Full source audio"}</div>
      <div className="tiny muted">{TTS_OK?(sub||"Full-source read-aloud"):"Audio not supported in this browser"}</div></div>
    <div className="row" style={{gap:6}}>{[0.75,1,1.25].map(r=><button key={r} className={"rate"+(rate===r?" on":"")} onClick={()=>setR(r)}>{r}×</button>)}
      <button className="sbtn" title="restart" onClick={()=>setR(rate)}>↺</button></div>
  </div>);
}
function Say({text,lang,rate=1}){ return <button className="sbtn" title="play" onClick={()=>speak(text,lang,rate)}>▶</button>; }

function SyncReader({items,lang,translation,rate=1,gap=0}){
  const [active,setActive]=useState(-1); const [playing,setPlaying]=useState(false); const stop=useRef(false);
  useEffect(()=>()=>{stop.current=true;stopSpeak();},[]);
  function playFrom(i){ if(stop.current||i>=items.length){setPlaying(false);setActive(-1);return;}
    setActive(i); const u=speak(items[i].s,lang,rate); if(!u){setPlaying(false);return;}
    u.onend=()=>{ if(!stop.current) setTimeout(()=>{ if(!stop.current) playFrom(i+1); }, gap); }; }
  function playAll(){ stop.current=false; setPlaying(true); playFrom(0); }
  function halt(){ stop.current=true; stopSpeak(); setPlaying(false); setActive(-1); }
  function one(i){ stop.current=true; stopSpeak(); setActive(i); const u=speak(items[i].s,lang,rate); if(u)u.onend=()=>setActive(-1); }
  return (<div>
    <div className="row" style={{marginBottom:12}}>
      <button className="btn btn-primary btn-sm" onClick={playing?halt:playAll}>{playing?"❚❚ Stop":"▶ Play all · read along"}</button>
      <span className="tiny muted">Each line lights up as it's read · tap any line to replay</span>
    </div>
    <div className="card card-p">
      {items.map((it,i)=>(<div key={i} className={"sline"+(active===i?" on":"")} onClick={()=>one(i)} style={{marginBottom:translation?6:2}}>
        <div style={{fontWeight:500}}>{it.s}</div>
        {translation && <div className="tiny muted" style={{marginTop:2}}>{it.tr?("→ "+it.tr):"→ add an OpenAI key to show the real translation here"}</div>}
      </div>))}
    </div>
  </div>);
}

function Quiz({items,lang,audio}){
  const [ans,setAns]=useState({});
  return (<div>{items.map((q,qi)=>{ const chosen=ans[qi];
    return (<div key={qi} className="card card-p" style={{marginBottom:14}}>
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontWeight:600}}>{q.q?q.q:(audio?`Which sentence did you hear?`:`Which sentence matches the text?`)}</div>
        {audio && <button className="btn btn-outline btn-sm" onClick={()=>speak(q.correct,lang)}>▶ Play</button>}</div>
      {q.options.map((o,oi)=>{ let cls="opt"; if(chosen!=null){if(o.ok)cls+=" correct";else if(oi===chosen)cls+=" wrong";}
        return (<div key={oi} className={cls} onClick={()=>chosen==null&&setAns({...ans,[qi]:oi})}>
          <span className="mk">{chosen!=null&&o.ok?"✓":chosen===oi?"✕":String.fromCharCode(65+oi)}</span><span>{o.t}</span></div>); })}
      {chosen!=null && <div className="tiny muted" style={{marginTop:4}}>{q.options[chosen].ok?"Nice — that's right. 🎉":"Not quite — the highlighted one is it. Try replaying above."}</div>}
    </div>); })}</div>);
}
function SelfRate({value,onChange,prompt}){
  return (<div><div style={{fontWeight:600,marginBottom:12}}>{prompt}</div>
    <input type="range" min="0" max="100" step="5" value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%"}}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:6}}>
      <span className="tiny muted">0% · nothing yet</span><span className="badge">{value}%</span><span className="tiny muted">100% · all of it</span></div></div>);
}

/* ---------- login / input / preview ---------- */
function Login({onDone}){ const [email,setEmail]=useState(DB.get("email","")); const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (<div className="center">
    <div style={{textAlign:"center",marginBottom:24}}><div style={{display:"inline-flex"}}><Brand/></div></div>
    <div className="card card-p"><h1 style={{fontSize:21}}>Learn any language through content you love</h1>
      <p className="sub" style={{marginBottom:18}}>Paste a text, transcript, or article excerpt, and it becomes a complete guided learning session.</p>
      <label className="fld">Email</label>
      <input className="input" value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
      <button className="btn btn-primary" style={{width:"100%",marginTop:14}} disabled={!ok} onClick={()=>{DB.set("email",email);onDone(email);}}>Continue</button>
      <p className="tiny muted" style={{textAlign:"center",marginTop:14}}>No password needed for this test build. Your learning stays on this device.</p></div>
  </div>);
}
const LANGS=Object.keys(LANG_CODE).sort();
const GOALS=["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"];

function InputScreen({onNext}){
  const [raw,setRaw]=useState(DB.get("draft","")); const cleaned=cleanText(raw); const count=cleaned.length; const LIMIT=2000; const over=count>LIMIT;
  const [lang,setLang]=useState(DB.get("lang","")); const [level,setLevel]=useState(DB.get("level",LEVELS[1])); const [goal,setGoal]=useState(DB.get("goal",GOALS[0]));
  const fileRef=useRef(null);
  function onFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setRaw(String(r.result));r.readAsText(f);}
  const ready=count>40&&!over&&lang;
  return (<div>
    <h1>Bring your material</h1><p className="sub">Paste text, or upload a .txt file. Best results: 1,000–3,000 characters with normal punctuation.</p>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <label className="fld" style={{margin:0}}>Your text</label>
        <button className="btn btn-outline btn-sm" onClick={()=>fileRef.current.click()}>Upload .txt</button>
        <input ref={fileRef} type="file" accept=".txt,.md" onChange={onFile} style={{display:"none"}}/></div>
      <textarea style={{minHeight:220}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste an article, podcast transcript, newsletter excerpt, dialogue…"/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">Timestamps, [Music] tags and extra breaks are cleaned automatically.</span>
        <span className="tiny" style={{fontWeight:600,color:over?"hsl(0 72% 45%)":"hsl(var(--muted-foreground))"}}>{count.toLocaleString()} / {LIMIT.toLocaleString()} chars</span></div>
    </div>
    <div className="grid3" style={{marginTop:16}}>
      <div><label className="fld">Target language *</label><select value={lang} onChange={e=>setLang(e.target.value)}><option value="">Select…</option>{LANGS.map(l=><option key={l}>{l}</option>)}</select></div>
      <div><label className="fld">Your current level</label><select value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
      <div><label className="fld">Session goal</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map(l=><option key={l}>{l}</option>)}</select></div>
    </div>
    {over && <p className="tiny" style={{color:"hsl(0 72% 45%)",marginTop:12}}>Over the 2,000-character free limit — trim your text a little.</p>}
    {!lang && <p className="tiny muted" style={{marginTop:12}}>Choose your target language to continue.</p>}
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
      <button className="btn btn-primary" disabled={!ready} onClick={()=>{DB.set("draft",raw);DB.set("lang",lang);DB.set("level",level);DB.set("goal",goal);onNext({text:cleaned,lang,level,goal});}}>Analyze text →</button>
    </div>
  </div>);
}

function Preview({lesson,onStart,onBack}){
  const heavy=lesson.vocabCount>12;
  const diffLabel=["","Comfortable review","An easy read","Right at your level","A gentle stretch","Challenging"][lesson.diff];
  return (<div>
    <h1>Here's your text</h1><p className="sub">A quick read on your material before we begin.</p>
    <div className="row wrap" style={{gap:7,marginBottom:16}}>
      <span className="tiny muted" style={{fontWeight:600}}>Topics:</span>
      {lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}
    </div>
    <div className="grid4" style={{marginBottom:14}}>
      <Stat k="Recommended level" v={lesson.recommended.split(" — ")[0]}/>
      <Stat k="Estimated time" v={`~${TOTAL_MIN} min`}/>
      <Stat k="Vocabulary" v={lesson.vocabCount+" words"}/>
      <Stat k="Characters" v={lesson.charCount.toLocaleString()}/>
    </div>
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div><div className="stat-k" style={{fontSize:11,fontWeight:600,color:"hsl(var(--muted-foreground))",textTransform:"uppercase",letterSpacing:".05em"}}>Difficulty for you</div>
          <div style={{marginTop:5}}><Stars n={lesson.diff}/> <span style={{fontWeight:600,marginLeft:6}}>{diffLabel}</span></div></div>
        <div className="tiny muted" style={{textAlign:"right",maxWidth:230}}>Based on your level ({lesson.level.split(" — ")[0]}) vs the text's ({lesson.recommended.split(" — ")[0]}).</div>
      </div>
    </div>
    <div className="card card-p">
      <h3 className="lbl">The session · {STEPS.length} steps in {PLAN_BLOCKS.length} blocks</h3>
      {PLAN_BLOCKS.map(b=>(<div className="plan-row" key={b.name}>
        <span className="row" style={{gap:11}}><span style={{fontSize:18}}>{b.icon}</span>
          <span><div style={{fontWeight:600}}>{b.name}</div><div className="tiny muted">{b.items.join(" · ")}</div></span></span>
        <span className="tiny muted">~{b.min} min</span></div>))}
      <div className="ref">
        The flow follows the <b>Delft Method</b> (Delftse methode), a research-based approach to language learning developed at Delft University of Technology: understand a text first, absorb its high-frequency words and grammar in context, then move to conversation.<br/>
        Sources: Montens, F. &amp; Sciarone, A. G., <i>Nederlands voor buitenlanders: de Delftse methode</i> (Boom); TU Delft Centre for Languages, “About the Delftse methode.”
      </div>
    </div>
    {heavy && <div className="checkin" style={{marginTop:16,background:"hsl(var(--warm)/.08)",borderColor:"hsl(var(--warm)/.3)"}}><span>💡</span>
      <span>This one has <b>{lesson.vocabCount} new words</b> — quite a few. For it to really stick, try each block <b>at least twice</b>, and don't be shy about repeating an earlier step if it feels heavy.</span></div>}
    <div className="row" style={{justifyContent:"space-between",marginTop:22}}>
      <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      <button className="btn btn-primary" onClick={onStart}>Start · ~{TOTAL_MIN} min →</button></div>
  </div>);
}

/* ---------- lesson shell ---------- */
const GATED=new Set([4,9]);
function Lesson({lesson,text,onFinish}){
  const [step,setStep]=useState(DB.get("progress",0));
  const [gateOpen,setGateOpen]=useState(!GATED.has(DB.get("progress",0)));
  useEffect(()=>{DB.set("progress",step);stopSpeak();window.scrollTo({top:0,behavior:"smooth"});},[step]);
  function go(ns){ setGateOpen(!GATED.has(ns)); setStep(ns); }
  const S=STEPS[step]; const pct=Math.round(((step+1)/STEPS.length)*100);
  const locked=GATED.has(step)&&!gateOpen;
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta"><span className="tiny muted">{S.phase} · Step {step+1} of {STEPS.length}</span>
        <span className="tiny muted">~{S.min} min</span></div>
    </div>
    <div className="stage"><StepBody step={step} lesson={lesson} text={text} onComplete={()=>setGateOpen(true)}/></div>
    <div className="footnav">
      <button className="btn btn-ghost btn-sm" disabled={step===0} onClick={()=>go(Math.max(0,step-1))}>← Previous</button>
      {step<STEPS.length-1 ? <button className="btn btn-outline btn-sm" disabled={locked} onClick={()=>go(step+1)}>Continue →</button>
        : <button className="btn btn-primary btn-sm" disabled={locked} onClick={onFinish}>Finish ✓</button>}
    </div>
    {locked && <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{step===4?"Work through each sentence to unlock Continue.":"Get feedback in Part 1 and finish the Part 2 chat to unlock Finish."}</div>}
    <div style={{textAlign:"center",marginTop:16}}><button className="btn btn-ghost btn-sm muted" onClick={onFinish}>Exit session</button></div>
  </div>);
}

function StepBody({step,lesson,text,onComplete}){
  const {lang}=lesson; const sents=lesson.sents;
  const [before,setBefore]=useState(DB.get("selfBefore",30));

  if(step===0) return (<div>
    <div className="eyebrow">Learning</div><h2>Listen</h2>
    <Teacher>Let's just listen first. 🎧 Play it once and let it wash over you — no need to catch every word.</Teacher>
    <Purpose>The Delft Method starts the way you learned your first language: ears before rules. This builds your feel for the sound and rhythm.</Purpose>
    <FullPlayer text={text} lang={lang} label="Complete material" sub="Full audio · no subtitles"/>
    <div className="card card-p" style={{marginTop:18}}>
      <SelfRate value={before} prompt="Before we dig in — how much can you understand right now?" onChange={v=>{setBefore(v);DB.set("selfBefore",v);}}/></div>
    <CheckIn>Caught the mood or a few words? Perfect — that's all we need here. We'll check your growth at the end.</CheckIn>
  </div>);

  if(step===1) return (<div>
    <div className="eyebrow">Learning</div><h2>Watch · in your language</h2>
    <Teacher>Now let's make sense of it. 👀 Play along and read the meaning in a language you already know.</Teacher>
    <Purpose>Delft gives you the translation up front, so the text makes sense before you study it — no guessing, no frustration.</Purpose>
    <SyncReader items={(lesson.watch&&lesson.watch.length?lesson.watch:sents.slice(0,10).map(s=>({s})))} lang={lang} translation={true}/>
    <CheckIn>Does the story make sense now? If a line still feels murky, tap it again — take your time.</CheckIn>
  </div>);

  if(step===2) return (<div>
    <div className="eyebrow">Learning</div><h2>Listen &amp; Read</h2>
    <Teacher>Let's connect sound to spelling. 🔊 Read along in {lang} while you listen.</Teacher>
    <Purpose>Hearing and seeing the words together helps them stick — using the same kind of recordings Delft learners rely on.</Purpose>
    <SyncReader items={sents.slice(0,12).map(s=>({s}))} lang={lang} translation={false} rate={0.75} gap={1500}/>
    <CheckIn>Following along comfortably? Lovely. If not, replay a line or two before we move on.</CheckIn>
  </div>);

  if(step===3) return (<div>
    <div className="eyebrow">Testing</div><h2>Comprehension check</h2>
    <Teacher>Quick check — no pressure at all. ✅ Pick the sentence that matches what you read.</Teacher>
    <Purpose>Delft checks understanding after every text. It's not a test of you — it just tells us if you're ready to go deeper.</Purpose>
    <Quiz items={lesson.comprehension} lang={lang} audio={false}/>
    <CheckIn>Got them? Wonderful. Missed one? Pop back to “Listen &amp; Read” — that's exactly how it's meant to work.</CheckIn>
  </div>);

  if(step===4) return <GrammarStep lesson={lesson} onComplete={onComplete}/>;

  if(step===5) return (<div>
    <div className="eyebrow">Testing</div><h2>Sentence recognition</h2>
    <Teacher>Trust your ears. 👂 Play each line, then choose the sentence you heard.</Teacher>
    <Purpose>A short listening check, Delft-style, to sharpen how you catch spoken language.</Purpose>
    <Quiz items={lesson.recognition} lang={lang} audio={true}/>
    <CheckIn>Nailing these? Great ear. A few tricky? Replay and try once more — no rush.</CheckIn>
  </div>);

  if(step===6) return <TimedPractice sents={sents} lang={lang} withSubs={true}/>;
  if(step===7) return <TimedPractice sents={sents} lang={lang} withSubs={false}/>;

  if(step===8) return (<div>
    <div className="eyebrow">Practicing</div><h2>Understand everything</h2>
    <Teacher>One last full listen. 🌟 Play it through with {lang} text — it should feel clear now.</Teacher>
    <Purpose>Delft builds up to full comprehension before you speak. Notice how much more you catch than at the very start.</Purpose>
    <SyncReader items={sents.slice(0,12).map(s=>({s}))} lang={lang} translation={false}/>
    <CheckIn>Feels clearer than the first time? That's your progress showing. 🎉</CheckIn>
  </div>);

  return <PracticeAI lesson={lesson} onComplete={onComplete}/>;
}

/* ---------- step 5 grammar: one sentence at a time, then a summary card ---------- */
function GrammarStep({lesson,onComplete}){
  const {lang,sents,vocab,vlist,level,recommended}=lesson;
  const N=Math.min(6,sents.length);
  const [gi,setGi]=useState(0); const [view,setView]=useState("study"); // study | summary
  useEffect(()=>{ if(gi>=N-1 && onComplete) onComplete(); },[gi,N]);
  const vset=new Set(vlist);
  const vmap=Object.fromEntries((vocab||[]).map(v=>[v.word.toLowerCase(),v]));
  const depth=levelIdx(recommended)-levelIdx(level); // >0 harder for the learner
  function keyWordsIn(s){ const ws=[...new Set(words(s))]; return ws.filter(w=>vset.has(w)||w.length>6).slice(0,4); }
  function usageNote(w){
    if(depth>=1) return `New for your level — here it works as a ${POS[w.length%POS.length]}. Once the AI is connected you'll get the exact meaning; for now, notice how it's used in the sentence below and try saying it in your own example.`;
    if(depth<=-1) return `A quick refresher — you likely know this one. See how it behaves in this sentence.`;
    return `Here it means what it does in this context. Notice its part of speech and where it sits in the sentence.`;
  }
  const s=sents[gi]||""; const kw=keyWordsIn(s); const phrases=expressionsInSentence(s);

  if(view==="summary") return (<div>
    <div className="eyebrow">Grammar &amp; Vocabulary</div><h2>Let's pull it together</h2>
    <Teacher>Great work going through each sentence. 🌱 Here's everything in one place to lock it in.</Teacher>
    <div className="card card-p" style={{marginBottom:14}}>
      <h3 className="lbl">All key vocabulary</h3>
      <div className="row wrap" style={{gap:7,marginBottom:16}}>{vocab.map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
      <h3 className="lbl">Grammar patterns you met</h3>
      <ul className="clean">{lesson.grammarFocus.map((g,i)=><li key={i}>{g}</li>)}</ul>
    </div>
    <CheckIn>Feeling shaky on a sentence? No problem — head back to Sentence 1 and walk through again. Repetition is the whole idea.</CheckIn>
    <div style={{marginTop:14}}><button className="btn btn-outline btn-sm" onClick={()=>{setGi(0);setView("study");}}>↩ Review from Sentence 1</button></div>
  </div>);

  return (<div>
    <div className="eyebrow">Grammar &amp; Vocabulary</div><h2>Under the microscope</h2>
    <Teacher>Let's slow right down — one sentence at a time. 🔍 We'll unpack the words and phrases together, like a teacher sitting beside you.</Teacher>
    <Purpose>Delft teaches grammar through real examples from your own text — no rules or jargon — so you pick up patterns you can actually reuse.</Purpose>

    <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
      <span className="badge badge-outline">Sentence {gi+1} of {N}</span>
      <div className="track" style={{width:160}}><span style={{width:((gi+1)/N*100)+"%"}}/></div>
    </div>

    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:16}}>{s}</span><Say text={s} lang={lang} rate={0.75}/></div>

      <h3 className="lbl">Vocabulary</h3>
      {kw.length?kw.map((w,j)=>{ const e=vmap[w.toLowerCase()]; return (<div className="wcard" key={j}>
        <div className="row" style={{justifyContent:"space-between"}}>
          <span className="row" style={{gap:9}}><b style={{fontSize:15}}>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
          <Say text={w} lang={lang} rate={0.75}/></div>
        <div className="tiny muted" style={{margin:"7px 0"}}>💡 {e&&e.meaning ? e.meaning : usageNote(w)}</div>
        <div className="tiny" style={{fontStyle:"italic",marginTop:2}}>{e&&e.example ? ("📝 Example: “"+e.example+"”") : "📝 A fresh example sentence using this word appears once an OpenAI key is added — a practical new sentence, not copied from your text."}</div>
      </div>); }):<div className="tiny muted">No standout new words in this sentence — enjoy the breather. 🙂</div>}

      {phrases.length>0 && (<><h3 className="lbl" style={{marginTop:16}}>Phrases &amp; collocations</h3>
        {phrases.map((p,j)=>(<div className="wcard" key={j}>
          <div className="row" style={{justifyContent:"space-between"}}><b>{p}</b><Say text={p} lang={lang} rate={0.75}/></div>
          <div className="tiny muted" style={{marginTop:6}}>A natural pairing worth keeping together. Try reusing it in a sentence of your own. (Full explanation once the AI is connected.)</div>
        </div>))}</>)}

      <div className="tiny muted" style={{marginTop:14}}><b>Word order:</b> notice how this sentence is built — that structure repeats across the text. (AI breakdown simulated in this test build.)</div>
    </div>

    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={gi===0} onClick={()=>setGi(g=>g-1)}>← Previous sentence</button>
      {gi<N-1 ? <button className="btn btn-outline btn-sm" onClick={()=>setGi(g=>g+1)}>Next sentence →</button>
        : <button className="btn btn-primary btn-sm" onClick={()=>setView("summary")}>See summary →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>Take it slow — just this one sentence for now.</div>
  </div>);
}

/* ---------- steps 6 & 7 timed practice with a ready-buffer ---------- */
function TimedPractice({sents,lang,withSubs}){
  const list=sents.slice(0,8);
  const [started,setStarted]=useState(false);
  const [idx,setIdx]=useState(0);
  const [phase,setPhase]=useState("listen"); // listen | speak | done
  const [left,setLeft]=useState(0); const [paused,setPaused]=useState(false);
  const [reveal,setReveal]=useState(withSubs); const [nonce,setNonce]=useState(0);
  const cur=list[idx]||"";
  const secs=Math.min(12,Math.max(4,Math.round(cur.split(/\s+/).filter(Boolean).length*0.9)));

  useEffect(()=>{ if(!started) return; if(idx>=list.length){setPhase("done");return;}
    setReveal(withSubs); setPhase("listen"); stopSpeak(); let done=false;
    const wc=cur.split(/\s+/).filter(Boolean).length; const dur=Math.max(1900,wc*620+1000);
    const u=speak(cur,lang,0.75);
    const to=setTimeout(()=>{if(!done){done=true;setPhase("speak");setLeft(secs);}},dur);
    if(u)u.onend=()=>{if(!done){done=true;clearTimeout(to);setPhase("speak");setLeft(secs);}};
    return ()=>{done=true;clearTimeout(to);stopSpeak();};
  },[idx,nonce,started]);

  useEffect(()=>{ if(!started||phase!=="speak"||paused)return;
    if(left<=0){ if(idx<list.length-1)setIdx(idx+1); else setPhase("done"); return; }
    const t=setTimeout(()=>setLeft(l=>l-1),1000); return ()=>clearTimeout(t);
  },[phase,left,paused,idx,started]);

  const head=(<><div className="eyebrow">Practicing</div><h2>Practice · {withSubs?"with subtitles":"no subtitles"}</h2></>);

  if(!started) return (<div>{head}
    <Teacher>{withSubs
      ? <>Time to speak. 🗣️ I'll play each line, then it's your turn to read it aloud before the gentle timer moves you on.</>
      : <>Ears only now. 🎧 I'll play each line — you repeat it from memory. Reveal the text only if you need to peek.</>}</Teacher>
    <Purpose>Speaking sentences straight from your text is how Delft gets you conversing — you practise exactly what you'll be able to say.</Purpose>
    <div className="card card-p" style={{marginBottom:16}}>
      <div style={{fontWeight:500,marginBottom:6}}>How this works</div>
      <ul className="clean tiny muted"><li>One sentence fills the screen — just focus on that.</li>
        <li>Listen, then read aloud during the countdown.</li>
        <li>It auto-advances, but ← Back, Replay and Pause are always there.</li></ul>
    </div>
    <button className="btn btn-primary" onClick={()=>{setStarted(true);setIdx(0);setNonce(n=>n+1);}}>▶ I'm ready — start</button>
    <div className="tiny muted" style={{marginTop:10}}>Take a breath first — it won't start until you press the button.</div>
  </div>);

  if(phase==="done") return (<div>{head}
    <div className="card bigcard"><div style={{fontSize:34}}>✓</div>
      <div className="bigsent" style={{fontSize:18}}>You practised all {list.length} sentences. 🎉 Press Continue when you're ready.</div>
      <button className="btn btn-outline btn-sm" onClick={()=>{setIdx(0);setNonce(n=>n+1);}}>↺ Practise again</button></div>
    <CheckIn>Said each one out loud? That's exactly it. Another round never hurts.</CheckIn>
  </div>);

  return (<div>{head}
    <div className="card bigcard">
      <div className="row" style={{gap:8}}><span className="badge badge-outline">{idx+1} / {list.length}</span>
        <span className="phaselab" style={{color:phase==="speak"?"hsl(var(--success))":"hsl(var(--muted-foreground))"}}>{phase==="listen"?"🎧 Listen":"🗣️ Your turn — read aloud"}</span></div>
      {(withSubs||reveal) ? <div className="bigsent">{cur}</div> : <div className="bigsent muted" style={{opacity:.4}}>• • •</div>}
      {phase==="speak" && <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <div className="timerbar"><span style={{width:(left/secs*100)+"%"}}/></div><div className="count">{left}s</div></div>}
      {!withSubs && <button className="btn btn-outline btn-sm" onClick={()=>setReveal(r=>!r)}>{reveal?"Hide text":"Reveal text"}</button>}
    </div>
    <div className="row" style={{justifyContent:"center",gap:8,marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={()=>{stopSpeak();setIdx(i=>Math.max(0,i-1));}}>← Back</button>
      <button className="btn btn-outline btn-sm" onClick={()=>setNonce(n=>n+1)}>▶ Replay</button>
      <button className="btn btn-outline btn-sm" onClick={()=>setPaused(p=>!p)}>{paused?"Resume":"Pause"}</button>
      <button className="btn btn-ghost btn-sm" onClick={()=>{stopSpeak(); if(idx<list.length-1)setIdx(i=>i+1); else setPhase("done");}}>Skip →</button>
    </div>
  </div>);
}

/* ---------- step 10 Practice with AI: tabbed Part 1 / Part 2 ---------- */
function PracticeAI({lesson,onComplete}){
  const [tab,setTab]=useState("write");
  const [wrote,setWrote]=useState(false); const [talked,setTalked]=useState(false);
  useEffect(()=>{ if(wrote&&talked&&onComplete) onComplete(); },[wrote,talked]);
  return (<div>
    <div className="eyebrow">Using</div><h2>Practice with AI</h2>
    <Teacher>Let's actually use it. 💬 First write a little, then have a short chat — all with today's words.</Teacher>
    <Purpose>Delft conversations use only words and sentences from your text, so you can communicate with confidence from the very first try.</Purpose>
    <div className="tabs">
      <button className={"tab"+(tab==="write"?" on":"")} onClick={()=>setTab("write")}>Part 1 · Write {wrote?"✓":""}</button>
      <button className={"tab"+(tab==="chat"?" on":"")} onClick={()=>{stopSpeak();setTab("chat");}}>Part 2 · Talk {talked?"✓":""}</button>
    </div>
    {tab==="write" ? <AIWrite lesson={lesson} onNext={()=>setTab("chat")} onDone={()=>setWrote(true)}/> : <AIChat lesson={lesson} onDone={()=>setTalked(true)}/>}
    <div className="tiny muted" style={{marginTop:12}}>Finish unlocks once you've got feedback in Part 1 and completed the Part 2 chat.</div>
  </div>);
}
function AIWrite({lesson,onNext,onDone}){
  const {lang,level,vocab,sents}=lesson;
  const topic=(sents[0]||"the topic").replace(/[.!?。！？]+$/,"");
  const question=`Based on the passage — "${topic.length>90?topic.slice(0,90)+"…":topic}" — what's your view? Write 3–4 sentences in ${lang} using today's words.`;
  const [textv,setTextv]=useState(DB.get("aiPractice","")); const [fb,setFb]=useState(null); // null | "loading" | {real} | "mock"
  useEffect(()=>DB.set("aiPractice",textv),[textv]);
  async function getFeedback(){
    setFb("loading"); onDone&&onDone();
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"feedback",lang,level,question,text:textv.trim()})});
      if(!r.ok) throw new Error("no api");
      const d=await r.json(); setFb(d);
    }catch(e){ setFb("mock"); }
  }
  const real=fb && fb!=="loading" && fb!=="mock";
  return (<div>
    <div className="row wrap" style={{gap:7,marginBottom:14}}>{vocab.slice(0,8).map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
    <div className="card card-p" style={{marginBottom:14}}><div className="row" style={{gap:10}}>
      <div className="tface">👩‍🏫</div><div style={{fontWeight:500}}>{question}</div></div></div>
    <textarea style={{minHeight:130}} value={textv} onChange={e=>setTextv(e.target.value)} placeholder={"Write your answer in "+lang+"…"}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
      <span className="tiny muted">{textv.trim().split(/\s+/).filter(Boolean).length} words · saved locally</span>
      <button className="btn btn-primary btn-sm" disabled={textv.trim().length<12||fb==="loading"} onClick={getFeedback}>{fb==="loading"?"Reading…":"Get feedback"}</button></div>
    {fb==="loading" && <div className="card card-p" style={{marginTop:16}} ><span className="muted">✍️ Your teacher is reading your writing…</span></div>}
    {(real||fb==="mock") && (<div className="card card-p" style={{marginTop:16}}>
      <h3 className="lbl">Feedback &amp; suggested revision{real?"":" · simulated"}</h3>
      {real ? (<>
        <div style={{marginBottom:8}}>✅ <b>Grammar.</b> <span className="muted">{fb.grammar}</span></div>
        <div style={{marginBottom:8}}>✅ <b>Vocabulary.</b> <span className="muted">{fb.vocabulary}</span></div>
        <div style={{marginBottom:8}}>✅ <b>Sentence construction.</b> <span className="muted">{fb.sentence}</span></div>
        {fb.revision && <div style={{marginTop:10}}><b>Suggested revision:</b><div className="card card-p" style={{marginTop:6,background:"hsl(var(--secondary))"}}>{fb.revision}</div></div>}
      </>) : (<>
        <div style={{marginBottom:8}}>✅ <b>Grammar.</b> <span className="muted">Tenses look consistent. Check subject–verb agreement in your longer sentence.</span></div>
        <div style={{marginBottom:8}}>✅ <b>Vocabulary.</b> <span className="muted">Nice reuse of today's words — add one connective phrase to link ideas.</span></div>
        <div style={{marginBottom:8}}>✅ <b>Sentence construction.</b> <span className="muted">Clear structure. Try varying sentence length to sound more natural.</span></div>
        <div className="tiny muted" style={{marginTop:8}}>This is the simulated version — add an OpenAI key for real, specific feedback and a corrected draft.</div>
      </>)}
      <div style={{marginTop:14}}><button className="btn btn-primary btn-sm" onClick={onNext}>Next · talk with the AI →</button></div>
    </div>)}
  </div>);
}

function AIChat({lesson,onDone}){
  const {lang,level,vocab}=lesson;
  const vwords=vocab.slice(0,6).map(v=>v.word);
  const script=[`Hi! Let's chat about what you read. In ${lang}, tell me one thing you found interesting.`,
    `Good! Now try using the word "${vwords[0]||"it"}" in a full sentence.`,
    `Nice. Last one — give me your opinion in a complete sentence.`];
  const [msgs,setMsgs]=useState([]);           // {who:"ai"|"me", t}
  const [draft,setDraft]=useState(""); const [busy,setBusy]=useState(false);
  const [turns,setTurns]=useState(0); const [done,setDone]=useState(false); const [evalz,setEvalz]=useState(null);
  const mockRef=useRef(false);
  const MAX_TURNS=3;

  async function aiReply(history){
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"chat",lang,level,vocab:vwords,history})});
      if(!r.ok) throw new Error("no api"); const d=await r.json(); return d.reply||null;
    }catch(e){ return null; }
  }
  // opening line: try the model, else fall back to the script
  useEffect(()=>{ (async()=>{
    setBusy(true);
    const reply=await aiReply([]);
    if(reply){ mockRef.current=false; setMsgs([{who:"ai",t:reply}]); speak(reply,lang); }
    else { mockRef.current=true; setMsgs([{who:"ai",t:script[0]}]); speak(script[0],lang); }
    setBusy(false);
  })(); return ()=>stopSpeak(); },[]);

  const full=draft.trim().split(/\s+/).filter(Boolean).length>=4;
  function toHistory(list){ return list.map(m=>({role:m.who==="ai"?"assistant":"user",content:m.t})); }

  async function finish(list){
    setDone(true); onDone&&onDone();
    if(mockRef.current) return;
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"evaluate",lang,level,history:toHistory(list)})});
      if(r.ok) setEvalz(await r.json());
    }catch(e){}
  }

  async function send(){
    if(!full||busy) return;
    const withMe=[...msgs,{who:"me",t:draft.trim()}]; const nx=turns+1;
    setMsgs(withMe); setDraft(""); setTurns(nx);
    if(nx>=MAX_TURNS){ finish(withMe); return; }
    if(mockRef.current){ const line=script[nx]||script[script.length-1]; setMsgs([...withMe,{who:"ai",t:line}]); speak(line,lang); return; }
    setBusy(true);
    const reply=await aiReply(toHistory(withMe));
    const line=reply||"👍"; setMsgs([...withMe,{who:"ai",t:line}]); if(reply) speak(reply,lang);
    setBusy(false);
  }

  return (<div>
    <div className="tiny muted" style={{marginBottom:12}}>Your AI partner speaks each line aloud (tap ▶ to hear again). Reply with at least one complete sentence in {lang}.{mockRef.current?" · (simulated — add an OpenAI key for a live partner)":""}</div>
    <div className="card card-p">
      <div className="chat">{msgs.map((m,i)=>(<div key={i} className={"bubble "+m.who}>{m.t}
        {m.who==="ai" && <button className="sbtn" style={{marginLeft:8,verticalAlign:"middle"}} onClick={()=>speak(m.t,lang)}>▶</button>}</div>))}
        {busy && <div className="bubble ai muted">…</div>}</div>
      {!done ? (<div style={{marginTop:14}}>
        <textarea style={{minHeight:64}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={"Reply in "+lang+" — at least one full sentence…"}/>
        <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
          <span className="tiny muted">{full?"Looks like a full sentence ✓":"Write at least a complete sentence (4+ words)"}</span>
          <button className="btn btn-primary btn-sm" disabled={!full||busy} onClick={send}>Send</button></div>
      </div>) : (<div className="card card-p" style={{marginTop:14,background:"hsl(var(--secondary))"}}>
        <h3 className="lbl">Conversation feedback{evalz?"":" · simulated"}</h3>
        {evalz ? (<div>
          <div style={{marginBottom:8}}>🎉 {evalz.praise}</div>
          <div style={{marginBottom:6}}>✅ <b>Grammar.</b> <span className="muted">{evalz.grammar}</span></div>
          <div style={{marginBottom:6}}>✅ <b>Vocabulary.</b> <span className="muted">{evalz.vocabulary}</span></div>
          <div>✅ <b>Fluency.</b> <span className="muted">{evalz.fluency}</span></div>
        </div>) : (<div className="muted">You held a short exchange and used today's words in full sentences — exactly the goal. 🎉 Add an OpenAI key for a live AI voice partner that replies in {lang} and gives specific feedback.</div>)}
      </div>)}
    </div>
  </div>);
}

/* ---------- celebration ---------- */
function Done({lesson,onNew,onReview}){
  const name=(DB.get("email","")||"").split("@")[0]||"friend";
  const before=DB.get("selfBefore",30);
  const [after,setAfter]=useState(DB.get("selfAfter",null)); const [tmp,setTmp]=useState(70);
  const delta=after!=null?after-before:0;
  return (<div>
    <div className="celebrate">
      <div style={{fontSize:52,lineHeight:1}}>🎉</div>
      <h1 style={{marginTop:10}}>You did it, {name}! 👏</h1>
      <p className="sub" style={{maxWidth:470,margin:"8px auto 0"}}>You stayed with it through all {STEPS.length} steps of the full Delft cycle. Showing up and finishing is the hard part — and you just did. 🌟</p>
    </div>

    <div className="card card-p" style={{margin:"18px 0",background:"hsl(var(--warm)/.07)",borderColor:"hsl(var(--warm)/.25)",textAlign:"center"}}>
      <div style={{fontSize:26}}>📚✨</div>
      <div style={{fontWeight:600,marginTop:6}}>Today you explored {lesson.topics.slice(0,2).join(" & ")}</div>
      <div className="row wrap" style={{gap:7,justifyContent:"center",marginTop:10}}>{lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}</div>
      <div className="tiny muted" style={{marginTop:10}}>Bring a few more texts and we'll start to see which topics you love most — and where you spend your time. 💛</div>
    </div>

    <div className="grid4" style={{marginBottom:18}}>
      <Stat k="🏁 Steps" v={STEPS.length+" / "+STEPS.length}/>
      <Stat k="📖 Words" v={lesson.vocabCount}/>
      <Stat k="🗣️ Sentences" v={Math.min(8,lesson.sents.length)}/>
      <Stat k="🧩 Blocks" v={PLAN_BLOCKS.length}/>
    </div>

    <div className="card card-p" style={{marginBottom:18}}>
      <h3 className="lbl">📈 Your comprehension · before vs after</h3>
      {after==null ? (<div>
        <SelfRate value={tmp} prompt="One more time — how much can you understand now?" onChange={setTmp}/>
        <div style={{marginTop:14}}><button className="btn btn-outline btn-sm" onClick={()=>{setAfter(tmp);DB.set("selfAfter",tmp);}}>Reveal my progress ✨</button></div>
      </div>) : (<div>
        <div style={{marginBottom:12}}>
          <div className="row" style={{justifyContent:"space-between",marginBottom:5}}><span className="tiny muted">Before</span><span className="tiny" style={{fontWeight:600}}>{before}%</span></div>
          <div className="gbar"><span className="before" style={{width:before+"%"}}/></div></div>
        <div>
          <div className="row" style={{justifyContent:"space-between",marginBottom:5}}><span className="tiny muted">After</span><span className="tiny" style={{fontWeight:600}}>{after}%</span></div>
          <div className="gbar"><span className="after" style={{width:after+"%"}}/></div></div>
        <div style={{textAlign:"center",marginTop:14}}>
          {delta>0 ? <span className="badge badge-success" style={{fontSize:14,padding:"6px 14px"}}>▲ +{delta}% understanding — look at you go! 🚀</span>
            : <span className="badge" style={{fontSize:14,padding:"6px 14px"}}>A second pass will lift this — you've got it 💪</span>}
        </div>
      </div>)}
    </div>

    <div className="card card-p" style={{marginBottom:20}}>
      <h3 className="lbl">🎒 What you're taking with you</h3>
      <div className="row wrap" style={{gap:7}}>{lesson.vocab.map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
    </div>

    <div className="row" style={{justifyContent:"center",gap:10}}>
      <button className="btn btn-outline" onClick={onReview}>↺ Review this lesson</button>
      <button className="btn btn-primary" onClick={onNew}>Bring new material →</button>
    </div>
  </div>);
}

/* ---------- root ---------- */
function App(){
  const [screen,setScreen]=useState(DB.get("email")?"input":"login");
  const [lesson,setLesson]=useState(null); const [text,setText]=useState("");
  async function loadLesson(d){ setText(d.text); DB.set("progress",0); DB.set("selfAfter",null); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=await r.json(); setLesson(L); setScreen("preview"); }
    catch(e){ setLesson(generateLesson(d.text,d.lang,d.level,d.goal)); setScreen("preview"); } }
  function clearAll(){ if(confirm("Clear all local learning data (draft, notes, ratings, progress)?")){DB.clearAll();location.reload();} }
  return (<div className="app">
    {screen!=="login" && screen!=="lesson" && (<div className="topbar"><Brand/>
      <div className="row"><button className="btn btn-ghost btn-sm muted" onClick={clearAll}>Clear local data</button>
        {screen!=="input" && <button className="btn btn-outline btn-sm" onClick={()=>setScreen("input")}>New material</button>}</div></div>)}
    {screen==="login" && <Login onDone={()=>setScreen("input")}/>}
    {screen==="loading" && <Loading/>}
    {screen==="input" && <InputScreen onNext={loadLesson}/>}
    {screen==="preview" && lesson && <Preview lesson={lesson} onBack={()=>setScreen("input")} onStart={()=>setScreen("lesson")}/>}
    {screen==="lesson" && lesson && <Lesson lesson={lesson} text={text} onFinish={()=>setScreen("done")}/>}
    {screen==="done" && lesson && <Done lesson={lesson} onNew={()=>setScreen("input")} onReview={()=>{DB.set("progress",0);setScreen("lesson");}}/>}
  </div>);
}
export default function Page(){ return <App/>; }
