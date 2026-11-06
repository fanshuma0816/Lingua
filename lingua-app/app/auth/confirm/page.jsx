"use client";

import { useEffect, useState } from "react";
import { UI_TEXT } from "../../../config/uiText";
import { completeSessionFromTokenHash } from "../../../lib/auth-client";
import { DB } from "../../../lib/storage";

function safeReturnPath(raw) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
}

export default function AuthConfirmPage() {
  const [uiLang] = useState(() => DB.get("uiLang", "en"));
  const t = UI_TEXT[uiLang] || UI_TEXT.en;
  const [token, setToken] = useState(null);
  const [type, setType] = useState("email");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token_hash"));
    setType(params.get("type") || "email");
    setChecked(true);
  }, []);

  const valid = checked && !!token && type === "email";
  async function confirm() {
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await completeSessionFromTokenHash(token, type);
      setComplete(true);
      setBusy(false);
      setTimeout(()=>window.close(),350);
    } catch (e) {
      setFailed(true);
      setBusy(false);
    }
  }
  return (<main className="main">
    <div className="center">
      <div className="card card-p auth-confirm-card">
        <h1>{complete?t.authFlow.signedIn:(failed?t.authFlow.expiredTitle:(valid?t.authFlow.confirmTitle:t.authFlow.invalidTitle))}</h1>
        <p className="sub">{complete?t.authFlow.returnToOriginal:(failed?t.authFlow.expiredBody:(valid?t.authFlow.confirmBody:t.authFlow.invalidBody))}</p>
        <div className="auth-pop-actions">
          {valid && !failed && !complete && <button className="btn btn-primary" disabled={busy} onClick={confirm}>{busy?t.authFlow.signingIn:t.authFlow.continue}</button>}
          {complete && <button className="btn btn-primary" onClick={()=>window.close()}>{t.authFlow.closeTab}</button>}
          {complete && <a className="btn btn-outline" href={safeReturnPath(DB.get("loginNextPath",DB.get("resumePath","/")))}>{t.authFlow.continueHere}</a>}
          {failed && <a className="btn btn-primary" href="/login">{t.authFlow.requestNew}</a>}
          {!complete && <a className="btn btn-outline" href="/">{t.authFlow.backHome}</a>}
        </div>
      </div>
    </div>
  </main>);
}
