"use client";

import { useEffect, useState } from "react";
import { Svg } from "../ui/elements";
import { useUI } from "../../hooks/useUI";
import { fetchLearningRecords } from "../../lib/learning-sync";
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

function Progress({ auth, onLogin, onStartLearning }) {
  const { t } = useUI();
  const signedIn = !!auth?.session?.accessToken;
  const [state, setState] = useState({ loading: false, error: "", lessons: [], stats: null });
  const currentLesson = DB.get("currentLesson", null);
  const currentText = DB.get("currentText", "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!signedIn) {
        setState({ loading: false, error: "", lessons: [], stats: null });
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const data = await fetchLearningRecords(auth.session.accessToken);
        if (!cancelled) setState({ loading: false, error: "", lessons: data.lessons || [], stats: data.stats || null });
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e?.message || t.progress.loadError, lessons: [], stats: null });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [signedIn, auth?.session?.accessToken]);

  const hasLessons = state.lessons.length > 0;
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
        <div className="eyebrow">{t.ia.progress}</div>
        <h1>{t.progress.title}</h1>
        <p className="sub">{t.progress.subtitle}</p>
      </div>

      {!signedIn && <EmptyState signedIn={false} onLogin={onLogin} onStartLearning={onStartLearning} />}
      {signedIn && state.loading && <div className="card card-p">{t.progress.loading}</div>}
      {signedIn && state.error && <div className="notice">{state.error}</div>}
      {signedIn && !state.loading && !state.error && !hasLessons && <EmptyState signedIn onLogin={onLogin} onStartLearning={onStartLearning} />}

      {signedIn && !state.loading && !state.error && hasLessons && <>
        <div className="stats-grid">
          <div className="stat"><div className="k">{t.progress.lessonsCompleted}</div><div className="v">{state.stats?.lessonCount || state.lessons.length}</div></div>
          <div className="stat"><div className="k">{t.progress.wordsCollected}</div><div className="v">{state.stats?.wordCount || 0}</div></div>
          <div className="stat"><div className="k">{t.progress.grammarCollected}</div><div className="v">{state.stats?.grammarCount || 0}</div></div>
        </div>

        {localStats && <div className="resume-card">
          <div>
            <div className="tiny muted">{t.progress.continueLearning}</div>
            <b>{localStats.title}</b>
            <p>{[localStats.lang, localStats.level, localStats.sentences && t.progress.sentences(localStats.sentences), localStats.words && t.progress.words(localStats.words)].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="btn btn-primary btn-sm focusable" onClick={onStartLearning}>{t.progress.resume}</button>
        </div>}

        <h2 className="section-title">{t.progress.recentLessons}</h2>
        <div className="lesson-list">
          {state.lessons.map((lesson) => {
            const stats = lesson.stats || {};
            const title = lesson.material_title || lesson.material_summary?.title || t.progress.untitledLesson;
            const date = lesson.completed_at ? new Date(lesson.completed_at).toLocaleDateString() : "";
            return (
              <div className="lesson-card" key={lesson.id}>
                <div>
                  <b>{title}</b>
                  <p>{[lesson.lang, lesson.level, lesson.goal].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="lesson-meta">
                  <span>{date}</span>
                  <span>{t.progress.words(stats.vocabCount || 0)}</span>
                  <span>{t.progress.steps((lesson.completed_steps || []).length)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

export { Progress };
