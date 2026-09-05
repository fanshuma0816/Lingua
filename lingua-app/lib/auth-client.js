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
  if (!configured || !session?.refreshToken) return null;
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!response.ok) return null;
  const fresh = await response.json();
  const user = fresh.user || session.user || null;
  const next = normalizeSession(fresh, user);
  if (next) DB.set(AUTH_KEY, next);
  return next;
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
  const fresh = await refreshSession(session);
  if (fresh) return { configured: true, session: fresh };
  DB.remove(AUTH_KEY);
  return { configured: true, session: null };
}

async function signInWithEmail(email, nextPath = "/done") {
  const { url, anonKey, configured } = supabaseConfig();
  if (!configured) throw new Error("Supabase auth is not configured.");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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
  if (!response.ok) throw new Error("Could not send sign-in link.");
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

function signOut() {
  DB.remove(AUTH_KEY);
}

export { completeSessionFromHash, getAuthState, signInWithEmail, signOut, supabaseConfig };
