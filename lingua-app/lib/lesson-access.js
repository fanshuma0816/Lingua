import { createHash } from "node:crypto";
import { fallbackGrammarItems } from "./lesson-client";
import { resolveIdentity, assertSameOrigin } from "./server-auth";
import { readLesson } from "./lesson-store";
import { entitlements, generationAction } from "./entitlements";
import { ApiError } from "./api-errors";
const normalized = value => String(value || "").normalize("NFKC").replace(/\s+/g," ").trim().toLowerCase();
export async function authorizeLearning(req, body, kind) {
 const identity = await resolveIdentity(req);
 if (!identity.enabled) return null;
 assertSameOrigin(req);
 if (kind === "analyze" && body.mode === "materials") {
  const balance = await entitlements(identity);
  if (!balance.canGenerate) throw new ApiError(identity.user ? "quota_exhausted" : "sign_in_required", identity.user ? 402 : 401);
  await generationAction(identity,"rate",{key:`materials:${identity.subject}`,limit:12}); return {identity};
 }
 if (!body.lessonId) throw new ApiError("lesson_not_found",404);
 const record = await readLesson(identity,body.lessonId);
 if (!record.delivered) throw new ApiError("lesson_not_delivered",409);
 const lesson = record.lesson;
 body.lang=lesson.lang;body.level=lesson.level;body.goal=lesson.goal;body.topics=lesson.topics;
 const allowed = [lesson.text,...(record.resources||[])].map(normalized);
 const assertText = value => {
  const text=normalized(value);
  if (!text || !allowed.some(source=>source.includes(text))) throw new ApiError("lesson_content_mismatch",403);
 };
 if (kind === "tts") {
  // Existing local grammar examples remain playable when live AI is unavailable.
  for(const sentence of lesson.sents||[])for(const language of ["en","zh"])
   for(const item of fallbackGrammarItems(sentence,lesson.level,language))
    for(const example of item.examples||[])allowed.push(normalized(example.sentence));
  assertText(body.text);
 }
 if (kind === "analyze") {
  if (!["grade","translate","explain","grammar","quiz","focus"].includes(body.mode)) throw new ApiError("invalid_mode");
  if (Array.isArray(body.sentences)) body.sentences.forEach(assertText);
  if (body.sentence) assertText(body.sentence);
  if (Array.isArray(body.words)) body.words.forEach(assertText);
  if (Array.isArray(body.items)) body.items.forEach(item=>{assertText(item.word);if(item.context)assertText(item.context);});
  if (body.mode === "focus") {body.sentences=lesson.sents;body.vocab=(lesson.vocab||[]).map(v=>v.word);}
  // Coaching context is selected by the server, not an arbitrary replacement text.
  if (body.translation) delete body.translation;
 }
 if (kind === "chat") {
  body.sample=lesson.text;body.vocab=(lesson.vocab||[]).map(v=>v.word);body.topic=(lesson.topics||[]).join(", ");
  if (!['feedback','chat','evaluate'].includes(body.mode)) throw new ApiError("invalid_mode");
  if (body.mode==='feedback') body.lessonContext=lesson.text;
  if (Array.isArray(body.history)) body.history=body.history.slice(-30).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,4000)}));
  body.text=String(body.text||'').slice(0,8000);
 }
 await generationAction(identity,"rate",{key:`learning:${identity.subject}`,limit:90});
 const {userId,sessionId,lessonId,...parameters}=body;
 const canonical=Object.fromEntries(Object.keys(parameters).sort().map(key=>[key,parameters[key]]));
 const cacheKey=kind==="analyze"?createHash("sha256").update(JSON.stringify(canonical)).digest("hex"):null;
 return {identity,lessonId:body.lessonId,cacheKey};
}
function strings(value, out=[]) {
 if (typeof value==='string' && value.trim().length>1) out.push(value.slice(0,8000));
 else if (Array.isArray(value)) value.forEach(v=>strings(v,out));
 else if (value && typeof value==='object') Object.values(value).forEach(v=>strings(v,out));
 return out;
}
export async function recordLearningResult(access, value) {
 if(access?.lessonId) await generationAction(access.identity,"resource",{lessonId:access.lessonId,resources:strings(value).slice(0,150)});
}

export async function cachedLearningResult(access) {
 if(!access?.cacheKey)return null;
 return (await generationAction(access.identity,"analysis_get",{lessonId:access.lessonId,key:access.cacheKey})).result;
}
export async function saveLearningResult(access,result) {
 if(!access?.cacheKey)return result;
 return (await generationAction(access.identity,"analysis_put",{lessonId:access.lessonId,key:access.cacheKey,result})).result;
}
