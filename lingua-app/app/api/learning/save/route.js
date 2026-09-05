export const runtime = "nodejs";

const MAX_WORDS = 80;

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url: (url || "").replace(/\/$/, ""), serviceKey };
}

function shortText(value, limit = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function cleanWord(value) {
  const word = String(value || "").replace(/\s+/g, " ").trim();
  return word ? word.slice(0, 120) : null;
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
      return Response.json({ error: "Learning save is not configured." }, { status: 503 });
    }

    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return Response.json({ error: "Please sign in to save progress." }, { status: 401 });
    }

    const user = await getUser(accessToken, env);
    if (!user?.id) {
      return Response.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    }

    const body = await req.json();
    const lang = shortText(body?.lang, 60);
    const level = shortText(body?.level, 40);
    const material = body?.material && typeof body.material === "object" ? body.material : {};
    const stats = body?.stats && typeof body.stats === "object" ? body.stats : {};
    const completedSteps = Array.isArray(body?.completedSteps) ? body.completedSteps.slice(0, 20) : [];

    if (!lang || !level) {
      return Response.json({ error: "Missing lesson language or level." }, { status: 400 });
    }

    await supabaseWrite("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: user.id,
        email: shortText(user.email, 240),
        updated_at: new Date().toISOString(),
      }),
    }, env);

    const inserted = await supabaseWrite("/rest/v1/lesson_sessions", {
      method: "POST",
      headers: jsonHeaders(env.serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({
        user_id: user.id,
        local_lesson_id: shortText(body?.localLessonId, 160),
        lang,
        level,
        goal: shortText(body?.goal, 120),
        material_title: shortText(material.title, 220),
        material_source: shortText(material.source, 120),
        material_hash: shortText(body?.materialHash || material.id, 160),
        material_summary: material,
        stats,
        completed_steps: completedSteps,
        completed_at: new Date().toISOString(),
      }),
    }, env);

    const lessonSession = Array.isArray(inserted) ? inserted[0] : inserted;
    const words = Array.isArray(body?.words) ? body.words : [];
    const seen = new Set();
    const rows = words.slice(0, MAX_WORDS).map((item) => {
      const word = cleanWord(item?.word || item);
      const key = `${lang}:${word}`.toLowerCase();
      if (!word || seen.has(key)) return null;
      seen.add(key);
      return {
        user_id: user.id,
        word,
        lang,
        level: shortText(item?.level || level, 40),
        source: shortText(item?.source, 40) || "lesson_completion",
        source_lesson_id: lessonSession?.id || null,
        last_seen_at: new Date().toISOString(),
      };
    }).filter(Boolean);

    if (rows.length) {
      await supabaseWrite("/rest/v1/user_words?on_conflict=user_id,lang,word", {
        method: "POST",
        headers: jsonHeaders(env.serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(rows),
      }, env);
    }

    return Response.json({
      ok: true,
      lessonSessionId: lessonSession?.id || null,
      wordCount: rows.length,
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not save learning progress." }, { status: 502 });
  }
}
