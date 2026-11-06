import { configuredMode, learningContext, database, learningFailure } from "../../../../lib/server/learning-access";
import { claimGuestCourses, courseRecord } from "../../../../lib/server/lesson-usage";
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

async function readLessonRows(userId, env, page) {
  const richSelect = "created_at,id,local_lesson_id,lang,level,goal,material_title,material_source,material_summary,stats,completed_steps,completed_at,input_text,lesson_snapshot,interaction_snapshot,saved_options";
  const basicSelect = "created_at,id,local_lesson_id,lang,level,goal,material_title,material_source,material_summary,stats,completed_steps,completed_at";
  const richPath = `/rest/v1/lesson_sessions?user_id=eq.${userId}&select=${richSelect}&order=created_at.desc,id.desc&limit=20&offset=${page*20}`;
  const basicPath = `/rest/v1/lesson_sessions?user_id=eq.${userId}&select=${basicSelect}&order=created_at.desc,id.desc&limit=20&offset=${page*20}`;
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
    const page=Math.max(0,Math.min(100000,Number(new URL(req.url).searchParams.get("page"))||0));
    if(!Number.isInteger(page)) return Response.json({error:"invalid_page"},{status:400});
    const legacy = await readLessonRows(userId, env,page);
    let managed=[];
    // Existing managed courses stay readable even when enforcement is switched off.
    try {
      const ctx=await learningContext(req,{force:true});
      await claimGuestCourses(ctx);
      const rows=await database(`/rest/v1/learning_courses_v1?owner_key=eq.${encodeURIComponent(ctx.owner)}&status=eq.confirmed&saved_at=not.is.null&order=created_at.desc,id.desc&limit=20&offset=${page*20}`);
      managed=(rows||[]).map(courseRecord);
    } catch(error){if(configuredMode()!=="off")return learningFailure(error);}
    const lessons=[...(legacy||[]),...managed].sort((a,b)=>String(b.saved_at||b.completed_at||b.created_at||"").localeCompare(String(a.saved_at||a.completed_at||a.created_at||"")));


    return Response.json({
      lessons: Array.isArray(lessons) ? lessons : [],
      nextPage: legacy.length===20||managed.length===20?page+1:null,
      stats: {
        lessonCount: Array.isArray(lessons) ? lessons.length : 0,
      },
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not load learning records." }, { status: 502 });
  }
}
