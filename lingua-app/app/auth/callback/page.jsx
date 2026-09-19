"use client";

import { useEffect, useState } from "react";
import { UI_TEXT } from "../../../config/uiText";
import { completeSessionFromHash } from "../../../lib/auth-client";
import { DB } from "../../../lib/storage";

function safeNextPath(raw, fallback) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export default function AuthCallbackPage() {
  const [uiLang] = useState(() => DB.get("uiLang", "en"));
  const t = UI_TEXT[uiLang] || UI_TEXT.en;
  const [state, setState] = useState({kind:"working", message:t.authFlow.signingIn});

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      try {
        const params = new URLSearchParams(window.location.search);
        const fallback = DB.get("pendingSaveAfterLogin", false) ? "/done?save=1" : "/done";
        const next = safeNextPath(params.get("next"), fallback);
        const session = await completeSessionFromHash(window.location.hash);
        if (!session) throw new Error("No sign-in token was found.");
        if (!cancelled) {
          setState({kind:"success", message:t.authFlow.signedIn});
          window.location.replace(next);
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
          <p className="sub">{state.kind==="error"?t.authFlow.expiredBody:t.authFlow.callbackBody}</p>
          {state.kind==="error" && <div className="auth-pop-actions">
            <a className="btn btn-primary" href="/login">{t.authFlow.requestNew}</a>
            <a className="btn btn-outline" href="/">{t.authFlow.backHome}</a>
          </div>}
        </div>
      </div>
    </main>
  );
}
