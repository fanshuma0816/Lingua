// Diagnostics. Open /api/health in your browser to see whether the AI provider
// is reachable and what the real error is (401 = bad key, 404 = wrong model or
// base URL, etc.). The key itself is never shown.
import { AI, chatComplete } from "../../../lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const info = {
    base: AI.base,
    model: AI.model,
    hasKey: !!AI.key,
    jsonMode: AI.jsonMode,
    ttsBase: AI.ttsBase,
    ttsModel: AI.ttsModel,
    hasTtsKey: !!AI.ttsKey,
  };
  if (!AI.key) {
    return Response.json({ ok: false, reason: "No API key set. Add OPENAI_API_KEY in your host's Environment Variables.", ...info });
  }
  try {
    const out = await chatComplete([{ role: "user", content: "Reply with the single word: OK" }], { temp: 0, max: 5 });
    return Response.json({ ok: true, sample: String(out).slice(0, 60), ...info });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e.message || e).slice(0, 400), ...info });
  }
}
