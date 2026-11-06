import { resolveIdentity, requirePhase } from "../../../../../lib/server-auth";
import { recoverableRequest } from "../../../../../lib/lesson-store";
import { apiError, jsonResult } from "../../../../../lib/api-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req, { params }) {
 try { const identity = await resolveIdentity(req); requirePhase(identity); return jsonResult(await recoverableRequest(identity, params.requestId)); }
 catch (error) { return apiError(error); }
}
