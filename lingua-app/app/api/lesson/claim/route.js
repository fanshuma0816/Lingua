import { resolveIdentity, requirePhase, assertSameOrigin } from "../../../../lib/server-auth";
import { generationAction } from "../../../../lib/entitlements";
import { ApiError, apiError, jsonResult } from "../../../../lib/api-errors";
export const runtime = "nodejs";
export async function POST(req) {
 try {
  assertSameOrigin(req); const identity = await resolveIdentity(req); requirePhase(identity);
  if (!identity.user) throw new ApiError("sign_in_required", 401);
  return jsonResult(identity.guest ? await generationAction(identity, "claim", { guest: `guest:${identity.guest}` }) : { ok: true });
 } catch (error) { return apiError(error); }
}
