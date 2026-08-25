// Public health is intentionally cheap and non-diagnostic. Full diagnostics
// require HEALTH_CHECK_TOKEN or DIAGNOSTIC_TOKEN, passed as x-health-token or
// ?token=..., because they call paid Google services.

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req) {
  const secret = process.env.HEALTH_CHECK_TOKEN || process.env.DIAGNOSTIC_TOKEN || "";
  if (!secret) return false;
  const url = new URL(req.url);
  const provided = req.headers.get("x-health-token") || url.searchParams.get("token") || "";
  return provided === secret;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: true });

  const { AI, chatComplete, googleTranslate, googleTTS } = await import("../../../lib/ai");
  const out = {
    config: {
      textProvider: "Gemini on Vertex AI (@google/genai)",
      model: AI.model,
      project: AI.project,
      location: AI.location,
      geminiAuthMode: AI.geminiAuthMode,
      hasGeminiApiKey: !!AI.geminiApiKey,
      textEnabled: !!AI.textEnabled,
      translationProvider: "Google Cloud Translation v2",
      ttsProvider: "Google Cloud Text-to-Speech v1",
      hasGcpKey: !!AI.gcpKey,
    },
  };

  // 1) Gemini text
  try {
    const s = await chatComplete([{ role: "user", content: "Reply with just: OK" }], { temp: 0, max: 60 });
    out.text = { ok: !!s, sample: String(s).slice(0, 60) };
  } catch (e) { out.text = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  // 2) Cloud Translation
  try {
    const r = await googleTranslate(["Ik studeer graag Nederlands."], { target: "English", source: "Dutch" });
    out.translation = r.error ? { ok: false, error: r.error } : { ok: true, sample: r.translations?.[0] || null };
  } catch (e) { out.translation = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  // 3) Cloud TTS
  try {
    const r = await googleTTS({ text: "Hallo, hoe gaat het met je?", lang: "Dutch", rate: 1, voiceRole: "female" });
    out.voice = r.buf ? { ok: true, bytes: r.buf.length, voiceUsed: r.voice } : { ok: false, error: r.error, voiceTried: r.voice };
  } catch (e) { out.voice = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  out.ok = !!(out.text?.ok && out.translation?.ok && out.voice?.ok);
  return Response.json(out);
}
