"use client";
import { getAuthState } from "./auth-client";
import { DB } from "./storage";
import { generateLesson } from "./lesson-client";

async function learningRequest(path, options = {}) {
  const state = await getAuthState();
  const token = state.session?.accessToken;
  const response = await fetch(path, { ...options, cache: "no-store", credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "learning_temporarily_unavailable");
    error.code = data.error; error.status = response.status; error.learningAccessError = !!data.learningAccessError;
    throw error;
  }
  return data;
}
function fetchEntitlements() { return learningRequest("/api/account/entitlements"); }
function confirmCourse(id) { return learningRequest(`/api/lesson/${encodeURIComponent(id)}/confirm`, { method: "POST" }); }
function fetchCourse(id) { return learningRequest(`/api/lesson/${encodeURIComponent(id)}`); }
function createCourse(input) {
  const fingerprint = JSON.stringify(input);
  let pending = DB.get("pendingLessonRequest", null);
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { id: crypto.randomUUID(), fingerprint };
    DB.set("pendingLessonRequest", pending);
  }
  return learningRequest("/api/lesson", { method: "POST", body: JSON.stringify({ ...input, requestId: pending.id }) });
}
function completeCourseRequest() { DB.remove("pendingLessonRequest"); }

// Legacy snapshots use "sentences"; current snapshots use the full lesson shape.
function restoreLessonRecord(record) {
  const snapshot = record.lesson_snapshot || {};
  const sents = snapshot.sents || snapshot.sentences;
  if (!Array.isArray(sents) || !sents.length) throw new Error("course_snapshot_unavailable");
  const text = record.input_text || sents.join("\n");
  const base=generateLesson(text,record.lang||snapshot.lang,record.level||snapshot.level,record.goal||snapshot.goal,null,snapshot.material);
  const lesson = { ...base, ...snapshot, sents, lang: record.lang || snapshot.lang, level: record.level || snapshot.level,
    goal: record.goal || snapshot.goal, material: snapshot.material || record.material_summary || {},
    vocab: snapshot.vocab || [], watch: snapshot.watch || [], vlist: snapshot.vlist || (snapshot.vocab || []).map(v => v.word),
    localLessonId: record.managed_course ? record.id : record.id ? "legacy:"+record.id : record.local_lesson_id, legacySessionId: record.managed_course ? null : record.id, serverLessonId: record.managed_course ? record.id : snapshot.serverLessonId,
    accessManaged: !!record.managed_course, usesFreeGeneration: record.uses_free_generation !== false, usageConfirmed: record.managed_course ? record.status !== "ready" : false,
    userWords: snapshot.markedWords || snapshot.userWords || [], restored: true };
  const interactions = record.interaction_snapshot || {};
  DB.set("recallAnswers", interactions.recall?.answers || {}); DB.set("recallShown", interactions.recall?.checked || {});
  DB.set("aiPractice", interactions.writing?.text || ""); DB.set("aiPracticeFeedback", interactions.writing?.feedback || null);
  DB.set("aiChatTranscript", interactions.conversation?.transcript || []); DB.set("aiChatEvaluation", interactions.conversation?.evaluation || null);
  DB.set("unknownWords", lesson.userWords); DB.set("currentLesson", lesson); DB.set("currentText", text);
  const path = record.saved_options?.resumePath || "/scan";
  const resumePath = /^\/(scan|preview|done|learn\/(understanding|vocabulary|shadowing|recall|using))$/.test(path) ? path : "/scan";
  DB.set("resumePath", resumePath);
  return { lesson, text, resumePath, completedSteps: record.completed_steps || [] };
}
export { learningRequest, fetchEntitlements, createCourse, confirmCourse, fetchCourse, completeCourseRequest, restoreLessonRecord };
