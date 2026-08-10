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
// VOICE (TTS): Google Cloud Text-to-Speech REST API.
//     GOOGLE_TTS_API_KEY       your Google Cloud TTS API key
//     GOOGLE_TTS_DUTCH_FEMALE  e.g. a nl-NL female voice name
//     GOOGLE_TTS_DUTCH_MALE    e.g. a nl-NL male voice name
//     GOOGLE_TTS_DEFAULT       fallback nl-NL voice name

const strip = (u, d) => (u || d).replace(/\/+$/, "");

export const AI = {
  base: strip(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
  chatPath: process.env.OPENAI_CHAT_PATH || "/chat/completions",
  key: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  jsonMode: (process.env.OPENAI_JSON_MODE ?? "1") !== "0",

  // Google Cloud TTS
  googleTTSKey: process.env.GOOGLE_TTS_API_KEY || "",
  googleTTSDefault: process.env.GOOGLE_TTS_DEFAULT || "",
  googleTTSDutchFemale: process.env.GOOGLE_TTS_DUTCH_FEMALE || process.env.GOOGLE_TTS_DEFAULT || "",
  googleTTSDutchMale: process.env.GOOGLE_TTS_DUTCH_MALE || process.env.GOOGLE_TTS_DEFAULT || "",
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

function googleVoiceForRole(voiceRole) {
  if (voiceRole === "female") return AI.googleTTSDutchFemale || AI.googleTTSDefault;
  if (voiceRole === "male") return AI.googleTTSDutchMale || AI.googleTTSDefault;
  return AI.googleTTSDefault;
}

// Google Cloud Text-to-Speech. Returns { buf } on success or { error }; callers
// convert failures to 204 so the browser voice fallback still works.
export async function googleTTS({ text, rate, voiceRole }) {
  if (!AI.googleTTSKey) return { error: "no GOOGLE_TTS_API_KEY" };
  const voice = googleVoiceForRole(voiceRole);
  if (!voice) return { error: "no Google TTS voice configured" };
  let res;
  try {
    res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(AI.googleTTSKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: (text || "").slice(0, 4000) },
        voice: { languageCode: "nl-NL", name: voice },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate || 1 },
      }),
    });
  } catch (e) { return { error: "network " + String(e.message || e).slice(0, 150), voice }; }
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: "http " + res.status + " " + t.slice(0, 200), voice }; }
  const d = await res.json();
  const audio = d?.audioContent;
  if (!audio) return { error: "no audioContent in response", voice };
  return { buf: Buffer.from(audio, "base64"), voice };
}
