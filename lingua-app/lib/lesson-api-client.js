"use client";
import { getAuthState } from "./auth-client";
import { DB, setLearningScope } from "./storage";
import { generationToContinue, clearGenerationContinuation, rememberGeneration, associateGenerationLesson } from "./generation-continuation";
let bootstrap = null;
const QUOTA_SIGNAL = "lingua:quotaSignal";
const QUOTA_CHANNEL = "lingua-quota";
export function publishQuotaChange(environment, userId = "guest") {
 bootstrap=null;
 const signal = { environment, userId, id: crypto.randomUUID() };
 if (typeof window === "undefined") return;
 try { window.localStorage.setItem(QUOTA_SIGNAL, JSON.stringify(signal)); } catch {}
 if (typeof BroadcastChannel !== "undefined") { const channel=new BroadcastChannel(QUOTA_CHANNEL);channel.postMessage(signal);channel.close(); }
 window.dispatchEvent(new CustomEvent("lingua-quota-change", {detail:signal}));
}
export function subscribeQuotaChanges(listener) {
 if (typeof window === "undefined") return () => {};
 const seen=new Set();
 const receive=signal=>{if(!signal?.id||seen.has(signal.id))return;seen.add(signal.id);bootstrap=null;if(seen.size>100)seen.delete(seen.values().next().value);listener(signal);};
 const storage=event=>{if(event.key===QUOTA_SIGNAL){try{receive(JSON.parse(event.newValue));}catch{}}};
 const local=event=>receive(event.detail);
 const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(QUOTA_CHANNEL):null;
 if(channel)channel.onmessage=event=>receive(event.data);
 window.addEventListener("storage",storage);window.addEventListener("lingua-quota-change",local);
 return ()=>{window.removeEventListener("storage",storage);window.removeEventListener("lingua-quota-change",local);channel?.close();};
}
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
export async function getEntitlements({ fresh = false } = {}) {
 const auth = await getAuthState(), key = auth.session?.user?.id || "guest";
 if (!bootstrap || bootstrap.key !== key || (bootstrap.settled && (fresh || Date.now()-bootstrap.at>10000))) {
  const entry={key,settled:false,at:Date.now()};
  entry.promise=lessonRequest("/api/account/entitlements").then(data=>{entry.settled=true;entry.at=Date.now();return data;}).catch(error=>{if(bootstrap===entry)bootstrap=null;throw error;});
  bootstrap=entry;
 }
 const entry=bootstrap,data=await entry.promise,currentAuth=await getAuthState();
 if((currentAuth.session?.user?.id||"guest")!==key)throw new LessonApiError("account_changed",409);
 if(entry!==bootstrap)return getEntitlements();
 if (data.enabled) setLearningScope(`${data.environment}:${key}`); else setLearningScope(null);
 return data;
}
export async function refreshEntitlements() {
 try { return await getEntitlements({fresh:true}); }
 catch(error) { error.quotaReadFailure=true; throw error; }
}
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
 const phase = await refreshEntitlements();
 if (!phase.enabled) return lessonRequest("/api/lesson", { method: "POST", body: JSON.stringify(payload) });
 const auth=await getAuthState(),userId=auth.session?.user?.id||null;
 const previous=DB.get("pendingGeneration",null);
 if(phase.reserved && previous && previous.signature!==JSON.stringify(payload))throw new LessonApiError("request_processing",409);
 const continuation=generationToContinue(phase.environment,userId);
 // A guest request whose result is uncertain is queried under the original cookie;
 // never silently submit it as a second account request after signing in.
 if(continuation?.recover && continuation.requestId && continuation.userId!==userId && JSON.stringify(continuation.payload)===JSON.stringify(payload)) {
  let recovered;
  try{recovered=await lessonRequest(`/api/lesson/requests/${continuation.requestId}`);}
  catch(error){if(["request_failed","request_expired"].includes(error.code))clearGenerationContinuation(continuation.id);throw error;}
  if(!recovered.lesson?.lessonId)throw new LessonApiError("request_processing",409);
  associateGenerationLesson(continuation.requestId,recovered.lesson.lessonId);
  return recovered.lesson;
 }
 const pending = pendingGeneration(payload);
 const intent=rememberGeneration(payload,{environment:phase.environment,userId,path:typeof window!=="undefined"?window.location.pathname:"/find",requestId:pending.requestId,recover:true});
 let result;
 try {
  result = await lessonRequest("/api/lesson", { method: "POST", body: JSON.stringify({ ...payload, requestId: pending.requestId }) });
 } catch (error) {
  if (error.status && error.status < 500) {
   if (["request_expired","request_failed","quota_exhausted","sign_in_required"].includes(error.code)) {DB.remove("pendingGeneration");clearGenerationContinuation(intent?.id);}
   throw error;
  }
  result = await lessonRequest(`/api/lesson/requests/${pending.requestId}`);
 }
 if (result.lesson) result = result.lesson;
 if (!result.lessonId) throw new LessonApiError("request_processing", 409);
 associateGenerationLesson(pending.requestId,result.lessonId);
 return result;
}
export async function confirmLesson(id) {
 const before=await getAuthState(),userId=before.session?.user?.id||"guest";
 const intent=DB.get("generationContinuation",null),pending=DB.get("pendingGeneration",null);
 const result=await lessonRequest(`/api/lesson/${id}/confirm`,{method:"POST",body:"{}"});
 const after=await getAuthState();
 if((after.session?.user?.id||"guest")!==userId)throw new LessonApiError("account_changed",409);
 bootstrap=null;
 if(DB.get("pendingGeneration",null)?.requestId===pending?.requestId)DB.remove("pendingGeneration");
 if(intent?.id && intent.lessonId===id)clearGenerationContinuation(intent.id);
 publishQuotaChange(result.entitlements.environment,userId);
 if(userId!=="guest")publishQuotaChange(result.entitlements.environment,"guest");
 return result;
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
