"use client";

import { useEffect, useState } from "react";
import { UI_TEXT } from "../../../config/uiText";
import { completeSessionFromHash } from "../../../lib/auth-client";
import { DB } from "../../../lib/storage";

function safeNextPath(raw, fallback) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : fallback;
}

export default function AuthCallbackPage() {
  const [uiLang] = useState(() => DB.get("uiLang", "en"));
  const t = UI_TEXT[uiLang] || UI_TEXT.en;
  const [state, setState] = useState({kind:"working", message:t.authFlow.signingIn});
  const [returnPath, setReturnPath] = useState("/");

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      try {
        const params = new URLSearchParams(window.location.search);
        const fallback = DB.get("loginNextPath", DB.get("resumePath", "/"));
        const next = safeNextPath(params.get("next"), fallback);
        setReturnPath(next);
        const session = await completeSessionFromHash(window.location.hash);
        if (!session) throw new Error("No sign-in token was found.");
        if (!cancelled) {
          setState({kind:"success", message:t.authFlow.signedIn});
          setTimeout(()=>window.close(),350);
        }
      } catch (e) {
        if (!cancelled) setState({kind:"error", message:t.authFlow.expiredTitle});
      }
    }
    finish();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="main">
      <div className="center">
        <div className="card card-p" style={{ textAlign: "center" }}>
          <h1>{state.message}</h1>
          <p className="sub">{state.kind==="error"?t.authFlow.expiredBody:(state.kind==="success"?t.authFlow.returnToOriginal:t.authFlow.callbackBody)}</p>
          {state.kind==="success" && <div className="auth-pop-actions">
            <button className="btn btn-primary" onClick={()=>window.close()}>{t.authFlow.closeTab}</button>
            <a className="btn btn-outline" href={returnPath}>{t.authFlow.continueHere}</a>
          </div>}
          {state.kind==="error" && <div className="auth-pop-actions">
            <a className="btn btn-primary" href="/login">{t.authFlow.requestNew}</a>
            <a className="btn btn-outline" href="/">{t.authFlow.backHome}</a>
          </div>}
        </div>
      </div>
    </main>
  );
}
