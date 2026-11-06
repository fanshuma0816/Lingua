"use client";

import { useUI } from "../../hooks/useUI";

export function QuotaStatus({ courseFree = false, onRetry }) {
  const { t, quota } = useUI();
  const q = t.quotaHints;
  if (!quota || quota.state === "off") return null;
  const ready = !["loading", "unavailable"].includes(quota.state);
  let hint = "";
  if (ready) {
    hint = quota.reserved > 0 ? q.processing(quota.reserved)
      : quota.available === 0 ? (quota.identity === "guest" ? q.guestUsed : q.exhausted)
      : quota.identity === "guest" ? q.guestHint
      : quota.available === 1 ? q.lastHint : q.onceHint;
  }
  return <section className="quota-status" aria-label={q.regionLabel}>
    <div className="quota-status-row">
      <div className="quota-status-summary" role="status" aria-live="polite" aria-atomic="true">
        {ready ? <>
          <span className="badge badge-outline quota-status-identity">{q.identities[quota.identity]}</span>
          <span>{q.available(quota.available)}</span>
          {quota.reserved > 0 && <span className="tiny muted">{q.pending(quota.reserved)}</span>}
        </> : <span className="tiny muted">{quota.state === "loading" ? q.loading : q.unavailable}</span>}
      </div>
      {quota.state === "unavailable" && onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>{q.retry}</button>}
    </div>
    {hint && <p className="tiny muted quota-status-hint">{hint}</p>}
    {courseFree && <p className="tiny muted quota-status-hint">{q.courseFree}</p>}
    <details className="quota-status-details">
      <summary>{q.detailsTitle}</summary>
      <div className="card card-p quota-status-policy">
        {ready && <dl className="quota-status-breakdown">
          {[["granted", quota.granted], ["used", quota.used], ["reserved", quota.reserved], ["available", quota.available]].map(([key, value]) =>
            <div key={key}><dt>{q.breakdown[key]}</dt><dd>{q.times(value)}</dd></div>)}
        </dl>}
        <p>{q.meaning}</p>
        <p>{q.guestGrant}</p>
        <p>{q.accountGrant}</p>
        <ul>{q.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
        {ready&&quota.identity==="guest"&&<p className="tiny muted">{q.guestSave}</p>}
      </div>
    </details>
  </section>;
}

// These hints share App's validated state; they never fetch or calculate quota.
export function GenerationCostHint({ recommendation = false }) {
  const { t, quota } = useUI();
  if (!quota || quota.state === "off") return null;
  return <p className="tiny muted quota-cost-hint">{recommendation ? t.quotaHints.recommendationFree : t.quotaHints.generationCost}</p>;
}
