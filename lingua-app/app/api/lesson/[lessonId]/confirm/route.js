import { resolveIdentity, requirePhase, assertSameOrigin } from "../../../../../lib/server-auth";
import { generationAction, entitlements } from "../../../../../lib/entitlements";
import { apiError, jsonResult } from "../../../../../lib/api-errors";
export const runtime = "nodejs";
export async function POST(req, { params }) {
 try {
  assertSameOrigin(req); const identity = await resolveIdentity(req); requirePhase(identity);
  const result = await generationAction(identity, "confirm", { lessonId: params.lessonId });
  return jsonResult({ ...result, entitlements: await entitlements(identity) });
 } catch (error) { return apiError(error); }
}
