import { resolveIdentity, requirePhase, assertSameOrigin } from "../../../../../lib/server-auth";
import { generationAction } from "../../../../../lib/entitlements";
import { ApiError, apiError, jsonResult } from "../../../../../lib/api-errors";
export const runtime = "nodejs";
export async function PATCH(req, { params }) {
 try {
  assertSameOrigin(req); const identity = await resolveIdentity(req); requirePhase(identity);
  const progress = await req.json();
  if (JSON.stringify(progress).length > 150000) throw new ApiError("progress_too_large", 413);
  const path = String(progress.path || "/scan");
  if (!/^\/(scan|preview|done|learn\/[a-z-]+)$/.test(path)) throw new ApiError("invalid_progress_path");
  return jsonResult(await generationAction(identity, "progress", { lessonId: params.lessonId, progress: {
   path, ...(progress.interaction?{interaction:progress.interaction}:{}), userWords: Array.isArray(progress.userWords) ? progress.userWords.slice(0, 100) : [],
   completedSteps: Array.isArray(progress.completedSteps) ? progress.completedSteps.slice(0, 20) : [],
  } }));
 } catch (error) { return apiError(error); }
}
