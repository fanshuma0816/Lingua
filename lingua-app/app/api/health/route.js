// Full diagnostics. Open /api/health in your browser: it actually tests the
// chat model, the lesson translation, and the voice — and shows the REAL error
// for each if something fails. Keys are never shown. (Costs a few tokens per hit.)
import { AI, chatComplete, miniMaxTTS } from "../../../lib/ai";
import { generateLesson, enrich } from "../../../lib/lesson";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const out = {
    config: {
      chatBase: AI.base, chatPath: AI.chatPath, model: AI.model, jsonMode: AI.jsonMode, hasKey: !!AI.key,
      voiceBase: AI.mmBase, voiceModel: AI.mmModel, defaultVoice: AI.mmVoice, dutchFemaleVoice: AI.mmDutchFemaleVoice, dutchMaleVoice: AI.mmDutchMaleVoice, hasGroupId: !!AI.mmGroup,
      perLanguageVoices: AI.mmVoices,
    },
  };

  // 1) chat
  try {
    const s = await chatComplete([{ role: "user", content: "Reply with just: OK" }], { temp: 0, max: 60 });
    out.chat = { ok: !!s, sample: String(s).slice(0, 60) };
  } catch (e) { out.chat = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  // 2) lesson translation (the part that fills the Watch/Grammar steps)
  try {
    const sample = "De kat zit op de mat. Ik studeer graag Nederlands met interessante teksten.";
    const base = generateLesson(sample, "Dutch", "A2 — Elementary", "General fluency");
    await enrich(base, { text: sample, lang: "Dutch", level: "A2 — Elementary", goal: "General fluency" });
    out.lesson = {
      ok: !!base.ai,
      exampleTranslation: base.watch?.[0]?.tr || null,
      exampleWordMeaning: base.vocab?.[0]?.meaning || null,
    };
  } catch (e) { out.lesson = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  // 3) voice
  try {
    const r = await miniMaxTTS({ text: "Hallo, hoe gaat het met je?", lang: "Dutch", rate: 1, voiceRole: "female" });
    out.voice = r.buf ? { ok: true, bytes: r.buf.length, voiceUsed: r.voice } : { ok: false, error: r.error, voiceTried: r.voice };
  } catch (e) { out.voice = { ok: false, error: String(e.message || e).slice(0, 300) }; }

  out.ok = !!(out.chat?.ok && out.lesson?.ok && out.voice?.ok);
  return Response.json(out);
}
