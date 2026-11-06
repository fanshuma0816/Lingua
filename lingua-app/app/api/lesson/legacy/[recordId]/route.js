import { resolveIdentity, requirePhase, assertSameOrigin } from "../../../../../lib/server-auth";
import { importLegacy } from "../../../../../lib/lesson-store";
import { apiError, jsonResult } from "../../../../../lib/api-errors";
export const runtime = "nodejs";
export async function POST(req, { params }) {
 try { assertSameOrigin(req); const identity = await resolveIdentity(req); requirePhase(identity); return jsonResult(await importLegacy(identity, params.recordId)); }
 catch (error) { return apiError(error); }
}
