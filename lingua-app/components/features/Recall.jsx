"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Purpose, Say, StepHead, Teacher } from "../ui/elements";
import { LANG_CODE } from "../../config/constants";
import { useUI } from "../../hooks/useUI";
import { speak, stopSpeak } from "../../lib/audio";
import { compareRecallAnswer, masteryForRecallItem, mergeRecallPlan, summarizeRecall } from "../../lib/recall";
import { DB } from "../../lib/storage";
import { cachedAiAnalyze } from "../../services/api";

function DiffLine({label,segments=[]}){
  return <div className="recall-diff-line"><span className="tiny muted">{label}</span><div className="recall-diff-words">
    {segments.map((part,index)=><span className={part.status} key={`${part.token}-${index}`}>{part.token}</span>)}
  </div></div>;
}

function RecallFeedback({result,t}){
  if(!result) return null;
  const categories=(result.categories||[]).filter(key=>t.recall.categories[key]);
  return <div className={"recall-feedback "+(result.accepted?"accepted":"needs-work")}>
    <div className="recall-feedback-title">{result.accepted?t.recall.feedbackCorrect:t.recall.feedbackImprove}</div>
    {result.shortFeedback&&<p>{result.shortFeedback}</p>}
    {result.diff&&<div className="recall-diff">
      <DiffLine label={t.recall.youWrote} segments={result.diff.actual}/>
      <DiffLine label={t.recall.expected} segments={result.diff.expected}/>
    </div>}
    {!!categories.length&&<div className="recall-category-list">{categories.map(key=><span className="badge badge-outline" key={key}>{t.recall.categories[key]}</span>)}</div>}
  </div>;
}

function RecallStep({lesson,onComplete,onContinue,onSkip,onPrev,reviewOnly=false}){
  const {t,uiLang}=useUI();
  const lessonId=lesson?.localLessonId||lesson?.material?.id||lesson?.id||"current";
  const baseItems=useMemo(()=>{
    const plan=mergeRecallPlan(lesson.sents||[],lesson.userWords||DB.get("unknownWords",[]),lesson.recallPlan?.items||lesson.recallPlan||[],3);
    return plan.map(item=>({...item,translation:item.translation||(lesson.watch||[]).find(x=>x.s===item.sourceSentence)?.tr||""}));
  },[lessonId,lesson.recallPlan]);
  const stored=useMemo(()=>DB.get("recallState",null),[lessonId]);
  const initialItems=stored?.lessonId===lessonId&&Array.isArray(stored.items)&&stored.items.length?stored.items:baseItems;
  const filteredItems=reviewOnly?initialItems.filter(item=>["developing","review"].includes(masteryForRecallItem(item))):initialItems;
  const [items,setItems]=useState(filteredItems.length?filteredItems:initialItems);
  const [stage,setStage]=useState(reviewOnly?"sentence":(stored?.lessonId===lessonId?stored.stage||"cloze":"cloze"));
  const [idx,setIdx]=useState(reviewOnly?0:(stored?.lessonId===lessonId?stored.idx||0:0));
  const [draft,setDraft]=useState("");
  const [feedback,setFeedback]=useState(null);
  const [checking,setChecking]=useState(false);
  const [listening,setListening]=useState(false);
  const recRef=useRef(null);
  const item=items[idx]||items[0];

  useEffect(()=>{
    if(!items.length||items.every(x=>x.translation)) return;
    let cancelled=false;
    const missing=items.filter(x=>!x.translation);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.sourceSentence),lang:lesson.lang,level:lesson.level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(data=>{
      if(cancelled||!Array.isArray(data?.translations)) return;
      setItems(current=>current.map(entry=>{
        const at=missing.findIndex(x=>x.id===entry.id);
        return at>=0?{...entry,translation:data.translations[at]||entry.translation}:entry;
      }));
    });
    return()=>{cancelled=true;};
  },[lessonId,uiLang]);

  useEffect(()=>{
    DB.set("recallState",{version:2,lessonId,stage,idx,items});
    const answers={}; items.forEach((entry,i)=>{ const attempt=entry.fullSentenceAttempts?.at(-1); if(attempt?.answer) answers[i]=attempt.answer; });
    DB.set("recallAnswers",answers);
  },[lessonId,stage,idx,items]);
  useEffect(()=>()=>stopMic(),[]);

  if(!item) return <div><StepHead eyebrow={t.nav.mods.recall} title={t.recall.title} onSkip={onSkip} skipLabel={t.skipStep}/><Teacher>{t.recall.noItems}</Teacher></div>;

  const total=items.length;
  const currentAttempts=stage==="cloze"?(item.attempts||[]):(item.fullSentenceAttempts||[]);
  const hasResult=!!feedback;
  const revealed=stage==="cloze"?!!item.revealedCloze:!!item.revealedSentence;

  function updateCurrent(updater){ setItems(current=>current.map((entry,i)=>i===idx?updater(entry):entry)); }
  function stopMic(){ if(recRef.current){ try{recRef.current.stop(); }catch(e){} recRef.current=null; } setListening(false); }
  const SR=typeof window!=="undefined"&&(window.SpeechRecognition||window.webkitSpeechRecognition);
  function startMic(){
    if(!SR) return;
    stopSpeak(); const recognition=new SR(); recognition.lang=LANG_CODE[lesson.lang]||"nl-NL"; recognition.interimResults=false; recognition.maxAlternatives=1;
    recognition.onresult=e=>setDraft(value=>(value+" "+e.results[0][0].transcript).trim());
    recognition.onend=()=>setListening(false); recognition.onerror=()=>setListening(false); recRef.current=recognition;
    try{ recognition.start(); setListening(true); }catch(e){ setListening(false); }
  }

  function check(){
    const answer=draft.trim(); if(!answer||checking) return;
    setChecking(true);
    let result=compareRecallAnswer(answer,stage==="cloze"?item.targetPhrase:item.sourceSentence,{sentence:stage==="sentence"});
    const attempt={answer,accepted:!!result.accepted,categories:result.categories||[],usedHint:revealed,at:new Date().toISOString()};
    updateCurrent(entry=>{
      const next=stage==="cloze"?{...entry,attempts:[...(entry.attempts||[]),attempt]}:{...entry,fullSentenceAttempts:[...(entry.fullSentenceAttempts||[]),attempt]};
      next.mastery=masteryForRecallItem(next);
      next.reviewTargets=result.accepted?[]:[...new Set([...(next.reviewTargets||[]),entry.targetPhrase].filter(Boolean))];
      return next;
    });
    setFeedback(result); setChecking(false);
  }

  function reveal(){
    updateCurrent(entry=>{
      const next=stage==="cloze"?{...entry,revealedCloze:true}:{...entry,revealedSentence:true};
      return {...next,mastery:masteryForRecallItem(next)};
    });
    setFeedback(compareRecallAnswer(draft,stage==="cloze"?item.targetPhrase:item.sourceSentence,{sentence:stage==="sentence"}));
  }

  function retry(){ setFeedback(null); setDraft(""); }
  function advance(){
    stopMic(); setFeedback(null); setDraft("");
    if(idx<total-1){ setIdx(i=>i+1); return; }
    if(stage==="cloze"){ setStage("sentence"); setIdx(0); return; }
    onComplete?.(); onContinue?.();
  }
  function back(){
    stopMic(); setFeedback(null); setDraft("");
    if(idx>0){ setIdx(i=>i-1); return; }
    if(stage==="sentence"&&!reviewOnly){ setStage("cloze"); setIdx(total-1); return; }
    onPrev?.();
  }

  return <div className="recall-step">
    <StepHead eyebrow={t.nav.mods.recall} title={reviewOnly?t.recall.reviewTitle:t.recall.title} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{stage==="cloze"?t.recall.clozeTeacher:t.recall.sentenceTeacher}</Teacher>
    <Purpose>{stage==="cloze"?t.recall.clozePurpose:t.recall.sentencePurpose}</Purpose>
    <div className="recall-levels" aria-label={t.recall.levelProgress}>
      <span className={stage==="cloze"?"on":"done"}>1 · {t.recall.levelCloze}</span>
      <span className={stage==="sentence"?"on":""}>2 · {t.recall.levelSentence}</span>
    </div>
    <div className="card card-p recall-card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <span className="badge badge-outline">{t.recall.progress(idx+1,total)}</span>
        <span className="tiny muted">{t.recall.attempt(Math.max(1,currentAttempts.length+(hasResult?0:1)))}</span>
      </div>
      {stage==="cloze"?<>
        <div className="recall-mode-label">{item.clozeType==="dictation"?t.recall.dictation:t.recall.blindCloze}</div>
        {item.clozeType==="dictation"&&<button className="btn btn-outline recall-listen" onClick={()=>speak(item.sourceSentence,lesson.lang)}>▶ {t.recall.listen}</button>}
        {item.clozeType!=="dictation"&&item.translation&&<div className="translation-line">{item.translation}</div>}
        <div className="recall-prompt notranslate" translate="no" lang={lesson.lang==="Dutch"?"nl":undefined}>{item.clozeText}</div>
      </>:<>
        <h3 className="lbl">{t.recall.meaningCue}</h3>
        <div className="translation-line">{item.translation||t.recall.rebuildCue}</div>
      </>}
      <h3 className="lbl">{stage==="cloze"?t.recall.missingExpression:t.recall.yourDutch}</h3>
      <textarea value={draft} onChange={e=>{setDraft(e.target.value); if(feedback)setFeedback(null);}} style={{minHeight:stage==="cloze"?58:96}} placeholder={stage==="cloze"?t.recall.clozePlaceholder:t.recall.placeholder}/>
      <div className="row recall-check-actions">
        {stage==="sentence"&&SR?<button className={"btn btn-sm "+(listening?"btn-primary":"btn-outline")} onClick={listening?stopMic:startMic}>🎤 {t.recall.speak}</button>:<span/>}
        <button className="btn btn-primary btn-sm" disabled={!draft.trim()||checking} onClick={check}>{checking?t.recall.checking:t.recall.check}</button>
      </div>
      <RecallFeedback result={feedback} t={t}/>
      {hasResult&&<div className="recall-result-actions">
        {!feedback.accepted&&<button className="btn btn-outline btn-sm" onClick={retry}>{t.recall.tryAgain}</button>}
        {!feedback.accepted&&!revealed&&<button className="btn btn-ghost btn-sm" onClick={reveal}>{t.recall.showAnswer}</button>}
        {(feedback.accepted||revealed)&&<button className="btn btn-primary btn-sm" onClick={advance}>{idx<total-1?t.recall.next:stage==="cloze"?t.recall.nextLevel:t.continue} →</button>}
      </div>}
      {revealed&&<div className="recall-reference">
        <h3 className="lbl">{t.recall.reference}</h3>
        <div className="notranslate" translate="no" lang={lesson.lang==="Dutch"?"nl":undefined}>{stage==="cloze"?item.targetPhrase:item.sourceSentence}</div>
        <Say text={item.sourceSentence} lang={lesson.lang}/>
      </div>}
    </div>
    <div className="sent-nav"><button className="btn btn-ghost btn-sm" onClick={back}>← {t.back}</button></div>
  </div>;
}

function RecallEvidence({lesson}){
  const {t}=useUI();
  const lessonId=lesson?.localLessonId||lesson?.material?.id||lesson?.id||"current";
  const state=DB.get("recallState",null);
  if(state?.lessonId!==lessonId||!Array.isArray(state.items)||!state.items.length) return null;
  const summary=summarizeRecall(state.items);
  return <div className="done-card recall-evidence-card">
    <div className="done-card-title">{t.recallEvidence.title}</div>
    <p className="done-card-note">{t.recallEvidence.subtitle}</p>
    <div className="recall-evidence-stats">
      <div><b>{summary.counts.independent}</b><span>{t.recallEvidence.independent}</span></div>
      <div><b>{summary.counts.supported}</b><span>{t.recallEvidence.supported}</span></div>
      <div><b>{summary.counts.developing+summary.counts.review}</b><span>{t.recallEvidence.toReview}</span></div>
    </div>
    {!!summary.mastered.length&&<section className="recall-evidence-section">
      <h3>{t.recallEvidence.learned}</h3>
      <div className="row wrap" style={{gap:6}}>{summary.mastered.map(text=><span className="badge" key={text}>{text}</span>)}</div>
    </section>}
    {!!summary.review.length&&<section className="recall-evidence-section review">
      <h3>{t.recallEvidence.reviewTitle}</h3>
      {summary.review.map(entry=><div className="recall-review-item" key={entry.id}>
        <b className="notranslate" translate="no" lang={lesson.lang==="Dutch"?"nl":undefined}>{entry.target}</b>
        <span className="tiny muted">{entry.categories.length?entry.categories.map(key=>t.recall.categories[key]).filter(Boolean).join(" · "):t.recallEvidence.needsPractice}</span>
      </div>)}
    </section>}
  </div>;
}

export { RecallEvidence, RecallFeedback, RecallStep };
