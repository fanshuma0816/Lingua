import { generateLesson } from "../../../lib/lesson-client";
import { cleanText } from "../../../lib/text";
import { learningContext, learningResponse, learningFailure, LearningError, requireSameOrigin } from "../../../lib/server/learning-access";
import { reserveLesson, finishLesson, failLesson } from "../../../lib/server/lesson-usage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  let ctx, reservedId;
  try {
    requireSameOrigin(req);
    const body = await req.json();
    const input = { text: cleanText(body.text || ""), lang: body.lang || "Dutch", level: body.level || "A2 — Elementary",
      goal: body.goal || "General fluency", targetMin: Number(body.targetMin) || null,
      material: body.material?.validatedTextLevel ? body.material : null };
    if (!input.text.trim() || input.text.length > 20000) throw new LearningError("invalid_lesson_text", 400);
    ctx = await learningContext(req);
    if (!ctx.enabled) return learningResponse(ctx, generateLesson(input.text, input.lang, input.level, input.goal, input.targetMin, input.material));
    const reservation = await reserveLesson(ctx, body.requestId, input);
    if (reservation.reused) {
      const c = reservation.course;
      return learningResponse(ctx, { ...c.lesson, text: c.source_text, serverLessonId: c.id, localLessonId: c.id,
        usesFreeGeneration: c.chargeable, usageConfirmed: c.status === "confirmed", accessManaged: true, recovered: true });
    }
    reservedId = reservation.course.id;
    const lesson = generateLesson(input.text, input.lang, input.level, input.goal, input.targetMin, input.material);
    if (!lesson?.sents?.length) throw new LearningError("lesson_generation_failed", 502);
    await finishLesson(ctx, reservedId, lesson);
    return learningResponse(ctx, { ...lesson, text: input.text, serverLessonId: reservedId, localLessonId: reservedId, accessManaged: true, usesFreeGeneration: reservation.course.chargeable });
  } catch (error) {
    if (reservedId && ctx) await failLesson(ctx, reservedId).catch(() => {});
    return learningFailure(error instanceof SyntaxError ? new LearningError("invalid_request", 400) : error, ctx);
  }
}
