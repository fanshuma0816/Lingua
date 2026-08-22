"use client";

import { useEffect, useRef, useState } from "react";
import { Login } from "./Login";
import { SessionView, Sidebar } from "./Session";
import { InputScreen, Preview } from "./Setup";
import { Done } from "./Steps";
import { Loading, Svg } from "../ui/elements";
import { STEPS, stepIndex } from "../../config/constants";
import { UI_TEXT } from "../../config/uiText";
import { UIContext } from "../../hooks/useUI";
import { stopSpeak } from "../../lib/audio";
import { scrollToTop } from "../../lib/format";
import { generateLesson } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { cachedAiAnalyze } from "../../services/api";

function App(){
  const [uiLang,setUiLangState]=useState(DB.get("uiLang","en"));
  const t=UI_TEXT[uiLang]||UI_TEXT.en;
  function setUiLang(next){ setUiLangState(next); DB.set("uiLang",next); }
  useEffect(()=>{ document.documentElement.lang=uiLang==="zh"?"zh-CN":"en"; },[uiLang]);
  const [screen,setScreen]=useState(DB.get("email")?"input":"login");
  const [lesson,setLesson]=useState(null); const [text,setText]=useState("");
  const [theme,setTheme]=useState(DB.get("theme","light"));
  const [pinned,setPinned]=useState(false);
  const [openMod,setOpenMod]=useState("diag");
  const [step,setStep]=useState(0);
  const [doneSet,setDoneSet]=useState(()=>new Set());
  const [diag,setDiag]=useState({coverage:null,tier:null,total:0,unknown:[]});
  const [narrow,setNarrow]=useState(false);
  const autoReveal=useRef(false); const revealTimer=useRef(null);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);

  function toggleTheme(){ setTheme(v=>{ const n=v==="dark"?"light":"dark"; DB.set("theme",n); return n; }); }
  function toggleSide(){ autoReveal.current=false; setPinned(p=>!p); }
  function clearAll(){ if(confirm(t.clearConfirm)){DB.clearAll();location.reload();} }

  // Briefly reveal the path panel on entering a session, then auto-collapse
  // unless the learner reached for it or pinned it.
  function revealThenCollapse(){
    clearTimeout(revealTimer.current);
    if(typeof window!=="undefined"&&window.innerWidth<1200){ setPinned(false); return; }
    autoReveal.current=true; setPinned(true);
    revealTimer.current=setTimeout(()=>{ if(autoReveal.current){ setPinned(false); autoReveal.current=false; } },2400);
  }
  function resetSession(){ setStep(0); setDoneSet(new Set()); setOpenMod("diag"); setDiag({coverage:null,tier:null,total:0,unknown:[]}); }
  function startSession(){ resetSession(); setScreen("lesson"); revealThenCollapse(); }
  function reviewSession(){ resetSession(); setScreen("lesson"); revealThenCollapse(); }
  function go(id){ const idx=stepIndex(id); if(idx<0) return; if(screen==="done") setScreen("lesson"); setStep(idx); setOpenMod(STEPS[idx].mod); if(window.innerWidth<1200) setPinned(false); scrollToTop(); }
  function onContinue(){ const cur=STEPS[step]; setDoneSet(prev=>new Set(prev).add(cur.id));
    if(step===STEPS.length-1){ setScreen("done"); } else { const n=step+1; setStep(n); setOpenMod(STEPS[n].mod); scrollToTop(); } }
  function onPrev(){ const n=Math.max(0,step-1); setStep(n); setOpenMod(STEPS[n].mod); scrollToTop(); }

  async function loadLesson(d){ setText(d.text); DB.set("recallAnswers",{}); DB.set("recallShown",{}); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=await r.json(); setLesson(L); setScreen("preview");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    }
    catch(e){ const L=generateLesson(d.text,d.lang,d.level,d.goal,d.targetMin||null,d.material||null); setLesson(L); setScreen("preview");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    } }

  if(screen==="login") return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <main className="main"><Login onDone={()=>setScreen("input")}/></main></UIContext.Provider>);

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
        <Sidebar mode={mode} lesson={lesson} step={step} doneSet={doneSet} openMod={openMod} setOpenMod={setOpenMod} go={go} onBackHome={()=>setScreen("input")}/>
      </div>
      <main className="main">
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen onNext={loadLesson}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} onBack={()=>setScreen("input")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} onPrev={onPrev} onContinue={onContinue} diag={diag} setDiag={setDiag}/>}
        {screen==="done" && lesson && <Done lesson={lesson} diag={diag} onNew={()=>setScreen("input")} onReview={reviewSession}/>}
      </main>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}

export default App;
