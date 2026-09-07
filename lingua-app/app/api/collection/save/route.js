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

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function uuidOrNull(value) {
  const text = shortText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text || "") ? text : null;
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

function likelyMissingRichWordColumns(error) {
  return /lemma|pos|meaning|detail|example|example_translation|audio_key|tts_lang|tts_rate|tts_voice_role|schema cache|column/i.test(String(error?.message || ""));
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
      const wordRow = {
        user_id: user.id,
        word,
        lang,
        level,
        source: "collection",
        source_lesson_id: uuidOrNull(item.sourceLessonId),
        last_seen_at: new Date().toISOString(),
      };
      const richWordRow = {
        ...wordRow,
        lemma: shortText(item.lemma, 120),
        pos: shortText(item.pos, 80),
        meaning: shortText(item.meaning, 600),
        detail: shortText(item.detail, 1200),
        example: shortText(item.example, 700),
        example_translation: shortText(item.exampleTranslation, 700),
        audio_key: shortText(item.audioKey, 4200),
        tts_lang: shortText(item.ttsLang || lang, 60),
        tts_rate: numberOrNull(item.ttsRate ?? 1),
        tts_voice_role: shortText(item.ttsVoiceRole, 80),
      };
      try {
        await supabaseWrite("/rest/v1/user_words?on_conflict=user_id,lang,word", {
          method: "POST",
          headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify(richWordRow),
        }, env);
      } catch (e) {
        if (!likelyMissingRichWordColumns(e)) throw e;
        await supabaseWrite("/rest/v1/user_words?on_conflict=user_id,lang,word", {
          method: "POST",
          headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify(wordRow),
        }, env);
      }
      return Response.json({ ok: true, type: "word", word });
    }

    if (type === "grammar") {
      const title = shortText(item.title, 220);
      if (!title || !lang) return Response.json({ error: "Missing grammar title or language." }, { status: 400 });
      await supabaseWrite("/rest/v1/user_grammar_items?on_conflict=user_id,lang,title", {
        method: "POST",
        headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({
          user_id: user.id,
          title,
          explanation: shortText(item.explanation, 900),
          example: shortText(item.example, 500),
          example_translation: shortText(item.exampleTranslation, 500),
          lang,
          level,
          source_lesson_id: uuidOrNull(item.sourceLessonId),
        }),
      }, env);
      return Response.json({ ok: true, type: "grammar" });
    }

    return Response.json({ error: "Unknown collection item type." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not save to collection." }, { status: 502 });
  }
}
