// High-quality text-to-speech via an OpenAI-compatible /audio/speech endpoint.
// Returns MP3 when a TTS key + endpoint are configured; otherwise 204 so the
// client falls back to the browser voice.
// NOTE: many chat-only providers do NOT offer speech. To get AI voice you may
// need OPENAI_TTS_BASE_URL + OPENAI_TTS_API_KEY pointed at a provider that does.
import { AI } from "../../../lib/ai";

export const runtime = "nodejs";

export async function POST(req) {
  if (!AI.ttsKey) return new Response(null, { status: 204 });
  try {
    const { text, rate } = await req.json();
    const res = await fetch(AI.ttsBase + "/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI.ttsKey}` },
      body: JSON.stringify({
        model: AI.ttsModel,
        voice: AI.ttsVoice,
        input: (text || "").slice(0, 4000),
        speed: rate || 1,
      }),
    });
    if (!res.ok) return new Response(null, { status: 204 });
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
