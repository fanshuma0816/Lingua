// Text-to-speech via MiniMax T2A v2 (see lib/ai.js miniMaxTTS).
// Returns MP3; on any failure returns 204 so the client falls back to the browser voice.
import { miniMaxTTS } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { text, lang, rate } = await req.json();
    const r = await miniMaxTTS({ text, lang, rate });
    if (r.buf) return new Response(r.buf, { headers: { "Content-Type": "audio/mpeg" } });
    return new Response(null, { status: 204 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
