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

async function readLessonRows(userId, env) {
  const richSelect = "id,local_lesson_id,lang,level,goal,material_title,material_source,material_summary,stats,completed_steps,completed_at,input_text,lesson_snapshot,interaction_snapshot,saved_options";
  const basicSelect = "id,local_lesson_id,lang,level,goal,material_title,material_source,material_summary,stats,completed_steps,completed_at";
  const richPath = `/rest/v1/lesson_sessions?user_id=eq.${userId}&select=${richSelect}&order=completed_at.desc&limit=20`;
  const basicPath = `/rest/v1/lesson_sessions?user_id=eq.${userId}&select=${basicSelect}&order=completed_at.desc&limit=20`;
  try {
    return await readRows(richPath, env);
  } catch (e) {
    if (!/input_text|lesson_snapshot|interaction_snapshot|saved_options|schema cache|column/i.test(String(e?.message || ""))) throw e;
    return readRows(basicPath, env);
  }
}

export async function GET(req) {
  try {
    const env = supabaseEnv();
    if (!env.url || !env.serviceKey) {
      return Response.json({ error: "Learning records are not configured." }, { status: 503 });
    }

    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return Response.json({ error: "Please sign in to view progress." }, { status: 401 });
    }

    const user = await getUser(accessToken, env);
    if (!user?.id) {
      return Response.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    }

    const userId = encodeURIComponent(user.id);
    const lessons = await readLessonRows(userId, env);

    return Response.json({
      lessons: Array.isArray(lessons) ? lessons : [],
      stats: {
        lessonCount: Array.isArray(lessons) ? lessons.length : 0,
      },
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not load learning records." }, { status: 502 });
  }
}
