// AI writing feedback + live conversation + evaluation.
// Uses whatever provider is configured in lib/ai.js. Returns 204 when no key
// is set (or the call fails) so the client falls back to the simulated version.
import { AI, chatComplete, parseJSON } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!AI.textEnabled) return new Response(null, { status: 204 });
  try {
    const b = await req.json();

    if (b.mode === "feedback") {
      const sys = "You are a warm, encouraging language teacher. Reply ONLY with minified JSON.";
      const feedbackLanguage = b.feedbackLanguage || "English";
      const user = `A ${b.level} learner of ${b.lang} answered the prompt "${b.question}". Their writing:\n"""${b.text}"""\nReturn JSON {"grammar": <one short encouraging note in ${feedbackLanguage}>, "vocabulary": <one short note in ${feedbackLanguage}>, "sentence": <one short note in ${feedbackLanguage}>, "revision": <an improved version of their text in ${b.lang}>}. Be specific and kind.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(parseJSON(out));
    }

    if (b.mode === "chat") {
      const sys = `You are a warm ${b.lang} conversation partner sitting across from a ${b.level} learner — like a real person chatting face to face, not a chatbot.
Speak ONLY in ${b.lang}. Never use English.
If this is the first message, open naturally in ${b.lang}; do not say the English name of the language unless that is itself ${b.lang}. For Dutch, for example, say "Nederlands", not "Dutch".
The learner just studied THIS text:
"""${(b.sample || "").slice(0, 700)}"""
Ask concrete, specific questions ABOUT that text's ideas and details (not vague "what did you think?"). Give the learner something real to react to, so they always have something to say.
Gently reuse today's words (${(b.vocab || []).join(", ")}) so replies feel achievable.
Keep EVERY reply to ONE short, natural sentence ending in a question, at or just below ${b.level}. React briefly to what they said before asking the next thing. Be encouraging and human. About 5 exchanges.`;
      const messages = [{ role: "system", content: sys }, ...(Array.isArray(b.history) ? b.history : [])];
      const out = await chatComplete(messages, { temp: 0.7, max: 160 });
      return Response.json({ reply: out.trim() });
    }

    if (b.mode === "evaluate") {
      const sys = "You are a kind language teacher. Reply ONLY with minified JSON.";
      const feedbackLanguage = b.feedbackLanguage || "English";
      const conv = (b.history || []).map(m => `${m.role}: ${m.content}`).join("\n");
      const user = `Here is a short ${b.lang} practice conversation with a ${b.level} learner:\n${conv}\nReturn JSON {"praise": <one warm sentence in ${feedbackLanguage}>, "grammar": <one short tip in ${feedbackLanguage}>, "vocabulary": <one short tip in ${feedbackLanguage}>, "fluency": <one short tip in ${feedbackLanguage}>}.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(parseJSON(out));
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
