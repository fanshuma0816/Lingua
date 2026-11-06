"use client";
import { DB } from "./storage";
const KEY = "generationContinuation";
const MAX_AGE = 24 * 60 * 60 * 1000;
const PATHS = new Set(["/find", "/import", "/collection/materials"]);
export function rememberGeneration(payload, { environment, userId = null, path = "/find", requestId = null, recover = false } = {}) {
  if (!environment || !payload?.text) return null;
  const intent = { environment, userId, path: PATHS.has(path) ? path : "/find", payload,
    requestId, recover, createdAt: Date.now(), id: crypto.randomUUID() };
  DB.set(KEY, intent); return intent;
}
export function generationToContinue(environment, userId) {
  const intent = DB.get(KEY, null);
  if (!intent || !intent.id || Date.now() - intent.createdAt > MAX_AGE) { DB.remove(KEY); return null; }
  if (intent.environment !== environment || (intent.userId && intent.userId !== userId)) return null;
  return intent;
}
export function clearGenerationContinuation(id) {
  if (!id || DB.get(KEY, null)?.id === id) DB.remove(KEY);
}

export function associateGenerationLesson(requestId, lessonId) {
  const intent=DB.get(KEY,null);
  if(intent?.requestId===requestId)DB.set(KEY,{...intent,lessonId});
}
