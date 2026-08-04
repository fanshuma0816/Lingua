// Provider-agnostic LLM config. Works with OpenAI OR any OpenAI-compatible
// endpoint (most Chinese providers offer one). Point it at your provider with:
//   OPENAI_BASE_URL   e.g. https://api.your-provider.com/v1
//   OPENAI_API_KEY    your key
//   OPENAI_MODEL      the model name your provider expects
// If your provider rejects response_format, set OPENAI_JSON_MODE=0.

const strip = (u, d) => (u || d).replace(/\/+$/, "");

export const AI = {
  base: strip(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  key: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  jsonMode: (process.env.OPENAI_JSON_MODE ?? "1") !== "0",
  ttsBase: strip(process.env.OPENAI_TTS_BASE_URL || process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  ttsKey: process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || "",
  ttsModel: process.env.OPENAI_TTS_MODEL || "tts-1",
  ttsVoice: process.env.OPENAI_TTS_VOICE || "alloy",
};

export async function chatComplete(messages, { json = false, temp = 0.6, max = 400 } = {}) {
  const body = { model: AI.model, temperature: temp, max_tokens: max, messages };
  if (json && AI.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(AI.base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("llm " + res.status + " " + t.slice(0, 300));
  }
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}

// Tolerant JSON parse: some providers wrap JSON in ```json fences.
export function parseJSON(s) {
  if (!s) throw new Error("empty response");
  let t = String(s).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{"), last = t.lastIndexOf("}");
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}
