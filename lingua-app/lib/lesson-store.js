import { generationAction } from "./entitlements";
import { database } from "./server-auth";
import { ApiError } from "./api-errors";
export const readLesson = (identity, lessonId) => generationAction(identity, "read", { lessonId });
export const listLessons = (identity, offset = 0) => generationAction(identity, "list", { offset });
export async function validateMaterial(identity, body) {
  const id = body.material?.accountMaterialId, segment = body.material?.accountSegmentId;
  if (!id && !segment) return;
  if (!identity.user || !id || !segment) throw new ApiError("lesson_not_found", 404);
  const rows = await database(`material_segments?id=eq.${encodeURIComponent(segment)}&material_id=eq.${encodeURIComponent(id)}&select=text,user_materials!inner(user_id)`);
  if (!rows?.[0] || rows[0].user_materials.user_id !== identity.user.id || rows[0].text !== body.text) throw new ApiError("lesson_not_found", 404);
}
export async function importLegacy(identity, recordId) {
  if (!identity.user) throw new ApiError("sign_in_required", 401);
  const rows = await database(`lesson_sessions?id=eq.${encodeURIComponent(recordId)}&user_id=eq.${identity.user.id}&select=*`);
  const row = rows?.[0];
  if (!row?.input_text || !(row.lesson_snapshot?.sentences?.length || row.lesson_snapshot?.sents?.length) || !Array.isArray(row.lesson_snapshot?.comprehension) || !Array.isArray(row.lesson_snapshot?.recognition) || !row.lesson_snapshot?.recommended || !Array.isArray(row.lesson_snapshot?.topics)) throw new ApiError("legacy_snapshot_incomplete", 409);
  const s = row.lesson_snapshot;
  const snapshot = { ...s, lang: row.lang, level: row.level, goal: row.goal, text: row.input_text,
    sents: s.sents || s.sentences, userWords: s.markedWords || [], estMin: row.stats?.estimatedMinutes,
    material: { ...row.material_summary, ...s.material, accountMaterialId: row.material_id, accountSegmentId: row.material_segment_id } };
  return generationAction(identity, "legacy", { recordId: row.id, snapshot, progress: {
    path: "/preview", interaction: row.interaction_snapshot || {}, completedSteps: row.completed_steps || [],
  } });
}

export async function attachSegmentLessons(identity,segments){
 if(!identity.enabled)return segments;
 const lessons=await database(`generated_lessons?environment=eq.${identity.environment}&owner_user_id=eq.${identity.user.id}&delivered_at=not.is.null&material_segment_id=not.is.null&select=id,material_segment_id&order=created_at.desc`);
 const ids=new Map();for(const l of lessons){if(!ids.has(l.material_segment_id))ids.set(l.material_segment_id,l.id);}
 return segments.map(segment=>({...segment,lessonId:ids.get(segment.id)||null}));
}

// A signed, unexpired guest cookie is proof of the original anonymous request.
// It cannot expose a course that has already been claimed by another account.
function originalGuest(identity) {
 return identity.user && identity.guest ? {...identity,user:null,subject:`guest:${identity.guest}`} : null;
}
export async function recoverableRequest(identity,requestId) {
 try{
  const result=await generationAction(identity,"request",{requestId});
  if(result.lesson?.ownerId && result.lesson.ownerId!==identity.user?.id)throw new ApiError("request_not_found",404);
  return result;
 }
 catch(error){
  const guest=originalGuest(identity);
  if(error.code!=="request_not_found"||!guest)throw error;
  const result=await generationAction(guest,"request",{requestId});
  if(result.lesson?.ownerId && result.lesson.ownerId!==identity.user.id)throw new ApiError("request_not_found",404);
  if(result.lesson && result.status==="confirmed"){
   await generationAction(identity,"claim",{guest:guest.subject});
   return {...result,lesson:(await readLesson(identity,result.lesson.lessonId)).lesson};
  }
  return result;
 }
}
export async function readRecoverableLesson(identity,lessonId) {
 try{return await readLesson(identity,lessonId);}
 catch(error){
  const guest=originalGuest(identity);
  if(error.code!=="lesson_not_found"||!guest)throw error;
  const record=await readLesson(guest,lessonId);
  if(record.delivered){await generationAction(identity,"claim",{guest:guest.subject});return readLesson(identity,lessonId);}
  return record;
 }
}
export async function confirmRecoverableLesson(identity,lessonId) {
 try{return await generationAction(identity,"confirm",{lessonId});}
 catch(error){
  const guest=originalGuest(identity);
  if(error.code!=="lesson_not_found"||!guest)throw error;
  // Charge the original guest hold, preserving all 3 additional account credits.
  const result=await generationAction(guest,"confirm",{lessonId});
  await generationAction(identity,"claim",{guest:guest.subject});
  return result;
 }
}
