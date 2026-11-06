"use client";
import { getAuthState } from "./auth-client";
import { DB, setLearningScope } from "./storage";
let bootstrap = null;
export class LessonApiError extends Error {
 constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export function isAccessError(error) { return [401,402,403,404,409].includes(error?.status); }
export async function authRequest(path, options = {}) {
 const auth = await getAuthState();
 return fetch(path, { ...options, cache: "no-store", credentials: "same-origin", headers: {
  "Content-Type": "application/json", ...(auth.session?.accessToken ? { Authorization: `Bearer ${auth.session.accessToken}` } : {}), ...options.headers,
 } });
}
export async function lessonRequest(path, options = {}) {
 const r = await authRequest(path, options), data = await r.json().catch(() => ({}));
 if (!r.ok) throw new LessonApiError(data.error || "service_unavailable", r.status);
 return data;
}
export async function getEntitlements() {
 const auth = await getAuthState(), key = auth.session?.user?.id || "guest";
 if (!bootstrap || bootstrap.key !== key) {
  bootstrap = { key, promise: lessonRequest("/api/account/entitlements").catch(error => { bootstrap = null; throw error; }) };
 }
 const data = await bootstrap.promise;
 const currentAuth=await getAuthState();
 if((currentAuth.session?.user?.id||"guest")!==key)throw new LessonApiError("account_changed",409);
 if (data.enabled) setLearningScope(`${data.environment}:${key}`);
 return data;
}
export function refreshEntitlements() { bootstrap = null; return getEntitlements(); }
export async function learningFetch(path, options = {}) {
 const body = options.body ? JSON.parse(options.body) : {};
 const current = DB.get("currentLesson", null);
 const r = await authRequest(path, { ...options, body: JSON.stringify({ ...body, lessonId: current?.lessonId || null }) });
 if ([401,402,403,404,409].includes(r.status)) {
  const data = await r.json().catch(() => ({}));
  const error = new LessonApiError(data.error || "lesson_not_found", r.status);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lingua-access-error", { detail: error }));
  throw error;
 }
 return r;
}
export function pendingGeneration(payload) {
 const signature = JSON.stringify(payload), previous = DB.get("pendingGeneration", null);
 if (previous?.signature === signature) return previous;
 const pending = { requestId: crypto.randomUUID(), signature, payload };
 DB.set("pendingGeneration", pending); return pending;
}
export async function createLesson(payload) {
 const phase = await getEntitlements();
 if (!phase.enabled) return lessonRequest("/api/lesson", { method: "POST", body: JSON.stringify(payload) });
 const pending = pendingGeneration(payload);
 let result;
 try {
  result = await lessonRequest("/api/lesson", { method: "POST", body: JSON.stringify({ ...payload, requestId: pending.requestId }) });
 } catch (error) {
  if (error.status && error.status < 500) {
   if (["request_expired","request_failed","quota_exhausted","sign_in_required"].includes(error.code)) DB.remove("pendingGeneration");
   throw error;
  }
  result = await lessonRequest(`/api/lesson/requests/${pending.requestId}`);
 }
 if (result.lesson) result = result.lesson;
 if (!result.lessonId) throw new LessonApiError("request_processing", 409);
 return result;
}
export async function confirmLesson(id) {
 const result = await lessonRequest(`/api/lesson/${id}/confirm`, { method: "POST", body: "{}" });
 bootstrap = null; DB.remove("pendingGeneration"); return result;
}
export async function claimLessons() {
 const phase = await getEntitlements();
 if (phase.enabled && phase.signedIn) await lessonRequest("/api/lesson/claim", { method: "POST", body: "{}" });
}
export function interactionSnapshot() {
 return { recall: { answers: DB.get("recallAnswers", {}), checked: DB.get("recallShown", {}), state: DB.get("recallState", null) },
  writing: { text: DB.get("aiPractice", ""), feedback: DB.get("aiPracticeFeedback", null) },
  conversation: { transcript: DB.get("aiChatTranscript", []), evaluation: DB.get("aiChatEvaluation", null) } };
}
export function restoreLesson({ lesson, progress = {} }) {
 const sameLesson=DB.get("currentLesson",null)?.lessonId===lesson.lessonId;
 const interaction = progress.interaction || (sameLesson?interactionSnapshot():{});
 DB.set(`savedPractice:${lesson.lessonId}`,!!progress.includePractice);
 DB.set("currentLesson", lesson); DB.set("currentText", lesson.text || "");
 DB.set("unknownWords", progress.userWords || lesson.userWords || []);
 DB.set("recallAnswers", interaction.recall?.answers || {}); DB.set("recallShown", interaction.recall?.checked || {});
 if(interaction.recall?.state)DB.set("recallState",interaction.recall.state);else if(!sameLesson)DB.remove("recallState");
 DB.set("aiPractice", interaction.writing?.text || ""); DB.set("aiPracticeFeedback", interaction.writing?.feedback || null);
 DB.set("aiChatTranscript", interaction.conversation?.transcript || []); DB.set("aiChatEvaluation", interaction.conversation?.evaluation || null);
 DB.set("resumePath", progress.path || "/scan");
}
