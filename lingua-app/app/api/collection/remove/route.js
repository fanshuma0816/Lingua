export const runtime = "nodejs";

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url: (url || "").replace(/\/$/, ""), serviceKey };
}

function shortText(value, limit = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function jsonHeaders(serviceKey, extra = {}) {
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function getUser(accessToken, env) {
  const response = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function supabaseDelete(path, env) {
  const response = await fetch(`${env.url}${path}`, {
    method: "DELETE",
    headers: jsonHeaders(env.serviceKey, { Prefer: "return=minimal" }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Supabase delete failed.");
  }
  return true;
}

export async function POST(req) {
  try {
    const env = supabaseEnv();
    if (!env.url || !env.serviceKey) {
      return Response.json({ error: "Collection is not configured." }, { status: 503 });
    }

    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return Response.json({ error: "Please sign in to update your collection." }, { status: 401 });
    }

    const user = await getUser(accessToken, env);
    if (!user?.id) {
      return Response.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    }

    const body = await req.json();
    const type = body?.type;
    const item = body?.item && typeof body.item === "object" ? body.item : {};
    const lang = shortText(item.lang, 60);
    const uid = encodeURIComponent(user.id);

    if (type === "word") {
      const word = shortText(item.word, 120);
      if (!word || !lang) return Response.json({ error: "Missing word or language." }, { status: 400 });
      await supabaseDelete(`/rest/v1/user_words?user_id=eq.${uid}&lang=eq.${encodeURIComponent(lang)}&word=eq.${encodeURIComponent(word)}&source=eq.collection`, env);
      return Response.json({ ok: true, type: "word", word });
    }

    if (type === "grammar") {
      const title = shortText(item.title, 220);
      if (!title || !lang) return Response.json({ error: "Missing grammar title or language." }, { status: 400 });
      await supabaseDelete(`/rest/v1/user_grammar_items?user_id=eq.${uid}&lang=eq.${encodeURIComponent(lang)}&title=eq.${encodeURIComponent(title)}`, env);
      return Response.json({ ok: true, type: "grammar", title });
    }

    return Response.json({ error: "Unknown collection item type." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not remove from collection." }, { status: 502 });
  }
}
