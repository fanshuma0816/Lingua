// Text-to-speech via MiniMax T2A v2.
// Needs MINIMAX_GROUP_ID (+ a key). Returns MP3; on any failure returns 204 so
// the client falls back to the browser voice. `language_boost` is set from the
// lesson language to improve pronunciation (e.g. Dutch, Japanese).
import { AI, MM_LANG_BOOST } from "../../../lib/ai";

export const runtime = "nodejs";

export async function POST(req) {
  if (!AI.mmKey || !AI.mmGroup) return new Response(null, { status: 204 });
  try {
    const { text, lang, rate } = await req.json();
    const res = await fetch(`${AI.mmBase}/t2a_v2?GroupId=${encodeURIComponent(AI.mmGroup)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI.mmKey}` },
      body: JSON.stringify({
        model: AI.mmModel,
        text: (text || "").slice(0, 4000),
        stream: false,
        output_format: "hex",
        language_boost: MM_LANG_BOOST[lang] || "auto",
        voice_setting: { voice_id: AI.mmVoices[lang] || AI.mmVoice, speed: rate || 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });
    if (!res.ok) return new Response(null, { status: 204 });
    const d = await res.json();
    const hex = d?.data?.audio;
    if (!hex) return new Response(null, { status: 204 });
    const buf = Buffer.from(hex, "hex");
    return new Response(buf, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
