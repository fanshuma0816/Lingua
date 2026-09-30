"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Purpose, Say, StepHead, Teacher } from "../ui/elements";
import { LANG_CODE } from "../../config/constants";
import { useUI } from "../../hooks/useUI";
import { speak, stopSpeak } from "../../lib/audio";
import { buildRecallStagePlan, compareRecallAnswer, masteryForRecallItem, normalizeRecallText } from "../../lib/recall";
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
    </div>}
    {!!categories.length&&<div className="recall-category-list">{categories.map(key=><span className="badge badge-outline" key={key}>{t.recall.categories[key]}</span>)}</div>}
  </div>;
}

function recallLearningPoint(item,lesson,t){
  const phrase=normalizeRecallText(item.targetPhrase);
  const vocab=(lesson.focus?.vocab||[]).find(entry=>phrase.includes(normalizeRecallText(entry.word)));
  if(vocab) return {kind:t.recall.pointExpression,title:vocab.word||item.targetPhrase,body:vocab.reason||t.recall.expressionExplanation};
  if(/\b(moet|moeten|kan|kunnen|wil|willen|mag|mogen|zal|zullen)\b/i.test(item.targetPhrase)){
    return {kind:t.recall.pointGrammar,title:t.recall.modalTitle,body:t.recall.modalExplanation};
  }
  if(/\b(omdat|als|dat|terwijl|hoewel|wanneer)\b/i.test(item.targetPhrase)){
    return {kind:t.recall.pointGrammar,title:t.recall.subclauseTitle,body:t.recall.subclauseExplanation};
  }
  return {kind:t.recall.pointExpression,title:item.targetPhrase,body:t.recall.expressionExplanation};
}

function AnswerReview({item,lesson,t}){
  const sentence=item.sourceSentence;
  const at=sentence.indexOf(item.targetPhrase);
  const point=recallLearningPoint(item,lesson,t);
  return <div className="recall-revealed-answer">
    <div className="tiny muted recall-answer-label">{t.recall.correctAnswer}</div>
    <div className="recall-revealed-line notranslate" translate="no" lang={lesson.lang==="Dutch"?"nl":undefined}>
      {at>=0?<>{sentence.slice(0,at)}<span className="recall-focus-phrase">{item.targetPhrase}</span>{sentence.slice(at+item.targetPhrase.length)}</>:sentence}
    </div>
    <div className="row recall-revealed-tools"><Say text={item.sourceSentence} lang={lesson.lang}/></div>
    <div className="recall-learning-point"><span className="recall-learning-label">{t.recall.learningTip}</span><span className="badge badge-outline">{point.kind}</span><b>{point.title}</b><p>{point.body}</p></div>
  </div>;
}

function RecallStep({lesson,onComplete,onContinue,onSkip,onPrev,reviewOnly=false}){
  const {t,uiLang}=useUI();
  const lessonId=lesson?.localLessonId||lesson?.material?.id||lesson?.id||"current";
  const baseItemsByStage=useMemo(()=>{
    const plan=buildRecallStagePlan(lesson.sents||[],lesson.userWords||DB.get("unknownWords",[]),lesson.recallPlan?.items||lesson.recallPlan||[],3);
    return Object.fromEntries(Object.entries(plan).map(([key,entries])=>[key,entries.map(item=>({...item,translation:item.translation||(lesson.watch||[]).find(x=>x.s===item.sourceSentence)?.tr||""}))]));
  },[lessonId,lesson.recallPlan]);
  const stored=useMemo(()=>DB.get("recallState",null),[lessonId]);
  const initialItemsByStage=useMemo(()=>{
    if(stored?.lessonId===lessonId&&stored.version>=3&&stored.itemsByStage) return stored.itemsByStage;
    if(stored?.lessonId===lessonId&&Array.isArray(stored.items)){
      const legacy=new Map(stored.items.map(item=>[item.sourceSentence,item]));
      return {...baseItemsByStage,cloze:baseItemsByStage.cloze.map(item=>legacy.has(item.sourceSentence)?{...item,...legacy.get(item.sourceSentence)}:item)};
    }
    return baseItemsByStage;
  },[lessonId,stored,baseItemsByStage]);
  const initialSentenceItems=initialItemsByStage.sentence||[];
  const reviewSentenceItems=reviewOnly?initialSentenceItems.filter(item=>["developing","review"].includes(masteryForRecallItem(item))):initialSentenceItems;
  const [itemsByStage,setItemsByStage]=useState({...initialItemsByStage,cloze:initialItemsByStage.cloze||[],sentence:reviewSentenceItems.length?reviewSentenceItems:initialSentenceItems});
  const [stage,setStage]=useState(reviewOnly?"sentence":(stored?.lessonId===lessonId?stored.stage||"cloze":"cloze"));
  const [idxByStage,setIdxByStage]=useState(()=>stored?.lessonId===lessonId&&stored.idxByStage?stored.idxByStage:{cloze:stored?.stage==="cloze"?stored?.idx||0:0,sentence:stored?.stage==="sentence"?stored?.idx||0:0});
  const [draft,setDraft]=useState("");
  const [feedback,setFeedback]=useState(null);
  const [checking,setChecking]=useState(false);
  const [listening,setListening]=useState(false);
  const recRef=useRef(null);
  const stageItems=itemsByStage[stage]||[];
  const idx=Math.max(0,Math.min(Math.max(0,stageItems.length-1),idxByStage[stage]||0));
  const item=stageItems[idx];

  useEffect(()=>{
    const allItems=Object.values(itemsByStage).flat();
    if(!allItems.length||allItems.every(x=>x.translation)) return;
    let cancelled=false;
    const missing=allItems.filter(x=>!x.translation);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.sourceSentence),lang:lesson.lang,level:lesson.level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(data=>{
      if(cancelled||!Array.isArray(data?.translations)) return;
      setItemsByStage(current=>Object.fromEntries(Object.entries(current).map(([key,entries])=>[key,entries.map(entry=>{
          const at=missing.findIndex(x=>x.id===entry.id);
          return at>=0?{...entry,translation:data.translations[at]||entry.translation}:entry;
        })])));
    });
    return()=>{cancelled=true;};
  },[lessonId,uiLang]);

  useEffect(()=>{
    DB.set("recallState",{version:3,lessonId,stage,idx,idxByStage,itemsByStage});
    const answers={}; (itemsByStage.sentence||[]).forEach((entry,i)=>{ const attempt=entry.fullSentenceAttempts?.at(-1); if(attempt?.answer) answers[i]=attempt.answer; });
    DB.set("recallAnswers",answers);
  },[lessonId,stage,idx,idxByStage,itemsByStage]);
  useEffect(()=>()=>stopMic(),[]);

  const total=stageItems.length;
  const currentAttempts=stage==="cloze"?(item?.attempts||[]):(item?.fullSentenceAttempts||[]);
  const hasResult=!!feedback;
  const clozeComplete=(itemsByStage.cloze||[]).every(entry=>(entry.attempts||[]).length>0);
  const hiddenWords=item?.hiddenWords?.length?item.hiddenWords:(item?.targetPhrase?.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu)||[]);
  const phraseAt=item?item.sourceSentence.indexOf(item.targetPhrase):-1;
  const clozeBefore=item?(item.clozeBefore??(phraseAt>=0?item.sourceSentence.slice(0,phraseAt):"")):"";
  const clozeAfter=item?(item.clozeAfter??(phraseAt>=0?item.sourceSentence.slice(phraseAt+item.targetPhrase.length):"")):"";

  function updateCurrent(updater){ setItemsByStage(current=>({...current,[stage]:(current[stage]||[]).map((entry,i)=>i===idx?updater(entry):entry)})); }
  function setStageIndex(next){ setIdxByStage(current=>({...current,[stage]:Math.max(0,Math.min(stageItems.length-1,next))})); }
  function switchStage(next){
    stopMic(); setFeedback(null); setDraft(""); setStage(next);
  }
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
    const attempt={answer,accepted:!!result.accepted,categories:result.categories||[],usedHint:false,at:new Date().toISOString()};
    updateCurrent(entry=>{
      const next=stage==="cloze"?{...entry,attempts:[...(entry.attempts||[]),attempt]}:{...entry,fullSentenceAttempts:[...(entry.fullSentenceAttempts||[]),attempt]};
      next.mastery=masteryForRecallItem(next);
      next.reviewTargets=result.accepted?[]:[...new Set([...(next.reviewTargets||[]),entry.targetPhrase].filter(Boolean))];
      return next;
    });
    setFeedback(result); setChecking(false);
  }

  function retry(){ setFeedback(null); setDraft(""); }
  function advance(){
    stopMic(); setFeedback(null); setDraft("");
    if(idx<total-1){ setStageIndex(idx+1); return; }
    if(stage==="cloze"&&(itemsByStage.sentence||[]).length){ setStage("sentence"); return; }
    onComplete?.(); onContinue?.();
  }
  function back(){
    stopMic(); setFeedback(null); setDraft("");
    if(idx>0){ setStageIndex(idx-1); return; }
    if(stage==="sentence"&&!reviewOnly){ setStage("cloze"); return; }
    onPrev?.();
  }

  return <div className="recall-step">
    <StepHead eyebrow={t.nav.mods.recall} title={reviewOnly?t.recall.reviewTitle:t.recall.title} onSkip={onSkip} skipLabel={t.skipStep}/>
    <Teacher>{stage==="cloze"?t.recall.clozeTeacher:t.recall.sentenceTeacher}</Teacher>
    <Purpose>{stage==="cloze"?t.recall.clozePurpose:t.recall.sentencePurpose}</Purpose>
    <div className="tabs recall-level-tabs" aria-label={t.recall.levelProgress}>
      <button className={"tab"+(stage==="cloze"?" on":"")} onClick={()=>switchStage("cloze")}>{t.recall.levelCloze} {clozeComplete?"✓":""}</button>
      <button className={"tab"+(stage==="sentence"?" on":"")} onClick={()=>switchStage("sentence")}>{t.recall.levelSentence}</button>
    </div>
    {!item?<div className="card card-p recall-card"><Teacher>{t.recall.noItems}</Teacher></div>:<div className="card card-p recall-card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <span className="badge badge-outline">{t.recall.progress(idx+1,total)}</span>
        <span className="tiny muted">{t.recall.attempt(Math.max(1,currentAttempts.length+(hasResult?0:1)))}</span>
      </div>
      {stage==="cloze"?<>
        <div className="recall-mode-label">{item.clozeType==="dictation"?t.recall.dictation:t.recall.blindCloze}</div>
        {item.clozeType==="dictation"&&<button className="btn btn-outline recall-listen" onClick={()=>speak(item.sourceSentence,lesson.lang)}>▶ {t.recall.listen}</button>}
        {item.clozeType!=="dictation"&&item.translation&&<div className="translation-line">{item.translation}</div>}
        {!hasResult&&<div className="recall-prompt notranslate" translate="no" lang={lesson.lang==="Dutch"?"nl":undefined}>
          <span>{clozeBefore}</span><span className="recall-blank-group" aria-label={t.recall.blankCount(hiddenWords.length)}>{hiddenWords.map((word,index)=><span className="recall-word-blank" style={{"--blank-size":Math.max(3,Math.min(10,word.length))+"ch"}} key={`${word}-${index}`}/>)}</span><span>{clozeAfter}</span>
        </div>}
      </>:<div className="recall-cue-section">
        <h3 className="lbl">{t.recall.meaningCue}</h3>
        <div className="translation-line">{item.translation||t.recall.rebuildCue}</div>
      </div>}
      {!hasResult&&<div className="recall-answer-section">
        <h3 className="lbl">{stage==="cloze"?t.recall.missingExpression:t.recall.yourDutch}</h3>
        <textarea className="recall-answer-input" value={draft} onChange={e=>{setDraft(e.target.value); if(feedback)setFeedback(null);}} style={{minHeight:stage==="cloze"?58:96}} placeholder={stage==="cloze"?t.recall.clozePlaceholder:t.recall.placeholder}/>
      </div>}
      {!hasResult&&<div className="row recall-check-actions">
        {stage==="sentence"&&SR?<button className={"btn btn-sm "+(listening?"btn-primary":"btn-outline")} onClick={listening?stopMic:startMic}>🎤 {t.recall.speak}</button>:<span/>}
        <button className="btn btn-primary btn-sm" disabled={!draft.trim()||checking} onClick={check}>{checking?t.recall.checking:t.recall.check}</button>
      </div>}
      <RecallFeedback result={feedback} t={t}/>
      {hasResult&&<AnswerReview item={item} lesson={lesson} t={t}/>}
      {hasResult&&<div className="recall-result-actions">
        {!feedback.accepted&&<button className="btn btn-outline btn-sm" onClick={retry}>{t.recall.tryAgain}</button>}
        <button className="btn btn-primary btn-sm" onClick={advance}>{idx<total-1?t.recall.next:stage==="cloze"?t.recall.nextLevel:t.continue} →</button>
      </div>}
    </div>}
    <div className="sent-nav"><button className="btn btn-ghost btn-sm" onClick={back}>← {t.back}</button></div>
  </div>;
}

export { RecallFeedback, RecallStep };
