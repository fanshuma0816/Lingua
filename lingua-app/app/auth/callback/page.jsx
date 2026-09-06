"use client";

import { useEffect, useState } from "react";
import { completeSessionFromHash } from "../../../lib/auth-client";
import { DB } from "../../../lib/storage";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      try {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || (DB.get("pendingSaveAfterLogin", false) ? "/done?save=1" : "/done");
        const session = await completeSessionFromHash(window.location.hash);
        if (!session) throw new Error("No sign-in token was found.");
        if (!cancelled) {
          setStatus("Signed in. Taking you back...");
          window.location.replace(next);
        }
      } catch (e) {
        if (!cancelled) setStatus(e?.message || "Could not finish sign-in.");
      }
    }
    finish();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="main">
      <div className="center">
        <div className="card card-p" style={{ textAlign: "center" }}>
          <h1>{status}</h1>
          <p className="sub">You can close this page if it does not move automatically.</p>
        </div>
      </div>
    </main>
  );
}
