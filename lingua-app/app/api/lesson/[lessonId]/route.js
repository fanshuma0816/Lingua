import { resolveIdentity, requirePhase } from "../../../../lib/server-auth";
import { readRecoverableLesson } from "../../../../lib/lesson-store";
import { apiError, jsonResult } from "../../../../lib/api-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req, { params }) {
 try { const identity = await resolveIdentity(req); requirePhase(identity); return jsonResult(await readRecoverableLesson(identity, params.lessonId)); }
 catch (error) { return apiError(error); }
}
