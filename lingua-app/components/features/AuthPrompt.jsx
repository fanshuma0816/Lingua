"use client";

import { useEffect, useState } from "react";
import { Svg } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { signInWithEmail } from "../../lib/auth-client";
import { DB } from "../../lib/storage";

function AuthPrompt({ open, onClose, returnPath, purpose }) {
  const { t } = useUI();
  const [email,setEmail]=useState(()=>DB.get("email",""));
  const [status,setStatus]=useState("idle");
  const [message,setMessage]=useState("");
  const valid=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  useEffect(()=>{ if(open) { setStatus("idle"); setMessage(""); } },[open]);
  async function sendLink(){
    if(!valid||status==="sending") return;
    setStatus("sending"); setMessage("");
    try{
      const path=returnPath||(typeof window!=="undefined"?window.location.pathname:"/");
      DB.set("email",email);
      DB.set("loginNextPath",path);
      await signInWithEmail(email,path);
      setStatus("sent");
      setMessage(t.authPrompt.linkSent);
    }catch(e){
      setStatus("error");
      setMessage(e?.message||t.loginError);
    }
  }
  if (!open) return null;
  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div className="auth-pop" role="dialog" aria-modal="true" aria-labelledby="auth-pop-title" onClick={(e) => e.stopPropagation()}>
        <button className="auth-pop-close focusable" onClick={onClose} aria-label={t.authPrompt.close}>×</button>
        <div className="auth-pop-icon"><Svg n="bookmark" /></div>
        <h2 id="auth-pop-title">{purpose==="save-material-plan"?(t.signInSavePlan||t.authPrompt.title):t.authPrompt.title}</h2>
        <p>{purpose==="save-material-plan"?(t.saveMaterialGuest||t.authPrompt.body):t.commercial.saveIntro+" "+t.authPrompt.body}</p>
        <p className="tiny muted auth-launch-note">{t.commercial.saveLaunch}</p>
        <div className="auth-pop-field">
          <label className="fld" htmlFor="auth-email">{t.email}</label>
          <input id="auth-email" className="input" type="email" autoComplete="email" value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
        </div>
        {message && <div className={"tiny save-status auth-pop-status "+(status==="error"?"error":"ok")} role="status">{message}</div>}
        <div className="auth-pop-actions">
          <button className="btn btn-primary focusable" disabled={!valid||status==="sending"||status==="sent"} onClick={sendLink}><Svg n="user" /> {status==="sending"?t.saveProgress.sending:(status==="sent"?t.authPrompt.emailSent:t.authPrompt.signIn)}</button>
          <button className="btn btn-outline focusable" onClick={onClose}>{t.authPrompt.keepLearning}</button>
        </div>
      </div>
    </div>
  );
}

export { AuthPrompt };
