"use client";

import { useCallback, useRef, useState } from "react";
import { SyncReader } from "./Player";
import { GrammarStep, PracticeAI, RecallStep, Shadowing } from "./Steps";
import { Brand, CheckIn, Purpose, StepHead, Svg, Teacher } from "../ui/elements";
import { MODULES, STEPS, TOTAL_MIN, stepIndex } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useUI } from "../../hooks/useUI";
import { setLineTr } from "../../lib/trcache";

function SessionView({lesson,text,step,onPrev,onContinue,onSkip,onPreview}){
  const {t}=useUI();
  const S=STEPS[step]; const M=MODULES.find(m=>m.id===S.mod);
  const readerRef=useRef(null);
  const [readerPage,setReaderPage]=useState({page:0,pageCount:1,canPrevPage:false,canNextPage:false});
  const handleReaderPageState=useCallback((next)=>{
    setReaderPage(prev=>prev.page===next.page&&prev.pageCount===next.pageCount&&prev.canPrevPage===next.canPrevPage&&prev.canNextPage===next.canNextPage ? prev : next);
  },[]);
  const pct=Math.round(((step+1)/STEPS.length)*100);
  const stepMin=Math.max(1,Math.round(S.min*((lesson.estMin||TOTAL_MIN)/TOTAL_MIN)));
  const last=step===STEPS.length-1;
  const internalContinue=(S.kind==="grammar"||S.kind==="recall");
  const hideFoot=(S.kind==="grammar"||S.kind==="recall"||S.kind==="shadow");
  const readerControls=S.kind==="understand";
  const expectedReaderPageCount=Math.max(1,Math.ceil(((lesson&&lesson.sents)||[]).length/5));
  const effectiveReaderPage=readerControls&&readerPage.pageCount===1&&expectedReaderPageCount>1
    ? {...readerPage,pageCount:expectedReaderPageCount,canNextPage:true}
    : readerPage;
  const canNextReaderPage=readerControls&&effectiveReaderPage.canNextPage;
  const canPrevReaderPage=readerControls&&effectiveReaderPage.canPrevPage;
  const backAction=canPrevReaderPage ? ()=>readerRef.current?.prevPage() : (step===0?onPreview:onPrev);
  const continueAction=canNextReaderPage ? ()=>readerRef.current?.nextPage() : onContinue;
  const backLabel=canPrevReaderPage ? t.previousPage : (step===0?t.backToPreview:t.previous);
  const continueLabel=canNextReaderPage ? t.nextPage : (last?t.finish:t.continue);
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta">
        <span className="tiny muted">{t.nav.mods[M.id]} · {t.nav.steps[S.id]}</span>
        <span className="tiny muted">{t.min(stepMin)}</span></div>
    </div>
    <div className="stage"><StepBody step={S} lesson={lesson} text={text} onContinue={onContinue} onSkip={onSkip} onPrev={step===0?onPreview:onPrev} readerRef={readerRef} onReaderPageState={handleReaderPageState}/></div>
    {!hideFoot && <div className="footnav">
      <button className="btn btn-ghost btn-sm focusable" onClick={backAction}>← {backLabel}</button>
      <div className="row" style={{gap:8}}>
        {!internalContinue && <button className="btn btn-primary btn-sm focusable" onClick={continueAction}>{continueLabel}{last&&!canNextReaderPage?" ✓":" →"}</button>}
      </div>
    </div>}
  </div>);
}

function StepBody({step,lesson,text,onContinue,onSkip,onPrev,readerRef,onReaderPageState}){
  const {t}=useUI();
  const {lang}=lesson; const sents=lesson.sents;
  switch(step.kind){
    case "understand": return (<div>
      <StepHead eyebrow={t.nav.mods.understanding} title={t.nav.steps.understanding} onSkip={onSkip} skipLabel={t.skipStep}/>
      <Teacher>{t.watch.teacher}</Teacher>
      <Purpose>{t.watch.purpose}</Purpose>
      <SyncReader ref={readerRef} key="understand-reader" controls="external" onPageStateChange={onReaderPageState} items={sents.map((s)=>({s,tr:(lesson.watch||[]).find(x=>x.s===s)?.tr||null}))} lang={lang} level={lesson.level} translation={true} onTranslated={(sen,tr)=>setLineTr("en",sen,tr)}/>
      <CheckIn>{t.watch.check}</CheckIn>
    </div>);
    case "grammar": return <GrammarStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue} onSkip={onSkip} onPrev={onPrev}/>;
    case "shadow":  return <Shadowing key="shadow" sents={sents} lang={lang} onSkip={onSkip} onPrev={onPrev} onContinue={onContinue}/>;
    case "recall":  return <RecallStep lesson={lesson} onComplete={()=>{}} onContinue={onContinue} onSkip={onSkip} onPrev={onPrev}/>;
    default:        return <PracticeAI lesson={lesson} onComplete={()=>{}} onSkip={onSkip}/>;
  }
}

function Sidebar({mode,lesson,step,doneSet,go,onBackHome,showBack}){
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
      {!canJump && <div className="side-hint">{t.nav.lockedHint}</div>}
      {MODULES.map(m=>{
        const s=STEPS.find(x=>x.mod===m.id); const idx=stepIndex(s.id);
        const done=doneSet.has(s.id);
        const cur=mode==="session"&&idx===step;
        const dis=!canJump;
        return (<div className="nav-group" key={m.id}>
          <button className={"group-trigger focusable"+(dis?" disabled":"")} data-hasactive={cur?"true":"false"} aria-disabled={dis} disabled={dis}
            onClick={()=>{ if(!dis) go(s.id); }}>
            <span className="gicon"><Svg n={m.icon}/></span>
            <span className="gname">{t.nav.mods[m.id]}</span>
            <span style={{marginLeft:"auto",fontSize:11,lineHeight:1,color:done?"hsl(var(--success))":cur?"hsl(var(--foreground))":"hsl(var(--muted-foreground)/.45)"}}>{done?"✓":cur?"●":""}</span>
          </button>
        </div>);
      })}
    </nav>
    <div className="side-foot">
      {showBack
        ? <button className="btn btn-outline btn-sm focusable" onClick={onBackHome} title={t.nav.backHome}><Svg n="home"/> {t.nav.backHome}</button>
        : <span className="tiny muted">{t.nav.previewHint}</span>}
    </div>
  </aside>);
}

export { SessionView, Sidebar, StepBody };
