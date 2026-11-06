import { authorizeLearning } from "../../../lib/lesson-access";
import { apiError, ApiError } from "../../../lib/api-errors";
// Text-to-speech via Google Cloud Text-to-Speech (see lib/ai.js googleTTS).
// Returns MP3; on any failure returns 204 so the client falls back to the browser voice.
import { googleTTS } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body=await req.json();
    await authorizeLearning(req,body,"tts");
    const { text, lang, rate, voiceRole } = body;
    const r = await googleTTS({ text, lang, rate, voiceRole });
    if (r.buf) return new Response(r.buf, { headers: { "Content-Type": "audio/mpeg" } });
    return new Response(null, { status: 204 });
  } catch (e) {
    if(e instanceof ApiError)return apiError(e);
    return new Response(null, { status: 204 });
  }
}
