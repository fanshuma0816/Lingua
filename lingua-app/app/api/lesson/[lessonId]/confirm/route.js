import { learningContext, entitlements, learningResponse, learningFailure, requireSameOrigin } from "../../../../../lib/server/learning-access";
import { confirmLesson } from "../../../../../lib/server/lesson-usage";
export const runtime = "nodejs";
export async function POST(req, { params }) {
  let ctx;
  try {
    requireSameOrigin(req);
    ctx = await learningContext(req, { force: true });
    const course = await confirmLesson(ctx, params.lessonId);
    return learningResponse(ctx, { confirmed: true, usesFreeGeneration: course.chargeable, courseId: course.id, entitlement: await entitlements(ctx) });
  } catch (error) { return learningFailure(error, ctx); }
}
