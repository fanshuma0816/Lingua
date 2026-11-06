import { learningContext, learningResponse, learningFailure } from "../../../../lib/server/learning-access";
import { readLesson, courseRecord } from "../../../../lib/server/lesson-usage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req, { params }) {
  let ctx;
  try {
    ctx = await learningContext(req, { force: true });
    const course = await readLesson(ctx, params.lessonId);
    return learningResponse(ctx, { record: courseRecord(course), confirmed: course.status === "confirmed" });
  } catch (error) { return learningFailure(error, ctx); }
}
