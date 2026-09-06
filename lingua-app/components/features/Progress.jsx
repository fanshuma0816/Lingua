"use client";

import { useEffect, useState } from "react";
import { Svg } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { DB } from "../../lib/storage";

function EmptyState({ signedIn, onLogin, onStartLearning }) {
  const { t } = useUI();
  return (
    <div className="empty-state">
      <div className="empty-icon"><Svg n="progress" /></div>
      <h2>{signedIn ? t.progress.emptyTitle : t.progress.signInTitle}</h2>
      <p>{signedIn ? t.progress.emptyBody : t.progress.signInBody}</p>
      <div className="empty-actions">
        {!signedIn && <button className="btn btn-primary focusable" onClick={onLogin}><Svg n="user" /> {t.authPrompt.signIn}</button>}
        <button className="btn btn-outline focusable" onClick={onStartLearning}>{t.progress.startLearning}</button>
      </div>
    </div>
  );
}

function Progress({ auth, onLogin, onStartLearning, onResume }) {
  const { t } = useUI();
  const signedIn = !!auth?.session?.accessToken;
  const [localProgress, setLocalProgress] = useState({ lesson: null, text: "" });
  useEffect(() => {
    setLocalProgress({
      lesson: DB.get("currentLesson", null),
      text: DB.get("currentText", ""),
    });
  }, []);
  const currentLesson = localProgress.lesson;
  const currentText = localProgress.text;
  const localStats = currentLesson ? {
    title: currentLesson?.material?.title || t.progress.currentLesson,
    lang: currentLesson.lang,
    level: currentLesson.level,
    sentences: Array.isArray(currentLesson.sents) ? currentLesson.sents.length : null,
    words: Array.isArray(currentLesson.vocab) ? currentLesson.vocab.length : null,
    chars: String(currentText || "").length,
  } : null;

  return (
    <div className="account-page">
      <div className="page-head">
        <h1>{t.progress.title}</h1>
        <p className="sub">{t.progress.subtitle}</p>
      </div>

      {!localStats ? <EmptyState signedIn={signedIn} onLogin={onLogin} onStartLearning={onStartLearning} /> : (
        <div className="resume-card">
          <div>
            <div className="tiny muted">{t.progress.continueLearning}</div>
            <b>{localStats.title}</b>
            <p>{[localStats.lang, localStats.level, localStats.sentences && t.progress.sentences(localStats.sentences), localStats.words && t.progress.words(localStats.words)].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="btn btn-primary btn-sm focusable" onClick={onResume}>{t.progress.resume}</button>
        </div>
      )}
    </div>
  );
}

export { Progress };
