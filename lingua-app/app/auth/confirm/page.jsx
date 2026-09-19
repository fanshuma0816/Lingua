"use client";

import { useEffect, useState } from "react";
import { UI_TEXT } from "../../../config/uiText";
import { completeSessionFromTokenHash } from "../../../lib/auth-client";
import { DB } from "../../../lib/storage";

export default function AuthConfirmPage() {
  const [uiLang] = useState(() => DB.get("uiLang", "en"));
  const t = UI_TEXT[uiLang] || UI_TEXT.en;
  const [token, setToken] = useState(null);
  const [type, setType] = useState("email");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

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
      const next = DB.get("pendingSaveAfterLogin", false) ? "/done?save=1" : "/done";
      window.location.replace(next);
    } catch (e) {
      setFailed(true);
      setBusy(false);
    }
  }
  return (<main className="main">
    <div className="center">
      <div className="card card-p auth-confirm-card">
        <h1>{failed?t.authFlow.expiredTitle:(valid?t.authFlow.confirmTitle:t.authFlow.invalidTitle)}</h1>
        <p className="sub">{failed?t.authFlow.expiredBody:(valid?t.authFlow.confirmBody:t.authFlow.invalidBody)}</p>
        <div className="auth-pop-actions">
          {valid && !failed && <button className="btn btn-primary" disabled={busy} onClick={confirm}>{busy?t.authFlow.signingIn:t.authFlow.continue}</button>}
          {failed && <a className="btn btn-primary" href="/login">{t.authFlow.requestNew}</a>}
          <a className="btn btn-outline" href="/">{t.authFlow.backHome}</a>
        </div>
      </div>
    </div>
  </main>);
}
