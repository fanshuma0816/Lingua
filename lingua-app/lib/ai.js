// Google-only AI backend.
//   TEXT (lessons, grammar analysis, feedback, conversation): Gemini on
//     Google Cloud Vertex AI via the @google/genai SDK.
//   TRANSLATION: Google Cloud Translation API v2 (REST, API key).
//   VOICE (TTS): Google Cloud Text-to-Speech API v1 (REST, API key).
//
// Server-only credentials (never expose these to the client):
//   Gemini text can authenticate with a Vercel GEMINI_API_KEY or a Google Cloud
//   service account / ADC, and it always uses Vertex AI location "global":
//     GEMINI_API_KEY                         API key for Gemini / Vertex AI
//     GCP_PROJECT_ID / GOOGLE_PROJECT_ID     GCP project id (defaults to lingua-tts-504817)
//     GCP_SERVICE_ACCOUNT_KEY              full service-account JSON string (used on Vercel)
//        (also accepts GOOGLE_APPLICATION_CREDENTIALS_JSON / GOOGLE_CREDENTIALS /
//         GCP_SERVICE_ACCOUNT_JSON — raw JSON or base64)
//     GOOGLE_APPLICATION_CREDENTIALS       path to a JSON key file (local/dev)
//     VERTEX_MODEL / GEMINI_MODEL          model id (defaults to gemini-3.7-flash)
//   GCP_API_KEY   Google Cloud API key with Cloud Translation + Cloud TTS enabled.
// Optional:
//   GOOGLE_TTS_DUTCH_FEMALE   override the nl-NL female voice
//   GOOGLE_TTS_DUTCH_MALE     override the nl-NL male voice

import { GoogleGenAI } from "@google/genai";

// Resolve service-account credentials from the environment. Returns a parsed
// credentials object for Google Auth, or null to let the SDK fall back to
// Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS file path).
function resolveServiceAccount() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY
    || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    || process.env.GOOGLE_CREDENTIALS
    || process.env.GCP_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    || "";
  const tryParse = (s) => { try { const o = JSON.parse(s); return o && o.client_email ? o : null; } catch { return null; } };
  if (raw) {
    const t = raw.trim();
    if (t.startsWith("{")) { const o = tryParse(t); if (o) return o; }
    // Support base64-encoded JSON (handy for single-line Vercel env values).
    try { const dec = Buffer.from(t, "base64").toString("utf8"); const o = tryParse(dec); if (o) return o; } catch { /* ignore */ }
  }
  return null;
}

const SERVICE_ACCOUNT = resolveServiceAccount();

export const AI = {
  gcpKey: process.env.GCP_API_KEY || "",                                  // Cloud Translation + Cloud TTS
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  project: process.env.GCP_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || (SERVICE_ACCOUNT && SERVICE_ACCOUNT.project_id) || "lingua-tts-504817",
  location: "global",
  model: process.env.VERTEX_MODEL || process.env.GEMINI_MODEL || "gemini-3.7-flash",
  textEnabled: !!(
    process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || SERVICE_ACCOUNT
    || process.env.GOOGLE_APPLICATION_CREDENTIALS
  ),
};

// ---- Gemini / Vertex AI client (lazy singleton) ----
let _genaiClient = null;
function getGenAIClient() {
  if (!AI.textEnabled) return null;
  if (_genaiClient) return _genaiClient;
  // In @google/genai Node, API-key Vertex Express mode uses the global
  // aiplatform endpoint and rejects project/location constructor fields.
  const opts = AI.geminiApiKey
    ? { vertexai: true, apiKey: AI.geminiApiKey }
    : { vertexai: true, project: AI.project, location: AI.location };
  if (!AI.geminiApiKey && SERVICE_ACCOUNT) {
    opts.googleAuthOptions = { credentials: SERVICE_ACCOUNT, projectId: AI.project };
  }
  _genaiClient = new GoogleGenAI(opts);
  return _genaiClient;
}

// Some models can wrap reasoning in <think>…</think>; strip it so JSON parsing
// and chat bubbles stay clean.
function stripThink(s) {
  if (!s) return s;
  let t = String(s);
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  t = t.replace(/^[\s\S]*?<\/think>/i, "");
  t = t.replace(/<\/?think>/gi, "");
  return t.trim();
}

function buildGeminiRequest(messages, { json = false, temp = 0.6, max = 1200 } = {}) {
  const list = Array.isArray(messages) ? messages : [{ role: "user", content: String(messages || "") }];
  const sys = list.filter(m => m.role === "system").map(m => m.content).join("\n\n").trim();
  const contents = list
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content ?? "") }] }));

  const config = {
    maxOutputTokens: Math.max(max, 1200),
  };
  if (json) config.responseMimeType = "application/json";
  if (sys) config.systemInstruction = sys;
  // Gemini 3.x rejects deprecated sampling parameters. Keep temperature only
  // for older override models.
  if (!/^gemini-3(?:[.-]|$)/i.test(AI.model) && typeof temp === "number") config.temperature = temp;

  return {
    model: AI.model,
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: sys || "" }] }],
    config,
  };
}

// Chat/generation via Gemini on Vertex AI. Accepts the same {role, content} message array
// the rest of the app already uses ("system" → systemInstruction, "assistant" → model).
export async function geminiComplete(messages, { json = false, temp = 0.6, max = 1200 } = {}) {
  let text = "";
  for await (const chunk of geminiStream(messages, { json, temp, max })) text += chunk;
  return stripThink(text);
}

export async function* geminiStream(messages, { json = false, temp = 0.6, max = 1200 } = {}) {
  const client = getGenAIClient();
  if (!client) throw new Error("Gemini on Vertex AI not configured (missing GEMINI_API_KEY or Google credentials)");

  const response = await client.models.generateContentStream(buildGeminiRequest(messages, { json, temp, max }));
  for await (const chunk of response) {
    const text = chunk?.text || "";
    if (text) yield text;
  }
}

// Backwards-compatible name used across the routes.
export const chatComplete = geminiComplete;

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

// ---- Language helpers ----
const ISO = {
  English: "en", Chinese: "zh", "Mandarin Chinese": "zh", Dutch: "nl",
  Spanish: "es", French: "fr", German: "de", Italian: "it", Portuguese: "pt",
  Japanese: "ja", Korean: "ko", Arabic: "ar", Russian: "ru",
};
function isoCode(name) {
  if (!name) return "";
  const n = String(name).trim();
  return ISO[n] || n.slice(0, 2).toLowerCase();
}
function decodeEntities(s) {
  return String(s || "")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}

// Google Cloud Translation API v2 (REST). Returns { translations } in the SAME
// order as the input, or { error }. Callers turn failures into a 204 so the app
// keeps working without translations.
export async function googleTranslate(texts, { target, source } = {}) {
  if (!AI.gcpKey) return { error: "no GCP_API_KEY" };
  const q = (Array.isArray(texts) ? texts : [texts]).map(x => String(x ?? ""));
  if (!q.length || q.every(s => !s.trim())) return { translations: q.map(() => "") };
  const body = { q, target: isoCode(target) || "en", format: "text" };
  const src = isoCode(source);
  if (src && src !== body.target) body.source = src;

  let res;
  try {
    res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(AI.gcpKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) { return { error: "network " + String(e.message || e).slice(0, 150) }; }
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: "http " + res.status + " " + t.slice(0, 200) }; }
  const d = await res.json();
  const arr = d?.data?.translations || [];
  return { translations: q.map((_, i) => decodeEntities(arr[i]?.translatedText || "")) };
}

// ---- Text-to-Speech ----
// Learning-language → BCP-47 code. The app teaches Dutch, so nl-NL is the norm;
// en-US-Neural2-F is the ultimate fallback voice.
const TTS_LANG = {
  Dutch: "nl-NL", English: "en-US", Spanish: "es-ES", French: "fr-FR",
  German: "de-DE", Italian: "it-IT", Portuguese: "pt-PT", Japanese: "ja-JP",
  Korean: "ko-KR", "Mandarin Chinese": "cmn-CN", Arabic: "ar-XA", Russian: "ru-RU",
};
const VOICES = {
  "nl-NL": { female: process.env.GOOGLE_TTS_DUTCH_FEMALE || "nl-NL-Wavenet-D", male: process.env.GOOGLE_TTS_DUTCH_MALE || "nl-NL-Wavenet-C" },
  "en-US": { female: "en-US-Neural2-F", male: "en-US-Neural2-D" },
  "es-ES": { female: "es-ES-Neural2-A", male: "es-ES-Neural2-B" },
  "fr-FR": { female: "fr-FR-Neural2-A", male: "fr-FR-Neural2-B" },
  "de-DE": { female: "de-DE-Neural2-A", male: "de-DE-Neural2-B" },
  "it-IT": { female: "it-IT-Neural2-A", male: "it-IT-Neural2-C" },
};
const FALLBACK_VOICE = "en-US-Neural2-F";
function pickVoice(lang, voiceRole) {
  const code = TTS_LANG[lang] || "en-US";
  const set = VOICES[code];
  if (!set) return { code: "en-US", name: FALLBACK_VOICE };
  return { code, name: voiceRole === "male" ? set.male : set.female };
}

// Google Cloud Text-to-Speech v1 (REST). Returns { buf, audioBase64, voice } on
// success or { error }; callers convert failures to 204 so the browser voice
// fallback still works.
export async function googleTTS({ text, lang, rate, voiceRole }) {
  if (!AI.gcpKey) return { error: "no GCP_API_KEY" };
  const { code, name } = pickVoice(lang, voiceRole);
  let res;
  try {
    res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(AI.gcpKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: (text || "").slice(0, 4000) },
        voice: { languageCode: code, name },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate || 1 },
      }),
    });
  } catch (e) { return { error: "network " + String(e.message || e).slice(0, 150), voice: name }; }
  if (!res.ok) { const t = await res.text().catch(() => ""); return { error: "http " + res.status + " " + t.slice(0, 200), voice: name }; }
  const d = await res.json();
  const audio = d?.audioContent;
  if (!audio) return { error: "no audioContent in response", voice: name };
  return { buf: Buffer.from(audio, "base64"), audioBase64: audio, voice: name };
}
