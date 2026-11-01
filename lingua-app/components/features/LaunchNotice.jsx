"use client";

import { useEffect, useState } from "react";
import { useUI } from "../../hooks/useUI";

// Pre-launch notice: update explicitly when the paid release is ready.
// A calendar date alone must never imply that checkout is available.
const DISMISS_KEY="lingua:pro-launch-2026-11-09-dismissed";

function LaunchNotice(){
  const {t}=useUI();
  const c=t.commercial;
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    try{setVisible(localStorage.getItem(DISMISS_KEY)!=="1");}
    catch{setVisible(true);}
  },[]);
  function dismiss(){
    setVisible(false);
    try{localStorage.setItem(DISMISS_KEY,"1");}catch{}
  }
  if(!visible)return null;
  return (<aside className="launch-notice" aria-label={c.launchTitle}>
    <div className="launch-notice-copy">
      <strong>{c.launchTitle}</strong>
      <p>{c.launchBody}</p>
      <a href="https://www.lingualanguage.site/#pricing" target="_blank" rel="noopener noreferrer">{c.viewPlans} →</a>
    </div>
    <button type="button" className="launch-notice-close focusable" onClick={dismiss} aria-label={c.dismiss}>×</button>
  </aside>);
}

export { LaunchNotice };
