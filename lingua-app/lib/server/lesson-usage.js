import { createHash } from "node:crypto";
import { UUID, LearningError, rpc } from "./learning-access";

function inputHash(input) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
async function claimGuestCourses(ctx) {
  if (ctx.user && ctx.guest) await rpc("learning_claim_v1", { p_guest: ctx.guest, p_owner: ctx.owner });
}
async function reserveLesson(ctx, requestId, input) {
  if (!UUID.test(requestId || "")) throw new LearningError("invalid_request_id", 400);
  await claimGuestCourses(ctx);
  return rpc("learning_reserve_v1", { p_owner: ctx.owner, p_limit: ctx.allowance, p_request: requestId,
    p_hash: inputHash(input), p_source: input.text, p_pro: ctx.pro });
}
async function finishLesson(ctx, id, lesson) {
  return rpc("learning_finish_v1", { p_owner: ctx.owner, p_id: id, p_lesson: lesson });
}
async function failLesson(ctx, id) {
  return rpc("learning_fail_v1", { p_owner: ctx.owner, p_id: id });
}
async function confirmLesson(ctx, id) {
  if (!UUID.test(id || "")) throw new LearningError("course_not_found", 404);
  await claimGuestCourses(ctx);
  return rpc("learning_confirm_v1", { p_owner: ctx.owner, p_id: id });
}
async function readLesson(ctx, id) {
  if (!UUID.test(id || "")) throw new LearningError("course_not_found", 404);
  await claimGuestCourses(ctx);
  return rpc("learning_read_v1", { p_owner: ctx.owner, p_id: id });
}
async function saveCourse(ctx, id, payload) {
  if (!ctx.user) throw new LearningError("login_required", 401);
  await claimGuestCourses(ctx);
  return rpc("learning_save_v1", { p_owner: ctx.owner, p_id: id, p_resume: payload });
}
function courseRecord(course) {
  const data = course.resume || {};
  const lesson = course.lesson || {};
  return { id: course.id, local_lesson_id: course.id, managed_course: true, uses_free_generation: course.chargeable, lang: lesson.lang, level: lesson.level,
    goal: lesson.goal, material_title: lesson.material?.title, input_text: course.source_text,
    lesson_snapshot: { ...lesson, ...(data.lessonSnapshot || {}), serverLessonId: course.id, localLessonId: course.id, sents: lesson.sents, sentences: lesson.sents, lang: lesson.lang, level: lesson.level, material: lesson.material },
    interaction_snapshot: data.interactionSnapshot || {}, saved_options: { ...data.savedOptions, resumePath: data.resumePath || "/scan" },
    stats: data.stats || {}, completed_steps: data.completedSteps || [], completed_at: course.completed_at,
    saved_at: course.saved_at, created_at: course.created_at, status: course.status === "ready" ? "ready" : course.completed_at ? "completed" : "in_progress" };
}
export { inputHash, claimGuestCourses, reserveLesson, finishLesson, failLesson, confirmLesson, readLesson, saveCourse, courseRecord };
