// Small, focused, per-section AI calls. Each request handles ONE screen's worth
// of analysis (a few sentences or words), so it stays fast and never truncates —
// unlike the old one-shot enrichment that failed on long texts.
// Modes: translate | explain | grammar | quiz | question
import { AI, chatComplete, parseJSON } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!AI.key) return new Response(null, { status: 204 });
  try {
    const b = await req.json();
    const lang = b.lang || "the target language";
    const level = b.level || "A2";

    // --- recommend/generate a few learner-ready materials ---
    if (b.mode === "materials") {
      const duration = b.duration || "45-60 min";
      const goal = b.goal || "General fluency";
      const topics = (Array.isArray(b.topics) && b.topics.length ? b.topics : ["daily life"]).slice(0, 3);
      const lengthGuide = String(duration).includes("20") ? "70-120 words" : String(duration).includes("45") ? "140-240 words" : "300-520 words";
      const sys = "You are a careful language teacher selecting short study texts. Reply ONLY with minified JSON, no prose.";
      const user = `Create 3 different short learning materials in ${lang} for a ${level} learner.
Goal: ${goal}. Full lesson time: ${duration}. Learner interests: ${topics.join(", ")}.
The full lesson includes translation, vocabulary, sentence work, practice, mistakes, and repetition; therefore the source text itself should be about ${lengthGuide}, not as long as the full study time.
Each material should be suitable for turning into a listening/reading/vocabulary lesson.
Return JSON {"materials":[{"title":<short title in ${lang}>,"source":<one of: Daily story, Dialogue, News explainer, Culture note, Practical situation>,"text":<original text in ${lang}, natural and level-appropriate>}]}.
If source is "Dialogue", format each turn with a short speaker label, for example "Sanne: ..." and "Amir: ...".
Use concrete details, not generic textbook filler. Do not include translations.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.7, max: 2600 });
      const p = parseJSON(out);
      return Response.json({ materials: Array.isArray(p.materials) ? p.materials.slice(0, 3) : [] });
    }

    // --- translate a handful of sentences (index-aligned, robust) ---
    if (b.mode === "translate") {
      const src = (b.sentences || []).slice(0, 12);
      if (!src.length) return Response.json({ translations: [] });
      const translationLanguage = b.translationLanguage || "English";
      const sys = "You are a precise translator. Reply ONLY with minified JSON, no prose.";
      const user = `Translate each ${lang} sentence into natural ${translationLanguage}. Return JSON {"t":[ ... ]} where t is an array of ${translationLanguage} translations in the SAME ORDER as the input. Input (${lang}):\n${JSON.stringify(src)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.2, max: 2000 });
      const p = parseJSON(out);
      const t = Array.isArray(p.t) ? p.t : Array.isArray(p.translations) ? p.translations : [];
      return Response.json({ translations: src.map((_, i) => t[i] || null) });
    }

    // --- explain a few words in context (meaning + a NEW example) ---
    if (b.mode === "explain") {
      const items = (b.items || []).slice(0, 6);
      if (!items.length) return Response.json({ items: [] });
      const explanationLanguage = b.explanationLanguage || "English";
      const sys = "You are a warm, precise language teacher. Reply ONLY with minified JSON, no prose.";
      const user = `A ${level} learner of ${lang} is studying these words, each shown with the sentence it appears in.
Return JSON {"items":[{"word":<word>,"pos":<part of speech in English>,"simpleMeaning":<1-4 very simple ${explanationLanguage} words, as used here>,"detail":<one short ${explanationLanguage} explanation, max 16 words>,"meaning":<same idea as simpleMeaning + detail, concise>,"example":<ONE new, simple example sentence in ${lang} using the word, NOT copied from the context>}]} — one object per input word, same order.
Words:\n${JSON.stringify(items)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.4, max: 1600 });
      const p = parseJSON(out);
      return Response.json({ items: Array.isArray(p.items) ? p.items : [] });
    }

    // --- explain grammar in the current sentence, matched to the learner level ---
    if (b.mode === "grammar") {
      const sentence = String(b.sentence || "").slice(0, 500);
      if (!sentence) return Response.json({ items: [] });
      const feedbackLanguage = b.feedbackLanguage || "English";
      const translation = b.translation ? `Known translation: ${b.translation}` : "";
      const sys = "You are a diagnostic Dutch teacher. Reply ONLY with minified JSON, no prose.";
      const user = `A ${level} learner is studying this ${lang} sentence:
${sentence}
${translation}
Explain 1-2 grammar points that are actually useful for this specific learner and this specific sentence.
Use ${feedbackLanguage} for "point" and "explain". Keep each explanation under 22 words.
Give exactly 3 short new ${lang} example sentences for each grammar point, with natural ${feedbackLanguage} translations.
If the sentence is very simple, return one useful review point rather than inventing advanced grammar.
Do not repeat the original sentence as an example.
Return JSON {"items":[{"point":<short label>,"explain":<level-specific explanation>,"examples":[{"sentence":<new sentence in ${lang}>,"translation":<translation in ${feedbackLanguage}>}]}]}.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.35, max: 1800 });
      const p = parseJSON(out);
      return Response.json({ items: Array.isArray(p.items) ? p.items.slice(0, 2) : [] });
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
