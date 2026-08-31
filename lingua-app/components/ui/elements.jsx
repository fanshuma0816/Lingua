"use client";

import { useEffect, useState } from "react";
import { ICONS } from "../../config/icons";
import { useUI } from "../../hooks/useUI";
import { speak } from "../../lib/audio";
import { spokenTextForLine } from "../../lib/voices";

function Svg({n}){ return <svg className="i" viewBox="0 0 24 24" dangerouslySetInnerHTML={{__html:ICONS[n]||""}}/>; }

function Loading(){
  const {t}=useUI();
  const steps=t.buildingSteps;
  const [i,setI]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setI(x=>Math.min(x+1,steps.length-1)),3200); return ()=>clearInterval(t); },[]);
  return (<div className="center" style={{textAlign:"center"}}>
    <div className="tface pulse" style={{margin:"0 auto 18px",width:56,height:56,fontSize:28}}>📖</div>
    <div style={{fontWeight:600,fontSize:18}}>{t.buildingTitle}</div>
    <div className="muted" style={{marginTop:10,minHeight:22,fontSize:15}}>{steps[i]}</div>
    <div className="track" style={{maxWidth:280,margin:"18px auto 0"}}><span style={{width:((i+1)/steps.length*100)+"%",transition:"width .6s ease"}}/></div>
    <div className="tiny muted" style={{marginTop:16,maxWidth:340,marginLeft:"auto",marginRight:"auto",lineHeight:1.6}}>
      {t.buildingNote}
    </div>
  </div>);
}

const Brand=()=>(<div className="brand"><div className="logo">L</div>Lingua</div>);

function LanguageSwitch(){
  const {uiLang,setUiLang,t}=useUI();
  return (<label className="lang-switch">
    <span>{t.interfaceLanguage}</span>
    <select value={uiLang} onChange={e=>setUiLang(e.target.value)}>
      <option value="en">{t.english}</option>
      <option value="zh">{t.chinese}</option>
    </select>
  </label>);
}

const Stat=({k,v})=>(<div className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>);

function Stars({n}){ return <span>{[1,2,3,4,5].map(i=><span key={i} className={"star"+(i<=n?"":" off")}>★</span>)}</span>; }

function Teacher({children}){ return <div className="teacher"><div className="tface">👩‍🏫</div><div className="tmsg">{children}</div></div>; }

function Purpose({children}){ return <div className="purpose">{children}</div>; }

function CheckIn({children}){ return <div className="checkin"><span>💛</span><span>{children}</span></div>; }

function Say({text,lang,rate=1,voiceRole}){ const {t}=useUI(); return <button className="sbtn saybtn" title={t.play} aria-label={t.play} onClick={(e)=>{e.stopPropagation();speak(voiceRole?spokenTextForLine(text):text,lang,rate,voiceRole);}}><span>▶</span><span>{t.play}</span></button>; }

function SelfRate({value,onChange,prompt}){
  const {t}=useUI();
  return (<div><div style={{fontWeight:600,marginBottom:12}}>{prompt}</div>
    <input type="range" min="0" max="100" step="5" value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%"}}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:6}}>
      <span className="tiny muted">{t.selfLow}</span><span className="badge">{value}%</span><span className="tiny muted">{t.selfHigh}</span></div></div>);
}

function StepHead({eyebrow,title,onSkip,skipLabel}){
  return (<div className="step-head">
    <div className="step-head-main">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
    </div>
    {onSkip && <button className="btn btn-outline btn-sm step-skip focusable" onClick={onSkip}>{skipLabel}</button>}
  </div>);
}

export { Brand, CheckIn, LanguageSwitch, Loading, Purpose, Say, SelfRate, Stars, Stat, StepHead, Svg, Teacher };
