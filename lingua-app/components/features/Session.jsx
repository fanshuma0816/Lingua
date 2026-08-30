"use client";

import { SyncReader } from "./Player";
import { GrammarStep, PracticeAI, RecallStep, Shadowing } from "./Steps";
import { Brand, CheckIn, Purpose, Svg, Teacher } from "../ui/elements";
import { MODULES, STEPS, TOTAL_MIN, stepIndex } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useUI } from "../../hooks/useUI";
import { setLineTr } from "../../lib/trcache";

function SessionView({lesson,text,step,onPrev,onContinue,onSkip}){
  const {t}=useUI();
  const S=STEPS[step]; const M=MODULES.find(m=>m.id===S.mod);
  const pct=Math.round(((step+1)/STEPS.length)*100);
  const stepMin=Math.max(1,Math.round(S.min*((lesson.estMin||TOTAL_MIN)/TOTAL_MIN)));
  const last=step===STEPS.length-1;
  const internalContinue=(S.kind==="grammar"||S.kind==="recall");
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta">
        <span className="tiny muted">{t.nav.mods[M.id]} · {t.nav.steps[S.id]}</span>
        <span className="tiny muted">{t.min(stepMin)}</span></div>
    </div>
    <div className="stage"><StepBody step={S} lesson={lesson} text={text} onContinue={onContinue}/></div>
    <div className="footnav">
      <button className="btn btn-outline btn-sm focusable" disabled={step===0} onClick={onPrev}>← {t.previous}</button>
      <div className="row" style={{gap:8}}>
        <button className="btn btn-ghost btn-sm focusable" onClick={onSkip}>{t.skipStep}</button>
        {!internalContinue && <button className="btn btn-primary btn-sm focusable" onClick={onContinue}>{last?`${t.finish} ✓`:`${t.continue} →`}</button>}
      </div>
    </div>
  </div>);
}

function StepBody({step,lesson,text,onContinue}){
  const {t,uiLang}=useUI();
  const {lang}=lesson; const sents=lesson.sents;
  switch(step.kind){
    case "understand": return (<div>
      <div className="eyebrow">{t.nav.mods.understanding}</div><h2>{t.nav.steps.understanding}</h2>
      <Teacher>{t.watch.teacher}</Teacher>
      <Purpose>{t.watch.purpose}</Purpose>
      <SyncReader key="understand-reader" items={sents.map((s)=>({s,tr:(lesson.watch||[]).find(x=>x.s===s)?.tr||null}))} lang={lang} level={lesson.level} translation={true} onTranslated={(sen,tr)=>setLineTr(uiLang,sen,tr)}/>
      <CheckIn>{t.watch.check}</CheckIn>
    </div>);
    case "grammar": return <GrammarStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue}/>;
    case "shadow":  return <Shadowing key="shadow" sents={sents} lang={lang}/>;
    case "recall":  return <RecallStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue}/>;
    default:        return <PracticeAI lesson={lesson} onComplete={()=>{}}/>;
  }
}

function Sidebar({mode,lesson,step,doneSet,go,onBackHome}){
  const {t}=useUI();
  const progress=mode==="done"?100:Math.round(doneSet.size/STEPS.length*100);
  const ctx=mode==="home"||!lesson ? t.nav.ctx : t.nav.ctxSession(langName(t,lesson.lang),(lesson.level||"").split(" — ")[0]);
  const canJump=mode==="session"||mode==="done";
  return (<aside className="sidebar">
    <div className="side-head">
      <div className="side-head-row"><Brand/></div>
      <div className="ctx">{ctx}</div>
      <div className="side-progress" style={{visibility:(mode==="session"||mode==="done")?"visible":"hidden"}}>
        <div className="prog"><span style={{width:progress+"%"}}/></div></div>
    </div>
    <nav className="side-nav" aria-label="Learning modules">
      {MODULES.map(m=>{
        const s=STEPS.find(x=>x.mod===m.id); const idx=stepIndex(s.id);
        const done=doneSet.has(s.id);
        const cur=mode==="session"&&idx===step;
        const dis=!canJump;
        return (<div className="nav-group" key={m.id}>
          <button className="group-trigger focusable" data-hasactive={cur?"true":"false"} aria-disabled={dis}
            onClick={()=>{ if(!dis) go(s.id); }}>
            <span className="gicon"><Svg n={m.icon}/></span>
            <span className="gname">{t.nav.mods[m.id]}</span>
            <span style={{marginLeft:"auto",fontSize:11,lineHeight:1,color:done?"hsl(var(--success))":cur?"hsl(var(--foreground))":"hsl(var(--muted-foreground)/.45)"}}>{done?"✓":cur?"●":""}</span>
          </button>
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
