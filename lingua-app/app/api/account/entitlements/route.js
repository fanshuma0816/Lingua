import { learningContext, entitlements, learningResponse, learningFailure } from "../../../../lib/server/learning-access";
import { claimGuestCourses } from "../../../../lib/server/lesson-usage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req) {
  let ctx;
  try {
    ctx = await learningContext(req);
    if (ctx.enabled) await claimGuestCourses(ctx);
    return learningResponse(ctx, await entitlements(ctx));
  } catch (error) { return learningFailure(error, ctx); }
}
