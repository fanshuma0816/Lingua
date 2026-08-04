// AI writing feedback + live conversation + evaluation.
// Returns 204 when OPENAI_API_KEY is missing so the client falls back to the
// built-in simulated version.
export const runtime = "nodejs";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

async function chat(messages, { json = false, temp = 0.6, max = 400 } = {}) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: temp, max_tokens: max,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error("openai " + res.status);
  const d = await res.json();
  return d.choices[0].message.content;
}

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) return new Response(null, { status: 204 });
  try {
    const b = await req.json();

    if (b.mode === "feedback") {
      const sys = "You are a warm, encouraging language teacher. Reply ONLY with minified JSON.";
      const user = `A ${b.level} learner of ${b.lang} answered the prompt "${b.question}". Their writing:\n"""${b.text}"""\nReturn JSON {"grammar": <one short encouraging note in English>, "vocabulary": <one short note in English>, "sentence": <one short note in English>, "revision": <an improved version of their text in ${b.lang}>}. Be specific and kind.`;
      const out = await chat([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(JSON.parse(out));
    }

    if (b.mode === "chat") {
      const sys = `You are a friendly ${b.lang} conversation partner for a ${b.level} learner. Speak ONLY in ${b.lang}. Keep every reply to ONE short, simple sentence that ends with a question. Gently encourage the learner to use these words: ${(b.vocab || []).join(", ")}. Stay warm and patient.`;
      const messages = [{ role: "system", content: sys }, ...(Array.isArray(b.history) ? b.history : [])];
      const out = await chat(messages, { temp: 0.7, max: 120 });
      return Response.json({ reply: out.trim() });
    }

    if (b.mode === "evaluate") {
      const sys = "You are a kind language teacher. Reply ONLY with minified JSON.";
      const conv = (b.history || []).map(m => `${m.role}: ${m.content}`).join("\n");
      const user = `Here is a short ${b.lang} practice conversation with a ${b.level} learner:\n${conv}\nReturn JSON {"praise": <one warm sentence in English>, "grammar": <one short tip in English>, "vocabulary": <one short tip in English>, "fluency": <one short tip in English>}.`;
      const out = await chat([{ role: "system", content: sys }, { role: "user", content: user }], { json: true });
      return Response.json(JSON.parse(out));
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
