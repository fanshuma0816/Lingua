"use client";

import { useEffect, useRef, useState } from "react";
import { materialId as cefrMaterialId } from "../../lib/cefr.mjs";
import { Stars, Stat, Teacher } from "../ui/elements";
import { GOALS, LANGS, LANG_CODE, LEVELS, PLAN_BLOCKS, STEPS, TOTAL_MIN } from "../../config/constants";
import { langName } from "../../config/uiText";
import { useUI } from "../../hooks/useUI";
import { safeDutchMaterial } from "../../lib/dutch";
import { durationSpec, scrollToTop } from "../../lib/format";
import { materialStats, sourceIcon } from "../../lib/lesson-client";
import { DB } from "../../lib/storage";
import { cleanText } from "../../lib/text";
import { aiAnalyze, sampleMaterials } from "../../services/api";

function SourceIdeas({tips,hint}){
  const {t}=useUI();
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const current=tips[active]||tips[0];
  return (<div className={"source-tips compact"+(open?" open":"")}>
    <button className="ideas-toggle" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>
      <span><b>{t.materialTipsTitle}</b><small>{hint}</small></span>
      <span>{open?t.hideIdeas:t.showIdeas}</span>
    </button>
    {open && <div className="ideas-body">
      <div className="idea-tabs">{tips.map((tip,i)=><button key={tip.key} className={active===i?"on":""} onClick={()=>setActive(i)}>
        <span>{tip.icon}</span><span>{tip.key}</span>
      </button>)}</div>
      {current && <div className="idea-panel">
        <div>
          <b>{current.key}</b>
          <p>{current.detail}</p>
        </div>
        <div className="source-links">{(current.links||[]).map((link,i)=>link.url
          ? <a key={i} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
          : <span key={i}>{link.label}</span>)}</div>
      </div>}
    </div>}
  </div>);
}

function InputScreen({onNext,initialMode=null,onRouteChange}){
  const {t}=useUI();
  const [mode,setMode]=useState(initialMode);
  const [raw,setRaw]=useState(DB.get("draft","")); const cleaned=cleanText(raw); const count=cleaned.length; const LIMIT=1200; const over=count>LIMIT;
  const savedLang=DB.get("lang","Dutch");
  const [lang,setLang]=useState(LANG_CODE[savedLang]?savedLang:"Dutch"); const [level,setLevel]=useState(DB.get("level",LEVELS[1])); const [goal,setGoal]=useState(DB.get("goal",GOALS[0]));
  const [durationIdx,setDurationIdx]=useState(1);
  const [topicIdxs,setTopicIdxs]=useState([0]);
  const [materials,setMaterials]=useState([]);
  const [selectedMaterial,setSelectedMaterial]=useState(0);
  const [materialError,setMaterialError]=useState(false);
  const [generating,setGenerating]=useState(false);
  const fileRef=useRef(null);
  const recentTitles=useRef([]);   // anti-repeat memory across regenerations
  function onFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setRaw(String(r.result));r.readAsText(f);}
  const ready=count>40&&!over&&lang;
  const liveStats=count>40?materialStats(cleaned,level):null;
  const shouldSplit=liveStats&&(liveStats.mins>=60||count>1050||liveStats.words>240);
  const durationPlans=t.durationPlans||[];
  const selectedDuration=durationPlans[durationIdx]?.label||"45-60 min";
  const topics=topicIdxs.map(i=>t.interestOptions[i]).filter(Boolean);
  useEffect(()=>{ setMode(initialMode); },[initialMode]);
  useEffect(()=>{ scrollToTop(); },[mode]);
  function setModeRoute(nextMode,path){ setMode(nextMode); onRouteChange?.(path); }
  function toggleTopic(index){ setTopicIdxs(prev=>prev.includes(index)?prev.filter(x=>x!==index):[...prev,index].slice(0,3)); }
  async function generateMaterials(){
    if(!lang) return;
    setGenerating(true);
    setMaterialError(false);
    setMaterials([]);
    const spec=durationSpec(selectedDuration);
    // Anti-repeat: tell the server which topics/titles we just showed, plus a nonce.
    const avoid=[...recentTitles.current,...topics].slice(0,12);
    const nonce=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
    const d=await aiAnalyze("materials",{lang,level,goal,duration:selectedDuration,topics,avoid,nonce},{timeoutMs:10000});
    let generated=d&&Array.isArray(d.materials)?d.materials.filter(safeDutchMaterial):[];
    if(!generated.length) generated=sampleMaterials(lang,level,goal,selectedDuration,topics,avoid).filter(safeDutchMaterial);
    if(generated.length){
      generated=generated.map(m=>({...m,duration:m.duration||selectedDuration,targetMinutes:m.targetMinutes||spec.target}));
    }
    const items=generated.slice(0,3);
    recentTitles.current=[...items.map(m=>m.title).filter(Boolean),...recentTitles.current].slice(0,12);
    setMaterials(items); setSelectedMaterial(0); setMaterialError(!items.length); setGenerating(false);
  }
  function startGenerated(){
    const m=materials[selectedMaterial]; if(!m) return;
    const text=cleanText(m.text||""); DB.set("draft",m.text||""); DB.set("lang",lang); DB.set("level",level); DB.set("goal",goal);
    const targetMin=m.targetMinutes||durationSpec(selectedDuration).target;
    // Pass the stored material analysis forward so card = preview = diagnosis.
    const material={ id:m.id||cefrMaterialId(text), title:m.title||null, source:m.source||null,
      targetUserLevel:m.targetUserLevel||level.slice(0,2), validatedTextLevel:m.validatedTextLevel||m.level||level.slice(0,2),
      difficultyTier:m.difficultyTier||null, hardWordRatio:m.hardWordRatio??null,
      vocabularyAnnotations:Array.isArray(m.vocabularyAnnotations)?m.vocabularyAnnotations:[], estimatedLessonTime:targetMin };
    onNext({text,lang,level,goal,targetMin,material});
  }
  if(!mode) return (<div className="start-screen">
    <div className="start-head">
      <h1>{t.startTitle}</h1>
      <p className="sub">{t.startSub}</p>
    </div>
    <div className="entry-grid">
      <button className="entry-card" onClick={()=>setModeRoute("material","/import")}>
        <span className="entry-icon">📄</span>
        <span className="entry-copy">
          <span className="entry-title">{t.startMaterialTitle}</span>
          <span className="entry-sub">{t.startMaterialSub}</span>
          <span className="entry-action">{t.startMaterialAction} →</span>
        </span>
      </button>
      <button className="entry-card" onClick={()=>setModeRoute("find","/find")}>
        <span className="entry-icon">✨</span>
        <span className="entry-copy">
          <span className="entry-title">{t.startFindTitle}</span>
          <span className="entry-sub">{t.startFindSub}</span>
          <span className="entry-action">{t.startFindAction} →</span>
        </span>
      </button>
    </div>
  </div>);

  if(mode==="find") return (<div>
    <button className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setModeRoute(null,"/")}>← {t.back}</button>
    <h1>{t.findTitle}</h1><p className="sub">{t.findSub}</p>
    <div className="card card-p">
      <div className="grid3">
        <div><label className="fld">{t.targetLanguage}</label><select value={lang} onChange={e=>setLang(e.target.value)}>{LANGS.map(l=><option key={l} value={l}>{langName(t,l)}</option>)}</select></div>
        <div><label className="fld">{t.currentLevel}</label><select value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map((l,i)=><option key={l} value={l}>{t.levels[i]||l}</option>)}</select></div>
        <div><label className="fld">{t.sessionGoal}</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map((l,i)=><option key={l} value={l}>{t.goals[i]||l}</option>)}</select></div>
      </div>
      <div className="grid2" style={{marginTop:16}}>
        <div><label className="fld">{t.duration}</label><div className="duration-options">{durationPlans.map((plan,i)=><button key={plan.label} className={"duration-card"+(durationIdx===i?" on":"")} onClick={()=>setDurationIdx(i)}>
          <span className="duration-icon">{plan.icon}</span>
          <span><b>{plan.label}</b><small>{plan.length} · {plan.vocab}</small></span>
        </button>)}</div></div>
        <div><label className="fld">{t.interests}</label><div className="topic-pills">{t.interestOptions.map((topic,i)=><button key={topic} className={topicIdxs.includes(i)?"on":""} onClick={()=>toggleTopic(i)}>{topic}</button>)}</div></div>
      </div>
      <div className="row" style={{justifyContent:"space-between",marginTop:18}}>
        {!lang && <span className="tiny muted">{t.chooseTarget}</span>}
        <span/>
        <button className="btn btn-primary" disabled={!lang||generating} onClick={generateMaterials}>{generating?t.generatingMaterials:t.generateMaterials}</button>
      </div>
      {generating && <div className="track" style={{marginTop:14,overflow:"hidden"}}><span className="indet"/></div>}
    </div>
    {materialError && !generating && <div className="card card-p" style={{marginTop:22}}>
      <div className="tiny muted" style={{fontWeight:600}}>{t.noSuitableMaterials(level.slice(0,2))}</div>
    </div>}
    {materials.length>0 && <div className="material-results">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <div><h2 style={{margin:0}}>{t.chooseMaterial}</h2><div className="tiny muted">{t.switchAnytime}</div></div>
        <button className="btn btn-primary btn-sm" onClick={startGenerated}>{t.useThisText} →</button>
      </div>
      <div className="generated-grid">
        {materials.map((m,i)=>{ const stats=materialStats(m.text,level,m.duration||selectedDuration); return <button key={i} className={"generated-card"+(selectedMaterial===i?" on":"")} onClick={()=>setSelectedMaterial(i)}>
          <span className="row wrap" style={{gap:6}}><span className="badge badge-outline">{sourceIcon(m.source)} {m.source||"AI text"}</span><span className="badge badge-warm">{m.validatedTextLevel||m.level||level.slice(0,2)}</span></span>
          <b>{m.title}</b>
          <span className="generated-meta">{t.materialMeta(stats.mins,stats.words,stats.vocab)}</span>
          <span>{(m.text||"").slice(0,190)}{(m.text||"").length>190?"…":""}</span>
        </button>; })}
      </div>
    </div>}
  </div>);

  return (<div>
    <button className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setModeRoute(null,"/")}>← {t.back}</button>
    <h1>{t.inputTitle}</h1><p className="sub">{t.inputSub}</p>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <label className="fld" style={{margin:0}}>{t.yourText}</label>
        <button className="btn btn-outline btn-sm" onClick={()=>fileRef.current.click()}>{t.uploadTxt}</button>
        <input ref={fileRef} type="file" accept=".txt,.md" onChange={onFile} style={{display:"none"}}/></div>
      <SourceIdeas tips={t.materialTips} hint={t.sourceHint}/>
      <textarea style={{minHeight:220}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={t.textPlaceholder}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{t.cleanNote}</span>
        <span className="tiny" style={{fontWeight:600,color:over?"hsl(0 72% 45%)":"hsl(var(--muted-foreground))"}}>{count.toLocaleString()} / {LIMIT.toLocaleString()} {t.chars}</span></div>
      {shouldSplit && <div className="split-warning">
        <b>{t.splitTitle}</b>
        <span>{t.splitText(liveStats.mins)}</span>
      </div>}
    </div>
    <div className="grid3" style={{marginTop:16}}>
      <div><label className="fld">{t.targetLanguage}</label><select value={lang} onChange={e=>setLang(e.target.value)}>{LANGS.map(l=><option key={l} value={l}>{langName(t,l)}</option>)}</select></div>
      <div><label className="fld">{t.currentLevel}</label><select value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map((l,i)=><option key={l} value={l}>{t.levels[i]||l}</option>)}</select></div>
      <div><label className="fld">{t.sessionGoal}</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map((l,i)=><option key={l} value={l}>{t.goals[i]||l}</option>)}</select></div>
    </div>
    {over && <p className="tiny" style={{color:"hsl(0 72% 45%)",marginTop:12}}>{t.overLimit}</p>}
    {!lang && <p className="tiny muted" style={{marginTop:12}}>{t.chooseTarget}</p>}
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
      <button className="btn btn-primary" disabled={!ready} onClick={()=>{DB.set("draft",raw);DB.set("lang",lang);DB.set("level",level);DB.set("goal",goal);onNext({text:cleaned,lang,level,goal});}}>{t.analyzeText} →</button>
    </div>
  </div>);
}

function Preview({lesson,text,onStart,onBack}){
  const {t}=useUI();
  const heavy=lesson.vocabCount>12;
  const total=lesson.estMin||TOTAL_MIN; const scale=total/TOTAL_MIN;
  const diffLabel=t.diffLabels[lesson.diff];
  const fullText=(text&&text.trim())?text:((lesson.sents||[]).join("\n"));
  // The material's CEFR comes from the ONE stored analysis — not a recompute.
  const matLevel=(lesson.material&&lesson.material.validatedTextLevel)||lesson.recommended.split(" — ")[0];
  return (<div>
    <h1>{t.previewTitle}</h1><p className="sub">{t.previewSub}</p>
    <div className="row wrap" style={{gap:7,marginBottom:16}}>
      <span className="tiny muted" style={{fontWeight:600}}>{t.topics}</span>
      {lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}
    </div>
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <h3 className="lbl" style={{margin:0}}>{t.previewTextTitle}</h3>
        <span className="tiny muted">{lesson.charCount.toLocaleString()} {t.chars}</span>
      </div>
      <div className="tiny muted" style={{marginBottom:10}}>{t.previewTextHint}</div>
      <div style={{maxHeight:280,overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.7,fontSize:15,padding:"2px 2px"}}>{fullText}</div>
    </div>
    <div className="grid4" style={{marginBottom:14}}>
      <Stat k={t.recommendedLevel} v={matLevel}/>
      <Stat k={t.estimatedTime} v={t.min(total)}/>
      <Stat k={t.vocabulary} v={t.wordCount(lesson.vocabCount)}/>
      <Stat k={t.characters} v={lesson.charCount.toLocaleString()}/>
    </div>
    {(lesson.charCount>1050||lesson.vocabCount>18) && <div className="split-warning" style={{marginBottom:14}}>
      <b>{t.splitTitle}</b>
      <span>{t.splitText(total)}</span>
    </div>}
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div><div className="stat-k" style={{fontSize:11,fontWeight:600,color:"hsl(var(--muted-foreground))",textTransform:"uppercase",letterSpacing:".05em"}}>{t.difficultyForYou}</div>
          <div style={{marginTop:5}}><Stars n={lesson.diff}/> <span style={{fontWeight:600,marginLeft:6}}>{diffLabel}</span></div></div>
        <div className="tiny muted" style={{textAlign:"right",maxWidth:230}}>{t.basedOnLevel(lesson.level.split(" — ")[0],matLevel)}</div>
      </div>
    </div>
    {heavy && <div className="checkin" style={{marginTop:16,background:"hsl(var(--warm)/.08)",borderColor:"hsl(var(--warm)/.3)"}}><span>💡</span>
      <span>{t.heavy(lesson.vocabCount)}</span></div>}
    <div className="row" style={{justifyContent:"space-between",marginTop:22}}>
      <button className="btn btn-ghost" onClick={onBack}>← {t.back}</button>
      <button className="btn btn-primary" onClick={onStart}>{t.start(total)} →</button></div>
  </div>);
}

function DailyFocus({lesson}){
  const {t}=useUI();
  const focus=lesson.focus||null;
  if(!focus) return <div className="card card-p" style={{marginBottom:16}}>
    <h3 className="lbl">{t.focus.title}</h3>
    <div className="tiny muted">{t.focus.loading}</div>
  </div>;
  const vocab=Array.isArray(focus.vocab)?focus.vocab.slice(0,8):[];
  const grammar=Array.isArray(focus.grammar)?focus.grammar.slice(0,3):[];
  return (<div className="card card-p" style={{marginBottom:16}}>
    <h3 className="lbl">{t.focus.title}</h3>
    <Teacher>{t.focus.teacher}</Teacher>
    {!!vocab.length && <div style={{marginBottom:12}}>
      <div className="tiny muted" style={{fontWeight:700,marginBottom:7}}>{t.focus.vocab}</div>
      <div className="row wrap" style={{gap:7}}>{vocab.map((v,i)=><span key={(v.word||"")+i} className="badge">{v.word}<span className="muted">{v.level||""}</span></span>)}</div>
    </div>}
    {!!grammar.length && <div>
      <div className="tiny muted" style={{fontWeight:700,marginBottom:7}}>{t.focus.grammar}</div>
      <div className="row wrap" style={{gap:7}}>{grammar.map((g,i)=><span key={(g.point||"")+i} className="badge badge-outline">{g.point}<span className="muted">{g.level||""}</span></span>)}</div>
    </div>}
  </div>);
}

export { DailyFocus, InputScreen, Preview, SourceIdeas };
