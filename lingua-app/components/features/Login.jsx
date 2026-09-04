"use client";

import { useState } from "react";
import { Brand, LanguageSwitch } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { identifyUser, trackEvent } from "../../lib/analytics";
import { DB } from "../../lib/storage";

function Login({onDone}){ const {t}=useUI(); const [email,setEmail]=useState(DB.get("email","")); const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (<div className="center">
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><LanguageSwitch/></div>
    <div style={{textAlign:"center",marginBottom:24}}><div style={{display:"inline-flex"}}><Brand/></div></div>
    <div className="card card-p"><h1 style={{fontSize:21}}>{t.loginTitle}</h1>
      <p className="sub" style={{marginBottom:18}}>{t.loginSub}</p>
      <label className="fld">{t.email}</label>
      <input className="input" value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
      <button className="btn btn-primary" style={{width:"100%",marginTop:14}} disabled={!ok} onClick={()=>{const userId=DB.get("userId",crypto.randomUUID());DB.set("userId",userId);DB.set("email",email);identifyUser(userId,{email});trackEvent("login_completed");onDone(email);}}>{t.continue}</button>
      <p className="tiny muted" style={{textAlign:"center",marginTop:14}}>{t.noPassword}</p></div>
  </div>);
}

export { Login };
