// High-quality text-to-speech. Returns MP3 audio when OPENAI_API_KEY is set;
// otherwise responds 204 so the client falls back to the browser voice.
export const runtime = "nodejs";

// Map our language names to a reasonable OpenAI voice (all voices are multilingual).
const VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new Response(null, { status: 204 });
  try {
    const { text, rate } = await req.json();
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "tts-1",
        voice: VOICE,
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
