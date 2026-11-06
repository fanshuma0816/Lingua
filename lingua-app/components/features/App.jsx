"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthPrompt } from "./AuthPrompt";
import { Collection } from "./Collection";
import { Login } from "./Login";
import { QuotaStatus } from "./QuotaStatus";
import { quotaPresentation } from "../../lib/quota-presentation";

import { Progress } from "./Progress";
import { SessionView, Sidebar } from "./Session";
import { InputScreen, Preview } from "./Setup";
import { Done, QuickScan } from "./Steps";
import { Brand, Loading, Svg } from "../ui/elements";
import { GOALS, STEPS, STEP_SLUG, stepIndex } from "../../config/constants";
import { UI_TEXT } from "../../config/uiText";
import { UIContext } from "../../hooks/useUI";
import { identifyUser, resetAnalytics, trackEvent } from "../../lib/analytics";
import { stopSpeak } from "../../lib/audio";
import { getAuthState, signOut, subscribeAuthChanges } from "../../lib/auth-client";
import { scrollToTop } from "../../lib/format";
import { createLesson, confirmLesson, refreshEntitlements, claimLessons, lessonRequest, restoreLesson, interactionSnapshot, subscribeQuotaChanges } from "../../lib/lesson-api-client";
import { DB } from "../../lib/storage";
import { rememberGeneration, generationToContinue, clearGenerationContinuation } from "../../lib/generation-continuation";
import { clearLineTr } from "../../lib/trcache";
import { cachedAiAnalyze } from "../../services/api";

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
    let cancelled=false;
    (async()=>{
      setUiLangState(DB.get("uiLang","en")); setTheme(DB.get("theme","light"));
      let initialized=false;
      try { await refreshAuth();initialized=true; } catch(error) { if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable"); }
      if(cancelled)return;
      let storedLesson=initialized?DB.get("currentLesson",null):null;
      if(storedLesson?.lessonId){
        try{const result=await lessonRequest(`/api/lesson/${storedLesson.lessonId}`);storedLesson={...result.lesson,delivered:result.delivered};restoreLesson({...result,lesson:storedLesson});setDoneSet(new Set(result.progress?.completedSteps||[]));}
        catch(error){if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable");storedLesson=null;}
      }
      setLesson(storedLesson); setText(DB.get("currentText","")); setUserWords(DB.get("unknownWords",[])||[]);
      setHydrated(true);
      const pending=initialized?DB.get("pendingGeneration",null):null;
      if(pending?.payload&&!storedLesson?.lessonId) loadLesson(pending.payload);
    })();
    return ()=>{cancelled=true;};
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
  const [phase,setPhase]=useState(null);
  const [phaseError,setPhaseError]=useState("");
  const [checkingRequest,setCheckingRequest]=useState(false);
  const [retryPayload,setRetryPayload]=useState(null);
  const [quotaLoad,setQuotaLoad]=useState("loading");
  const [continuation,setContinuation]=useState(null);
  const [deliveryState,setDeliveryState]=useState("idle");
  const pathnameRef=useRef(pathname),phaseRef=useRef(null),quotaRefreshVersion=useRef(0);
  pathnameRef.current=pathname;phaseRef.current=phase;
  const busyGeneration=useRef(false), identityRef=useRef(null), confirming=useRef(null), saveQueue=useRef(Promise.resolve()), dirtyVersion=useRef(0);
  const [authPrompt,setAuthPrompt]=useState(false);
  const [authPromptPurpose,setAuthPromptPurpose]=useState(null);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";
  const activeMain=screen==="progress"?"progress":screen==="collection"?"collection":"learn";
  const showSideBack=mode!=="home"||screen==="scan"||screen==="preview"||(screen==="input"&&pathname!=="/");

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen,step]);
  useEffect(()=>{setPhaseError("");},[pathname]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);

  useEffect(()=>{
    let checking=false,queued=false,disposed=false;
    const check=async()=>{
      if(checking){queued=true;return;}
      checking=true;
      do{
        queued=false;
        try{
          const state=await refreshAuth();
          if(!disposed&&state.session?.accessToken){
            setAuthPrompt(false);
            if(pathnameRef.current==="/login")navigatePath(DB.get("loginNextPath","/progress"));
          }
        }catch(error){if(!disposed)if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable");}
      }while(queued&&!disposed);
      checking=false;
    };
    const unsubscribe=subscribeAuthChanges(check);
    return()=>{disposed=true;unsubscribe();};
  },[]);
  useEffect(()=>subscribeQuotaChanges(signal=>{
    if(signal.environment!==phaseRef.current?.environment || signal.userId!==identityRef.current)return;
    refreshQuotaBalance().catch(()=>{});
  }),[]);
  // The learning path (sidebar) stays open by default on desktop; the learner
  // can still collapse it with the toggle. On narrow screens it starts closed.
  useEffect(()=>{ if(typeof window!=="undefined") setPinned(window.innerWidth>=1200); },[]);
  useEffect(()=>{
    if(!hydrated||screen==="loading") return;
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
  function navigateTo(nextScreen,path){ setPhaseError(""); setScreen(nextScreen); rememberResumePath(path); if(pathname!==path) router.push(path); }
  function replaceWith(path){ if(pathname!==path) router.replace(path); }
  function acceptQuota(balance){setPhase(balance);setQuotaLoad("ready");}
  async function refreshQuotaBalance(){
    const version=++quotaRefreshVersion.current,actor=identityRef.current;
    setQuotaLoad("loading");
    try{
      const balance=await refreshEntitlements();
      if(version===quotaRefreshVersion.current&&actor===identityRef.current)acceptQuota(balance);
      return balance;
    }catch(error){
      if(version===quotaRefreshVersion.current&&actor===identityRef.current){setQuotaLoad("error");}
      error.quotaReadFailure=true;throw error;
    }
  }
  async function refreshAuth(){
    const state=await getAuthState(), oldLesson=DB.get("currentLesson",null);
    const nextIdentity=state.session?.user?.id||"guest";
    const firstIdentity=identityRef.current===null;
    const changed=!firstIdentity&&identityRef.current!==nextIdentity;
    identityRef.current=nextIdentity;
    if(changed){setPhase(null);stopSpeak();setLesson(null);setText("");setUserWords([]);setDoneSet(new Set());clearLineTr();}
    setAuth({...state,checked:true});
    const balance=await refreshQuotaBalance();
    if(balance.enabled&&state.session?.accessToken) await claimLessons();
    if(balance.enabled&&(changed||firstIdentity)){
      let restored=DB.get("currentLesson",null),progress={};
      const candidate=state.session?.accessToken && oldLesson?.lessonId && (!oldLesson.ownerId||oldLesson.ownerId===nextIdentity)?oldLesson:restored;
      if(candidate?.lessonId){
        try {
          const result=await lessonRequest(`/api/lesson/${candidate.lessonId}`);
          restored={...result.lesson,delivered:result.delivered};progress=result.progress||{};
          restoreLesson({...result,lesson:restored});
        } catch(error){
          restored=null;DB.remove("currentLesson");DB.remove("currentText");
          if(error.status!==404)throw error;
        }
      }
      setLesson(restored);setText(restored?.text||"");setUserWords(restored?DB.get("unknownWords",[]):[]);setDoneSet(new Set(progress.completedSteps||[]));
    }
    setContinuation(balance.enabled?generationToContinue(balance.environment,state.session?.user?.id||null):null);
    if(changed)setPhaseError("");
    identityRef.current=nextIdentity;setAuth({...state,checked:true}); return state;
  }
  function navigatePath(path){ const r=routeState(path); navigateTo(r.screen,r.path); }
  function resumeLearning(){
    if(lesson?.lessonId){openLesson(lesson.lessonId);return;}
    if(!lesson){ navigateTo("input","/"); return; }
    const path=DB.get("resumePath",stepPath(step||0));
    const r=routeState(path);
    if(r.screen==="lesson") setStep(r.stepIndex||0);
    navigateTo(r.screen,r.path);
  }
  async function startLogin(nextPath){
    const target=nextPath||pathname||"/";
    const state=await getAuthState();
    setAuth({...state,checked:true});
    setAuthPrompt(false);
    if(state.session?.accessToken){ navigatePath(target); return; }
    DB.set("loginNextPath",target);
    navigateTo("login","/login");
  }
  async function handleSignOut(){ await signOut(auth.session); await refreshAuth(); }
  function requireLogin(nextPath=pathname,purpose=null){ DB.set("loginNextPath",nextPath||pathname||"/"); setAuthPromptPurpose(purpose); setAuthPrompt(true); }
  async function continueAfterLogin(){
    const state=await getAuthState();
    if(!state.session?.accessToken)return;
    setAuth({...state,checked:true});setAuthPrompt(false);
    const intended=DB.get("loginNextPath",DB.get("resumePath","/progress"));
    navigatePath(intended==="/login"?"/progress":intended);
    // Course claiming/restoration still uses the authenticated server checks.
    refreshAuth().catch(error=>{if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable");});
  }
  async function checkPendingRequest(){
    const pending=DB.get("pendingGeneration",null);
    if(!pending?.requestId || busyGeneration.current)return;
    busyGeneration.current=true;setCheckingRequest(true);
    try {
      const result=await lessonRequest(`/api/lesson/requests/${pending.requestId}`);
      if(!result.lesson?.lessonId){setPhaseError("request_processing");return;}
      await openLesson(result.lesson.lessonId);
    } catch(error){setPhaseError(error.code||"service_unavailable");}
    finally {busyGeneration.current=false;setCheckingRequest(false);}
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
  async function scanDone(list){ if(lesson?.lessonId&&!lesson.delivered){try{await ensureDelivery();}catch{return;}}  const arr=Array.isArray(list)?list:[]; setRecallWords(arr); trackEvent("quick_scan_completed",{language:lesson?.lang,word_count:arr.length}); navigateTo("preview","/preview"); }
  async function scanSkip(){ if(lesson?.lessonId&&!lesson.delivered){try{await ensureDelivery();}catch{return;}}  setRecallWords([]); trackEvent("quick_scan_skipped",{language:lesson?.lang}); navigateTo("preview","/preview"); }

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
  async function loadLesson(d){
    if(busyGeneration.current)return;
    const startedAs=identityRef.current;
    busyGeneration.current=true;setRetryPayload(d);setPhaseError("");setDeliveryState("idle");setScreen("loading");
    quotaRefreshVersion.current++;setQuotaLoad("loading");
    DB.set("lastInputMode",d.material?.accountMaterialId?"material":d.material?"find":"material");
    try {
      const result=await createLesson(d);
      if(startedAs!==identityRef.current)throw {code:"account_changed"};
      const L=saveLoadedLesson({...result,localLessonId:result.lessonId||crypto.randomUUID()},d);
      restoreLesson({lesson:L});setLesson(L);setUserWords([]);setDoneSet(new Set());clearLineTr();
      trackEvent("lesson_created",{source:d.material?"generated_material":"imported_text",language:d.lang,level:d.level?.slice(0,2),goal:d.goal});
      navigateTo("scan","/scan");
      if(!L.lessonId) prefetchFocus(L);
    } catch(error) {
      if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable");setScreen("input");
      refreshQuotaBalance().catch(()=>{});
      if(["request_failed","request_expired"].includes(error.code))setContinuation(null);
      if(error.code==="sign_in_required"){
        const balance=phaseRef.current;
        const intent=rememberGeneration(d,{environment:balance?.environment,userId:auth.session?.user?.id||null,path:pathnameRef.current});
        setContinuation(intent);requireLogin(pathnameRef.current,"quota");
      }
    } finally {busyGeneration.current=false;}
  }
  function prefetchFocus(L){
    cachedAiAnalyze("focus",{lang:L.lang,level:L.level,goal:L.goal,topics:L.topics,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})
      .then(f=>{if(f)setLesson(cur=>cur?.localLessonId===L.localLessonId?{...cur,focus:f}:cur);}).catch(()=>{});
  }
  async function ensureDelivery(){
    if(!lesson?.lessonId||lesson.delivered)return true;
    const current=lesson,startedAs=identityRef.current;
    if(confirming.current?.lessonId===current.lessonId)return confirming.current.promise;
    setDeliveryState("confirming");setPhaseError("");
    const promise=(async()=>{
      try{
        const result=await confirmLesson(current.lessonId);
        if(startedAs!==identityRef.current)throw {code:"account_changed"};
        quotaRefreshVersion.current++;acceptQuota(result.entitlements);setContinuation(null);setDeliveryState("confirmed");
        setLesson(cur=>{if(cur?.lessonId!==current.lessonId)return cur;const next={...cur,delivered:true};DB.set("currentLesson",next);return next;});
        prefetchFocus(current);
        if(current.material?.accountMaterialId&&current.material?.accountSegmentId&&auth.session?.accessToken)
          startMaterialSegment(current.material.accountMaterialId,current.material.accountSegmentId,auth.session.accessToken).catch(()=>{});
        return true;
      }catch(error){
        if(startedAs===identityRef.current){
          refreshQuotaBalance().catch(()=>{});
          setDeliveryState(["request_expired","request_failed","lesson_not_found"].includes(error.code)?"failed":"uncertain");
          if(["request_expired","request_failed","lesson_not_found"].includes(error.code))setPhaseError(error.code);
        }
        throw error;
      }finally{if(confirming.current?.lessonId===current.lessonId)confirming.current=null;}
    })();
    confirming.current={lessonId:current.lessonId,promise};return promise;
  }
  async function openLesson(id,legacy=false){
    setPhaseError("");setDeliveryState("idle");const startedAs=identityRef.current;
    try {
      const result=await lessonRequest(legacy?`/api/lesson/legacy/${id}`:`/api/lesson/${id}`,legacy?{method:"POST",body:"{}"}:{});
      if(startedAs!==identityRef.current)throw {code:"account_changed"};
      const L={...result.lesson,delivered:result.delivered};restoreLesson({...result,lesson:L});
      setLesson(L);setText(L.text||"");setUserWords(DB.get("unknownWords",[]));setDoneSet(new Set(result.progress?.completedSteps||[]));
      clearLineTr();navigatePath(result.delivered?(result.progress?.path||"/preview"):"/scan");
      if(result.delivered)prefetchFocus(L);
    } catch(error){if(!error.quotaReadFailure)setPhaseError(error.code||"service_unavailable");}
  }
  useEffect(()=>{
    if(!hydrated||pathname!=="/scan"||screen!=="scan"||!lesson?.lessonId||lesson.delivered)return;
    ensureDelivery().catch(()=>{});
  },[hydrated,pathname,screen,lesson?.lessonId]);
  useEffect(()=>{
    const onError=event=>{stopSpeak();setPhaseError(event.detail?.code||"lesson_not_found");navigateTo("input","/");};
    window.addEventListener("lingua-access-error",onError);return()=>window.removeEventListener("lingua-access-error",onError);
  },[]);
  useEffect(()=>{
    if(!phase?.enabled||!lesson?.lessonId||!lesson.delivered)return;
    let timer;
    const flush=()=>{
      if(!["scan","preview","lesson","done"].includes(screen))return;
      const progress={path:screen==="lesson"?stepPath(step):`/${screen}`,userWords:DB.get("unknownWords",userWords),completedSteps:[...doneSet],...(DB.get(`savedPractice:${lesson.lessonId}`,false)?{interaction:interactionSnapshot()}:{})};
      const version=dirtyVersion.current;
      saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>lessonRequest(`/api/lesson/${lesson.lessonId}/progress`,{method:"PATCH",body:JSON.stringify(progress),keepalive:new TextEncoder().encode(JSON.stringify(progress)).length<60000}))
        .then(()=>{if(version===dirtyVersion.current)setUnsaved(false);}).catch(()=>setUnsaved(true));
    };
    const schedule=()=>{dirtyVersion.current++;setUnsaved(true);clearTimeout(timer);timer=setTimeout(flush,750);};
    const onHide=()=>{if(document.visibilityState==="hidden")flush();};
    schedule();window.addEventListener("lingua-learning-change",schedule);document.addEventListener("visibilitychange",onHide);
    return()=>{clearTimeout(timer);flush();window.removeEventListener("lingua-learning-change",schedule);document.removeEventListener("visibilitychange",onHide);};
  },[phase?.enabled,lesson?.lessonId,lesson?.delivered,screen,step,userWords,doneSet]);
  const [unsaved,setUnsaved]=useState(false);
  useEffect(()=>{
    const warn=event=>{if(unsaved){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[unsaved]);

  async function startSavedSegment(materialId,segmentId){
    if(!auth.session?.accessToken)return startLogin("/collection/materials");
    const {material}=await fetchMaterial(materialId,auth.session.accessToken);const segment=(material.segments||[]).find(s=>s.id===segmentId)||(material.segments||[]).find(s=>s.status!=="completed");if(!segment)return;
    if(segment.lessonId)return openLesson(segment.lessonId);
    loadLesson({text:segment.text,lang:material.language||"Dutch",level:material.learner_level,goal:material.learning_goal||GOALS[0],targetMin:Math.round(((segment.estimated_minutes_min||20)+(segment.estimated_minutes_max||30))/2),
      material:{id:segment.id,title:material.display_name,source:material.source_type,targetUserLevel:String(material.learner_level).slice(0,2),validatedTextLevel:segment.material_level||String(material.learner_level).slice(0,2),difficultyTier:segment.difficulty_label||"balanced",accountMaterialId:material.id,accountSegmentId:segment.id,segmentIndex:segment.segment_index,segmentCount:material.segments.length}});
  }

  const quota=quotaPresentation(phase,{status:quotaLoad});
  const requestUncertain=!!DB.get("pendingGeneration",null)?.requestId && ["service_unavailable","database_unavailable","request_not_found"].includes(phaseError);
  const uiContextValue={uiLang,setUiLang,t,quota};

  if(!hydrated) return <UIContext.Provider value={uiContextValue}><main className="main"><Loading/></main></UIContext.Provider>;

  if(screen==="login") return (<UIContext.Provider value={uiContextValue}>
    <main className="main"><Login nextPath={DB.get("loginNextPath","/progress")} onDone={continueAfterLogin}/></main></UIContext.Provider>);

  return (<UIContext.Provider value={uiContextValue}>
    <div className={"shell"+(pinned?" pinned":"")}>
      <div className="app-chrome">
        <a className="app-brand-link focusable" href="https://www.lingualanguage.site/" aria-label="Lingua home">
          <Brand variant="landing"/>
        </a>
      <div className="path-anchor">
        <div className="chrome-row">
          <button className="bar-toggle focusable" onClick={toggleSide} aria-pressed={pinned} aria-label="Show or hide the learning path"><Svg n={pinned?"panelRightClose":"panelRight"}/></button>
          <label className="chrome-select" title={t.interfaceLanguage}><Svg n="globe"/>
            <select value={uiLang} onChange={e=>setUiLang(e.target.value)} aria-label={t.interfaceLanguage}>
              <option value="en">EN</option><option value="zh">中文</option></select></label>
          <button className="chrome-btn focusable" onClick={toggleTheme} title="Toggle light / dark" aria-label="Toggle light / dark">{theme==="dark"?"☀️":"🌙"}</button>
          <button className="chrome-btn focusable" onClick={clearAll} title={t.clearLocalData} aria-label={t.clearLocalData}><Svg n="trash"/></button>
        </div>
        <Sidebar mode={mode} activeScreen={screen} lesson={lesson} step={step} doneSet={doneSet} go={go} onGoScan={()=>navigateTo("scan","/scan")} onBackHome={()=>navigateTo("input","/")} showBack={showSideBack}
          activeMain={activeMain} onNavigate={navigatePath} auth={auth} onLogin={()=>startLogin(pathname)} onSignOut={handleSignOut}/>
      </div>
      </div>
      <main className="main">
        <QuotaStatus key={pathname} onLogin={()=>startLogin(pathname)} courseFree={!!lesson?.delivered&&["scan","preview","lesson","done"].includes(screen)} onRetry={()=>refreshQuotaBalance().catch(()=>{})}/>
        {(phaseError || checkingRequest) && <div className="notice quota-operation-notice" role="alert">
          <span>{checkingRequest?t.quotaHints.checkingStatus:(requestUncertain?t.quotaHints.uncertainRequest:(t.generationQuota.errors[phaseError]||t.generationQuota.errors.service_unavailable))}</span>
          <div className="quota-operation-actions">
            {retryPayload && ["request_failed","request_expired"].includes(phaseError) && <button className="btn btn-ghost btn-sm" onClick={()=>loadLesson(retryPayload)}>{t.quotaHints.retry}</button>}
            {DB.get("pendingGeneration",null)?.requestId && ["service_unavailable","database_unavailable","request_processing","request_not_found"].includes(phaseError) && <button className="btn btn-ghost btn-sm" disabled={checkingRequest} onClick={checkPendingRequest}>{t.quotaHints.checkStatus}</button>}
            {["quota_exhausted","lesson_not_found"].includes(phaseError) && <button className="btn btn-ghost btn-sm" onClick={()=>navigateTo("progress","/progress")}>{t.progress.savedLessons}</button>}
            <button className="btn btn-ghost btn-sm" disabled={checkingRequest} onClick={()=>setPhaseError("")}>{t.quotaHints.dismiss}</button>
          </div>
        </div>}
        {phase?.enabled && auth.session?.accessToken && continuation && screen==="input" && <div className="notice" role="status" style={{flexWrap:"wrap"}}>
          <p style={{flexBasis:"100%",margin:0}}>{continuation.recover?t.generationQuota.recoverPrevious:t.generationQuota.readyAfterLogin}</p>
          <button className="btn btn-primary btn-sm" onClick={()=>loadLesson(continuation.payload)}>{continuation.recover?t.generationQuota.recoverRequest:t.generationQuota.continueGeneration}</button>
          {!continuation.recover && <button className="btn btn-ghost btn-sm" onClick={()=>{clearGenerationContinuation(continuation.id);setContinuation(null);}}>{t.generationQuota.chooseAgain}</button>}
        </div>}
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen auth={auth} onRequireLogin={requireLogin} onNext={loadLesson} onGenerationError={error=>setPhaseError(error.code||"service_unavailable")} initialMode={currentRoute.inputMode} onRouteChange={replaceWith}/>}
        {screen==="scan" && lesson && <QuickScan lesson={lesson} text={text} deliveryState={deliveryState} onRetryDelivery={()=>ensureDelivery().catch(()=>{})} onDone={scanDone} onSkip={scanSkip} onBack={()=>navigateTo("input",DB.get("lastInputMode","find")==="material"?"/import":"/find")}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} userWords={userWords} onBack={()=>navigateTo("scan","/scan")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} auth={auth} onRequireLogin={requireLogin} onPrev={onPrev} onContinue={onContinue} onSkip={onSkip} onPreview={()=>navigateTo("preview","/preview")}/>}
        {screen==="done" && lesson && <Done lesson={lesson} text={text} diag={{unknown:userWords}} doneSet={doneSet} onNew={()=>navigateTo("input","/")} onReview={reviewSession} onOpenMaterial={()=>navigateTo("collection","/collection/materials")}/>}
        {screen==="progress" && <Progress auth={auth} onLogin={()=>startLogin("/progress")} onStartLearning={()=>navigateTo("input","/")} onResume={resumeLearning} onOpenLesson={openLesson}/>}
        {screen==="collection" && <Collection auth={auth} tab={currentRoute.collectionTab} onTabChange={(tab)=>navigateTo("collection",tab==="materials"?"/collection/materials":tab==="grammar"?"/collection/grammar":"/collection")} onLogin={()=>startLogin(currentRoute.path)} onStartLearning={()=>navigateTo("input","/")} onStartSegment={startSavedSegment}/>}
      </main>
      <AuthPrompt open={authPrompt} purpose={authPromptPurpose} onClose={()=>setAuthPrompt(false)} returnPath={DB.get("loginNextPath",pathname||"/")}/>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}

export default App;
