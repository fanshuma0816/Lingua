// Small, focused, per-section AI calls. Each request handles ONE screen's worth
// of analysis (a few sentences or words), so it stays fast and never truncates —
// unlike the old one-shot enrichment that failed on long texts.
// Modes: translate | explain | quiz | question
import { AI, chatComplete, parseJSON } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!AI.key) return new Response(null, { status: 204 });
  try {
    const b = await req.json();
    const lang = b.lang || "the target language";
    const level = b.level || "A2";

    // --- translate a handful of sentences (index-aligned, robust) ---
    if (b.mode === "translate") {
      const src = (b.sentences || []).slice(0, 12);
      if (!src.length) return Response.json({ translations: [] });
      const sys = "You are a precise translator. Reply ONLY with minified JSON, no prose.";
      const user = `Translate each ${lang} sentence into natural English. Return JSON {"t":[ ... ]} where t is an array of English translations in the SAME ORDER as the input. Input (${lang}):\n${JSON.stringify(src)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.2, max: 2000 });
      const p = parseJSON(out);
      const t = Array.isArray(p.t) ? p.t : Array.isArray(p.translations) ? p.translations : [];
      return Response.json({ translations: src.map((_, i) => t[i] || null) });
    }

    // --- explain a few words in context (meaning + a NEW example) ---
    if (b.mode === "explain") {
      const items = (b.items || []).slice(0, 6);
      if (!items.length) return Response.json({ items: [] });
      const sys = "You are a warm, precise language teacher. Reply ONLY with minified JSON, no prose.";
      const user = `A ${level} learner of ${lang} is studying these words, each shown with the sentence it appears in.
Return JSON {"items":[{"word":<word>,"pos":<part of speech in English>,"simpleMeaning":<1-3 very simple English words, as used here>,"detail":<one short English explanation, max 16 words>,"meaning":<same idea as simpleMeaning + detail, concise>,"example":<ONE new, simple example sentence in ${lang} using the word, NOT copied from the context>}]} — one object per input word, same order.
Words:\n${JSON.stringify(items)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.4, max: 1600 });
      const p = parseJSON(out);
      return Response.json({ items: Array.isArray(p.items) ? p.items : [] });
    }

    // --- a short comprehension quiz in the target language ---
    if (b.mode === "quiz") {
      const src = (b.sentences || []).slice(0, 10);
      const n = Math.min(3, Math.max(2, b.count || 3));
      const sys = "You are a kind language teacher. Reply ONLY with minified JSON, no prose.";
      const user = `Based on this ${lang} text, write ${n} simple comprehension questions for a ${level} learner.
Return JSON {"items":[{"q":<question in ${lang}>,"options":[{"t":<option in ${lang}>,"ok":<true for exactly ONE correct option>}]}]} with 4 options each, exactly one correct.
Text (${lang} sentences):\n${JSON.stringify(src)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.5, max: 2000 });
      const p = parseJSON(out);
      const items = (Array.isArray(p.items) ? p.items : []).map(it => ({
        q: it.q || null,
        correct: (it.options || []).find(o => o.ok)?.t || "",
        options: (it.options || []).slice(0, 4),
      })).filter(it => it.options.length >= 2);
      return Response.json({ items });
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
