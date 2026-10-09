"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthPrompt } from "./AuthPrompt";
import { Collection } from "./Collection";
import { Login } from "./Login";
import { Progress } from "./Progress";
import { SessionView, Sidebar } from "./Session";
import { InputScreen, Preview } from "./Setup";
import { Done, QuickScan } from "./Steps";
import { Loading, Svg } from "../ui/elements";
import { GOALS, STEPS, STEP_SLUG, stepIndex } from "../../config/constants";
import { UI_TEXT } from "../../config/uiText";
import { UIContext } from "../../hooks/useUI";
import { identifyUser, resetAnalytics, trackEvent } from "../../lib/analytics";
import { stopSpeak } from "../../lib/audio";
import { getAuthState, signOut, subscribeAuthChanges } from "../../lib/auth-client";
import { scrollToTop } from "../../lib/format";
import { generateLesson } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { clearLineTr } from "../../lib/trcache";
import { cachedAiAnalyze } from "../../services/api";
import { prepareImport } from "../../lib/text-chunks";
import { rememberMaterial } from "../../lib/material-history";
import { buildFallbackRecallPlan } from "../../lib/recall";
import { completeMaterialSegment, fetchMaterial, startMaterialSegment } from "../../lib/materials-client";

function stepPath(index){ const s=STEPS[Math.max(0,Math.min(STEPS.length-1,index))]; return "/learn/"+STEP_SLUG[s.mod]; }

function routeState(pathname){
  const path=(pathname||"/").replace(/\/+$/,"")||"/";
  if(path==="/find") return {screen:"input",inputMode:"find",path:"/find"};
  if(path==="/import") return {screen:"input",inputMode:"material",path:"/import"};
  if(path==="/scan") return {screen:"scan",inputMode:null,path:"/scan"};
  if(path==="/preview") return {screen:"preview",inputMode:null,path:"/preview"};
  if(path==="/done") return {screen:"done",inputMode:null,path:"/done"};
  if(path==="/login") return {screen:"login",inputMode:null,path:"/login"};
  if(path==="/progress") return {screen:"progress",inputMode:null,path:"/progress"};
  if(path==="/collection"||path==="/collection/words") return {screen:"collection",inputMode:null,path:"/collection",collectionTab:"words"};
  if(path==="/collection/materials") return {screen:"collection",inputMode:null,path:"/collection/materials",collectionTab:"materials"};
  if(path==="/collection/grammar") return {screen:"collection",inputMode:null,path:"/collection/grammar",collectionTab:"grammar"};
  if(path==="/learn") return {screen:"lesson",inputMode:null,path:stepPath(0),stepIndex:0};
  if(path.startsWith("/learn/")){ const slug=path.slice(7); const i=STEPS.findIndex(s=>STEP_SLUG[s.mod]===slug); return {screen:"lesson",inputMode:null,path,stepIndex:i>=0?i:0}; }
  return {screen:"input",inputMode:null,path:"/"};
}

function App(){
  const router=useRouter();
  const pathname=usePathname()||"/";
  const currentRoute=routeState(pathname);
  const [hydrated,setHydrated]=useState(false);
  const [uiLang,setUiLangState]=useState("en");
  const t=UI_TEXT[uiLang]||UI_TEXT.en;
  function setUiLang(next){ setUiLangState(next); DB.set("uiLang",next); }
  useEffect(()=>{ document.documentElement.lang=uiLang==="zh"?"zh-CN":"en"; },[uiLang]);
  useEffect(()=>{
    setUiLangState(DB.get("uiLang","en"));
    const storedLesson=DB.get("currentLesson",null);
    if(storedLesson&&!storedLesson.localLessonId){ storedLesson.localLessonId=crypto.randomUUID(); DB.set("currentLesson",storedLesson); }
    setLesson(storedLesson);
    setText(DB.get("currentText",""));
    setTheme(DB.get("theme","light"));
    setUserWords(DB.get("unknownWords",[])||[]);
    setHydrated(true);
  },[]);
  useEffect(()=>{
    const userId=DB.get("userId",crypto.randomUUID());
    DB.set("userId",userId);
    const email=DB.get("email","");
    identifyUser(userId, email?{email}:undefined);
  },[]);
  const [screen,setScreen]=useState(currentRoute.screen);
  const [lesson,setLesson]=useState(null); const [text,setText]=useState("");
  const [theme,setTheme]=useState("light");
  const [pinned,setPinned]=useState(false);
  const [step,setStep]=useState(()=>currentRoute.stepIndex||0);
  const [doneSet,setDoneSet]=useState(()=>new Set());
  const [userWords,setUserWords]=useState([]);
  const [narrow,setNarrow]=useState(false);
  const [auth,setAuth]=useState({configured:true,session:null,checked:false});
  const [authPrompt,setAuthPrompt]=useState(false);
  const [authPromptPurpose,setAuthPromptPurpose]=useState(null);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";
  const activeMain=screen==="progress"?"progress":screen==="collection"?"collection":"learn";
  const showSideBack=mode!=="home"||screen==="scan"||screen==="preview"||(screen==="input"&&pathname!=="/");

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen,step]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);
  useEffect(()=>{ refreshAuth(); },[]);
  useEffect(()=>{
    let checking=false;
    return subscribeAuthChanges(async()=>{
      if(checking) return;
      checking=true;
      try{
        const state=await refreshAuth();
        if(state.session?.accessToken) setAuthPrompt(false);
      }finally{ checking=false; }
    });
  },[]);
  // The learning path (sidebar) stays open by default on desktop; the learner
  // can still collapse it with the toggle. On narrow screens it starts closed.
  useEffect(()=>{ if(typeof window!=="undefined") setPinned(window.innerWidth>=1200); },[]);
  useEffect(()=>{
    if(!hydrated) return;
    if(screen==="login") return;
    const r=routeState(pathname);
    if((r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"||r.screen==="done")&&!lesson){ setScreen("input"); if(pathname!=="/") router.replace("/"); return; }
    if(r.screen==="lesson") setStep(r.stepIndex||0);
    setScreen(r.screen);
  },[pathname,hydrated,lesson]);
  useEffect(()=>{
    if(!lesson) return;
    const r=routeState(pathname);
    if(r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"){
      DB.set("resumePath",r.screen==="lesson"?stepPath(r.stepIndex||step||0):r.path);
    }
  },[pathname,lesson,step]);

  function rememberResumePath(path){
    if(!lesson) return;
    const r=routeState(path);
    if(r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"){
      DB.set("resumePath",r.screen==="lesson"?stepPath(r.stepIndex||0):r.path);
    }
  }
  function navigateTo(nextScreen,path){ setScreen(nextScreen); rememberResumePath(path); if(pathname!==path) router.push(path); }
  function replaceWith(path){ if(pathname!==path) router.replace(path); }
  async function refreshAuth(){ const state=await getAuthState(); setAuth({...state,checked:true}); return state; }
  function navigatePath(path){ const r=routeState(path); navigateTo(r.screen,r.path); }
  function resumeLearning(){
    if(!lesson){ navigateTo("input","/"); return; }
    const path=DB.get("resumePath",stepPath(step||0));
    const r=routeState(path);
    if(r.screen==="lesson") setStep(r.stepIndex||0);
    navigateTo(r.screen,r.path);
  }
  async function startLogin(nextPath){
    const target=nextPath||pathname||"/";
    const state=await refreshAuth();
    setAuthPrompt(false);
    if(state.session?.accessToken){ navigatePath(target); return; }
    DB.set("loginNextPath",target);
    navigateTo("login","/login");
  }
  async function handleSignOut(){ await signOut(auth.session); await refreshAuth(); }
  function requireLogin(nextPath=pathname,purpose=null){ DB.set("loginNextPath",nextPath||pathname||"/"); setAuthPromptPurpose(purpose); setAuthPrompt(true); }
  function continueAfterLogin(){
    const r=routeState(pathname);
    if((r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"||r.screen==="done")&&!lesson){ navigateTo("input","/"); return; }
    if(r.screen==="input"){ navigateTo("input",r.path); return; }
    navigateTo("input","/");
  }
  function toggleTheme(){ setTheme(v=>{ const n=v==="dark"?"light":"dark"; DB.set("theme",n); return n; }); }
  function toggleSide(){ setPinned(p=>!p); }
  function clearAll(){ if(confirm(t.clearConfirm)){resetAnalytics();DB.clearAll();location.reload();} }

  function resetSession(){ setStep(0); setDoneSet(new Set()); }
  function goStep(index){ const n=Math.max(0,Math.min(STEPS.length-1,index)); setStep(n); DB.set("resumePath",stepPath(n)); navigateTo("lesson",stepPath(n)); if(typeof window!=="undefined"&&window.innerWidth<1200) setPinned(false); scrollToTop(); }
  function startSession(){ resetSession(); trackEvent("learning_session_started",{session_type:"new",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function reviewSession(){ resetSession(); trackEvent("learning_session_started",{session_type:"review",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function go(id){ const idx=stepIndex(id); if(idx<0) return; goStep(idx); }
  function onContinue(){ const cur=STEPS[step]; trackEvent("learning_step_completed",{step_id:cur.id,module_id:cur.mod,step_number:step+1}); setDoneSet(prev=>new Set(prev).add(cur.id));
    if(step===STEPS.length-1){ if(lesson?.lang==="Dutch") rememberMaterial({...lesson.material,text},"completed"); saveChunkProgress(lesson,"completed");
      if(lesson?.material?.accountMaterialId&&lesson?.material?.accountSegmentId&&auth.session?.accessToken) completeMaterialSegment(lesson.material.accountMaterialId,lesson.material.accountSegmentId,auth.session.accessToken).catch(()=>{});
      trackEvent("learning_session_completed",{language:lesson?.lang,level:lesson?.level?.slice(0,2),step_count:STEPS.length}); navigateTo("done","/done"); } else { goStep(step+1); } }
  function onSkip(){ const cur=STEPS[step]; trackEvent("learning_step_skipped",{step_id:cur.id,module_id:cur.mod,step_number:step+1});
    if(step===STEPS.length-1){ navigateTo("done","/done"); } else { goStep(step+1); } }
  function onPrev(){ goStep(Math.max(0,step-1)); }

  // Quick scan → Preview
  function setRecallWords(arr){
    setUserWords(arr); DB.set("unknownWords",arr);
    setLesson(cur=>{
      if(!cur) return cur;
      const next={...cur,userWords:arr,recallPlan:{items:buildFallbackRecallPlan(cur.sents||[],arr,3)}};
      DB.set("currentLesson",next);
      return next;
    });
  }
  function scanDone(list){ const arr=Array.isArray(list)?list:[]; setRecallWords(arr); trackEvent("quick_scan_completed",{language:lesson?.lang,word_count:arr.length}); navigateTo("preview","/preview"); }
  function scanSkip(){ setRecallWords([]); trackEvent("quick_scan_skipped",{language:lesson?.lang}); navigateTo("preview","/preview"); }

  function saveChunkProgress(current, status){
    if(!current?.importDocumentId) return;
    const key="importDocument:"+current.importDocumentId;
    const doc=DB.get(key,null); if(!doc) return;
    DB.set(key,{...doc,chunks:doc.chunks.map((chunk,index)=>index===current.importChunkIndex?{...chunk,status:chunk.status==="completed"?"completed":status}:chunk)});
  }
  function saveLoadedLesson(result,d){
    const {sourceDocument,...L}=result;
    if(sourceDocument){
      const key="importDocument:"+sourceDocument.id, prior=DB.get(key,null);
      DB.set(key,{...sourceDocument,chunks:sourceDocument.chunks.map((chunk,index)=>({...chunk,status:prior?.chunks?.[index]?.id===chunk.id?prior.chunks[index].status:chunk.status}))});
    }
    const actualText=L.text||d.text;
    setText(actualText); DB.set("currentText",actualText);
    if(L.lang==="Dutch") rememberMaterial({...L.material,text:actualText},"started");
    saveChunkProgress(L,"started");
    return L;
  }
  async function loadLesson(d){ trackEvent("lesson_created",{source:d.material?"generated_material":"imported_text",language:d.lang,level:d.level?.slice(0,2),goal:d.goal}); DB.set("lastInputMode",d.material?.accountMaterialId?"material":d.material?"find":"material"); setText(d.text); DB.set("currentText",d.text); DB.set("recallAnswers",{}); DB.remove("recallShown"); DB.remove("recallState"); DB.set("unknownWords",[]); DB.remove("aiPractice"); DB.remove("aiPracticeFeedback"); DB.remove("aiChatTranscript"); DB.remove("aiChatEvaluation"); setUserWords([]); clearLineTr(); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=saveLoadedLesson({...(await r.json()),localLessonId:crypto.randomUUID()},d); setLesson(L); DB.set("currentLesson",L); DB.set("resumePath","/scan"); navigateTo("scan","/scan");
      if(L.material?.accountMaterialId&&L.material?.accountSegmentId&&auth.session?.accessToken) startMaterialSegment(L.material.accountMaterialId,L.material.accountSegmentId,auth.session.accessToken).catch(()=>{});
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,goal:L.goal,topics:L.topics,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?.localLessonId===L.localLessonId?{...cur,focus:f}:cur); });
    }
    catch(e){
      const sourceDocument=d.lang==="Dutch"&&!d.material?prepareImport(d.text,{level:d.level,targetMin:d.targetMin,difficulty:d.difficulty}):null;
      const actualText=sourceDocument?sourceDocument.text:d.text;
      const L=saveLoadedLesson({...generateLesson(actualText,d.lang,d.level,d.goal,d.targetMin||null,d.material||null),text:actualText,
        ...(sourceDocument?{sourceDocument,importDocumentId:sourceDocument.id,importChunkId:sourceDocument.selectedChunkId,importChunkIndex:sourceDocument.selectedChunkIndex}:{}),localLessonId:crypto.randomUUID()},d); setLesson(L); DB.set("currentLesson",L); DB.set("resumePath","/scan"); navigateTo("scan","/scan");
      if(L.material?.accountMaterialId&&L.material?.accountSegmentId&&auth.session?.accessToken) startMaterialSegment(L.material.accountMaterialId,L.material.accountSegmentId,auth.session.accessToken).catch(()=>{});
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,goal:L.goal,topics:L.topics,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?.localLessonId===L.localLessonId?{...cur,focus:f}:cur); });
    } }

  async function startSavedSegment(materialId,segmentId){
    if(!auth.session?.accessToken)return startLogin("/collection/materials");
    const {material}=await fetchMaterial(materialId,auth.session.accessToken);const segment=(material.segments||[]).find(s=>s.id===segmentId)||(material.segments||[]).find(s=>s.status!=="completed");if(!segment)return;
    loadLesson({text:segment.text,lang:material.language||"Dutch",level:material.learner_level,goal:material.learning_goal||GOALS[0],targetMin:Math.round(((segment.estimated_minutes_min||20)+(segment.estimated_minutes_max||30))/2),
      material:{id:segment.id,title:material.display_name,source:material.source_type,targetUserLevel:String(material.learner_level).slice(0,2),validatedTextLevel:segment.material_level||String(material.learner_level).slice(0,2),difficultyTier:segment.difficulty_label||"balanced",accountMaterialId:material.id,accountSegmentId:segment.id,segmentIndex:segment.segment_index,segmentCount:material.segments.length}});
  }

  if(screen==="login") return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <main className="main"><Login nextPath={DB.get("loginNextPath","/progress")} onDone={continueAfterLogin}/></main></UIContext.Provider>);

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
        <Sidebar mode={mode} activeScreen={screen} lesson={lesson} step={step} doneSet={doneSet} go={go} onGoScan={()=>navigateTo("scan","/scan")} onBackHome={()=>navigateTo("input","/")} showBack={showSideBack}
          activeMain={activeMain} onNavigate={navigatePath} auth={auth} onLogin={()=>startLogin(pathname)} onSignOut={handleSignOut}/>
      </div>
      <main className="main">
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen auth={auth} onRequireLogin={requireLogin} onNext={loadLesson} initialMode={currentRoute.inputMode} onRouteChange={replaceWith}/>}
        {screen==="scan" && lesson && <QuickScan lesson={lesson} text={text} onDone={scanDone} onSkip={scanSkip} onBack={()=>navigateTo("input",DB.get("lastInputMode","find")==="material"?"/import":"/find")}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} userWords={userWords} onBack={()=>navigateTo("scan","/scan")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} auth={auth} onRequireLogin={requireLogin} onPrev={onPrev} onContinue={onContinue} onSkip={onSkip} onPreview={()=>navigateTo("preview","/preview")}/>}
        {screen==="done" && lesson && <Done lesson={lesson} text={text} diag={{unknown:userWords}} doneSet={doneSet} onNew={()=>navigateTo("input","/")} onReview={reviewSession} onOpenMaterial={()=>navigateTo("collection","/collection/materials")}/>}
        {screen==="progress" && <Progress auth={auth} onLogin={()=>startLogin("/progress")} onStartLearning={()=>navigateTo("input","/")} onResume={resumeLearning}/>}
        {screen==="collection" && <Collection auth={auth} tab={currentRoute.collectionTab} onTabChange={(tab)=>navigateTo("collection",tab==="materials"?"/collection/materials":tab==="grammar"?"/collection/grammar":"/collection")} onLogin={()=>startLogin(currentRoute.path)} onStartLearning={()=>navigateTo("input","/")} onStartSegment={startSavedSegment}/>}
      </main>
      <AuthPrompt open={authPrompt} purpose={authPromptPurpose} onClose={()=>setAuthPrompt(false)} returnPath={DB.get("loginNextPath",pathname||"/")}/>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}

export default App;
