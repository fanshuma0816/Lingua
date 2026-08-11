// Full diagnostics. Open /api/health in your browser: it actually tests Gemini,
// Google Cloud Translation, and Cloud Text-to-Speech — and shows the REAL error
// for each if something fails. Keys are never shown. (Costs a few tokens per hit.)
import { AI, chatComplete, googleTranslate, googleTTS } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const out = {
    config: {
      textProvider: "Gemini (@google/genai)",
      model: AI.model,
      hasGeminiKey: !!AI.key,
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
