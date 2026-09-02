"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { ArticleAudio } from "./Player";
import { CheckIn, Purpose, Say, StepHead, Svg, Teacher } from "../ui/elements";
import { LANG_CODE, PARTNER, POS, STEPS, SUPPORT_CHECKOUT_URL } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useElapsed } from "../../hooks/useElapsed";
import { useUI } from "../../hooks/useUI";
import { speak, stopSpeak } from "../../lib/audio";
import { displayWordInfo } from "../../lib/dutch";
import { normalizePoint, progressPct, scrollToTop } from "../../lib/format";
import { fallbackGrammarItems, practiceQuestion } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { STOP, grammarExamples, meaningParts, words } from "../../lib/text";
import { getLineTr, setLineTr } from "../../lib/trcache";
import { spokenTextForLine, voiceRoleForLine } from "../../lib/voices";
import { cachedAiAnalyze, chatFallback } from "../../services/api";

// Quick scan — the learner taps words they don't know straight in the text.
// All words look the same (no difficulty hints, no CEFR badges); the marked
// words are remembered and drive the Vocabulary & Grammar and Recall steps.
function QuickScan({lesson,text,onDone,onSkip,onBack}){
  const {t}=useUI();
  const src=(text&&text.trim())?text:((lesson.sents||[]).join("\n"));
  const parts=useMemo(()=>src.split(/([\p{L}][\p{L}'’-]*)/u),[src]);
  const isWord=(s)=>/^[\p{L}][\p{L}'’-]*$/u.test(s);
  const [marked,setMarked]=useState(()=>new Set((DB.get("unknownWords",[])||[]).map(w=>String(w).toLowerCase())));
  function toggle(w){ const k=w.toLowerCase(); setMarked(prev=>{ const n=new Set(prev); n.has(k)?n.delete(k):n.add(k); return n; }); }
  const count=marked.size;
  return (<div>
    <div className="step-head"><div className="step-head-main"><div className="eyebrow">{t.scan.eyebrow}</div><h2>{t.scan.title}</h2></div>
      <button className="btn btn-outline btn-sm step-skip focusable" onClick={onSkip}>{t.scan.skip}</button></div>
    <Teacher>{t.scan.teacher}</Teacher>
    <div className="card card-p" style={{marginBottom:14}}>
      <div style={{whiteSpace:"pre-wrap",lineHeight:2.05,fontSize:16,maxHeight:360,overflowY:"auto"}}>
        {parts.map((p,i)=> isWord(p)
          ? <span key={i} className="scanw" onClick={()=>toggle(p)}
              style={{cursor:"pointer",borderRadius:5,padding:"1px 2px",
                background:marked.has(p.toLowerCase())?"hsl(var(--primary)/.35)":"transparent",
                boxShadow:marked.has(p.toLowerCase())?"inset 0 -2px 0 hsl(var(--primary))":"none"}}>{p}</span>
          : <span key={i}>{p}</span>)}
      </div>
      <div className="tiny muted" style={{marginTop:12}}>{t.scan.hint}</div>
    </div>
    <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}>
      <div className="row" style={{gap:12}}>
        {onBack && <button className="btn btn-ghost btn-sm focusable" onClick={onBack}>{t.scan.reselect}</button>}
        <span className="tiny muted">{count?t.scan.marked(count):t.scan.none}</span>
      </div>
      <button className="btn btn-primary focusable" onClick={()=>onDone([...marked])}>{t.scan.done}</button>
    </div>
  </div>);
}

function GrammarStep({lesson,onComplete,onContinue,onSkip,onPrev}){
  const {t,uiLang}=useUI();
  const {lang,sents,vocab,vlist,level,recommended}=lesson;
  const N=sents.length;
  const [gi,setGi]=useState(0); const [view,setView]=useState("study"); // study | summary
  const [expl,setExpl]=useState({});     // word(lc) -> {meaning, example, pos} from AI
  const [loadingKw,setLoadingKw]=useState(false);
  const [trs,setTrs]=useState({});
  const [loadingTr,setLoadingTr]=useState(false);
  const [grammar,setGrammar]=useState({});
  const [loadingGrammar,setLoadingGrammar]=useState(false);
  const lookupElapsed=useElapsed(loadingKw);
  useEffect(()=>{ if(gi>=N-1 && onComplete) onComplete(); },[gi,N]);
  useEffect(()=>{ setTrs({}); setGrammar({}); },[uiLang]);
  const vmap=Object.fromEntries((vocab||[]).map(v=>[v.word.toLowerCase(),v]));
  // The learner's own marked words (from Quick scan) drive this step. If they
  // skipped Quick scan, fall back to salient words from their level and the text.
  const userWords=useMemo(()=>new Set(((lesson.userWords&&lesson.userWords.length?lesson.userWords:DB.get("unknownWords",[]))||[]).map(w=>String(w).toLowerCase())),[lesson.userWords]);
  function seenWordsBefore(index){ return new Set(sents.slice(0,index).flatMap(x=>words(x)).map(w=>w.toLowerCase())); }
  function keyWordsIn(s,index=gi){
    if(userWords.size){ const seen=new Set(),out=[];
      words(s).forEach(w=>{ const k=w.toLowerCase(); if(userWords.has(k)&&!seen.has(k)){seen.add(k); out.push(w);} });
      return out.slice(0,8);
    }
    const seen=seenWordsBefore(index);
    const ws=[...new Set(words(s))].filter(w=>w.length>3&&!STOP.has(w.toLowerCase())&&!seen.has(w.toLowerCase()));
    ws.sort((a,b)=>{
      const av=vmap[a.toLowerCase()]?20:0, bv=vmap[b.toLowerCase()]?20:0;
      return (bv+b.length)-(av+a.length);
    });
    return ws.slice(0,6);
  }
  // Translate the current sentence — reuse the cached translation from Understanding
  // (Learn 1) or a previous visit before ever calling the API.
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||"";
    const cached=(uiLang==="en" ? (lesson.watch||[]).find(x=>x.s===sen)?.tr : null) || getLineTr(uiLang,sen);
    if(cached){ setTrs(prev=>prev[gi]?prev:{...prev,[gi]:cached}); return; }
    if(trs[gi] || !sen){ setLoadingTr(false); return; }
    setLoadingTr(true);
    cachedAiAnalyze("translate",{sentences:[sen],lang,level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      const tr=d&&Array.isArray(d.translations)?d.translations[0]:null;
      if(tr){ setTrs(prev=>({...prev,[gi]:tr})); setLineTr(uiLang,sen,tr); }
    });
    return ()=>{cancel=true;};
  },[gi,uiLang,trs[gi]]);
  // Ask the AI to explain this sentence's key words in context (meaning + example).
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||""; const kws=keyWordsIn(sen,gi).filter(w=>!expl[w.toLowerCase()]);
    if(!kws.length){ setLoadingKw(false); return; }
    setLoadingKw(true);
    cachedAiAnalyze("explain",{lang,level,items:kws.map(w=>({word:w,context:sen})),explanationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingKw(false);
      if(d&&Array.isArray(d.items)){ setExpl(prev=>{ const n={...prev};
        d.items.forEach(it=>{ if(it&&it.word) n[String(it.word).toLowerCase()]={meaning:it.meaning||null,simpleMeaning:it.simpleMeaning||null,detail:it.detail||null,example:it.example||null,exampleTranslation:it.exampleTranslation||null,pos:it.pos||null}; });
        kws.forEach(w=>{ const k=w.toLowerCase(); if(!n[k]) n[k]={simpleMeaning:w,detail:null,example:null,pos:null}; });
        return n; }); }
      else setExpl(prev=>{ const n={...prev}; kws.forEach(w=>{ const k=w.toLowerCase(); if(!n[k]) n[k]={simpleMeaning:w,detail:null,example:null,pos:null}; }); return n; });
    });
    return ()=>{cancel=true;};
  },[gi,view]);
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||"";
    if(grammar[gi] || !sen){ setLoadingGrammar(false); return; }
    setLoadingGrammar(true);
    const covered=Object.values(grammar).flat().map(g=>g&&g.point).filter(Boolean);
    cachedAiAnalyze("grammar",{lang,level,sentence:sen,translation:trs[gi]||null,covered,feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingGrammar(false);
      const prior=new Set(Object.entries(grammar).filter(([k])=>Number(k)<gi).flatMap(([,items])=>(items||[]).map(g=>normalizePoint(g.point))));
      const raw=d&&Array.isArray(d.items)&&d.items.length?d.items:fallbackGrammarItems(sen,level,uiLang);
      const items=raw.filter(g=>!prior.has(normalizePoint(g.point))).slice(0,1);
      setGrammar(prev=>({...prev,[gi]:items}));
    });
    return ()=>{cancel=true;};
  },[gi,trs[gi],uiLang]);
  function usageNote(w){ return loadingKw ? t.lookingUpWord : t.studyUsage; }
  const s=sents[gi]||""; const tr=trs[gi]; const kw=keyWordsIn(s,gi); const grammarItems=grammar[gi]||fallbackGrammarItems(s,level,uiLang);
  const studyWords=(()=>{ const seen=new Set(), out=[];
    if(userWords.size){
      sents.slice(0,N).forEach((sen,i)=>keyWordsIn(sen,i).forEach(w=>{ const k=w.toLowerCase(); if(!seen.has(k)&&expl[k]){seen.add(k); out.push(w);} }));
      return out;
    }
    const focusWords=(lesson.focus&&Array.isArray(lesson.focus.vocab)?lesson.focus.vocab.map(x=>x.word).filter(Boolean):[]);
    focusWords.forEach(w=>{ const k=String(w).toLowerCase(); if(!seen.has(k)){seen.add(k); out.push(w);} });
    sents.slice(0,N).forEach((sen,i)=>keyWordsIn(sen,i).forEach(w=>{ const k=w.toLowerCase(); if(!seen.has(k)&&expl[k]){seen.add(k); out.push(w);} }));
    return out;
  })();
  const allGrammarItems=(()=>{ const seen=new Set(), out=[];
    sents.slice(0,N).forEach((sen,i)=>{
      const items=grammar[i]||fallbackGrammarItems(sen,level,uiLang);
      items.forEach(g=>{ const k=(g.point||"")+"|"+(g.explain||""); if(!seen.has(k)){seen.add(k); out.push(g);} });
    });
    return out;
  })();
  const lookupEstimate=Math.max(6,kw.length*2+2);
  const lookupRemaining=Math.max(1,lookupEstimate-lookupElapsed);

  if(view==="summary") return (<div>
    <StepHead eyebrow={t.nav.mods.vocabulary} title={t.gram.summaryTitle} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{t.gram.summaryTeacher}</Teacher>
    <div className="summary-stack">
      <ArticleAudio sents={sents} lang={lang}/>
      <h3 className="lbl">{t.gram.allVocab}</h3>
      {studyWords.map((w,j)=>{ const base=vmap[w.toLowerCase()]||vocab.find(v=>v.word.toLowerCase()===w.toLowerCase()); const e=displayWordInfo(w,lang,uiLang,base,expl[w.toLowerCase()]); const parts=meaningParts(e); return (
        <details className="summary-card" key={w}>
          <summary>
            <span className="row" style={{gap:9}}><b>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
            <span className="row" style={{gap:8}}><span className="meaning-simple inline">{parts.simple||w}</span><Say text={w} lang={lang}/></span>
          </summary>
          {parts.detail && <div className="summary-detail">{parts.detail}</div>}
          {e&&e.example && <div className="word-example">“{e.example}”</div>}
          {e&&e.example&&e.exampleTranslation && <div className="word-example-translation">→ {e.exampleTranslation}</div>}
        </details>
      ); })}
      <h3 className="lbl" style={{marginTop:16}}>{t.gram.patterns}</h3>
      {allGrammarItems.map((g,j)=><div className="grammar-card" key={j}>
        <b>{g.point||t.gram.wordOrder}</b>
        <p>{g.explain}</p>
        <div className="grammar-examples">
          {grammarExamples(g).map((ex,k)=><div className="grammar-example-row" key={k}>
            <div className="row" style={{justifyContent:"space-between",gap:8}}>
              <span className="grammar-example">{ex.sentence}</span>
            </div>
            {ex.translation && <div className="grammar-example-translation">→ {ex.translation}</div>}
          </div>)}
        </div>
      </div>)}
    </div>
    <CheckIn>{t.gram.summaryCheck}</CheckIn>
    <div className="row" style={{justifyContent:"space-between",marginTop:14}}><button className="btn btn-ghost btn-sm" onClick={()=>{setGi(0);setView("study");}}>↩ {t.gram.review}</button><button className="btn btn-primary btn-sm" onClick={onContinue}>{t.continue} →</button></div>
  </div>);

  return (<div>
    <StepHead eyebrow={t.nav.mods.vocabulary} title={t.gram.title} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{t.gram.teacher}</Teacher>
    <Purpose>{t.gram.purpose}</Purpose>

    <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
      <span className="badge badge-outline">{t.gram.sentence(gi+1,N)}</span>
      <div className="track" style={{width:160}}><span style={{width:((gi+1)/N*100)+"%"}}/></div>
    </div>

    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:16}}>{s}</span><Say text={s} lang={lang} rate={1} voiceRole={voiceRoleForLine(s,gi,sents)}/></div>
      <div className={"translation-line grammar-translation"+(!tr&&loadingTr?" loading":"")}>
        {tr?("→ "+tr):(loadingTr?`→ ${t.lineTranslating(gi+1,N)}`:`→ ${t.translationUnavailable}`)}
      </div>

      <h3 className="lbl">{t.vocabulary}</h3>
      {loadingKw && <div className="status-strip compact" style={{marginBottom:12}}>
        <div className="row" style={{justifyContent:"space-between",alignItems:"baseline"}}>
          <b>{t.lookingUpTitle}</b><span className="tiny muted">{t.aboutRemaining(lookupRemaining)}</span>
        </div>
        <div className="mini-track"><span style={{width:progressPct(lookupElapsed,lookupEstimate)+"%"}}/></div>
      </div>}
      {kw.length?kw.map((w,j)=>{ const e=displayWordInfo(w,lang,uiLang,vmap[w.toLowerCase()],expl[w.toLowerCase()]); const parts=meaningParts(e); return (<div className="wcard" key={j}>
        <div className="row" style={{justifyContent:"space-between"}}>
          <span className="row" style={{gap:9}}><b style={{fontSize:15}}>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
          <Say text={w} lang={lang} rate={1}/></div>
        {parts.simple ? (<div className="meaning-block">
          <div className="meaning-simple">{parts.simple}</div>
        </div>) : (<div className="meaning-loading">
          <div className="skeleton short"/><div className="skeleton"/>
          <div className="tiny muted" style={{marginTop:7}}>💡 {usageNote(w)}</div>
        </div>)}
        {e&&e.example && <div className="word-example">“{e.example}”</div>}
        {e&&e.example&&e.exampleTranslation && <div className="word-example-translation">→ {e.exampleTranslation}</div>}
      </div>); }):<div className="tiny muted">{t.gram.noWords}</div>}

      <h3 className="lbl" style={{marginTop:16}}>{t.gram.grammarCoach}</h3>
      {loadingGrammar && <div className="tiny muted" style={{marginBottom:8}}>{t.gram.grammarLoading}</div>}
      {grammarItems.length?grammarItems.map((g,j)=><div className="grammar-card" key={j}>
        <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><b>{g.point||t.gram.wordOrder}</b><p>{g.explain}</p></div>
        </div>
        <div className="grammar-examples">
          {grammarExamples(g).map((ex,k)=><div className="grammar-example-row" key={k}>
            <div className="row" style={{justifyContent:"space-between",gap:8}}>
              <span className="grammar-example">{ex.sentence}</span>
            </div>
            {ex.translation && <div className="grammar-example-translation">→ {ex.translation}</div>}
          </div>)}
        </div>
      </div>):<div className="tiny muted">{t.gram.noWords}</div>}
    </div>

    <div className="sent-nav">
      <button className="btn btn-ghost btn-sm focusable" onClick={()=>{ if(gi===0){ onPrev&&onPrev(); } else setGi(g=>g-1); }}>← {gi===0?t.previous:t.gram.previous}</button>
      {gi<N-1
        ? <button className="btn btn-primary btn-sm focusable" onClick={()=>setGi(g=>g+1)}>{t.gram.next} →</button>
        : <button className="btn btn-primary btn-sm focusable" onClick={()=>setView("summary")}>{t.gram.seeSummary} →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{t.gram.sentence(gi+1,N)}</div>
  </div>);
}

// Shadowing — one page, two modes the learner can switch between: read along
// with the text, or hide the text for a challenge.
function Shadowing({sents,lang,onSkip,onPrev,onContinue}){
  const {t}=useUI();
  const list=sents;
  const [withSubs,setWithSubs]=useState(true);
  const [started,setStarted]=useState(false);
  const [idx,setIdx]=useState(0);
  const [done,setDone]=useState(false);
  const [reveal,setReveal]=useState(true);
  const cur=list[idx]||"";
  const lastPlayed=useRef(-1);

  useEffect(()=>{ setStarted(false); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; stopSpeak(); },[withSubs,list.length]);
  useEffect(()=>()=>stopSpeak(),[]);

  function playLine(rate=1){ const role=voiceRoleForLine(cur,idx,list); speak(role?spokenTextForLine(cur):cur,lang,rate,role); }
  useEffect(()=>{ if(!started||done) return; if(lastPlayed.current===idx) return;
    lastPlayed.current=idx; setReveal(withSubs);
    const role=voiceRoleForLine(cur,idx,list);
    speak(role?spokenTextForLine(cur):cur,lang,1,role);
  },[started,idx,done]);

  function begin(){ stopSpeak(); setStarted(true); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; scrollToTop(); }
  function goPrev(){ if(idx===0) return; stopSpeak(); setIdx(i=>Math.max(0,i-1)); scrollToTop(); }
  function goNext(){ stopSpeak(); if(idx<list.length-1){ setIdx(i=>i+1); scrollToTop(); } else setDone(true); }

  const modeSwitch=(<div className="tabs" style={{marginBottom:14}}>
    <button className={"tab"+(withSubs?" on":"")} onClick={()=>setWithSubs(true)}>{t.timed.modeSubs}</button>
    <button className={"tab"+(!withSubs?" on":"")} onClick={()=>setWithSubs(false)}>{t.timed.modeNoSubs}</button>
  </div>);
  const head=(<StepHead eyebrow={t.nav.mods.shadowing} title={t.timed.title(withSubs)} onSkip={onSkip} skipLabel={t.skipStep}/>);

  if(!started) return (<div>{head}{modeSwitch}
    <Teacher>{withSubs?t.timed.teacherSubs:t.timed.teacherNoSubs}</Teacher>
    <Purpose>{t.timed.purpose}</Purpose>
    <div className="card card-p" style={{marginBottom:16}}>
      <div style={{fontWeight:500,marginBottom:6}}>{t.timed.how}</div>
      <ul className="clean tiny muted">{t.timed.tips.map((tip,i)=><li key={i}>{tip}</li>)}</ul>
    </div>
    <div className="tiny muted" style={{marginBottom:10}}>{t.timed.breath}</div>
    <div className="sent-nav">
      <button className="btn btn-ghost btn-sm focusable" onClick={()=>onPrev&&onPrev()}>← {t.previous}</button>
      <button className="btn btn-primary btn-sm focusable" onClick={begin}>▶ {t.timed.ready}</button>
    </div>
  </div>);

  if(done) return (<div>{head}{modeSwitch}
    <div className="card bigcard"><div style={{fontSize:34}}>✓</div>
      <div className="bigsent" style={{fontSize:18}}>{t.timed.done(list.length)}</div></div>
    <CheckIn>{t.timed.doneCheck}</CheckIn>
    <div className="sent-nav">
      <button className="btn btn-ghost btn-sm focusable" onClick={begin}>↺ {t.timed.again}</button>
      <button className="btn btn-primary btn-sm focusable" onClick={()=>onContinue&&onContinue()}>{t.continue} →</button>
    </div>
  </div>);

  return (<div>{head}{modeSwitch}
    <div className="card bigcard">
      <div className="row" style={{gap:8}}><span className="badge badge-outline">{idx+1} / {list.length}</span>
        <span className="phaselab" style={{color:"hsl(var(--success))"}}>🗣️ {t.timed.shadow}</span></div>
      {(withSubs||reveal) ? <div className="bigsent">{cur}</div> : <div className="bigsent muted" style={{opacity:.4}}>• • •</div>}
      {!withSubs && <button className="btn btn-outline btn-sm" onClick={()=>setReveal(r=>!r)}>{reveal?t.timed.hide:t.timed.reveal}</button>}
    </div>
    <div className="row" style={{justifyContent:"center",gap:8,marginTop:16}}>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(1)}>▶ {t.timed.replay}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(.75)}>▶ {t.timed.slow} 0.75×</button>
    </div>
    <div className="sent-nav">
      <button className="btn btn-ghost btn-sm focusable" onClick={()=>{ if(idx===0){ stopSpeak(); setStarted(false); } else goPrev(); }}>← {t.back}</button>
      <button className="btn btn-primary btn-sm focusable" onClick={goNext}>{idx<list.length-1?`${t.timed.next} →`:`${t.timed.finishRound} ✓`}</button>
    </div>
  </div>);
}

function RecallStep({lesson,onComplete,onContinue,onSkip,onPrev}){
  const {t,uiLang}=useUI();
  const {lang,level,sents,focus}=lesson;
  // Recall focuses on the sentences carrying the most of the learner's own
  // unknown words — at most three.
  const userWords=new Set(((lesson.userWords&&lesson.userWords.length?lesson.userWords:DB.get("unknownWords",[]))||[]).map(w=>String(w).toLowerCase()));
  function unknownCount(s){ let c=0; const seen=new Set(); words(s).forEach(w=>{ const k=w.toLowerCase(); if(userWords.has(k)&&!seen.has(k)){seen.add(k); c++;} }); return c; }
  const ranked=userWords.size
    ? sents.map((s,i)=>({s,i,c:unknownCount(s)})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c).map(x=>x.s)
    : [];
  const base=ranked.length?ranked
    :(focus&&Array.isArray(focus.recallSentences)&&focus.recallSentences.length?focus.recallSentences:sents.filter(s=>s.length<180));
  const list=(base.length?base:sents.slice(0,Math.min(3,sents.length))).slice(0,3);
  const [idx,setIdx]=useState(0);
  const [answers,setAnswers]=useState(()=>DB.get("recallAnswers",{}));
  const [shown,setShown]=useState(()=>DB.get("recallShown",{}));
  const [trs,setTrs]=useState({});
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const recRef=useRef(null);
  const cur=list[idx]||"";
  const doneCount=Object.keys(shown).filter(k=>shown[k]).length;
  useEffect(()=>{ DB.set("recallAnswers",answers); },[answers]);
  useEffect(()=>{ DB.set("recallShown",shown); if(doneCount>=list.length&&onComplete) onComplete(); },[shown,doneCount,list.length]);
  useEffect(()=>{ let cancel=false;
    const missing=list.map((s,i)=>({s,i})).filter(x=>!trs[x.i]);
    if(!missing.length) return;
    setLoading(true);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.s),lang,level,translationLanguage:"English"}).then(d=>{
      if(cancel) return; setLoading(false);
      if(d&&Array.isArray(d.translations)) setTrs(prev=>{ const next={...prev}; missing.forEach((m,i)=>{next[m.i]=d.translations[i]||m.s;}); return next; });
    });
    return ()=>{cancel=true;};
  },[list.length,uiLang]);
  const SR=typeof window!=="undefined" && (window.SpeechRecognition||window.webkitSpeechRecognition);
  function startMic(){ if(!SR) return; stopSpeak(); const r=new SR(); r.lang=LANG_CODE[lang]||"nl-NL"; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=e=>setAnswers(a=>({...a,[idx]:((a[idx]||"")+" "+e.results[0][0].transcript).trim()}));
    r.onend=()=>setListening(false); r.onerror=()=>setListening(false); recRef.current=r; try{r.start();setListening(true);}catch(e){setListening(false);} }
  function stopMic(){ if(recRef.current){ try{recRef.current.stop();}catch(e){} recRef.current=null; } setListening(false); }
  useEffect(()=>()=>stopMic(),[]);
  const answer=(answers[idx]||"").trim();
  const canCheck=answer.split(/\s+/).filter(Boolean).length>=2;
  function check(){ if(!canCheck) return; setShown(s=>({...s,[idx]:true})); }
  function move(next){ stopMic(); setIdx(Math.max(0,Math.min(list.length-1,next))); }
  return (<div>
    <StepHead eyebrow={t.nav.mods.recall} title={t.recall.title} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{t.recall.teacher}</Teacher>
    <Purpose>{t.recall.purpose}</Purpose>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span className="badge badge-outline">{t.recall.progress(idx+1,list.length)}</span>
        <div className="track" style={{width:160}}><span style={{width:((doneCount||0)/Math.max(1,list.length)*100)+"%"}}/></div>
      </div>
      <h3 className="lbl">{t.recall.englishCue}</h3>
      <div className="translation-line" style={{marginBottom:16}}>{loading&&!trs[idx]?t.translatingTitle:trs[idx]}</div>
      <h3 className="lbl">{t.recall.yourDutch}</h3>
      <textarea style={{minHeight:88}} value={answers[idx]||""} onChange={e=>setAnswers(a=>({...a,[idx]:e.target.value}))} placeholder={t.recall.placeholder}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
        {SR ? <button className={"btn btn-sm "+(listening?"btn-primary":"btn-outline")} onClick={listening?stopMic:startMic}>🎤 {t.recall.speak}</button> : <span className="tiny muted">{t.recall.tryFirst}</span>}
        <button className="btn btn-primary btn-sm" disabled={!canCheck} onClick={check}>{t.recall.check}</button>
      </div>
      {shown[idx] && <div className="card card-p" style={{marginTop:14,background:"hsl(var(--secondary))"}}>
        <h3 className="lbl">{t.recall.original}</h3>
        <div style={{fontWeight:600}}>{cur}</div>
        <div style={{marginTop:10}}><Say text={cur} lang={lang} rate={1} voiceRole={voiceRoleForLine(cur,idx,list)}/></div>
      </div>}
    </div>
    <div className="sent-nav">
      <button className="btn btn-ghost btn-sm focusable" onClick={()=>{ if(idx===0){ onPrev&&onPrev(); } else move(idx-1); }}>← {idx===0?t.previous:t.back}</button>
      {idx<list.length-1
        ? <button className="btn btn-primary btn-sm focusable" onClick={()=>move(idx+1)}>{t.gram.next} →</button>
        : <button className="btn btn-primary btn-sm focusable" onClick={onContinue}>{t.continue} →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{doneCount>=list.length?t.recall.done:t.recall.tryFirst}</div>
  </div>);
}

function PracticeAI({lesson,onComplete,onSkip}){
  const {t}=useUI();
  const [tab,setTab]=useState("chat");
  const [wrote,setWrote]=useState(false); const [talked,setTalked]=useState(false);
  useEffect(()=>{ if(wrote&&talked&&onComplete) onComplete(); },[wrote,talked]);
  return (<div>
    <StepHead eyebrow={t.nav.mods.using} title={t.aiUse.title} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{t.aiUse.teacher}</Teacher>
    <Purpose>{t.aiUse.purpose}</Purpose>
    <div className="tabs">
      <button className={"tab"+(tab==="chat"?" on":"")} onClick={()=>{stopSpeak();setTab("chat");}}>{t.aiUse.chatTab} {talked?"✓":""}</button>
      <button className={"tab"+(tab==="write"?" on":"")} onClick={()=>{stopSpeak();setTab("write");}}>{t.aiUse.writeTab} {wrote?"✓":""}</button>
    </div>
    {tab==="chat" ? <AIChat lesson={lesson} onNext={()=>{stopSpeak();setTab("write");}} onDone={()=>setTalked(true)}/> : <AIWrite lesson={lesson} onDone={()=>setWrote(true)}/>}
    <div className="tiny muted" style={{marginTop:12}}>{t.aiUse.unlock}</div>
  </div>);
}

function AIWrite({lesson,onDone}){
  const {t,uiLang}=useUI();
  const {lang,level,vocab,sents,focus}=lesson;
  const focusWords=(focus&&Array.isArray(focus.vocab)?focus.vocab.map(x=>x.word).filter(Boolean):[]);
  const shownLang=langName(t,lang);
  const question=practiceQuestion(lesson,shownLang,uiLang);
  const [textv,setTextv]=useState(DB.get("aiPractice","")); const [fb,setFb]=useState(null); // null | "loading" | {real} | "mock"
  useEffect(()=>DB.set("aiPractice",textv),[textv]);
  async function getFeedback(){
    posthog.capture("writing_feedback_requested",{language:lang,level:level.slice(0,2),word_count:textv.trim().split(/\s+/).filter(Boolean).length});
    setFb("loading"); onDone&&onDone();
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"feedback",lang,level,question,text:textv.trim(),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})});
      if(!r.ok) throw new Error("no api");
      const d=await r.json(); setFb(d);
    }catch(e){ setFb("mock"); }
  }
  const real=fb && fb!=="loading" && fb!=="mock";
  return (<div>
    <div className="row wrap" style={{gap:7,marginBottom:14}}>{(focusWords.length?focusWords:vocab.slice(0,8).map(v=>v.word)).slice(0,8).map(w=><span key={w} className="badge">{w}</span>)}</div>
    <div className="card card-p" style={{marginBottom:14}}><div className="row" style={{gap:10}}>
      <div className="tface">👩‍🏫</div><div style={{fontWeight:500}}>{question}</div></div></div>
    <textarea style={{minHeight:130}} value={textv} onChange={e=>setTextv(e.target.value)} placeholder={t.aiUse.writePlaceholder(shownLang)}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
      <span className="tiny muted">{t.aiUse.saved(textv.trim().split(/\s+/).filter(Boolean).length)}</span>
      <button className="btn btn-primary btn-sm" disabled={textv.trim().length<12||fb==="loading"} onClick={getFeedback}>{fb==="loading"?t.aiUse.reading:t.aiUse.feedback}</button></div>
    {fb==="loading" && <div className="card card-p" style={{marginTop:16}}>
      <div className="row" style={{gap:11}}><div className="tface pulse">👩‍🏫</div>
        <div><div style={{fontWeight:500}}>{t.aiUse.teacherReading}</div>
          <div className="tiny muted">{t.aiUse.checking}</div></div></div>
      <div className="track" style={{marginTop:12,overflow:"hidden"}}><span className="indet"/></div>
    </div>}
    {(real||fb==="mock") && (<div className="card card-p" style={{marginTop:16}}>
      <h3 className="lbl">{t.aiUse.feedbackTitle(!real)}</h3>
      {real ? (<>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{fb.grammar}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{fb.vocabulary}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.sentence}.</b> <span className="muted">{fb.sentence}</span></div>
        {fb.revision && <div style={{marginTop:10}}><b>{t.aiUse.revision}:</b><div className="card card-p" style={{marginTop:6,background:"hsl(var(--secondary))"}}>{fb.revision}</div></div>}
      </>) : (<>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{t.aiUse.mockGrammar}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{t.aiUse.mockVocab}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.sentence}.</b> <span className="muted">{t.aiUse.mockSentence}</span></div>
        <div className="tiny muted" style={{marginTop:8}}>{t.aiUse.mockNote}</div>
      </>)}
    </div>)}
  </div>);
}

function AIChat({lesson,onNext,onDone}){
  const {t,uiLang}=useUI();
  const {lang,level,vocab,topics,grammarFocus,sents,focus}=lesson;
  const shownLang=langName(t,lang);
  const focusWords=(focus&&Array.isArray(focus.vocab)?focus.vocab.map(x=>x.word).filter(Boolean):[]);
  const vwords=(focusWords.length?focusWords:vocab.map(v=>v.word)).slice(0,6);
  const topic=(topics&&topics.join(", "))||"the text";
  const grammar=(grammarFocus&&grammarFocus.join("; "))||"";
  const sample=(sents||[]).slice(0,8).join(" ");
  const partner=PARTNER[lang]||PARTNER._;
  const fallback=chatFallback(lang,vwords[0],sents[0]);
  const [msgs,setMsgs]=useState([]); const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false); const [turns,setTurns]=useState(0);
  const [speaking,setSpeaking]=useState(false);
  const [done,setDone]=useState(false); const [evalz,setEvalz]=useState(null); const [listening,setListening]=useState(false);
  const mockRef=useRef(false); const recRef=useRef(null); const wantRef=useRef(false); const silenceRef=useRef(null);
  const mountedRef=useRef(false); const abortRef=useRef(null);
  const MAX_TURNS=5;

  function sayAI(line){
    if(!mountedRef.current) return;
    setSpeaking(true);
    const u=speak(line,lang);
    if(u){ u.onend=()=>{ if(mountedRef.current) setSpeaking(false); }; }
    else setSpeaking(false);
  }

  async function aiReply(history,onChunk){
    const controller=new AbortController();
    abortRef.current=controller;
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        signal:controller.signal,
        body:JSON.stringify({mode:"chat",stream:true,lang,level,vocab:vwords,topic,grammar,sample,history})});
      if(!r.ok) throw new Error("no api");
      const ct=r.headers.get("content-type")||"";
      if(r.body && !ct.includes("application/json")){
        const reader=r.body.getReader(); const decoder=new TextDecoder(); let text="";
        while(true){
          const {value,done}=await reader.read();
          if(controller.signal.aborted) return null;
          if(done) break;
          text+=decoder.decode(value,{stream:true});
          if(!controller.signal.aborted) onChunk&&onChunk(text);
        }
        text+=decoder.decode();
        if(text&&!controller.signal.aborted) onChunk&&onChunk(text);
        return text.trim()||null;
      }
      const d=await r.json(); return d.reply||null;
    }catch(e){ return null; }
    finally{ if(abortRef.current===controller) abortRef.current=null; }
  }
  useEffect(()=>{ (async()=>{
    mountedRef.current=true;
    setBusy(true);
    const reply=await aiReply([],partial=>{ if(!mountedRef.current) return; mockRef.current=false; setMsgs([{who:"ai",t:partial}]); });
    if(!mountedRef.current) return;
    if(reply){ mockRef.current=false; setMsgs([{who:"ai",t:reply}]); sayAI(reply); }
    else { mockRef.current=true; setMsgs([{who:"ai",t:fallback[0]}]); sayAI(fallback[0]); }
    setBusy(false);
  })(); return ()=>{ mountedRef.current=false; if(abortRef.current) abortRef.current.abort(); stopSpeak(); stopMic(); }; },[]);

  const full=draft.trim().split(/\s+/).filter(Boolean).length>=3;
  function toHistory(list){ return list.map(m=>({role:m.who==="ai"?"assistant":"user",content:m.t})); }

  const SR = typeof window!=="undefined" && (window.SpeechRecognition||window.webkitSpeechRecognition);
  function clearSilence(){ if(silenceRef.current){ clearTimeout(silenceRef.current); silenceRef.current=null; } }
  function armSilence(){ clearSilence(); silenceRef.current=setTimeout(()=>{ stopMic(); },8000); }
  function startMic(){ if(!SR) return; stopSpeak(); wantRef.current=true;
    const r=new SR(); r.lang=LANG_CODE[lang]||"en-US"; r.continuous=true; r.interimResults=true; r.maxAlternatives=1;
    r.onresult=(e)=>{ let fin=""; for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) fin+=e.results[i][0].transcript; } if(fin.trim()) setDraft(d=>(d?d+" ":"")+fin.trim()); armSilence(); };
    r.onend=()=>{ if(wantRef.current){ try{ r.start(); }catch(e){ setListening(false); } } else setListening(false); };
    r.onerror=(ev)=>{ if(ev&&ev.error==="no-speech") return; wantRef.current=false; clearSilence(); setListening(false); };
    recRef.current=r; try{ r.start(); setListening(true); armSilence(); }catch(e){ setListening(false); } }
  function stopMic(){ wantRef.current=false; clearSilence(); if(recRef.current){ try{recRef.current.stop();}catch(e){} recRef.current=null; } setListening(false); }

  async function finish(list){ posthog.capture("conversation_practice_completed",{language:lang,level:level.slice(0,2),turn_count:turns+1,used_fallback:mockRef.current}); setDone(true); onDone&&onDone();
    if(mockRef.current) return;
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"evaluate",lang,level,history:toHistory(list),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})});
      if(r.ok){ const d=await r.json(); if(mountedRef.current) setEvalz(d); } }catch(e){} }

  async function send(){ if(!full||busy) return; stopMic();
    const withMe=[...msgs,{who:"me",t:draft.trim()}]; const nx=turns+1;
    setMsgs(withMe); setDraft(""); setTurns(nx);
    if(nx>=MAX_TURNS){ finish(withMe); return; }
    if(mockRef.current){ const line=fallback[nx]||fallback[fallback.length-1]; setMsgs([...withMe,{who:"ai",t:line}]); sayAI(line); return; }
    setBusy(true);
    setMsgs([...withMe,{who:"ai",t:""}]);
    const reply=await aiReply(toHistory(withMe),partial=>{ if(mountedRef.current) setMsgs([...withMe,{who:"ai",t:partial}]); });
    if(!mountedRef.current) return;
    const line=reply||"👍"; setMsgs([...withMe,{who:"ai",t:line}]); if(reply) sayAI(line);
    setBusy(false);
  }

  const lastAi=[...msgs].reverse().find(m=>m.who==="ai");
  return (<div>
    <div className="notice" style={{marginBottom:14}}><span>🗣️</span>
      <span>{t.chat.notice(partner.name,shownLang,MAX_TURNS)}</span></div>

    <div className="card card-p" style={{textAlign:"center",background:"hsl(var(--secondary))"}}>
      <div style={{fontSize:60,lineHeight:1,filter:speaking?"none":"grayscale(.15)"}}>{partner.face}</div>
      <div style={{fontWeight:700,marginTop:6}}>{partner.name}</div>
      <div className="tiny muted">{busy?"…"+t.chat.thinking:speaking?"🔊 "+t.chat.speaking+"…":t.chat.yourTurn}</div>
      {lastAi && <div style={{fontWeight:500,fontSize:17,margin:"12px auto 0",maxWidth:520}}>{lastAi.t}</div>}
      <div className="row" style={{gap:8,justifyContent:"center",marginTop:10}}>
        {lastAi && <button className="btn btn-outline btn-sm" onClick={()=>sayAI(lastAi.t)}>🔊 {t.chat.sayAgain}</button>}
        <span className="tiny muted">{t.chat.exchange(Math.min(turns+1,MAX_TURNS),MAX_TURNS)}</span>
      </div>
    </div>

    {!done ? (<div style={{marginTop:16}}>
      {SR ? (<div style={{textAlign:"center"}}>
        <button className={"btn "+(listening?"btn-primary":"btn-outline")} style={{fontSize:17,padding:"14px 26px",borderRadius:999}}
          onClick={listening?stopMic:startMic}>{listening?"● "+t.chat.listening:"🎤 "+t.chat.speakAnswer}</button>
        <div className="tiny muted" style={{marginTop:8}}>{t.chat.speakIn(shownLang)}</div>
      </div>) : <div className="tiny muted" style={{marginBottom:6}}>{t.chat.typeIn(shownLang)}</div>}
      <textarea style={{minHeight:56,marginTop:12}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t.chat.placeholder(shownLang)}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{full?t.chat.looksGood+" ✓":t.chat.shortSentence}</span>
        <button className="btn btn-primary btn-sm" disabled={!full||busy} onClick={send}>{t.chat.replyTo(partner.name)} →</button></div>

      {msgs.length>1 && <details style={{marginTop:14}}><summary className="tiny muted" style={{cursor:"pointer"}}>{t.chat.showTranscript}</summary>
        <div className="chat" style={{marginTop:8}}>{msgs.map((m,i)=>(<div key={i} className={"bubble "+m.who}>{m.t}</div>))}</div></details>}
    </div>) : (<div className="card card-p" style={{marginTop:14,background:"hsl(var(--secondary))"}}>
        <h3 className="lbl">{t.chat.feedbackTitle(!evalz)}</h3>
        {evalz ? (<div>
          <div style={{marginBottom:8}}>🎉 {evalz.praise}</div>
          <div style={{marginBottom:6}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{evalz.grammar}</span></div>
          <div style={{marginBottom:6}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{evalz.vocabulary}</span></div>
          <div>✅ <b>{t.chat.fluency}.</b> <span className="muted">{evalz.fluency}</span></div>
        </div>) : (<div className="muted">{t.chat.mockDone(shownLang)}</div>)}
        {onNext && <div style={{marginTop:14,textAlign:"right"}}><button className="btn btn-primary btn-sm" onClick={onNext}>{t.aiUse.nextTalk} →</button></div>}
      </div>)}
  </div>);
}

function Done({lesson,diag,onNew,onReview}){
  const {t}=useUI();
  const [most,setMost]=useState(null); const [least,setLeast]=useState(null);
  const [feedbackStep,setFeedbackStep]=useState("most");
  const [feedbackOpen,setFeedbackOpen]=useState(true);
  const [devFeedback,setDevFeedback]=useState(()=>DB.get("developmentFeedbackDraft",""));
  const [devFeedbackStatus,setDevFeedbackStatus]=useState("idle");
  const SURVEY_MODS=["understanding","vocabulary","shadowing","recall","using"];
  function captureSurvey(mostV,leastV){
    try{ if(typeof window!=="undefined"&&window.gtag) window.gtag("event","lesson_feedback",{most_helpful:mostV||null,least_helpful:leastV||null,language:lesson?.lang,level:(lesson?.level||"").slice(0,2)}); }catch(e){}
    posthog.capture("lesson_feedback",{most_helpful:mostV,least_helpful:leastV,language:lesson?.lang,level:(lesson?.level||"").slice(0,2)}); }
  function chooseMost(m){ setMost(m); setFeedbackStep("least"); }
  function chooseLeast(m){ if(m!==most) setLeast(m); }
  function submitSurvey(){ if(!most||!least) return; captureSurvey(most,least); setFeedbackOpen(false); }
  useEffect(()=>DB.set("developmentFeedbackDraft",devFeedback),[devFeedback]);
  async function submitDevelopmentFeedback(){
    const text=devFeedback.trim();
    if(!text||devFeedbackStatus==="sending") return;
    setDevFeedbackStatus("sending");
    try{
      const r=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          text,
          language:lesson?.lang||null,
          level:(lesson?.level||"").slice(0,2)||null,
          lessonId:lesson?.id||null,
          pagePath:typeof window!=="undefined"?window.location.pathname:null,
        })});
      if(!r.ok) throw new Error("feedback failed");
      const d=await r.json();
      try{ if(typeof window!=="undefined"&&window.gtag) window.gtag("event","development_feedback_submitted",{
        feedback_length:d?.feedback_length||text.length,
        feedback_redacted:String(!!d?.feedback_redacted),
        lesson_language:lesson?.lang||null,
        lesson_level:(lesson?.level||"").slice(0,2)||null,
      }); }catch(e){}
      posthog.capture("development_feedback_submitted",{feedback_length:d?.feedback_length||text.length,feedback_redacted:!!d?.feedback_redacted,language:lesson?.lang,level:(lesson?.level||"").slice(0,2)});
      setDevFeedback("");
      DB.set("developmentFeedbackDraft","");
      setDevFeedbackStatus("sent");
    }catch(e){
      setDevFeedbackStatus("error");
    }
  }
  const name=(DB.get("email","")||"").split("@")[0]||t.done.friend;
  const fromDiag=(diag&&Array.isArray(diag.unknown)&&diag.unknown.length)?diag.unknown:null;
  const fromFocus=(lesson.focus&&Array.isArray(lesson.focus.vocab))?lesson.focus.vocab.map(v=>v.word):[];
  const wordList=(fromDiag||(fromFocus.length?fromFocus:(lesson.vlist||[]))).filter(Boolean).slice(0,6);
  const isLeastStep=feedbackStep==="least";
  const feedbackNumber=isLeastStep?2:1;
  const feedbackText=devFeedback.trim();
  const feedbackSending=devFeedbackStatus==="sending";
  return (<>
    <div className="done-wrap">
      <div className="done-emoji">🎉</div>
      <h1 className="done-h1">{t.done.title(name)}</h1>
      <p className="done-sub">{t.done.sub(STEPS.length)}</p>
      <div className="done-card donation-card">
        <div className="done-card-title">{t.donation.title}</div>
        <p className="done-card-note">{t.donation.body}</p>
        <button className="btn btn-outline" onClick={()=>window.location.assign(SUPPORT_CHECKOUT_URL)}>{t.donation.button}</button>
        <div className="tiny muted">{t.donation.soon}</div>
        <div className="donation-feedback">
          <label className="tiny muted" htmlFor="development-feedback">{t.donation.feedbackLabel}</label>
          <textarea id="development-feedback" value={devFeedback} onChange={e=>{setDevFeedback(e.target.value); if(devFeedbackStatus!=="sending") setDevFeedbackStatus("idle");}} placeholder={t.donation.feedbackPlaceholder}/>
          <div className="feedback-submit-row">
            <span className="tiny muted">{t.donation.feedbackPrivacy}</span>
            <button className="btn btn-primary btn-sm" disabled={!feedbackText||feedbackSending} onClick={submitDevelopmentFeedback}>{feedbackSending?t.donation.feedbackSending:t.donation.feedbackSend}</button>
          </div>
          {devFeedbackStatus==="sent" && <div className="tiny feedback-status ok">{t.donation.feedbackSent}</div>}
          {devFeedbackStatus==="error" && <div className="tiny feedback-status error">{t.donation.feedbackError}</div>}
        </div>
      </div>
      <div className="done-actions">
        <button className="btn btn-outline focusable" onClick={onReview}><Svg n="recall"/> {t.done.review}</button>
        <button className="btn btn-primary focusable" onClick={onNew}>{t.done.new} →</button>
      </div>
    </div>
    {feedbackOpen && <div className="feedback-pop" role="dialog" aria-label={t.survey.title}>
      <div className="feedback-pop-head">
        <div>
          <b>{t.survey.title}</b>
          <div className="tiny muted">{t.survey.progress(feedbackNumber,2)}</div>
        </div>
        <button className="feedback-close" aria-label={t.survey.close} onClick={()=>setFeedbackOpen(false)}>×</button>
      </div>
      <div className="feedback-step-dots" aria-hidden="true"><span className={!isLeastStep?"on":""}/><span className={isLeastStep?"on":""}/></div>
      <div className="feedback-question">
        <span className="feedback-question-icon">{isLeastStep?t.survey.leastIcon:t.survey.mostIcon}</span>
        <span>{isLeastStep?t.survey.least:t.survey.most}</span>
      </div>
      <div className="feedback-options">{SURVEY_MODS.map(m=>{
        const selected=isLeastStep?least===m:most===m;
        const disabled=isLeastStep&&most===m;
        return <button key={m} className={"badge badge-outline feedback-choice"+(selected?" on":"")} disabled={disabled} onClick={()=>isLeastStep?chooseLeast(m):chooseMost(m)}>{t.nav.mods[m]}</button>;
      })}</div>
      <div className="feedback-actions">
        <button className="btn btn-ghost btn-sm" onClick={()=>setFeedbackOpen(false)}>{t.survey.skip}</button>
        <div className="row" style={{gap:8}}>
          {isLeastStep && <button className="btn btn-outline btn-sm" onClick={()=>setFeedbackStep("most")}>{t.survey.back}</button>}
          {isLeastStep && <button className="btn btn-primary btn-sm" disabled={!most||!least} onClick={submitSurvey}>{t.survey.submit}</button>}
        </div>
      </div>
    </div>}
  </>);
}

export { AIChat, AIWrite, Done, GrammarStep, PracticeAI, QuickScan, RecallStep, Shadowing };
