import { timingSafeEqual } from "node:crypto";
import { database, phaseConfig } from "../../../../lib/server-auth";
import { ApiError, apiError, jsonResult } from "../../../../lib/api-errors";
export const runtime = "nodejs";
export async function POST(req) {
 try {
  const expected = `Bearer ${process.env.GENERATION_MAINTENANCE_SECRET || ""}`, actual = req.headers.get("authorization") || "";
  if (!process.env.GENERATION_MAINTENANCE_SECRET || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new ApiError("unauthorized", 401);
  if (!phaseConfig().enabled) throw new ApiError("feature_disabled", 404);
  return jsonResult({ expired: await database("rpc/lingua_expire_generation_requests", { method: "POST", body: "{}" }) });
 } catch (error) { return apiError(error); }
}
