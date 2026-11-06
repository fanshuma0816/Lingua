"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_DOCUMENT_CHARS } from "../../config/constants";
import { useUI } from "../../hooks/useUI";
import { createMaterialPlan } from "../../lib/material-plan";
import { saveMaterialPlan } from "../../lib/materials-client";
import { extractPdfText } from "../../lib/pdf-import-client";
import { readPendingMaterial, removePendingMaterial, savePendingMaterial } from "../../lib/pending-material-store";

function lessonFromSegment(plan,segment,account={}){
  return {text:segment.text,lang:"Dutch",level:plan.level,goal:plan.goal,targetMin:Math.round((segment.estimatedMinutesMin+segment.estimatedMinutesMax)/2),
    material:{id:segment.id||segment.localId,title:plan.displayName,source:plan.sourceType,targetUserLevel:String(plan.level).slice(0,2),
      validatedTextLevel:segment.material_level||segment.materialLevel||String(plan.level).slice(0,2),difficultyTier:segment.difficulty_label||segment.difficultyLabel||"balanced",
      estimatedLessonTime:segment.estimatedMinutesMax,accountMaterialId:account.materialId||null,accountSegmentId:account.segmentId||null,
      segmentIndex:segment.segment_index??segment.index,segmentCount:plan.segmentCount}};
}

function MaterialImporter({auth,level,goal,onNext,onRequireLogin,initialText="",onTextChange}){
  const {t}=useUI(),fileRef=useRef(null);
  const [raw,setRawState]=useState(initialText),[source,setSource]=useState({type:"pasted",name:t.materialDefaultName||"My material",pageMap:[],fileSize:null,pageCount:null});
  const [status,setStatus]=useState("idle"),[progress,setProgress]=useState(null),[error,setError]=useState(""),[plan,setPlan]=useState(null);
  const signedIn=!!auth?.session?.accessToken;
  const setRaw=value=>{setRawState(value);onTextChange?.(value);setPlan(null);setError("");};
  useEffect(()=>{if(!initialText)return;setRawState(initialText);},[]);
  useEffect(()=>{if(!signedIn)return;readPendingMaterial().then(p=>{if(p&&!plan){setPlan(p);setRawState(p.cleanedText);setSource({type:p.sourceType,name:p.displayName,pageMap:[],fileSize:p.fileSize,pageCount:p.pageCount});}}).catch(()=>{});},[signedIn]);
  async function chooseFile(event){
    const file=event.target.files?.[0];if(!file)return;setError("");setPlan(null);setStatus("reading");setProgress(null);
    try{
      if(/\.pdf$/i.test(file.name)){
        const result=await extractPdfText(file,{onProgress:setProgress});
        setRaw(result.text);setSource({type:"pdf",name:file.name.replace(/\.pdf$/i,""),pageMap:result.pageMap,fileSize:result.fileSize,pageCount:result.pageCount});
      }else{
        const text=await file.text();
        setRaw(text);setSource({type:/\.md$/i.test(file.name)?"markdown":"txt",name:file.name.replace(/\.(txt|md)$/i,""),pageMap:[],fileSize:file.size,pageCount:null});
      }
      setStatus("ready");
    }catch(e){setStatus("error");setError(t.materialImportErrors?.[e?.message]||e?.message||t.materialImportFailed||"Could not read this file.");}
    finally{event.target.value="";}
  }
  function buildPlan(){
    try{const next=createMaterialPlan(raw,{sourceType:source.type,displayName:source.name,pageMap:source.pageMap,level,goal,targetMin:30,fileSize:source.fileSize,pageCount:source.pageCount});setPlan(next);setRawState(next.cleanedText);onTextChange?.(next.cleanedText);setError("");}
    catch(e){setError(t.materialImportErrors?.[e?.message]||e?.message||t.materialImportFailed||"Could not prepare this material.");}
  }
  async function requestLogin(){await savePendingMaterial(plan);onRequireLogin?.("/import","save-material-plan");}
  async function startOnly(){await removePendingMaterial().catch(()=>{});onNext(lessonFromSegment(plan,plan.segments[0]));}
  async function saveAndStart(){
    if(!signedIn)return requestLogin();setStatus("saving");setError("");
    try{const result=await saveMaterialPlan(plan,auth.session.accessToken),saved=result.material,segment=saved.segments?.[0];await removePendingMaterial().catch(()=>{});onNext(lessonFromSegment(plan,segment,{materialId:saved.id,segmentId:segment?.id}));}
    catch(e){setStatus("ready");setError(e?.message||t.materialSaveFailed||"Could not save this material.");}
  }
  const long=plan?.segments?.length>1,count=raw.length,ready=count>=40&&count<=MAX_DOCUMENT_CHARS;
  return <>
    <div className="card card-p material-importer">
      <div className="row input-card-head" style={{justifyContent:"space-between",marginBottom:10}}>
        <label className="fld" style={{margin:0}}>{t.yourText}</label>
        <button className="btn btn-outline btn-sm" onClick={()=>fileRef.current?.click()}>{t.uploadMaterial||"Upload PDF or text"}</button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={chooseFile} style={{display:"none"}}/>
      </div>
      {status==="reading"&&<div className="import-progress">{progress?t.pdfProgress?.(progress.pageNumber,progress.pageCount)||`Reading page ${progress.pageNumber} of ${progress.pageCount}…`:t.materialReading||"Reading your material…"}</div>}
      <textarea style={{minHeight:260}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={t.textPlaceholder}/>
      <div className="row input-meta-row" style={{justifyContent:"space-between",marginTop:10}}><span className="tiny muted">{t.cleanedPreviewNote||t.cleanNote}</span><span className="tiny muted">{count.toLocaleString()} / {MAX_DOCUMENT_CHARS.toLocaleString()} {t.chars}</span></div>
      {source.type==="pdf"&&<div className="tiny muted" style={{marginTop:7}}>{t.pdfPrivacy||"The original PDF is processed on this device and is not saved."}</div>}
      {error&&<div className="notice" style={{marginTop:12}}>{error}</div>}
      {!plan&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={!ready||status==="reading"} onClick={buildPlan}>{t.analyzeText} →</button></div>}
    </div>
    {plan&&<div className="card card-p material-plan-summary" style={{marginTop:16}}>
      <h2>{long?(t.materialPlanTitle?.(plan.segmentCount)||`Recommended: ${plan.segmentCount} lessons`):(t.materialReadyTitle||"Your material is ready")}</h2>
      {long&&<p className="sub">{t.materialPlanBody||"Each lesson uses one complete section of the text."}</p>}
      <div className="segment-list">{plan.segments.map(s=><div className="segment-row" key={s.localId}><span><b>{t.materialPart?.(s.index+1)||`Part ${s.index+1}`}</b><small>{s.wordCount} {t.wordsLabel||"words"}</small></span><span>{s.estimatedMinutesMin}–{s.estimatedMinutesMax} {t.minutesShort||"min"}</span></div>)}</div>
      {long&&<div className="material-save-choice">
        <p>{signedIn?(t.saveMaterialSignedIn||"Save the cleaned text and remaining lesson plan to your account?"):(t.saveMaterialGuest||`Sign in to save all ${plan.segmentCount} lessons. Without signing in, only the first lesson will be kept.`)}</p>
        <div className="row wrap" style={{gap:9}}><button className="btn btn-primary" disabled={status==="saving"} onClick={saveAndStart}>{signedIn?(status==="saving"?t.savingMaterial:t.saveMaterialAndStart):(t.signInSavePlan||"Sign in and save the plan")}</button><button className="btn btn-outline" onClick={startOnly}>{t.currentLessonOnly||"Study this lesson only"}</button></div>
        <div className="tiny muted" style={{marginTop:8}}>{t.currentLessonOnlyHint||"The remaining sections will not be saved."}</div>
      </div>}
      {!long&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button className="btn btn-primary" onClick={startOnly}>{t.analyzeText} →</button></div>}
    </div>}
  </>;
}

export { MaterialImporter, lessonFromSegment };
