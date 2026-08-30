"use client";

import { useEffect, useRef, useState } from "react";
import { useElapsed } from "../../hooks/useElapsed";
import { useUI } from "../../hooks/useUI";
import { TTS_OK, speak, stopSpeak } from "../../lib/audio";
import { estimateAudioSeconds, fmtTime, progressPct } from "../../lib/format";
import { dialogueSegments, spokenTextForLine, voiceRoleForLine } from "../../lib/voices";
import { cachedAiAnalyze } from "../../services/api";

function FullPlayer({text,lang,label,sub}){
  const {t}=useUI();
  const [playing,setPlaying]=useState(false); const [rate,setRate]=useState(1);
  const [pos,setPos]=useState(0); const [dur,setDur]=useState(()=>estimateAudioSeconds(text,1));
  const seq=useRef(0);
  const timer=useRef(null);
  function clearTimer(){ if(timer.current){clearInterval(timer.current);timer.current=null;} }
  function attachProgress(u,estimated){
    setPos(0); setDur(estimated);
    clearTimer();
    const started=Date.now();
    timer.current=setInterval(()=>setPos(p=>Math.min(estimated,(Date.now()-started)/1000)),500);
    if(u){
      u.onmeta=(d)=>{ if(d&&isFinite(d))setDur(d); };
      u.onprogress=(p,d)=>{ clearTimer(); if(d&&isFinite(d))setDur(d); setPos(p||0); };
    }
  }
  useEffect(()=>()=>{seq.current++;clearTimer();stopSpeak();},[]);
  function start(r=rate){
    const run=++seq.current;
    const segments=dialogueSegments(text);
    const estimated=estimateAudioSeconds(text,r);
    attachProgress(null,estimated);
    if(segments.length>1){
      setPlaying(true);
      clearTimer();
      const known=segments.map(seg=>estimateAudioSeconds(seg.text,r));
      const total=()=>known.reduce((a,b)=>a+b,0);
      let doneDur=0;
      setPos(0); setDur(total());
      const playSegment=(i)=>{
        if(run!==seq.current) return;
        if(i>=segments.length){clearTimer();setPos(total());setPlaying(false);return;}
        const seg=segments[i];
        const u=speak(seg.text,lang,r,seg.voiceRole);
        if(!u){setPlaying(false);return;}
        u.onmeta=(d)=>{ if(d&&isFinite(d)){ known[i]=d; setDur(total()); } };
        u.onprogress=(p,d)=>{ if(d&&isFinite(d)){ known[i]=d; setDur(total()); } setPos(Math.min(total(),doneDur+(p||0))); };
        u.onend=()=>{ doneDur+=known[i]||estimateAudioSeconds(seg.text,r); setPos(Math.min(total(),doneDur)); setTimeout(()=>playSegment(i+1),220); };
      };
      playSegment(0);
      return;
    }
    const u=speak(text,lang,r);
    attachProgress(u,estimated);
    if(u){u.onend=()=>{clearTimer();setPos(estimated);setPlaying(false);};setPlaying(true);}
  }
  function toggle(){ if(playing){seq.current++;clearTimer();stopSpeak();setPlaying(false);return;} start(rate); }
  function setR(r){ setRate(r); if(playing){seq.current++;clearTimer();stopSpeak();start(r);} else {setDur(estimateAudioSeconds(text,r));setPos(0);} }
  const pct=dur?Math.min(100,Math.max(0,pos/dur*100)):0;
  return (<div className="player">
    <button className="playbtn" onClick={toggle}>{playing?"❚❚":"▶"}</button>
    <div style={{flex:1}}><div style={{fontWeight:600}}>{label||t.fullSourceAudio}</div>
      <div className="tiny muted">{TTS_OK?(sub||t.fullSourceRead):t.audioUnsupported}</div>
      <div className="audio-progress"><span style={{width:pct+"%"}}/></div>
      <div className="tiny muted row" style={{justifyContent:"space-between",gap:8}}>
        <span>{t.audioTime(fmtTime(pos),fmtTime(dur))}</span><span>{t.audioLeft(fmtTime(Math.max(0,dur-pos)))}</span>
      </div></div>
    <div className="row" style={{gap:6}}>{[0.75,1,1.25].map(r=><button key={r} className={"rate"+(rate===r?" on":"")} onClick={()=>setR(r)}>{r}×</button>)}
      <button className="sbtn" title={t.restart} onClick={()=>setR(rate)}>↺</button></div>
  </div>);
}

// A compact player that reads a list of sentences one after another, reusing the
// exact per-sentence audio the learner already heard elsewhere (same speak()
// arguments → same cache key → no new TTS calls / no extra token cost).
function ArticleAudio({sents,lang,label,rate=1}){
  const {t}=useUI();
  const list=(sents||[]).filter(Boolean);
  const [playing,setPlaying]=useState(false);
  const [idx,setIdx]=useState(-1);
  const stop=useRef(false);
  useEffect(()=>()=>{stop.current=true;stopSpeak();},[]);
  function playFrom(i){
    if(stop.current||i>=list.length){ setPlaying(false); setIdx(-1); return; }
    setIdx(i);
    const s=list[i]; const role=voiceRoleForLine(s,i,list);
    const u=speak(role?spokenTextForLine(s):s,lang,rate,role);
    if(!u){ setPlaying(false); return; }
    u.onend=()=>{ if(!stop.current) setTimeout(()=>{ if(!stop.current) playFrom(i+1); },160); };
  }
  function toggle(){ if(playing){ stop.current=true; stopSpeak(); setPlaying(false); setIdx(-1); return; } stop.current=false; setPlaying(true); playFrom(0); }
  if(!list.length) return null;
  const pct=idx>=0?Math.round((idx+1)/list.length*100):0;
  return (<div className="player" style={{marginBottom:14}}>
    <button className="playbtn" onClick={toggle}>{playing?"❚❚":"▶"}</button>
    <div style={{flex:1}}>
      <div style={{fontWeight:600}}>{label||t.gram.playArticle}</div>
      <div className="tiny muted">{TTS_OK?t.gram.playArticleHint:t.audioUnsupported}</div>
      <div className="audio-progress"><span style={{width:pct+"%"}}/></div>
      <div className="tiny muted">{idx>=0?`${idx+1} / ${list.length}`:`${list.length}`}</div>
    </div>
  </div>);
}

function SyncReader({items,lang,level,translation,rate=1,gap=0,onTranslated}){
  const {t,uiLang}=useUI();
  const [active,setActive]=useState(-1); const [playing,setPlaying]=useState(false); const stop=useRef(false);
  const [trs,setTrs]=useState(()=>items.map(it=>uiLang==="en" ? (it.tr||null) : null));
  const [loadingTr,setLoadingTr]=useState(false);
  const [page,setPage]=useState(0);
  const pageSize=5;
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const start=page*pageSize;
  const pageItems=items.slice(start,start+pageSize);
  const estimateSec=Math.max(8,Math.ceil(items.length*1.6));
  const elapsed=useElapsed(loadingTr);
  const remaining=Math.max(1,estimateSec-elapsed);
  useEffect(()=>{ setPage(0); setActive(-1); stopSpeak(); },[items.length]);
  useEffect(()=>{ if(translation) setTrs(items.map(()=>null)); },[uiLang,translation,items.length]);
  useEffect(()=>{ let cancel=false;
    if(!translation) return;
    const missing=pageItems.map((it,i)=>({it,i:start+i})).filter(({it,i})=>!((uiLang==="en"&&it.tr)||trs[i]));
    if(!missing.length) return;
    setLoadingTr(true);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.it.s),lang,level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      if(d&&Array.isArray(d.translations)) setTrs(prev=>{ const next=[...prev]; missing.forEach((m,i)=>{ const tr=(uiLang==="en"&&m.it.tr)||d.translations[i]||null; next[m.i]=tr; if(tr&&onTranslated) onTranslated(m.it.s,tr); }); return next; });
    });
    return ()=>{cancel=true;};
  },[translation,uiLang,page,items.length]);
  useEffect(()=>()=>{stop.current=true;stopSpeak();},[]);
  function playFrom(i){ if(stop.current||i>=items.length){setPlaying(false);setActive(-1);return;}
    const nextPage=Math.floor(i/pageSize);
    if(nextPage!==page) setPage(Math.max(0,Math.min(pageCount-1,nextPage)));
    const role=voiceRoleForLine(items[i].s,i,items);
    setActive(i); const u=speak(role?spokenTextForLine(items[i].s):items[i].s,lang,rate,role); if(!u){setPlaying(false);return;}
    u.onend=()=>{ if(!stop.current) setTimeout(()=>{ if(!stop.current) playFrom(i+1); }, gap); }; }
  function playAll(){ stop.current=false; setPlaying(true); playFrom(start); }
  function halt(){ stop.current=true; stopSpeak(); setPlaying(false); setActive(-1); }
  function one(i){ stop.current=true; stopSpeak(); setActive(i); const role=voiceRoleForLine(items[i].s,i,items); const u=speak(role?spokenTextForLine(items[i].s):items[i].s,lang,rate,role); if(u)u.onend=()=>setActive(-1); }
  function changePage(next){ halt(); setPage(Math.max(0,Math.min(pageCount-1,next))); }
  return (<div>
    <div className="row" style={{marginBottom:12}}>
      <button className="btn btn-primary btn-sm" onClick={playing?halt:playAll}>{playing?`❚❚ ${t.stop}`:`▶ ${t.playAll}`}</button>
      <span className="tiny muted">{t.syncHint}</span>
    </div>
    {translation && loadingTr && <div className="status-strip" style={{marginBottom:12}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline"}}>
        <b>{t.translatingTitle}</b><span className="tiny muted">{t.aboutRemaining(remaining)}</span>
      </div>
      <div className="mini-track"><span style={{width:progressPct(elapsed,estimateSec)+"%"}}/></div>
    </div>}
    <div className="reader-pager">
      <button className="btn btn-outline btn-sm" disabled={page===0} onClick={()=>changePage(page-1)}>← {t.previousPage}</button>
      <span className="tiny muted">{t.pageOf(page+1,pageCount)} · {start+1}-{Math.min(items.length,start+pageItems.length)} / {items.length}</span>
      <button className="btn btn-outline btn-sm" disabled={page>=pageCount-1} onClick={()=>changePage(page+1)}>{t.nextPage} →</button>
    </div>
    <div className="card card-p">
      {pageItems.map((it,j)=>{ const i=start+j; const translated=(uiLang==="en"&&it.tr)||trs[i]; return (<div key={i} className={"sline"+(active===i?" on":"")} style={{marginBottom:translation?12:2}}>
        <div className="row" style={{gap:9,alignItems:"flex-start"}}>
          <button className="sbtn saybtn" title={t.play} aria-label={t.play} onClick={(e)=>{e.stopPropagation();one(i);}}><span>▶</span></button>
          <div style={{flex:1}}>
            <div className="sentence-source">{it.s}</div>
            {translation && <div className={"translation-line"+(!translated&&loadingTr?" loading":"")}>{translated?("→ "+translated):(loadingTr?`→ ${t.lineTranslating(i+1,items.length)}`:`→ ${t.translationUnavailable}`)}</div>}
          </div>
        </div>
      </div>); })}
    </div>
  </div>);
}

export { ArticleAudio, FullPlayer, SyncReader };
