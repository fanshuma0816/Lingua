"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthPrompt } from "./AuthPrompt";
import { Collection } from "./Collection";
import { Login } from "./Login";
import { Progress } from "./Progress";
import { SessionView, Sidebar } from "./Session";
import { InputScreen, Preview } from "./Setup";
import { Done, QuickScan } from "./Steps";
import { Loading, Svg } from "../ui/elements";
import { STEPS, STEP_SLUG, stepIndex } from "../../config/constants";
import { UI_TEXT } from "../../config/uiText";
import { UIContext } from "../../hooks/useUI";
import { identifyUser, resetAnalytics, trackEvent } from "../../lib/analytics";
import { stopSpeak } from "../../lib/audio";
import { getAuthState, signOut } from "../../lib/auth-client";
import { scrollToTop } from "../../lib/format";
import { generateLesson } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { clearLineTr } from "../../lib/trcache";
import { fetchEntitlements, createCourse, confirmCourse, fetchCourse, completeCourseRequest, restoreLessonRecord } from "../../lib/learning-access-client";
import { buildCompletedLessonPayload, saveCompletedLesson } from "../../lib/learning-sync";
import { cachedAiAnalyze } from "../../services/api";

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
    setDoneSet(new Set(DB.get("currentCompletedSteps",[])||[]));
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
  const [authPurpose,setAuthPurpose]=useState(null);
  const [access,setAccess]=useState(null);
  const [learningError,setLearningError]=useState("");
  const [confirmation,setConfirmation]=useState("idle");
  const [saveState,setSaveState]=useState("idle");
  const [creating,setCreating]=useState(false);
  const focusRequested=useRef(new Set());
  const generatingRef=useRef(false);
  const savingRef=useRef(false);
  const saveQueued=useRef(false);
  const latestSave=useRef(null);
  latestSave.current=()=>saveCurrentCourse(true);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";
  const activeMain=screen==="progress"?"progress":screen==="collection"?"collection":"learn";
  const showSideBack=mode!=="home"||screen==="scan"||screen==="preview"||(screen==="input"&&pathname!=="/");

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen,step]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);
  useEffect(()=>{
    const update=()=>refreshAuth().catch(()=>{});
    update(); window.addEventListener("focus",update); window.addEventListener("storage",update);
    return ()=>{window.removeEventListener("focus",update);window.removeEventListener("storage",update);};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    fetchEntitlements().then(value=>{if(!cancelled)setAccess(value);}).catch(()=>{if(!cancelled)setLearningError("error");});
    return ()=>{cancelled=true;};
  },[auth.session?.accessToken]);
  useEffect(()=>{
    if(screen==="scan"&&lesson?.accessManaged&&!lesson.usageConfirmed)confirmCurrentCourse();
  },[screen,lesson?.serverLessonId,lesson?.usageConfirmed]);
  useEffect(()=>{
    if(!hydrated||!lesson)return;
    DB.set("currentLesson",lesson); DB.set("unknownWords",userWords);
    DB.set("currentCompletedSteps",[...doneSet]);
  },[hydrated,lesson,userWords,doneSet]);
  useEffect(()=>{
    if(!auth.session?.accessToken||!lesson?.serverLessonId||!lesson.usageConfirmed)return;
    const timer=setTimeout(()=>saveCurrentCourse(true),800);
    return ()=>clearTimeout(timer);
  },[auth.session?.accessToken,lesson,screen,step,userWords,doneSet]);
  useEffect(()=>{
    if(!auth.session?.accessToken||!DB.get("pendingCourseSave",null))return;
    const payload=DB.get("pendingCourseSave",null);
    saveCompletedLesson(payload,auth.session.accessToken).then(()=>{DB.remove("pendingCourseSave");setSaveState("saved");}).catch(()=>setSaveState("error"));
  },[auth.session?.accessToken]);
  useEffect(()=>{
    const warn=e=>{if(needsSaveWarning()){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",warn);return ()=>window.removeEventListener("beforeunload",warn);
  },[lesson]);
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

  useEffect(()=>{
    const checkBack=()=>{
      if(needsSaveWarning()&&["input","progress","collection"].includes(routeState(window.location.pathname).screen)&&!window.confirm(t.learningAccess.leave))router.replace(pathname);
    };
    window.addEventListener("popstate",checkBack);
    return ()=>window.removeEventListener("popstate",checkBack);
  },[pathname,lesson,uiLang]);

  function rememberResumePath(path){
    if(!lesson) return;
    const r=routeState(path);
    if(r.screen==="scan"||r.screen==="preview"||r.screen==="lesson"){
      DB.set("resumePath",r.screen==="lesson"?stepPath(r.stepIndex||0):r.path);
    }
  }
  function needsSaveWarning(){return !!lesson?.accessManaged&&!!lesson.usageConfirmed&&!DB.get("courseSaved:"+lesson.localLessonId,false);}
  function navigateTo(nextScreen,path){
    if(["input","progress","collection"].includes(nextScreen)&&needsSaveWarning()&&!window.confirm(t.learningAccess.leave))return;
    setScreen(nextScreen); rememberResumePath(path); if(pathname!==path) router.push(path); }
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
  function requireLogin(nextPath=pathname,purpose=null){ setAuthPurpose(purpose); DB.set("loginNextPath",nextPath||pathname||"/"); setAuthPrompt(true); }
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
  function goStep(index){ if(lesson?.accessManaged&&!lesson.usageConfirmed){setLearningError("error");return;} const n=Math.max(0,Math.min(STEPS.length-1,index)); setStep(n); DB.set("resumePath",stepPath(n)); navigateTo("lesson",stepPath(n)); if(typeof window!=="undefined"&&window.innerWidth<1200) setPinned(false); scrollToTop(); }
  function startSession(){ resetSession(); trackEvent("learning_session_started",{session_type:"new",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function reviewSession(){ resetSession(); trackEvent("learning_session_started",{session_type:"review",language:lesson?.lang,level:lesson?.level?.slice(0,2)}); goStep(0); }
  function go(id){ const idx=stepIndex(id); if(idx<0) return; goStep(idx); }
  function onContinue(){ const cur=STEPS[step]; trackEvent("learning_step_completed",{step_id:cur.id,module_id:cur.mod,step_number:step+1}); setDoneSet(prev=>new Set(prev).add(cur.id));
    if(step===STEPS.length-1){ trackEvent("learning_session_completed",{language:lesson?.lang,level:lesson?.level?.slice(0,2),step_count:STEPS.length}); navigateTo("done","/done"); } else { goStep(step+1); } }
  function onSkip(){ const cur=STEPS[step]; trackEvent("learning_step_skipped",{step_id:cur.id,module_id:cur.mod,step_number:step+1});
    if(step===STEPS.length-1){ navigateTo("done","/done"); } else { goStep(step+1); } }
  function onPrev(){ goStep(Math.max(0,step-1)); }

  // Quick scan → Preview
  function scanDone(list){ const arr=Array.isArray(list)?list:[]; setUserWords(arr); DB.set("unknownWords",arr); setLesson(cur=>cur?{...cur,userWords:arr}:cur); trackEvent("quick_scan_completed",{language:lesson?.lang,word_count:arr.length}); navigateTo("preview","/preview"); }
  function scanSkip(){ setUserWords([]); DB.set("unknownWords",[]); setLesson(cur=>cur?{...cur,userWords:[]}:cur); trackEvent("quick_scan_skipped",{language:lesson?.lang}); navigateTo("preview","/preview"); }

  async function confirmCurrentCourse(){
    if(!lesson?.serverLessonId||lesson.usageConfirmed)return;
    const id=lesson.serverLessonId;
    setConfirmation("confirming");
    try {
      const result=await confirmCourse(id);
      setLesson(cur=>cur?.serverLessonId===id?{...cur,usageConfirmed:true,usesFreeGeneration:result.usesFreeGeneration}:cur);
      setAccess(result.entitlement);setConfirmation("confirmed");setLearningError("");completeCourseRequest();
    }catch{setConfirmation("error");}
  }
  useEffect(()=>{
    const id=lesson?.serverLessonId;
    if(!id||!lesson.usageConfirmed||lesson.focus||focusRequested.current.has(id))return;
    focusRequested.current.add(id);
    cachedAiAnalyze("focus",{lang:lesson.lang,level:lesson.level,sentences:lesson.sents,vocab:(lesson.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})
      .then(f=>{if(f)setLesson(cur=>cur?.serverLessonId===id?{...cur,focus:f}:cur);});
  },[lesson?.serverLessonId,lesson?.usageConfirmed]);
  function currentPayload(){
    return buildCompletedLessonPayload({lesson,text,userWords,completedSteps:[...doneSet],completed:screen==="done",
      resumePath:screen==="lesson"?stepPath(step):["done","preview","scan"].includes(screen)?"/"+screen:DB.get("resumePath","/scan")});
  }
  async function saveCurrentCourse(automatic=false){
    if(!lesson)return;
    if(savingRef.current){saveQueued.current=true;return;}
    const payload=currentPayload();
    if(!auth.session?.accessToken){
      DB.set("pendingCourseSave",payload);setSaveState("local");requireLogin(pathname,"save");return;
    }
    savingRef.current=true;
    if(!automatic)setSaveState("saving");
    try {await saveCompletedLesson(payload,auth.session.accessToken);if(DB.get("currentLesson",null)?.localLessonId===payload.localLessonId)setSaveState("saved");}
    catch{if(DB.get("currentLesson",null)?.localLessonId===payload.localLessonId)setSaveState("error");}
    finally{savingRef.current=false;if(saveQueued.current){saveQueued.current=false;latestSave.current?.();}}
  }
  async function restoreCourse(record,restart=false){
    try {
      if(needsSaveWarning()&&!window.confirm(t.learningAccess.leave))return;
      const current=record.managed_course?(await fetchCourse(record.id)).record:record;
      const restored=restoreLessonRecord(current);
      setLesson(restored.lesson);setText(restored.text);setUserWords(restored.lesson.userWords||[]);
      setDoneSet(new Set(restart?[]:restored.completedSteps));setSaveState("idle");setConfirmation("idle");setLearningError("");
      if(restart&&(!restored.lesson.accessManaged||restored.lesson.usageConfirmed)){resetSession();navigateTo("lesson",stepPath(0));}
      else {const route=routeState(restored.resumePath);setStep(route.stepIndex||0);navigateTo(route.screen,route.path);}
    }catch{setLearningError("error");}
  }
  async function resumePending(id){
    try {const result=await fetchCourse(id);await restoreCourse(result.record);}
    catch{setLearningError("error");}
  }
  async function loadLesson(d){
    if(generatingRef.current)return;
    if(needsSaveWarning()&&!window.confirm(t.learningAccess.leave))return;
    generatingRef.current=true;setCreating(true);setLearningError("");
    try {
      const state=await fetchEntitlements();setAccess(state);
      // The server makes the final decision, including recovery of pending courses.
      let L;
      try{L=await createCourse(d);}
      catch(error){
        if(state.enabled||error.learningAccessError)throw error;
        L=generateLesson(d.text,d.lang,d.level,d.goal,d.targetMin||null,d.material||null);
      }
      const actualText=L.text||d.text;
      L={...L,localLessonId:L.serverLessonId||L.localLessonId||crypto.randomUUID()};
      setText(actualText);DB.set("currentText",actualText);DB.set("currentLesson",L);
      DB.set("lastInputMode",d.material?"find":"material");
      DB.set("recallAnswers",{});DB.set("recallShown",{});DB.set("unknownWords",[]);DB.set("currentCompletedSteps",[]);
      DB.remove("aiPractice");DB.remove("aiPracticeFeedback");DB.remove("aiChatTranscript");DB.remove("aiChatEvaluation");
      setUserWords([]);setDoneSet(new Set());clearLineTr();setLesson(L);setSaveState("idle");setConfirmation("idle");
      DB.set("resumePath","/scan");setScreen("scan");if(pathname!=="/scan")router.push("/scan");
      if(!L.accessManaged||L.usageConfirmed)completeCourseRequest();
      trackEvent("lesson_created",{source:d.material?"generated_material":"imported_text",language:d.lang,level:d.level?.slice(0,2)});
      // Focus enrichment is deferred until confirmation for managed courses.
      if(!L.accessManaged)cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})
        .then(f=>{if(f)setLesson(cur=>cur?.localLessonId===L.localLessonId?{...cur,focus:f}:cur);});
    }catch(error){
      if(error.code==="registration_required"){setAuthPurpose("generation");setAuthPrompt(true);}
      setLearningError(error.code==="allowance_exhausted"?"exhausted":error.code==="registration_required"?"registration":"error");
    }finally{generatingRef.current=false;setCreating(false);}
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
        {creating && <p role="status" className="tiny muted">{t.buildingTitle}</p>}
        {learningError && <div className="learning-allowance" role="alert">{t.learningAccess[learningError]||t.learningAccess.error}</div>}
        {lesson?.accessManaged&&["scan","preview","lesson"].includes(screen)&&<aside className="learning-course-notice">
          {lesson.accessManaged&&<p role="status">{confirmation==="error"?t.learningAccess.error:!lesson.usageConfirmed?t.learningAccess.confirming:lesson.usesFreeGeneration===false?t.learningAccess.proUsed:t.learningAccess.used}</p>}
          {confirmation==="error"&&<button className="btn btn-outline btn-sm" onClick={confirmCurrentCourse}>{t.learningAccess.retry}</button>}
          {(!lesson.accessManaged||lesson.usageConfirmed)&&<button className="btn btn-outline btn-sm" disabled={saveState==="saving"} onClick={()=>saveCurrentCourse()}>{saveState==="saving"?t.learningAccess.saving:t.learningAccess.save}</button>}
          {saveState!=="idle"&&<span className="tiny muted" role="status">{saveState==="saved"?t.learningAccess.saved:saveState==="local"?t.learningAccess.localSaved:saveState==="error"?t.learningAccess.error:""}</span>}
        </aside>}
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen busy={creating} access={access} onResumePending={resumePending} onNext={loadLesson} initialMode={currentRoute.inputMode} onRouteChange={replaceWith}/>}
        {screen==="scan" && lesson && <QuickScan disabled={lesson.accessManaged&&!lesson.usageConfirmed} lesson={lesson} text={text} onDone={scanDone} onSkip={scanSkip} onBack={()=>navigateTo("input",DB.get("lastInputMode","find")==="material"?"/import":"/find")}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} userWords={userWords} onBack={()=>navigateTo("scan","/scan")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} auth={auth} onRequireLogin={requireLogin} onPrev={onPrev} onContinue={onContinue} onSkip={onSkip} onPreview={()=>navigateTo("preview","/preview")}/>}
        {screen==="done" && lesson && <Done lesson={lesson} text={text} diag={{unknown:userWords}} doneSet={doneSet} onNew={()=>navigateTo("input","/")} onReview={reviewSession}/>}
        {screen==="progress" && <Progress auth={auth} onLogin={()=>startLogin("/progress")} onStartLearning={()=>navigateTo("input","/")} onResume={resumeLearning} onRestore={restoreCourse}/>}
        {screen==="collection" && <Collection auth={auth} tab={currentRoute.collectionTab} onTabChange={(tab)=>navigateTo("collection",tab==="grammar"?"/collection/grammar":"/collection")} onLogin={()=>startLogin(currentRoute.path)} onStartLearning={()=>navigateTo("input","/")}/>}
      </main>
      <AuthPrompt purpose={authPurpose} open={authPrompt} onClose={()=>setAuthPrompt(false)} onSignIn={()=>startLogin(DB.get("loginNextPath",pathname||"/"))}/>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}

export default App;
