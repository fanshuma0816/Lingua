"use client";

import { Svg } from "../ui/elements";
import { useUI } from "../../hooks/useUI";

function AuthPrompt({ open, onClose, onSignIn }) {
  const { t } = useUI();
  if (!open) return null;
  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div className="auth-pop" role="dialog" aria-modal="true" aria-labelledby="auth-pop-title" onClick={(e) => e.stopPropagation()}>
        <button className="auth-pop-close focusable" onClick={onClose} aria-label={t.authPrompt.close}>×</button>
        <div className="auth-pop-icon"><Svg n="bookmark" /></div>
        <h2 id="auth-pop-title">{t.authPrompt.title}</h2>
        <p>{t.authPrompt.body}</p>
        <div className="auth-pop-actions">
          <button className="btn btn-primary focusable" onClick={onSignIn}><Svg n="user" /> {t.authPrompt.signIn}</button>
          <button className="btn btn-outline focusable" onClick={onClose}>{t.authPrompt.keepLearning}</button>
        </div>
      </div>
    </div>
  );
}

export { AuthPrompt };
