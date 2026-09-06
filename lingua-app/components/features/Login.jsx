"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand, LanguageSwitch } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { trackEvent } from "../../lib/analytics";
import { getAuthState, signInWithEmail } from "../../lib/auth-client";
import { DB } from "../../lib/storage";

function Login({nextPath="/progress"}){ const {t}=useUI(); const router=useRouter(); const [email,setEmail]=useState(DB.get("email","")); const [status,setStatus]=useState("checking"); const [message,setMessage]=useState(""); const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  useEffect(()=>{
    let cancelled=false;
    async function check(){
      const state=await getAuthState();
      if(cancelled) return;
      if(state.session?.accessToken){ router.replace(nextPath||"/progress"); return; }
      setStatus("idle");
    }
    check();
    return ()=>{cancelled=true;};
  },[nextPath,router]);
  async function sendLink(){
    if(!ok||status==="sending"||status==="checking") return;
    setStatus("sending"); setMessage("");
    try{
      DB.set("email",email);
      await signInWithEmail(email,nextPath);
      trackEvent("login_link_sent");
      setStatus("sent");
      setMessage(t.loginLinkSent);
    }catch(e){
      setStatus("error");
      setMessage(e?.message||t.loginError);
    }
  }
  return (<div className="center">
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><LanguageSwitch/></div>
    <div style={{textAlign:"center",marginBottom:24}}><div style={{display:"inline-flex"}}><Brand/></div></div>
    <div className="card card-p"><h1 style={{fontSize:21}}>{t.loginTitle}</h1>
      <p className="sub" style={{marginBottom:18}}>{t.loginSub}</p>
      <label className="fld">{t.email}</label>
      <input className="input" value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
      <button className="btn btn-primary" style={{width:"100%",marginTop:14}} disabled={!ok||status==="sending"||status==="checking"} onClick={sendLink}>{status==="checking"?t.loginChecking:(status==="sending"?t.saveProgress.sending:t.saveProgress.sendLink)}</button>
      {message && <p className={"tiny save-status "+(status==="error"?"error":"ok")} style={{textAlign:"center"}}>{message}</p>}
      <p className="tiny muted" style={{textAlign:"center",marginTop:14}}>{t.noPassword}</p></div>
  </div>);
}

export { Login };
