import { createHmac, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { learningAccessMode, RULE_VERSION, GUEST_GENERATIONS, ACCOUNT_GENERATIONS } from "../../config/commercial";

const COOKIE = "lingua_learning_guest";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class LearningError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
function configuredMode() {
  try { return learningAccessMode(); } catch { throw new LearningError("learning_configuration_error"); }
}
function requireSameOrigin(req) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new LearningError("invalid_origin", 403);
}
function databaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new LearningError("learning_not_configured");
  return { url, key };
}
async function database(path, options = {}) {
  const { url, key } = databaseConfig();
  let response;
  try {
    response = await fetch(url + path, { ...options, cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...options.headers } });
  } catch { throw new LearningError("learning_temporarily_unavailable"); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new LearningError("learning_storage_unavailable");
  return data;
}
async function rpc(name, params) {
  const result = await database("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(params) });
  if (result?.error) throw new LearningError(result.error, result.status || 409);
  return result;
}
function guestIdentity(req, create = true) {
  const secret = process.env.LEARNING_GUEST_SECRET;
  if (!secret && !create) return null;
  if (!secret || secret.length < 32) throw new LearningError("learning_not_configured");
  const sign = id => createHmac("sha256", secret).update(id).digest("hex");
  const cookie = (req.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  let id;
  if (cookie) {
    const [candidate, signature] = cookie.split(".");
    if (UUID.test(candidate || "") && /^[a-f0-9]{64}$/.test(signature || "") && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(candidate)))) id = candidate;
  }
  if (!id && !create) return null;
  const fresh = !id;
  id ||= randomUUID();
  return { owner: "g:" + createHash("sha256").update(id).digest("hex"),
    cookie: fresh ? `${COOKIE}=${id}.${sign(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=15552000${new URL(req.url).protocol === "https:" ? "; Secure" : ""}` : null };
}
async function learningContext(req, { force = false } = {}) {
  const mode = configuredMode();
  if (mode === "off" && !force) return { enabled: false, mode };
  const { url, key } = databaseConfig();
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  let user = null;
  if (token) {
    let response;
    try { response = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) }); }
    catch { throw new LearningError("learning_temporarily_unavailable"); }
    if (!response.ok) throw new LearningError("login_required", 401);
    user = await response.json();
    if (!UUID.test(user?.id || "")) throw new LearningError("login_required", 401);
  }
  const guest = guestIdentity(req, !user);
  const owner = user ? "u:" + user.id : guest.owner;
  // Simulation is server-side, available only in an explicitly isolated staging environment.
  const pro = mode === "test" && !!user && (process.env.LEARNING_TEST_PRO_USER_IDS || "").split(",").map(x => x.trim()).includes(user.id);
  return { enabled: mode !== "off", mode, owner, user, guest: guest?.owner, cookie: guest?.cookie, pro,
    allowance: user ? ACCOUNT_GENERATIONS : GUEST_GENERATIONS, version: RULE_VERSION };
}
async function entitlements(ctx) {
  if (!ctx.enabled) return { enabled: false, mode: "off" };
  const state = await rpc("learning_allowance_v1", { p_owner: ctx.owner, p_limit: ctx.allowance });
  return { ...state, enabled: true, mode: ctx.mode, signedIn: !!ctx.user, pro: ctx.pro, version: ctx.version };
}
function learningResponse(ctx, data, status = 200) {
  const headers = { "Cache-Control": "no-store" };
  if (ctx?.cookie) headers["Set-Cookie"] = ctx.cookie;
  return Response.json(data, { status, headers });
}
function learningFailure(error, ctx) {
  const known = error instanceof LearningError;
  return learningResponse(ctx, { error: known ? error.code : "learning_temporarily_unavailable", learningAccessError: true }, known ? error.status : 503);
}
export { UUID, LearningError, configuredMode, requireSameOrigin, learningContext, entitlements, database, rpc, learningResponse, learningFailure };
