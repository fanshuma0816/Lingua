"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Login } from "./Login";
import { SessionView, Sidebar } from "./Session";
import { InputScreen, Preview } from "./Setup";
import { Done, QuickScan } from "./Steps";
import { Loading, Svg } from "../ui/elements";
import { STEPS, STEP_SLUG, stepIndex } from "../../config/constants";
import { UI_TEXT } from "../../config/uiText";
import { UIContext } from "../../hooks/useUI";
import { stopSpeak } from "../../lib/audio";
import { scrollToTop } from "../../lib/format";
import { generateLesson } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { clearLineTr } from "../../lib/trcache";
import { cachedAiAnalyze } from "../../services/api";

function stepPath(index){ const s=STEPS[Math.max(0,Math.min(STEPS.length-1,index))]; return "/learn/"+STEP_SLUG[s.mod]; }

function routeState(pathname){
  const path=(pathname||"/").replace(/\/+$/,"")||"/";
  if(path==="/find") return {screen:"input",inputMode:"find",path:"/find"};
  if(path==="/import") return {screen:"input",inputMode:"material",path:"/import"};
  if(path==="/scan") return {screen:"scan",inputMode:null,path:"/scan"};
  if(path==="/preview") return {screen:"preview",inputMode:null,path:"/preview"};
  if(path==="/done") return {screen:"done",inputMode:null,path:"/done"};
  if(path==="/learn") return {screen:"lesson",inputMode:null,path:stepPath(0),stepIndex:0};
  if(path.startsWith("/learn/")){ const slug=path.slice(7); const i=STEPS.findIndex(s=>STEP_SLUG[s.mod]===slug); return {screen:"lesson",inputMode:null,path,stepIndex:i>=0?i:0}; }
  return {screen:"input",inputMode:null,path:"/"};
}

function App(){
  const router=useRouter();
  const pathname=usePathname()||"/";
  const currentRoute=routeState(pathname);
  const [uiLang,setUiLangState]=useState(DB.get("uiLang","en"));
  const t=UI_TEXT[uiLang]||UI_TEXT.en;
  function setUiLang(next){ setUiLangState(next); DB.set("uiLang",next); }
  useEffect(()=>{ document.documentElement.lang=uiLang==="zh"?"zh-CN":"en"; },[uiLang]);
  useEffect(()=>{
    const email=DB.get("email","");
    if(!email) return;
    const userId=DB.get("userId",crypto.randomUUID());
    DB.set("userId",userId);
    posthog.identify(userId,{email});
  },[]);
  const [screen,setScreen]=useState(DB.get("email")?currentRoute.screen:"login");
  const [lesson,setLesson]=useState(()=>DB.get("currentLesson",null)); const [text,setText]=useState(()=>DB.get("currentText",""));
  const [theme,setTheme]=useState(DB.get("theme","light"));
  const [pinned,setPinned]=useState(false);
  const [step,setStep]=useState(()=>currentRoute.stepIndex||0);
  const [doneSet,setDoneSet]=useState(()=>new Set());
  const [userWords,setUserWords]=useState(()=>DB.get("unknownWords",[])||[]);
  const [narrow,setNarrow]=useState(false);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen,step]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);
  // The learning path (sidebar) stays open by default on desktop; the learner
  // can still collapse it with the toggle. On narrow screens it starts closed.
  useEffect(()=>{ if(typeof window!=="undefined") setPinned(window.innerWidth>=1200); },[]);
  useEffect(()=>{
    if(screen==="login") return;
    const r=routeState(pathname);
    if((r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"||r.screen==="done")&&!lesson){ setScreen("input"); if(pathname!=="/") router.replace("/"); return; }
    if(r.screen==="lesson") setStep(r.stepIndex||0);
    setScreen(r.screen);
  },[pathname]);

  function navigateTo(nextScreen,path){ setScreen(nextScreen); if(pathname!==path) router.push(path); }
  function replaceWith(path){ if(pathname!==path) router.replace(path); }
  function continueAfterLogin(){
    const r=routeState(pathname);
    if((r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"||r.screen==="done")&&!lesson){ navigateTo("input","/"); return; }
    if(r.screen==="input"){ navigateTo("input",r.path); return; }
    navigateTo("input","/");
  }
  function toggleTheme(){ setTheme(v=>{ const n=v==="dark"?"light":"dark"; DB.set("theme",n); return n; }); }
  function toggleSide(){ setPinned(p=>!p); }
  function clearAll(){ if(confirm(t.clearConfirm)){posthog.reset();DB.clearAll();location.reload();} }

  function resetSession(){ setStep(0); setDoneSet(new Set()); }
  function goStep(index){ const n=Math.max(0,Math.min(STEPS.length-1,index)); setStep(n); navigateTo("lesson",stepPath(n)); if(typeof window!=="undefined"&&window.innerWidth<1200) setPinned(false); scrollToTop(); }
  function startSession(){ resetSession(); posthog.capture("learning_session_started",{session_type:"new",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function reviewSession(){ resetSession(); posthog.capture("learning_session_started",{session_type:"review",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function go(id){ const idx=stepIndex(id); if(idx<0) return; goStep(idx); }
  function onContinue(){ const cur=STEPS[step]; posthog.capture("learning_step_completed",{step_id:cur.id,module_id:cur.mod,step_number:step+1}); setDoneSet(prev=>new Set(prev).add(cur.id));
    if(step===STEPS.length-1){ posthog.capture("learning_session_completed",{language:lesson?.lang,level:lesson?.level?.slice(0,2),step_count:STEPS.length}); navigateTo("done","/done"); } else { goStep(step+1); } }
  function onSkip(){ const cur=STEPS[step]; posthog.capture("learning_step_skipped",{step_id:cur.id,module_id:cur.mod,step_number:step+1});
    if(step===STEPS.length-1){ navigateTo("done","/done"); } else { goStep(step+1); } }
  function onPrev(){ goStep(Math.max(0,step-1)); }

  // Quick scan → Preview
  function scanDone(list){ const arr=Array.isArray(list)?list:[]; setUserWords(arr); DB.set("unknownWords",arr); setLesson(cur=>cur?{...cur,userWords:arr}:cur); posthog.capture("quick_scan_completed",{language:lesson?.lang,word_count:arr.length}); navigateTo("preview","/preview"); }
  function scanSkip(){ setUserWords([]); DB.set("unknownWords",[]); setLesson(cur=>cur?{...cur,userWords:[]}:cur); posthog.capture("quick_scan_skipped",{language:lesson?.lang}); navigateTo("preview","/preview"); }

  async function loadLesson(d){ posthog.capture("lesson_created",{source:d.material?"generated_material":"imported_text",language:d.lang,level:d.level?.slice(0,2),goal:d.goal}); setText(d.text); DB.set("currentText",d.text); DB.set("recallAnswers",{}); DB.set("recallShown",{}); DB.set("unknownWords",[]); setUserWords([]); clearLineTr(); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=await r.json(); setLesson(L); DB.set("currentLesson",L); navigateTo("scan","/scan");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    }
    catch(e){ const L=generateLesson(d.text,d.lang,d.level,d.goal,d.targetMin||null,d.material||null); setLesson(L); DB.set("currentLesson",L); navigateTo("scan","/scan");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    } }

  if(screen==="login") return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <main className="main"><Login onDone={continueAfterLogin}/></main></UIContext.Provider>);

  return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <div className={"shell"+(pinned?" pinned":"")}>
      <div className="path-anchor">
        <div className="chrome-row">
          <button className="bar-toggle focusable" onClick={toggleSide} aria-pressed={pinned} aria-label="Show or hide the learning path"><Svg n={pinned?"panelClose":"panel"}/></button>
          <label className="chrome-select" title={t.interfaceLanguage}><Svg n="globe"/>
            <select value={uiLang} onChange={e=>setUiLang(e.target.value)} aria-label={t.interfaceLanguage}>
              <option value="en">EN</option><option value="zh">中文</option></select></label>
          <button className="chrome-btn focusable" onClick={toggleTheme} title="Toggle light / dark" aria-label="Toggle light / dark">{theme==="dark"?"☀️":"🌙"}</button>
          <button className="chrome-btn focusable" onClick={clearAll} title={t.clearLocalData} aria-label={t.clearLocalData}><Svg n="trash"/></button>
        </div>
        <Sidebar mode={mode} lesson={lesson} step={step} doneSet={doneSet} go={go} onBackHome={()=>navigateTo("input","/")}/>
      </div>
      <main className="main">
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen onNext={loadLesson} initialMode={currentRoute.inputMode} onRouteChange={replaceWith}/>}
        {screen==="scan" && lesson && <QuickScan lesson={lesson} text={text} onDone={scanDone} onSkip={scanSkip}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} userWords={userWords} onBack={()=>navigateTo("scan","/scan")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} onPrev={onPrev} onContinue={onContinue} onSkip={onSkip}/>}
        {screen==="done" && lesson && <Done lesson={lesson} diag={{unknown:userWords}} onNew={()=>navigateTo("input","/")} onReview={reviewSession}/>}
      </main>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}

export default App;
