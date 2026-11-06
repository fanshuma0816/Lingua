"use client";

import { useEffect, useRef } from "react";
import { useUI } from "../../hooks/useUI";

export function QuotaStatus({ courseFree = false, onRetry, onLogin }) {
  const { t, quota } = useUI();
  const q = t.quotaHints;
  const detailsRef = useRef(null);
  useEffect(() => {
    const closeOutside = event => {
      const details = detailsRef.current;
      if (details?.open && !details.contains(event.target)) details.open = false;
    };
    const closeWithEscape = event => {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);
  if (!quota || quota.state === "off") return null;
  const ready = !["loading", "unavailable"].includes(quota.state);
  const fresh = ready && !quota.stale && !quota.refreshing;
  return <section className="quota-status" aria-label={q.regionLabel}>
    <div className="quota-status-row">
      <div className="quota-status-summary" role="status" aria-live="polite" aria-atomic="true">
        {ready ? <>
          <span className="badge badge-outline quota-status-identity">{q.identities[quota.identity]}</span>
          <span>{q.available(quota.available)}</span>
          {quota.reserved > 0 && <span className="tiny muted" title={q.processing(quota.reserved)}>{q.pending(quota.reserved)}</span>}
          {(quota.stale || quota.refreshing) && <span className="tiny muted">{quota.refreshing ? q.updating : q.stale}</span>}
        </> : <span className="tiny muted">{quota.state === "loading" ? q.loading : q.unavailable}</span>}
      </div>
      {(quota.state === "unavailable" || quota.stale) && onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>{q.retry}</button>}
      {fresh && quota.available === 0 && quota.reserved === 0 && quota.identity === "guest" && onLogin && <button className="btn btn-ghost btn-sm" onClick={onLogin}>{q.register}</button>}
      <details ref={detailsRef} className="quota-status-details">
        <summary>{q.detailsTitle}</summary>
        <div className="quota-status-policy"><ul>{q.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></div>
      </details>
    </div>
    {courseFree ? <p className="tiny muted quota-status-hint">{q.courseFree}</p>
      : fresh && quota.available === 0 && quota.reserved === 0 && <p className="tiny muted quota-status-hint">{quota.identity === "guest" ? q.guestUsed : q.exhausted}</p>}
  </section>;
}

// Display only: generating and permission checks remain on the server.
export function GenerationCostHint({ recommendation = false }) {
  const { t, quota } = useUI();
  if (!quota || quota.state === "off") return null;
  return <p className="tiny muted quota-cost-hint">{recommendation ? t.quotaHints.recommendationFree : t.quotaHints.generationCost}</p>;
}
