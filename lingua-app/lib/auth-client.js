"use client";

import { DB } from "./storage";

const AUTH_KEY = "authSession";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return { url: url.replace(/\/$/, ""), anonKey, configured: !!url && !!anonKey };
}

function authHeaders(token) {
  const { anonKey } = supabaseConfig();
  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
  };
}

function normalizeSession(raw, user) {
  if (!raw || !raw.access_token) return null;
  const expiresIn = Number(raw.expires_in) || 3600;
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token || null,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    user: user || raw.user || null,
  };
}

async function fetchUser(accessToken) {
  const { url, configured } = supabaseConfig();
  if (!configured || !accessToken) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) return null;
  return response.json();
}

async function refreshSession(session) {
  const { url, configured } = supabaseConfig();
  if (!configured || !session?.refreshToken) return { status: "retry", session: null };
  let response;
  try {
    response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch (e) {
    // Network error / offline: keep the stored session and retry next time.
    return { status: "retry", session: null };
  }
  if (!response.ok) {
    // 400/401 means the refresh token itself is no longer valid -> sign out.
    // Anything else (5xx, rate limit, etc.) is transient -> keep the session.
    if (response.status === 400 || response.status === 401) return { status: "invalid", session: null };
    return { status: "retry", session: null };
  }
  const fresh = await response.json().catch(() => null);
  const user = (fresh && fresh.user) || session.user || null;
  const next = fresh ? normalizeSession(fresh, user) : null;
  if (next) {
    DB.set(AUTH_KEY, next);
    return { status: "ok", session: next };
  }
  return { status: "retry", session: null };
}

async function getAuthState() {
  const config = supabaseConfig();
  if (!config.configured) return { configured: false, session: null };
  const session = DB.get(AUTH_KEY, null);
  if (!session?.accessToken) return { configured: true, session: null };
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt && session.expiresAt - 60 > now) {
    return { configured: true, session };
  }
  const result = await refreshSession(session);
  if (result.status === "ok") return { configured: true, session: result.session };
  if (result.status === "invalid") {
    DB.remove(AUTH_KEY);
    return { configured: true, session: null };
  }
  // Transient failure (offline, 5xx): keep the stored session so a network blip
  // doesn't sign the user out. The next check will try to refresh again.
  return { configured: true, session };
}

async function signInWithEmail(email, nextPath = "") {
  const { url, anonKey, configured } = supabaseConfig();
  if (!configured) throw new Error("Supabase auth is not configured.");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  const redirectTo = `${origin}/auth/callback${next}`;
  const response = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email,
      create_user: true,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail = data?.msg || data?.message || data?.error_description || data?.error;
    throw new Error(detail || "Could not send sign-in link.");
  }
  return true;
}

async function completeSessionFromHash(hash) {
  const clean = String(hash || "").replace(/^#/, "");
  const params = new URLSearchParams(clean);
  const error = params.get("error_description") || params.get("error");
  if (error) throw new Error(error);
  const raw = {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
    token_type: params.get("token_type"),
  };
  const session = normalizeSession(raw, null);
  if (!session) return null;
  const user = await fetchUser(session.accessToken);
  const next = { ...session, user };
  DB.set(AUTH_KEY, next);
  if (user?.email) DB.set("email", user.email);
  return next;
}

async function signOut(session) {
  const current = session || DB.get(AUTH_KEY, null);
  const { url, configured } = supabaseConfig();
  if (configured && current?.accessToken) {
    try {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: authHeaders(current.accessToken),
      });
    } catch (e) {}
  }
  DB.remove(AUTH_KEY);
  DB.remove("pendingSaveAfterLogin");
  DB.remove("loginNextPath");
}

export { completeSessionFromHash, getAuthState, signInWithEmail, signOut, supabaseConfig };
