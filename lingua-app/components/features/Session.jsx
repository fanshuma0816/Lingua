"use client";

import { SyncReader } from "./Player";
import { BlindListen, DiagnosisMatrix, GrammarStep, PracticeAI, ReadingCheck, RecallStep, TimedPractice } from "./Steps";
import { Brand, CheckIn, Purpose, Svg, Teacher } from "../ui/elements";
import { MODULES, STEPS, TOTAL_MIN, stepIndex } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useUI } from "../../hooks/useUI";

function SessionView({lesson,text,step,onPrev,onContinue,diag,setDiag}){
  const {t}=useUI();
  const S=STEPS[step]; const M=MODULES.find(m=>m.id===S.mod);
  const pct=Math.round(((step+1)/STEPS.length)*100);
  const stepMin=Math.max(1,Math.round(S.min*((lesson.estMin||TOTAL_MIN)/TOTAL_MIN)));
  const last=step===STEPS.length-1;
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta">
        <span className="tiny muted">{t.nav.mods[M.id]} · {t.nav.steps[S.id]}</span>
        <span className="tiny muted">{t.min(stepMin)}</span></div>
    </div>
    <div className="stage"><StepBody step={S} lesson={lesson} text={text} diag={diag} setDiag={setDiag} onContinue={onContinue}/></div>
    {!(S.kind==="grammar"||S.kind==="recall") && <div className="footnav">
      <button className="btn btn-outline btn-sm focusable" disabled={step===0} onClick={onPrev}>← {t.previous}</button>
      <button className="btn btn-primary btn-sm focusable" onClick={onContinue}>{last?`${t.finish} ✓`:`${t.continue} →`}</button>
    </div>}
  </div>);
}

function StepBody({step,lesson,text,diag,setDiag,onContinue}){
  const {t}=useUI();
  const {lang}=lesson; const sents=lesson.sents;
  switch(step.kind){
    case "reading": return <ReadingCheck lesson={lesson} text={text} diag={diag} setDiag={setDiag}/>;
    case "listen":  return <BlindListen lesson={lesson} text={text} diag={diag} setDiag={setDiag}/>;
    case "diag":    return <DiagnosisMatrix lesson={lesson} diag={diag}/>;
    case "watch": return (<div>
      <div className="eyebrow">{t.nav.mods.learn}</div><h2>{t.nav.steps.l1}</h2>
      <Teacher>{t.watch.teacher}</Teacher>
      <Purpose>{t.watch.purpose}</Purpose>
      <SyncReader key="watch-reader" items={sents.map((s)=>({s,tr:(lesson.watch||[]).find(x=>x.s===s)?.tr||null}))} lang={lang} level={lesson.level} translation={true}/>
      <CheckIn>{t.watch.check}</CheckIn>
    </div>);
    case "grammar": return <GrammarStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue}/>;
    case "subs":    return <TimedPractice key="subs" sents={sents} lang={lang} withSubs={true}/>;
    case "nosubs":  return <TimedPractice key="nosubs" sents={sents} lang={lang} withSubs={false}/>;
    case "recall":  return <RecallStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue}/>;
    default:        return <PracticeAI lesson={lesson} onComplete={()=>{}}/>;
  }
}

function Sidebar({mode,lesson,step,doneSet,openMod,setOpenMod,go,onBackHome}){
  const {t}=useUI();
  const progress=mode==="done"?100:Math.round(doneSet.size/STEPS.length*100);
  const ctx=mode==="home"||!lesson ? t.nav.ctx : t.nav.ctxSession(langName(t,lesson.lang),(lesson.level||"").split(" — ")[0]);
  return (<aside className="sidebar">
    <div className="side-head">
      <div className="side-head-row"><Brand/></div>
      <div className="ctx">{ctx}</div>
      <div className="side-progress" style={{visibility:(mode==="session"||mode==="done")?"visible":"hidden"}}>
        <div className="prog"><span style={{width:progress+"%"}}/></div></div>
    </div>
    <nav className="side-nav" aria-label="Learning modules">
      {MODULES.map(m=>{
        const steps=STEPS.filter(s=>s.mod===m.id);
        const isOpen=openMod===m.id;
        const hasActive=mode==="session"&&STEPS[step]&&STEPS[step].mod===m.id;
        return (<div className="nav-group" key={m.id}>
          <button className="group-trigger focusable" data-hasactive={hasActive} aria-expanded={isOpen}
            onClick={()=>setOpenMod(isOpen?null:m.id)}>
            <span className="gicon"><Svg n={m.icon}/></span>
            <span className="gname">{t.nav.mods[m.id]}</span></button>
          <div className={"group-content"+(isOpen?" open":"")}><div className="inner"><div className="inner-lines">
            {steps.map(s=>{
              const idx=stepIndex(s.id);
              const done=doneSet.has(s.id);
              const cur=mode!=="home"&&idx===step;
              const dis=mode==="home";
              return (<button key={s.id} className="navlink focusable" aria-current={cur} aria-disabled={dis}
                onClick={()=>{ if(!dis) go(s.id); }}>
                <span className={"nmk"+(done?" done":"")}>{done?<Svg n="check"/>:cur?"●":"·"}</span>
                <span>{t.nav.steps[s.id]}</span></button>);
            })}
          </div></div></div>
        </div>);
      })}
    </nav>
    <div className="side-foot">
      {mode!=="home"
        ? <button className="btn btn-outline btn-sm focusable" onClick={onBackHome} title={t.nav.backHome}><Svg n="home"/> {t.nav.backHome}</button>
        : <span className="tiny muted">{t.nav.previewHint}</span>}
    </div>
  </aside>);
}

export { SessionView, Sidebar, StepBody };
