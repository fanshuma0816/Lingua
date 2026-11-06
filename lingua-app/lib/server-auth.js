import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { ApiError } from "./api-errors";

export function phaseConfig() {
  const mode = process.env.MONETIZATION_MODE || "off";
  if (!["off", "test", "production"].includes(mode)) throw new ApiError("invalid_phase_config", 503);
  return { enabled: mode !== "off", environment: mode === "test" ? "test" : "production" };
}
export function databaseConfig() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError("database_not_configured", 503);
  return { url, key };
}
export async function database(path, options = {}) {
  const { url, key } = databaseConfig();
  const r = await fetch(`${url}/rest/v1/${path}`, { ...options, cache: "no-store", headers: {
    "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, ...options.headers,
  } });
  if (!r.ok) throw new ApiError("database_unavailable", 503);
  return r.status === 204 ? null : r.json();
}
function signature(value) {
  const secret = process.env.GUEST_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new ApiError("guest_secret_not_configured", 503);
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function digest(value) { return signature(value); }
export function guestFromCookie(req, environment) {
  const name = `lingua_guest_${environment}`;
  const value = (req.headers.get("cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) || "";
  const [id, expires, sig] = value.split(".");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !/^\d+$/.test(expires || "") || Number(expires) < Date.now()) return null;
  const expected = signature(`${environment}:${id}:${expires}`);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}
export async function resolveIdentity(req, { issueGuest = false } = {}) {
  const config = phaseConfig();
  if (!config.enabled) return { ...config };
  const { url, key } = databaseConfig();
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  let user = null;
  if (token) {
    const r = await fetch(`${url}/auth/v1/user`, { cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new ApiError(r.status >= 500 ? "auth_unavailable" : "sign_in_required", r.status >= 500 ? 503 : 401);
    user = await r.json();
    if (!user?.id) throw new ApiError("sign_in_required", 401);
    if (config.environment === "test") {
      const allowedIds = (process.env.MONETIZATION_TEST_USER_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
      const allowedEmails = (process.env.MONETIZATION_TEST_EMAILS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
      // Only the verified address returned by Supabase Auth is trusted. Never user_metadata or request input.
      const verifiedEmail = user.email_confirmed_at && !user.is_anonymous && typeof user.email === "string"
        ? user.email.trim().toLowerCase() : null;
      if (!allowedIds.includes(user.id) && !(verifiedEmail && allowedEmails.includes(verifiedEmail)))
        throw new ApiError("test_account_required", 403);
    }
  }
  let guest = guestFromCookie(req, config.environment), cookie;
  if (!guest && !user) {
    if (!issueGuest) throw new ApiError("guest_session_required", 401);
    guest = randomUUID();
    const expires = String(Date.now() + 365 * 86400000);
    const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
    cookie = `lingua_guest_${config.environment}=${guest}.${expires}.${signature(`${config.environment}:${guest}:${expires}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
  }
  return { ...config, user, guest, cookie, subject: user ? `user:${user.id}` : `guest:${guest}` };
}
export function requirePhase(identity) { if (!identity.enabled) throw new ApiError("feature_disabled", 404); }
export function assertSameOrigin(req) {
  const origin = req.headers.get("origin");
  const configured = process.env.APP_ORIGIN;
  if (origin && origin !== (configured || new URL(req.url).origin)) throw new ApiError("invalid_origin", 403);
}
