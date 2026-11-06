import { resolveIdentity } from "../../../../lib/server-auth";
import { attachSegmentLessons } from "../../../../lib/lesson-store";
import { apiError } from "../../../../lib/api-errors";
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

async function readWords(userId, env) {
  const richSelect = "id,item_key,word,lang,level,source,source_lesson_id,last_seen_at,lemma,pos,meaning,detail,example,example_translation,audio_key,tts_lang,tts_rate,tts_voice_role";
  const basicSelect = "id,word,lang,level,source,source_lesson_id,last_seen_at";
  const richPath = `/rest/v1/user_words?user_id=eq.${userId}&source=eq.collection&select=${richSelect}&order=last_seen_at.desc&limit=200`;
  const basicPath = `/rest/v1/user_words?user_id=eq.${userId}&source=eq.collection&select=${basicSelect}&order=last_seen_at.desc&limit=200`;
  try {
    return await readRows(richPath, env);
  } catch (e) {
    if (!/item_key|lemma|pos|meaning|detail|example|example_translation|audio_key|tts_lang|tts_rate|tts_voice_role|schema cache|column/i.test(String(e?.message || ""))) throw e;
    return readRows(basicPath, env);
  }
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
    const words = await readWords(userId, env);
    const materials = await readRows(`/rest/v1/user_materials?user_id=eq.${userId}&select=id,display_name,source_type,language,learner_level,learning_goal,target_minutes,created_at,updated_at&order=updated_at.desc&limit=100`, env, true);
    let materialSegments=[];
    if(materials.length){
      const ids=materials.map(m=>m.id).join(",");
      materialSegments=await readRows(`/rest/v1/material_segments?material_id=in.(${ids})&select=id,material_id,segment_index,title,word_count,estimated_minutes_min,estimated_minutes_max,material_level,difficulty_label,status,started_at,completed_at&order=segment_index.asc`,env,true);
    }
    let grammar = await readRows(`/rest/v1/user_grammar_items?user_id=eq.${userId}&select=id,item_key,title,explanation,example,example_translation,lang,level,source_lesson_id,created_at&order=created_at.desc&limit=120`, env, true);
    if (!grammar.length) grammar = await readRows(`/rest/v1/user_grammar_items?user_id=eq.${userId}&select=id,title,explanation,example,example_translation,lang,level,source_lesson_id,created_at&order=created_at.desc&limit=120`, env, true);

    const identity=await resolveIdentity(req);if(identity.enabled)materialSegments=await attachSegmentLessons(identity,materialSegments);
    return Response.json({
      materials: materials.map(material=>({...material,segments:materialSegments.filter(segment=>segment.material_id===material.id)})),
      words: Array.isArray(words) ? words : [],
      grammar: Array.isArray(grammar) ? grammar : [],
    });
  } catch (e) {
    if(e?.code)return apiError(e);
    return Response.json({ error: e?.message || "Could not load collection." }, { status: 502 });
  }
}
