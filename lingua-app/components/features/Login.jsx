"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, LanguageSwitch } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { trackEvent } from "../../lib/analytics";
import { getAuthState, signInWithEmail, subscribeAuthChanges } from "../../lib/auth-client";
import { DB } from "../../lib/storage";

function Login({nextPath="/progress"}){ const {t}=useUI(); const router=useRouter(); const [email,setEmail]=useState(DB.get("email","")); const [status,setStatus]=useState("checking"); const [message,setMessage]=useState(""); const [mode,setMode]=useState("signup"); const c=t.commercial; const signup=mode==="signup"; const busy=status==="sending"||status==="checking"; const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  useEffect(()=>{
    let cancelled=false;
    async function check(){
      const state=await getAuthState();
      if(cancelled) return;
      if(state.session?.accessToken){ router.replace(nextPath||"/progress"); return; }
      setStatus("idle");
    }
    check();
    const unsubscribe=subscribeAuthChanges(check);
    return ()=>{cancelled=true;unsubscribe();};
  },[nextPath,router]);
  async function sendLink(){
    if(!ok||status==="sending"||status==="checking") return;
    setStatus("sending"); setMessage("");
    try{
      DB.set("email",email);
      await signInWithEmail(email,nextPath);
      trackEvent("login_link_sent");
      setStatus("sent");
      setMessage(signup?c.signupSent:c.loginSent);
    }catch(e){
      setStatus("error");
      setMessage(e?.message||t.loginError);
    }
  }
  function switchMode(next){
    if(busy)return;
    setMode(next);setMessage("");setStatus("idle");
  }
  return (<div className="center auth-page">
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><LanguageSwitch/></div>
    <a className="auth-brand focusable" href="https://www.lingualanguage.site/" aria-label="Lingua home"><Brand variant="landing"/></a>
    <div className="card card-p auth-card">
      <div className="auth-mode-switch" role="group" aria-label={c.signupTab+" / "+c.loginTab}>
        <button type="button" className="focusable" aria-pressed={signup} disabled={busy} onClick={()=>switchMode("signup")}>{c.signupTab}</button>
        <button type="button" className="focusable" aria-pressed={!signup} disabled={busy} onClick={()=>switchMode("login")}>{c.loginTab}</button>
      </div>
      <h1>{signup?c.signupTitle:c.loginTitle}</h1>
      <p className="sub">{signup?c.signupBody:c.loginBody}</p>
      {signup && <ul className="auth-benefits">{c.benefits.map(benefit=><li key={benefit}>{benefit}</li>)}</ul>}
      <form onSubmit={e=>{e.preventDefault();sendLink();}}>
        <label className="fld" htmlFor="login-email">{t.email}</label>
        <input id="login-email" className="input" type="email" autoComplete="email" required value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
        <button type="submit" className="btn btn-primary auth-submit" disabled={!ok||busy}>{status==="checking"?t.loginChecking:(status==="sending"?t.saveProgress.sending:(status==="sent"?c.resend:(signup?c.sendSignup:c.sendLogin)))}</button>
      </form>
      {message && <p className={"tiny save-status "+(status==="error"?"error":"ok")} role="status">{message}</p>}
      <p className="tiny muted auth-password-note">{t.noPassword}</p>
      {!signup && <p className="tiny muted">{c.noCharge}</p>}
      <div className="auth-pro-note"><p>{c.proNote}</p><a href="https://www.lingualanguage.site/#pricing" target="_blank" rel="noopener noreferrer">{c.viewPlans} →</a></div>
      <details className="auth-plan-details"><summary>{c.viewPlans}</summary><p>{c.planRules}</p><p>{c.renewalNote}</p></details>
    </div>
  </div>);
}

export { Login };
