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
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function supabaseWrite(path, options, env) {
  const response = await fetch(`${env.url}${path}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Supabase write failed.");
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
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
      return Response.json({ error: "Please sign in to save to your collection." }, { status: 401 });
    }

    const user = await getUser(accessToken, env);
    if (!user?.id) {
      return Response.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    }

    const body = await req.json();
    const type = body?.type;
    const item = body?.item && typeof body.item === "object" ? body.item : {};
    const lang = shortText(item.lang, 60);
    const level = shortText(item.level, 40);

    if (type === "word") {
      const word = shortText(item.word, 120);
      if (!word || !lang) return Response.json({ error: "Missing word or language." }, { status: 400 });
      await supabaseWrite("/rest/v1/user_words?on_conflict=user_id,lang,word", {
        method: "POST",
        headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({
          user_id: user.id,
          word,
          lang,
          level,
          source: "collection",
          source_lesson_id: shortText(item.sourceLessonId, 160),
          last_seen_at: new Date().toISOString(),
        }),
      }, env);
      return Response.json({ ok: true, type: "word", word });
    }

    if (type === "grammar") {
      const title = shortText(item.title, 220);
      if (!title || !lang) return Response.json({ error: "Missing grammar title or language." }, { status: 400 });
      const inserted = await supabaseWrite("/rest/v1/user_grammar_items", {
        method: "POST",
        headers: jsonHeaders(env.serviceKey, { Prefer: "return=representation" }),
        body: JSON.stringify({
          user_id: user.id,
          title,
          explanation: shortText(item.explanation, 900),
          example: shortText(item.example, 500),
          example_translation: shortText(item.exampleTranslation, 500),
          lang,
          level,
          source_lesson_id: shortText(item.sourceLessonId, 160),
          created_at: new Date().toISOString(),
        }),
      }, env);
      const row = Array.isArray(inserted) ? inserted[0] : inserted;
      return Response.json({ ok: true, type: "grammar", id: row?.id || null });
    }

    return Response.json({ error: "Unknown collection item type." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not save to collection." }, { status: 502 });
  }
}
