// AI writing feedback + live conversation + evaluation.
// Uses whatever provider is configured in lib/ai.js. Returns 204 when no key
// is set (or the call fails) so the client falls back to the simulated version.
import { AI, chatComplete, parseJSON } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!AI.key) return new Response(null, { status: 204 });
  try {
    const b = await req.json();

    if (b.mode === "feedback") {
      const sys = "You are a warm, encouraging language teacher. Reply ONLY with minified JSON.";
      const user = `A ${b.level} learner of ${b.lang} answered the prompt "${b.question}". Their writing:\n"""${b.text}"""\nReturn JSON {"grammar": <one short encouraging note in English>, "vocabulary": <one short note in English>, "sentence": <one short note in English>, "revision": <an improved version of their text in ${b.lang}>}. Be specific and kind.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(parseJSON(out));
    }

    if (b.mode === "chat") {
      const sys = `You are a friendly ${b.lang} conversation partner for a ${b.level} learner. Speak ONLY in ${b.lang}. Ask about today's topic: "${b.topic || "the text"}". Encourage the learner to use today's words (${(b.vocab || []).join(", ")})${b.grammar ? " and grammar (" + b.grammar + ")" : ""}. Keep EVERY reply to ONE short, simple sentence that ends with a question. Aim for about 5 exchanges. Be warm, patient and encouraging.`;
      const messages = [{ role: "system", content: sys }, ...(Array.isArray(b.history) ? b.history : [])];
      const out = await chatComplete(messages, { temp: 0.7, max: 120 });
      return Response.json({ reply: out.trim() });
    }

    if (b.mode === "evaluate") {
      const sys = "You are a kind language teacher. Reply ONLY with minified JSON.";
      const conv = (b.history || []).map(m => `${m.role}: ${m.content}`).join("\n");
      const user = `Here is a short ${b.lang} practice conversation with a ${b.level} learner:\n${conv}\nReturn JSON {"praise": <one warm sentence in English>, "grammar": <one short tip in English>, "vocabulary": <one short tip in English>, "fluency": <one short tip in English>}.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(parseJSON(out));
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
