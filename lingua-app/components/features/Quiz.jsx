"use client";

import { useEffect, useState } from "react";
import { useUI } from "../../hooks/useUI";
import { speak } from "../../lib/audio";
import { spokenTextForLine, voiceRoleForLine } from "../../lib/voices";
import { cachedAiAnalyze } from "../../services/api";

function Quiz({items,lang,audio}){
  const {t}=useUI();
  const [ans,setAns]=useState({});
  return (<div>{items.map((q,qi)=>{ const chosen=ans[qi];
    return (<div key={qi} className="card card-p" style={{marginBottom:14}}>
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontWeight:600}}>{q.q?q.q:(audio?t.whichHeard:t.whichMatches)}</div>
        {audio && <button className="btn btn-outline btn-sm" onClick={()=>{const role=voiceRoleForLine(q.correct,qi,items.map(x=>x.correct)); speak(role?spokenTextForLine(q.correct):q.correct,lang,1,role);}}>▶ {t.play}</button>}</div>
      {q.options.map((o,oi)=>{ let cls="opt"; if(chosen!=null){if(o.ok)cls+=" correct";else if(oi===chosen)cls+=" wrong";}
        return (<div key={oi} className={cls} onClick={()=>chosen==null&&setAns({...ans,[qi]:oi})}>
          <span className="mk">{chosen!=null&&o.ok?"✓":chosen===oi?"✕":String.fromCharCode(65+oi)}</span><span>{o.t}</span></div>); })}
      {chosen!=null && <div className="tiny muted" style={{marginTop:4}}>{q.options[chosen].ok?t.niceRight:t.notQuite}</div>}
    </div>); })}</div>);
}

function AIQuiz({lesson}){
  const {t}=useUI();
  const {lang,level,sents,comprehension}=lesson;
  const [items,setItems]=useState(comprehension);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ let cancel=false;
    cachedAiAnalyze("quiz",{lang,level,sentences:sents.slice(0,10),count:3}).then(d=>{
      if(cancel) return; setLoading(false);
      if(d&&Array.isArray(d.items)&&d.items.length) setItems(d.items);
    });
    return ()=>{cancel=true;};
  },[]);
  return (<div>
    {loading && <div className="tiny muted" style={{marginBottom:8}}>{t.quizLoading}</div>}
    <Quiz items={items} lang={lang} audio={false}/>
  </div>);
}

export { AIQuiz, Quiz };
