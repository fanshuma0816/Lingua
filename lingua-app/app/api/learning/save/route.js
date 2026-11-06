import { configuredMode, learningContext, learningResponse, learningFailure, database, LearningError, UUID } from "../../../../lib/server/learning-access";
import { saveCourse } from "../../../../lib/server/lesson-usage";
export const runtime = "nodejs";

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url: (url || "").replace(/\/$/, ""), serviceKey };
}

function shortText(value, limit = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function longText(value, limit = 20000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, limit) : null;
}

function jsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
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

function likelyMissingSnapshotColumns(error) {
  return /input_text|lesson_snapshot|interaction_snapshot|saved_options|schema cache|column/i.test(String(error?.message || ""));
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
    if (JSON.stringify(body).length > 250000) return Response.json({error:"lesson_snapshot_too_large"},{status:413});
    if (body.serverLessonId) {
      let ctx;
      try {
        ctx=await learningContext(req,{force:true});
        if (!ctx.user || ctx.user.id!==user.id) throw new LearningError("login_required",401);
        const course=await saveCourse(ctx,body.serverLessonId,body);
        return learningResponse(ctx,{ok:true,lessonSessionId:course.id,wordCount:Number(body.stats?.vocabCount)||0});
      } catch(error){return learningFailure(error,ctx);}
    }
    const completed=body.completed!==false;
    if(body.legacySessionId&&!UUID.test(body.legacySessionId))return Response.json({error:"invalid_course_id"},{status:400});
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

    const lessonRow = {
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
      completed_at: completed ? new Date().toISOString() : null,
    };
    const richLessonRow = {
      ...lessonRow,
      input_text: longText(body?.inputText),
      lesson_snapshot: jsonObject(body?.lessonSnapshot),
      interaction_snapshot: jsonObject(body?.interactionSnapshot),
      saved_options: { ...jsonObject(body?.savedOptions), completed, resumePath: shortText(body.resumePath,120)||"/scan" },
    };

    if (!lessonRow.local_lesson_id) return Response.json({error:"missing_course_id"},{status:400});
    let inserted;
    try {
      // Atomic upsert when the staged migration is present; legacy sites remain compatible.
      inserted = await database("/rest/v1/rpc/learning_legacy_save_v1",{method:"POST",body:JSON.stringify({p_user:user.id,p_local:lessonRow.local_lesson_id,p_row:{...richLessonRow,...(body.legacySessionId?{_legacy_id:body.legacySessionId}:{})}})});
    } catch (error) {
      if(configuredMode()!=="off")throw error;
      const key=encodeURIComponent(lessonRow.local_lesson_id);
      const filter=body.legacySessionId?`id=eq.${body.legacySessionId}`:`local_lesson_id=eq.${key}`;
      const existing=await supabaseWrite(`/rest/v1/lesson_sessions?user_id=eq.${user.id}&${filter}&select=id,completed_at&limit=1`,{method:"GET",headers:jsonHeaders(env.serviceKey)},env);
      const row=existing?.[0];
      if(body.legacySessionId&&!row)return Response.json({error:"course_not_found"},{status:404});
      const path=row?`/rest/v1/lesson_sessions?id=eq.${row.id}&user_id=eq.${user.id}`:"/rest/v1/lesson_sessions";
      if(row?.completed_at)richLessonRow.completed_at=row.completed_at;
      const write=value=>supabaseWrite(path,{method:row?"PATCH":"POST",headers:jsonHeaders(env.serviceKey,{Prefer:"return=representation"}),body:JSON.stringify(value)},env);
      try {inserted=await write(richLessonRow);}
      catch(error){
        if (!completed || !likelyMissingSnapshotColumns(error)) throw error;
        inserted=await write({...lessonRow,completed_at:row?.completed_at||lessonRow.completed_at});
      }
    }

    if(inserted?.error)return Response.json({error:inserted.error},{status:inserted.status||409});
    const lessonSession = Array.isArray(inserted) ? inserted[0] : inserted;
    return Response.json({
      ok: true,
      lessonSessionId: lessonSession?.id || null,
      wordCount: Number(stats.vocabCount) || 0,
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not save learning progress." }, { status: 502 });
  }
}
