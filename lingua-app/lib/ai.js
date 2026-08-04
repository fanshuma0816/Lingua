// Provider-agnostic AI config.
// TEXT (lessons + feedback + conversation): any OpenAI-style chat endpoint.
//   MiniMax uses a different path, so the path is configurable.
//     OPENAI_API_KEY     your MiniMax key
//     OPENAI_BASE_URL    https://api.minimaxi.chat/v1
//     OPENAI_CHAT_PATH   /text/chatcompletion_v2
//     OPENAI_MODEL       e.g. MiniMax-Text-01  (confirm the exact id in your console)
//     OPENAI_JSON_MODE   0   (MiniMax may not support strict JSON mode)
// VOICE (TTS): MiniMax T2A v2 (needs a GroupId).
//     MINIMAX_API_KEY    (optional) defaults to OPENAI_API_KEY
//     MINIMAX_GROUP_ID   your GroupId (required for voice)
//     MINIMAX_BASE_URL   https://api.minimaxi.chat/v1
//     MINIMAX_TTS_MODEL  speech-02-hd
//     MINIMAX_TTS_VOICE  a voice_id (e.g. female-shaonv)

const strip = (u, d) => (u || d).replace(/\/+$/, "");

export const AI = {
  base: strip(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  chatPath: process.env.OPENAI_CHAT_PATH || "/chat/completions",
  key: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  jsonMode: (process.env.OPENAI_JSON_MODE ?? "1") !== "0",

  // MiniMax TTS
  mmBase: strip(process.env.MINIMAX_BASE_URL, "https://api.minimaxi.chat/v1"),
  mmKey: process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY || "",
  mmGroup: process.env.MINIMAX_GROUP_ID || "",
  mmModel: process.env.MINIMAX_TTS_MODEL || "speech-02-hd",
  mmVoice: process.env.MINIMAX_TTS_VOICE || "female-shaonv",          // fallback voice
  mmVoices: (() => { try { return JSON.parse(process.env.MINIMAX_TTS_VOICES || "{}"); } catch (e) { return {}; } })(), // optional per-language: {"Dutch":"id","Japanese":"id"}
};

export async function chatComplete(messages, { json = false, temp = 0.6, max = 400 } = {}) {
  const body = { model: AI.model, temperature: temp, max_tokens: max, messages };
  if (json && AI.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(AI.base + AI.chatPath, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("llm " + res.status + " " + t.slice(0, 300));
  }
  const d = await res.json();
  // MiniMax returns errors as HTTP 200 with a base_resp — surface them.
  const br = d.base_resp;
  if (br && br.status_code && br.status_code !== 0) {
    throw new Error("provider " + br.status_code + " " + (br.status_msg || ""));
  }
  return d.choices?.[0]?.message?.content ?? "";
}

// Tolerant JSON parse: strip ``` fences / surrounding prose.
export function parseJSON(s) {
  if (!s) throw new Error("empty response");
  let t = String(s).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{"), last = t.lastIndexOf("}");
  if (first > 0 || last < t.length - 1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

// Map our language names to MiniMax language_boost values (improves pronunciation).
export const MM_LANG_BOOST = {
  "Mandarin Chinese": "Chinese", English: "English", Spanish: "Spanish", French: "French",
  German: "German", Italian: "Italian", Portuguese: "Portuguese", Dutch: "Dutch",
  Japanese: "Japanese", Korean: "Korean", Arabic: "Arabic", Russian: "Russian",
};
