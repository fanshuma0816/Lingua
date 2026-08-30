"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { analyzeDifficulty } from "../../lib/cefr.mjs";
import { FullPlayer } from "./Player";
import { CheckIn, Purpose, Say, Svg, Teacher } from "../ui/elements";
import { LANG_CODE, LEVELS, PARTNER, POS, STEPS, levelIdx } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useElapsed } from "../../hooks/useElapsed";
import { useUI } from "../../hooks/useUI";
import { speak, stopSpeak } from "../../lib/audio";
import { displayWordInfo } from "../../lib/dutch";
import { normalizePoint, progressPct, scrollToTop } from "../../lib/format";
import { fallbackGrammarItems, practiceQuestion } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { STOP, grammarExamples, meaningParts, words } from "../../lib/text";
import { spokenTextForLine, voiceRoleForLine } from "../../lib/voices";
import { cachedAiAnalyze, chatFallback } from "../../services/api";

function ReadingCheck({lesson,text,diag,setDiag}){
  const {t}=useUI();
  const {level}=lesson;
  const src=(text&&text.trim())?text:((lesson.sents||[]).join("\n"));
  // Candidate hard words come straight from the stored analysis (words above the
  // learner's level). Fall back to a local, deterministic analysis if absent.
  const annotations=useMemo(()=>{
    const stored=lesson.material&&Array.isArray(lesson.material.vocabularyAnnotations)?lesson.material.vocabularyAnnotations:null;
    const list=(stored&&stored.length)?stored:analyzeDifficulty(src,level).annotations;
    return list.slice(0,20);
  },[lesson.material,src,level]);
  const totalTokens=Math.max(1,words(src).length);
  const matLevel=(lesson.material&&lesson.material.validatedTextLevel)||LEVELS[levelIdx(level)].slice(0,2);
  const [known,setKnown]=useState(()=>new Set());
  const unknownWords=annotations.filter(g=>!known.has((g.lemma||g.surface||"").toLowerCase())).map(g=>g.surface||g.lemma);
  const coverage=Math.max(40,Math.min(99,Math.round((1-unknownWords.length/totalTokens)*100)));
  useEffect(()=>{ setDiag(d=>({...d,coverage,total:totalTokens,unknown:unknownWords}));
    DB.set("unknownWords",unknownWords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[coverage,annotations.length,known.size]);
  function toggle(w){ const lc=w.toLowerCase(); const markedKnown=!known.has(lc); posthog.capture("reading_diagnosis_updated",{language:lesson.lang,level:level.slice(0,2),word_count:annotations.length,marked_known:markedKnown}); setKnown(prev=>{ const n=new Set(prev); n.has(lc)?n.delete(lc):n.add(lc); return n; }); }
  return (<div>
    <div className="eyebrow">{t.diagnosis.readEyebrow}</div><h2>{t.diagnosis.readTitle}</h2>
    <Teacher>{t.diagnosis.readTeacher}</Teacher>
    <div className="card card-p" style={{marginBottom:14}}>
      <h3 className="lbl">{t.diagnosis.readTextLbl(matLevel)}</h3>
      <div style={{lineHeight:1.85,fontSize:15,whiteSpace:"pre-wrap",maxHeight:220,overflowY:"auto"}}>{src}</div>
    </div>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <h3 className="lbl" style={{margin:0}}>{t.diagnosis.readWordsLbl}</h3>
        <span className="tiny muted">{t.diagnosis.coverage}: <b>{coverage}%</b></span></div>
      {annotations.length===0
        ? <div className="tiny muted">{t.diagnosis.gradingWords}</div>
        : <div className="row wrap" style={{gap:8}}>{annotations.map((g,i)=>{ const w=g.surface||g.lemma; const on=known.has((g.lemma||w).toLowerCase());
            return <button key={(g.lemma||w)+i} className={"vchip focusable"+(on?" known":"")} onClick={()=>toggle(g.lemma||w)}>
              <span className="box">✓</span>{w}<span className="badge badge-outline" style={{padding:"0 5px"}}>{g.cefr}</span></button>; })}</div>}
      <div className="tiny muted" style={{marginTop:14}}>{t.diagnosis.readNote}</div>
    </div>
  </div>);
}

function BlindListen({lesson,text,diag,setDiag}){
  const {t}=useUI();
  const {lang}=lesson;
  const tiers=t.diagnosis.tiers;
  return (<div>
    <div className="eyebrow">{t.diagnosis.listenEyebrow}</div><h2>{t.diagnosis.listenTitle}</h2>
    <Teacher>{t.diagnosis.listenTeacher}</Teacher>
    <Purpose>{t.diagnosis.listenPurpose}</Purpose>
    <FullPlayer text={text} lang={lang} label={t.listen.player} sub={t.listen.sub}/>
    <div className="card card-p" style={{marginTop:18}}>
      <div style={{fontWeight:700,marginBottom:3}}>{t.diagnosis.catch}</div>
      <div className="tiny muted" style={{marginBottom:13}}>{t.diagnosis.catchHint}</div>
      <div className="tier-grid">
        {tiers.map((tr,i)=>(<button key={i} className={"tier focusable"+(diag.tier===i?" on":"")} data-fill={i+1} onClick={()=>{posthog.capture("listening_diagnosis_selected",{language:lang,tier_number:i+1});setDiag(d=>({...d,tier:i}));}}>
          <span className="tpct">{tr.pct}</span>
          <div className="bars"><i/><i/><i/><i/></div>
          <div className="tlabel">{tr.label}</div><div className="tdesc">{tr.desc}</div></button>))}
      </div>
    </div>
  </div>);
}

function diagnosisCase(coverage,tier){
  if(coverage!=null&&coverage<75) return "overload";
  if(tier!=null&&tier<=0) return "acoustic";
  if(coverage!=null&&coverage>=95&&tier!=null&&tier>=3) return "comfort";
  return "golden";
}

function DiagnosisMatrix({lesson,diag}){
  const {t}=useUI();
  const tiers=t.diagnosis.tiers;
  const cov=diag.coverage; const tier=diag.tier;
  const key=diagnosisCase(cov,tier);
  const c=t.diagnosis.cases[key];
  const cls=key==="overload"?"warn":(key==="acoustic"||key==="comfort")?"info":"";
  const listenLabel=tier!=null?tiers[tier].label:"—";
  return (<div>
    <div className="eyebrow">{t.diagnosis.diagEyebrow}</div><h2>{t.diagnosis.diagTitle}</h2>
    <div className="row wrap" style={{gap:12,margin:"6px 0 16px"}}>
      <div className="mini-metric"><div className="k">{t.diagnosis.reading}</div><div className="v">{cov!=null?cov+"%":"—"}</div><div className="tiny muted" style={{marginTop:2}}>{t.diagnosis.ofWords}</div></div>
      <div className="mini-metric"><div className="k">{t.diagnosis.listening}</div><div className="v">{listenLabel}</div><div className="tiny muted" style={{marginTop:2}}>{tier!=null?t.diagnosis.byEar(tiers[tier].pct):t.diagnosis.tapFirst}</div></div>
    </div>
    <div className={"diag-card "+cls}>
      <div className="row" style={{gap:11}}><span style={{fontSize:26}}>{c.emoji}</span>
        <span><div className="tiny muted" style={{fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{c.kicker}</div>
        <div className="diag-name">{c.name}</div></span></div>
      <div style={{fontSize:14,lineHeight:1.55}}>{c.body}</div>
      <div style={{background:"hsl(var(--background)/.6)",borderRadius:8,padding:"11px 13px",fontSize:14}}>{c.tip}</div>
    </div>
  </div>);
}

function GrammarStep({lesson,onComplete,onContinue}){
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
  // Salient words to unpack: vocab words first, then longer words.
  function seenWordsBefore(index){ return new Set(sents.slice(0,index).flatMap(x=>words(x)).map(w=>w.toLowerCase())); }
  function keyWordsIn(s,index=gi){ const seen=seenWordsBefore(index);
    const ws=[...new Set(words(s))].filter(w=>w.length>3&&!STOP.has(w.toLowerCase())&&!seen.has(w.toLowerCase()));
    ws.sort((a,b)=>{
      const av=vmap[a.toLowerCase()]?20:0, bv=vmap[b.toLowerCase()]?20:0;
      return (bv+b.length)-(av+a.length);
    });
    return ws.slice(0,6); }
  // Ask the AI to translate the current sentence when this step needs it.
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||"";
    const existing=uiLang==="en" ? (lesson.watch||[]).find(x=>x.s===sen)?.tr : null;
    if(existing){ setTrs(prev=>prev[gi]?prev:{...prev,[gi]:existing}); return; }
    if(trs[gi] || !sen){ setLoadingTr(false); return; }
    setLoadingTr(true);
    cachedAiAnalyze("translate",{sentences:[sen],lang,level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      const tr=d&&Array.isArray(d.translations)?d.translations[0]:null;
      if(tr) setTrs(prev=>({...prev,[gi]:tr}));
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
      const items=raw.filter(g=>!prior.has(normalizePoint(g.point))).slice(0,2);
      setGrammar(prev=>({...prev,[gi]:items}));
    });
    return ()=>{cancel=true;};
  },[gi,trs[gi],uiLang]);
  function usageNote(w){ return loadingKw ? t.lookingUpWord : t.studyUsage; }
  const s=sents[gi]||""; const tr=trs[gi]; const kw=keyWordsIn(s,gi); const grammarItems=grammar[gi]||fallbackGrammarItems(s,level,uiLang);
  const studyWords=(()=>{ const seen=new Set(), out=[];
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
    <div className="eyebrow">{t.stepPhases[2]}</div><h2>{t.gram.summaryTitle}</h2>
    <Teacher>{t.gram.summaryTeacher}</Teacher>
    <div className="summary-stack">
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
              <span className="grammar-example">{ex.sentence}</span><Say text={ex.sentence} lang={lang}/>
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
    <div className="eyebrow">{t.stepPhases[2]}</div><h2>{t.gram.title}</h2>
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
              <span className="grammar-example">{ex.sentence}</span><Say text={ex.sentence} lang={lang} rate={1}/>
            </div>
            {ex.translation && <div className="grammar-example-translation">→ {ex.translation}</div>}
          </div>)}
        </div>
      </div>):<div className="tiny muted">{t.gram.noWords}</div>}
    </div>

    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={gi===0} onClick={()=>setGi(g=>g-1)}>← {t.gram.previous}</button>
      {gi<N-1 ? <button className="btn btn-outline btn-sm" onClick={()=>setGi(g=>g+1)}>{t.gram.next} →</button>
        : <button className="btn btn-primary btn-sm" onClick={()=>setView("summary")}>{t.gram.seeSummary} →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{t.gram.sentence(gi+1,N)}</div>
  </div>);
}

function TimedPractice({sents,lang,withSubs}){
  const {t}=useUI();
  const list=sents;
  const [started,setStarted]=useState(false);
  const [idx,setIdx]=useState(0);
  const [done,setDone]=useState(false);
  const [reveal,setReveal]=useState(withSubs);
  const cur=list[idx]||"";
  const phaseIndex=withSubs?3:4;
  const lastPlayed=useRef(-1);

  useEffect(()=>{ setStarted(false); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; stopSpeak(); },[withSubs,list.length]);
  useEffect(()=>()=>stopSpeak(),[]);

  function playLine(rate=1){
    const role=voiceRoleForLine(cur,idx,list);
    speak(role?spokenTextForLine(cur):cur,lang,rate,role);
  }
  // Auto-play the current line whenever we land on a new sentence.
  useEffect(()=>{ if(!started||done) return; if(lastPlayed.current===idx) return;
    lastPlayed.current=idx; setReveal(withSubs);
    const role=voiceRoleForLine(cur,idx,list);
    speak(role?spokenTextForLine(cur):cur,lang,1,role);
  },[started,idx,done]);

  function begin(){ stopSpeak(); setStarted(true); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; scrollToTop(); }
  function goPrev(){ if(idx===0) return; stopSpeak(); setIdx(i=>Math.max(0,i-1)); scrollToTop(); }
  function goNext(){ stopSpeak(); if(idx<list.length-1){ setIdx(i=>i+1); scrollToTop(); } else setDone(true); }

  const head=(<><div className="eyebrow">{t.stepPhases[phaseIndex]}</div><h2>{t.timed.title(withSubs)}</h2></>);

  if(!started) return (<div>{head}
    <Teacher>{withSubs?t.timed.teacherSubs:t.timed.teacherNoSubs}</Teacher>
    <Purpose>{t.timed.purpose}</Purpose>
    <div className="card card-p" style={{marginBottom:16}}>
      <div style={{fontWeight:500,marginBottom:6}}>{t.timed.how}</div>
      <ul className="clean tiny muted">{t.timed.tips.map((tip,i)=><li key={i}>{tip}</li>)}</ul>
    </div>
    <button className="btn btn-primary" onClick={begin}>▶ {t.timed.ready}</button>
    <div className="tiny muted" style={{marginTop:10}}>{t.timed.breath}</div>
  </div>);

  if(done) return (<div>{head}
    <div className="card bigcard"><div style={{fontSize:34}}>✓</div>
      <div className="bigsent" style={{fontSize:18}}>{t.timed.done(list.length)}</div>
      <button className="btn btn-outline btn-sm" onClick={begin}>↺ {t.timed.again}</button></div>
    <CheckIn>{t.timed.doneCheck}</CheckIn>
  </div>);

  return (<div>{head}
    <div className="card bigcard">
      <div className="row" style={{gap:8}}><span className="badge badge-outline">{idx+1} / {list.length}</span>
        <span className="phaselab" style={{color:"hsl(var(--success))"}}>🗣️ {t.timed.shadow}</span></div>
      {(withSubs||reveal) ? <div className="bigsent">{cur}</div> : <div className="bigsent muted" style={{opacity:.4}}>• • •</div>}
      {!withSubs && <button className="btn btn-outline btn-sm" onClick={()=>setReveal(r=>!r)}>{reveal?t.timed.hide:t.timed.reveal}</button>}
    </div>
    <div className="row" style={{justifyContent:"center",gap:8,marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={goPrev}>← {t.back}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(1)}>▶ {t.timed.replay}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(.75)}>▶ {t.timed.slow} 0.75×</button>
      <button className="btn btn-primary btn-sm" onClick={goNext}>{idx<list.length-1?`${t.timed.next} →`:`${t.timed.finishRound} ✓`}</button>
    </div>
  </div>);
}

function RecallStep({lesson,onComplete,onContinue}){
  const {t,uiLang}=useUI();
  const {lang,level,sents,focus}=lesson;
  const chosen=(focus&&Array.isArray(focus.recallSentences)&&focus.recallSentences.length?focus.recallSentences:sents.filter(s=>s.length<180)).slice(0,10);
  const list=chosen.length?chosen:sents.slice(0,Math.min(10,sents.length));
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
    <div className="eyebrow">{t.stepPhases[5]}</div><h2>{t.recall.title}</h2>
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
    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={()=>move(idx-1)}>← {t.back}</button>
      <span className="tiny muted">{doneCount>=list.length?t.recall.done:t.recall.tryFirst}</span>
      {idx<list.length-1 ? <button className="btn btn-outline btn-sm" onClick={()=>move(idx+1)}>{t.gram.next} →</button> : <button className="btn btn-primary btn-sm" onClick={onContinue}>{t.continue} →</button>}
    </div>
  </div>);
}

function PracticeAI({lesson,onComplete}){
  const {t}=useUI();
  const [tab,setTab]=useState("write");
  const [wrote,setWrote]=useState(false); const [talked,setTalked]=useState(false);
  useEffect(()=>{ if(wrote&&talked&&onComplete) onComplete(); },[wrote,talked]);
  return (<div>
    <div className="eyebrow">{t.stepPhases[6]}</div><h2>{t.aiUse.title}</h2>
    <Teacher>{t.aiUse.teacher}</Teacher>
    <Purpose>{t.aiUse.purpose}</Purpose>
    <div className="tabs">
      <button className={"tab"+(tab==="write"?" on":"")} onClick={()=>setTab("write")}>{t.aiUse.writeTab} {wrote?"✓":""}</button>
      <button className={"tab"+(tab==="chat"?" on":"")} onClick={()=>{stopSpeak();setTab("chat");}}>{t.aiUse.chatTab} {talked?"✓":""}</button>
    </div>
    {tab==="write" ? <AIWrite lesson={lesson} onNext={()=>setTab("chat")} onDone={()=>setWrote(true)}/> : <AIChat lesson={lesson} onDone={()=>setTalked(true)}/>}
    <div className="tiny muted" style={{marginTop:12}}>{t.aiUse.unlock}</div>
  </div>);
}

function AIWrite({lesson,onNext,onDone}){
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
      <div style={{marginTop:14}}><button className="btn btn-primary btn-sm" onClick={onNext}>{t.aiUse.nextTalk} →</button></div>
    </div>)}
  </div>);
}

function AIChat({lesson,onDone}){
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
  const mockRef=useRef(false); const recRef=useRef(null);
  const MAX_TURNS=5;

  // Speak an AI line and reflect the "talking / your turn" state so it feels live.
  function sayAI(line){ setSpeaking(true); const u=speak(line,lang); if(u){ u.onend=()=>setSpeaking(false); } else setSpeaking(false); }

  async function aiReply(history,onChunk){
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"chat",stream:true,lang,level,vocab:vwords,topic,grammar,sample,history})});
      if(!r.ok) throw new Error("no api");
      const ct=r.headers.get("content-type")||"";
      if(r.body && !ct.includes("application/json")){
        const reader=r.body.getReader(); const decoder=new TextDecoder(); let text="";
        while(true){
          const {value,done}=await reader.read();
          if(done) break;
          text+=decoder.decode(value,{stream:true});
          onChunk&&onChunk(text);
        }
        text+=decoder.decode();
        if(text) onChunk&&onChunk(text);
        return text.trim()||null;
      }
      const d=await r.json(); return d.reply||null;
    }catch(e){ return null; }
  }
  useEffect(()=>{ (async()=>{
    setBusy(true);
    const reply=await aiReply([],partial=>{ mockRef.current=false; setMsgs([{who:"ai",t:partial}]); });
    if(reply){ mockRef.current=false; setMsgs([{who:"ai",t:reply}]); sayAI(reply); }
    else { mockRef.current=true; setMsgs([{who:"ai",t:fallback[0]}]); sayAI(fallback[0]); }
    setBusy(false);
  })(); return ()=>{stopSpeak(); stopMic();}; },[]);

  const full=draft.trim().split(/\s+/).filter(Boolean).length>=3;
  function toHistory(list){ return list.map(m=>({role:m.who==="ai"?"assistant":"user",content:m.t})); }

  // voice input (speech-to-text) in the target language — Chrome/Edge support this
  const SR = typeof window!=="undefined" && (window.SpeechRecognition||window.webkitSpeechRecognition);
  function startMic(){ if(!SR) return; stopSpeak();
    const r=new SR(); r.lang=LANG_CODE[lang]||"en-US"; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=(e)=>{ const t=e.results[0][0].transcript; setDraft(d=>(d?d+" ":"")+t); };
    r.onend=()=>setListening(false); r.onerror=()=>setListening(false);
    recRef.current=r; try{ r.start(); setListening(true); }catch(e){ setListening(false); } }
  function stopMic(){ if(recRef.current){ try{recRef.current.stop();}catch(e){} recRef.current=null; } setListening(false); }

  async function finish(list){ posthog.capture("conversation_practice_completed",{language:lang,level:level.slice(0,2),turn_count:turns+1,used_fallback:mockRef.current}); setDone(true); onDone&&onDone();
    if(mockRef.current) return;
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"evaluate",lang,level,history:toHistory(list),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})});
      if(r.ok) setEvalz(await r.json()); }catch(e){} }

  async function send(){ if(!full||busy) return; stopMic();
    const withMe=[...msgs,{who:"me",t:draft.trim()}]; const nx=turns+1;
    setMsgs(withMe); setDraft(""); setTurns(nx);
    if(nx>=MAX_TURNS){ finish(withMe); return; }
    if(mockRef.current){ const line=fallback[nx]||fallback[fallback.length-1]; setMsgs([...withMe,{who:"ai",t:line}]); sayAI(line); return; }
    setBusy(true);
    setMsgs([...withMe,{who:"ai",t:""}]);
    const reply=await aiReply(toHistory(withMe),partial=>setMsgs([...withMe,{who:"ai",t:partial}]));
    const line=reply||"👍"; setMsgs([...withMe,{who:"ai",t:line}]); if(reply) sayAI(line);
    setBusy(false);
  }

  const lastAi=[...msgs].reverse().find(m=>m.who==="ai");
  return (<div>
    <div className="notice" style={{marginBottom:14}}><span>🗣️</span>
      <span>{t.chat.notice(partner.name,shownLang,MAX_TURNS)}</span></div>

    {/* the person you're talking with */}
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
      {/* voice-first reply */}
      {SR ? (<div style={{textAlign:"center"}}>
        <button className={"btn "+(listening?"btn-primary":"btn-outline")} style={{fontSize:17,padding:"14px 26px",borderRadius:999}}
          onClick={listening?stopMic:startMic}>{listening?"● "+t.chat.listening:"🎤 "+t.chat.speakAnswer}</button>
        <div className="tiny muted" style={{marginTop:8}}>{t.chat.speakIn(shownLang)}</div>
      </div>) : <div className="tiny muted" style={{marginBottom:6}}>{t.chat.typeIn(shownLang)}</div>}
      <textarea style={{minHeight:56,marginTop:12}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t.chat.placeholder(shownLang)}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{full?t.chat.looksGood+" ✓":t.chat.shortSentence}</span>
        <button className="btn btn-primary btn-sm" disabled={!full||busy} onClick={send}>{t.chat.replyTo(partner.name)} →</button></div>

      {/* transcript, tucked below so it feels like a conversation, not a chat log */}
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
      </div>)}
  </div>);
}

function Done({lesson,diag,onNew,onReview}){
  const {t}=useUI();
  const name=(DB.get("email","")||"").split("@")[0]||t.done.friend;
  const fromDiag=(diag&&Array.isArray(diag.unknown)&&diag.unknown.length)?diag.unknown:null;
  const fromFocus=(lesson.focus&&Array.isArray(lesson.focus.vocab))?lesson.focus.vocab.map(v=>v.word):[];
  const wordList=(fromDiag||(fromFocus.length?fromFocus:(lesson.vlist||[]))).filter(Boolean).slice(0,6);
  return (<div className="done-wrap">
    <div className="done-emoji">🎉</div>
    <h1 className="done-h1">{t.done.title(name)}</h1>
    <p className="done-sub">{t.done.sub(STEPS.length)}</p>
    <div className="done-card">
      <div className="done-card-emoji">📚✨</div>
      <div className="done-card-title">{t.celebrate.explored(wordList.length)}</div>
      <div className="done-chips">{wordList.map(w=><span className="done-chip" key={w}>{w}</span>)}</div>
      <p className="done-card-note">{t.done.more}</p>
    </div>
    <div className="done-actions">
      <button className="btn btn-outline focusable" onClick={onReview}><Svg n="recall"/> {t.done.review}</button>
      <button className="btn btn-primary focusable" onClick={onNew}>{t.done.new} →</button>
    </div>
  </div>);
}

export { AIChat, AIWrite, BlindListen, DiagnosisMatrix, Done, GrammarStep, PracticeAI, ReadingCheck, RecallStep, TimedPractice, diagnosisCase };
