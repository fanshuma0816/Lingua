import { resolveIdentity, digest, assertSameOrigin } from "../../../../lib/server-auth";
import { entitlements, generationAction } from "../../../../lib/entitlements";
import { apiError, jsonResult } from "../../../../lib/api-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req) {
 try {
  assertSameOrigin(req);
  const identity = await resolveIdentity(req, { issueGuest: true });
  if (!identity.enabled) return jsonResult({ enabled: false });
  if (identity.cookie) {
   // Use the trusted platform IP only; no personal IP is stored in the database.
   const ip = req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-real-ip") || "local";
   await generationAction(identity, "rate", { key: `guest-bootstrap:${digest(ip)}`, limit: 10 });
  }
  return jsonResult(await entitlements(identity), identity);
 } catch (error) { return apiError(error); }
}
