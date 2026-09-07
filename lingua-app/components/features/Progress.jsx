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

function dateLabel(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch (e) {
    return "";
  }
}

function compactList(items, max = 10) {
  const list = (items || []).filter(Boolean);
  return list.length > max ? [...list.slice(0, max), `+${list.length - max}`] : list;
}

function LessonHistoryCard({ lesson }) {
  const { t } = useUI();
  const stats = lesson?.stats || {};
  const snapshot = lesson?.lesson_snapshot || {};
  const interaction = lesson?.interaction_snapshot || {};
  const title = lesson?.material_title || snapshot?.material?.title || t.progress.untitledLesson;
  const marked = snapshot?.markedWords || [];
  const recallAnswers = Object.values(interaction?.recall?.answers || {}).map((x) => String(x || "").trim()).filter(Boolean);
  const writing = interaction?.writing || {};
  const conversation = interaction?.conversation || {};
  const transcript = Array.isArray(conversation?.transcript) ? conversation.transcript : [];
  const meta = [
    lesson?.lang,
    lesson?.level,
    stats.sentenceCount && t.progress.sentences(stats.sentenceCount),
    stats.vocabCount && t.progress.words(stats.vocabCount),
    dateLabel(lesson?.completed_at),
  ].filter(Boolean).join(" · ");

  return (
    <details className="history-card">
      <summary>
        <span>
          <b>{title}</b>
          <span>{meta}</span>
        </span>
        <Svg n="chevronRight" />
      </summary>
      <div className="history-detail">
        {lesson?.input_text && <section>
          <h3>{t.progress.savedText}</h3>
          <p className="history-text notranslate" translate="no" lang={lesson.lang === "Dutch" ? "nl" : undefined}>{lesson.input_text}</p>
        </section>}
        {!!marked.length && <section>
          <h3>{t.progress.markedWords}</h3>
          <div className="row wrap" style={{ gap: 6 }}>{compactList(marked).map((word) => <span className="badge" key={word}>{word}</span>)}</div>
        </section>}
        {!!recallAnswers.length && <section>
          <h3>{t.progress.recallAnswers}</h3>
          {recallAnswers.slice(0, 4).map((answer, i) => <p className="history-line notranslate" translate="no" lang={lesson.lang === "Dutch" ? "nl" : undefined} key={i}>{answer}</p>)}
        </section>}
        {writing?.text && <section>
          <h3>{t.progress.aiWriting}</h3>
          <p className="history-line notranslate" translate="no" lang={lesson.lang === "Dutch" ? "nl" : undefined}>{writing.text}</p>
        </section>}
        {!!transcript.length && <section>
          <h3>{t.progress.aiConversation}</h3>
          {transcript.slice(0, 6).map((msg, i) => <p className="history-line notranslate" translate="no" lang={lesson.lang === "Dutch" ? "nl" : undefined} key={i}><b>{msg.who === "ai" ? "AI" : "Me"}:</b> {msg.t}</p>)}
        </section>}
      </div>
    </details>
  );
}

function Progress({ auth, onLogin, onStartLearning, onResume }) {
  const { t } = useUI();
  const signedIn = !!auth?.session?.accessToken;
  const [localProgress, setLocalProgress] = useState({ lesson: null, text: "" });
  const [records, setRecords] = useState({ loading: false, error: "", lessons: [] });
  useEffect(() => {
    setLocalProgress({
      lesson: DB.get("currentLesson", null),
      text: DB.get("currentText", ""),
    });
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadRecords() {
      if (!signedIn) {
        setRecords({ loading: false, error: "", lessons: [] });
        return;
      }
      setRecords((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const data = await fetchLearningRecords(auth.session.accessToken);
        if (!cancelled) setRecords({ loading: false, error: "", lessons: data.lessons || [] });
      } catch (e) {
        if (!cancelled) setRecords({ loading: false, error: e?.message || t.progress.loadError, lessons: [] });
      }
    }
    loadRecords();
    return () => { cancelled = true; };
  }, [signedIn, auth?.session?.accessToken]);
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
  const hasSavedLessons = signedIn && records.lessons.length > 0;
  const showEmpty = !localStats && !hasSavedLessons && !records.loading;

  return (
    <div className="account-page">
      <div className="page-head">
        <h1>{t.progress.title}</h1>
        <p className="sub">{t.progress.subtitle}</p>
      </div>

      {showEmpty && <EmptyState signedIn={signedIn} onLogin={onLogin} onStartLearning={onStartLearning} />}
      {localStats && (
        <div className="resume-card">
          <div>
            <div className="tiny muted">{t.progress.continueLearning}</div>
            <b>{localStats.title}</b>
            <p>{[localStats.lang, localStats.level, localStats.sentences && t.progress.sentences(localStats.sentences), localStats.words && t.progress.words(localStats.words)].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="btn btn-primary btn-sm focusable" onClick={onResume}>{t.progress.resume}</button>
        </div>
      )}
      {signedIn && records.loading && <div className="card card-p">{t.progress.loading}</div>}
      {signedIn && records.error && <div className="notice">{records.error}</div>}
      {hasSavedLessons && <div className="history-section">
        <h2>{t.progress.savedLessons}</h2>
        <div className="history-list">
          {records.lessons.map((lesson) => <LessonHistoryCard key={lesson.id} lesson={lesson} />)}
        </div>
      </div>}
    </div>
  );
}

export { Progress };
