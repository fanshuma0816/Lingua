export const runtime = "nodejs";

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url: (url || "").replace(/\/$/, ""), serviceKey };
}

function jsonHeaders(serviceKey) {
  return {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
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

async function readRows(path, env, optional = false) {
  const response = await fetch(`${env.url}${path}`, {
    headers: jsonHeaders(env.serviceKey),
  });
  if (!response.ok) {
    if (optional) return [];
    const errorText = await response.text();
    throw new Error(errorText || "Supabase read failed.");
  }
  return response.json();
}

export async function GET(req) {
  try {
    const env = supabaseEnv();
    if (!env.url || !env.serviceKey) {
      return Response.json({ error: "Collection is not configured." }, { status: 503 });
    }

    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return Response.json({ error: "Please sign in to view your collection." }, { status: 401 });
    }

    const user = await getUser(accessToken, env);
    if (!user?.id) {
      return Response.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    }

    const userId = encodeURIComponent(user.id);
    const words = await readRows(`/rest/v1/user_words?user_id=eq.${userId}&source=in.(collection,lesson_card)&select=id,word,lang,level,source,source_lesson_id,last_seen_at&order=last_seen_at.desc&limit=200`, env);
    const grammar = await readRows(`/rest/v1/user_grammar_items?user_id=eq.${userId}&select=id,title,explanation,example,example_translation,lang,level,source_lesson_id,created_at&order=created_at.desc&limit=120`, env, true);

    return Response.json({
      words: Array.isArray(words) ? words : [],
      grammar: Array.isArray(grammar) ? grammar : [],
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not load collection." }, { status: 502 });
  }
}
