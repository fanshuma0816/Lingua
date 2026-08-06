// Provider-agnostic AI config.
// TEXT (lessons + feedback + conversation): any OpenAI-style chat endpoint.
//   MiniMax uses a different path, so the path is configurable.
//   Mainland MiniMax host is api.minimaxi.com (note the extra "i");
//   international is api.minimax.io. The console domain (platform.minimaxi.com)
//   maps to the api.minimaxi.com host.
//     OPENAI_API_KEY     your MiniMax key
//     OPENAI_BASE_URL    https://api.minimaxi.com/v1
//     OPENAI_CHAT_PATH   /chat/completions   (OpenAI-compatible; chatcompletion_v2 is deprecated)
//     OPENAI_MODEL       e.g. MiniMax-M2.7 / MiniMax-Text-01 (confirm the exact id in your console)
//     OPENAI_JSON_MODE   0
// VOICE (TTS): MiniMax T2A v2 (needs a GroupId).
//     MINIMAX_API_KEY    (optional) defaults to OPENAI_API_KEY
//     MINIMAX_GROUP_ID   your GroupId (required for voice)
//     MINIMAX_BASE_URL   https://api.minimaxi.com/v1
//     MINIMAX_TTS_MODEL  speech-02-hd
//     MINIMAX_TTS_VOICE  Dutch_kindhearted_girl
//     MINIMAX_TTS_DUTCH_FEMALE  Dutch_kindhearted_girl
//     MINIMAX_TTS_DUTCH_MALE    Dutch_bossy_leader

const strip = (u, d) => (u || d).replace(/\/+$/, "");

export const AI = {
  base: strip(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  chatPath: process.env.OPENAI_CHAT_PATH || "/chat/completions",
  key: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  jsonMode: (process.env.OPENAI_JSON_MODE ?? "1") !== "0",

  // MiniMax TTS
  mmBase: strip(process.env.MINIMAX_BASE_URL, "https://api.minimaxi.com/v1"),
  mmKey: process.env.MINIMAX_API_KEY || process.env.OPENAI_API_KEY || "",
  mmGroup: process.env.MINIMAX_GROUP_ID || "",
  mmModel: process.env.MINIMAX_TTS_MODEL || "speech-02-hd",
  mmVoice: process.env.MINIMAX_TTS_VOICE || "Dutch_kindhearted_girl", // default single-speaker voice
  mmDutchFemaleVoice: process.env.MINIMAX_TTS_DUTCH_FEMALE || process.env.MINIMAX_TTS_VOICE || "Dutch_kindhearted_girl",
  mmDutchMaleVoice: process.env.MINIMAX_TTS_DUTCH_MALE || "Dutch_bossy_leader",
  mmVoices: (() => { try { return JSON.parse(process.env.MINIMAX_TTS_VOICES || "{}"); } catch (e) { return {}; } })(), // legacy per-language map; not needed for Dutch-only mode
};

// Reasoning models (e.g. MiniMax M-series) wrap output in <think>…</think>.
// Strip it so JSON parsing and chat bubbles stay clean.
function stripThink(s) {
  if (!s) return s;
  let t = String(s);
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");   // paired blocks
  t = t.replace(/^[\s\S]*?<\/think>/i, "");           // stray leading reasoning
  t = t.replace(/<\/?think>/gi, "");                  // leftover tags
  return t.trim();
}

export async function chatComplete(messages, { json = false, temp = 0.6, max = 400 } = {}) {
  // Give reasoning models room to think AND answer (this is a cap, not a target,
  // so non-reasoning models still stop early and cost nothing extra).
  const body = { model: AI.model, temperature: temp, max_tokens: Math.max(max, 1200), messages };
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
  return stripThink(d.choices?.[0]?.message?.content ?? "");
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

// MiniMax T2A v2 call. Returns { buf } on success or { error } (with the real
// reason) on failure — reused by /api/tts and /api/health.
export async function miniMaxTTS({ text, lang, rate, voiceRole }) {
  if (!AI.mmKey) return { error: "no key" };
  if (!AI.mmGroup) return { error: "no MINIMAX_GROUP_ID" };
  const voice = lang === "Dutch"
    ? (voiceRole === "male" ? AI.mmDutchMaleVoice : AI.mmDutchFemaleVoice)
    : (AI.mmVoices[lang] || AI.mmVoice);
  let res;
  try {
    res = await fetch(`${AI.mmBase}/t2a_v2?GroupId=${encodeURIComponent(AI.mmGroup)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI.mmKey}` },
      body: JSON.stringify({
        model: AI.mmModel,
        text: (text || "").slice(0, 4000),
        stream: false,
        output_format: "hex",
        language_boost: MM_LANG_BOOST[lang] || "auto",
        voice_setting: { voice_id: voice, speed: rate || 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });
  } catch (e) { return { error: "network " + String(e.message || e).slice(0, 150), voice }; }
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: "http " + res.status + " " + t.slice(0, 200), voice }; }
  const d = await res.json();
  const hex = d?.data?.audio;
  if (!hex) {
    const br = d.base_resp;
    return { error: br ? ("provider " + br.status_code + " " + (br.status_msg || "")) : "no audio in response", voice };
  }
  return { buf: Buffer.from(hex, "hex"), voice };
}
