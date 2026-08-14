// Small, focused, per-section AI calls. Each request handles ONE screen's worth
// of analysis (a few sentences or words), so it stays fast and never truncates —
// unlike the old one-shot enrichment that failed on long texts.
// Modes: translate | explain | grammar | quiz | question
import { AI, chatComplete, parseJSON, googleTranslate } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

function durationSpec(label) {
  const nums = String(label || "").match(/\d+/g)?.map(Number) || [];
  // Full-lesson time is capped at 60 min, so tiers never exceed it.
  const min = Math.min(60, nums[0] || 45);
  const max = Math.min(60, nums[1] || min);
  let words = [140, 240], vocab = [10, 18];
  if (max <= 30) { words = [70, 120]; vocab = [6, 10]; }
  else if (max <= 45) { words = [110, 180]; vocab = [8, 14]; }
  return { min, max, words, vocab, target: Math.round((min + max) / 2), label: `${min}-${max}` };
}
function wordCount(text) {
  return (String(text || "").toLowerCase().match(/[\p{L}][\p{L}'’-]{1,}/gu) || []).length;
}

export async function POST(req) {
  // Text modes need Vertex AI; the translate mode needs the Cloud API key.
  // Bail out early only if neither is configured.
  if (!AI.textEnabled && !AI.gcpKey) return new Response(null, { status: 204 });
  try {
    const b = await req.json();
    const lang = b.lang || "the target language";
    const level = b.level || "A2";

    // --- recommend/generate a few learner-ready materials ---
    if (b.mode === "materials") {
      const duration = b.duration || "45-60 min";
      const spec = durationSpec(duration);
      const goal = b.goal || "General fluency";
      const topics = (Array.isArray(b.topics) && b.topics.length ? b.topics : ["daily life"]).slice(0, 3);
      const levels = ["A1", "A2", "B1", "B2", "C1"];
      const cur = Math.max(0, levels.indexOf(String(level).slice(0, 2)));
      // Pin every material to ONE CEFR level so the three options are equally
      // hard \u2014 the learner picks by topic/format, not by an accidental
      // difficulty spread.
      const targetLevel = levels[cur];
      const [wMin, wMax] = spec.words;
      const wMid = Math.round((wMin + wMax) / 2);
      const lengthGuide = `between ${wMin} and ${wMax} words (aim for about ${wMid})`;
      const sys = "You are a careful language teacher selecting short study texts. Reply ONLY with minified JSON, no prose.";
      const user = `Create 3 different short learning materials in ${lang} for a CEFR ${targetLevel} learner.
Goal: ${goal}. Full lesson time: ${duration}. Learner interests: ${topics.join(", ")}.
HARD CONSTRAINTS \u2014 every one of the 3 materials must obey these, with no exceptions:
1) Length: each "text" must be ${lengthGuide}. Count the words. Do NOT return a text shorter than ${wMin} or longer than ${wMax} words. All three texts must be close in length to each other (within ~20%).
2) Difficulty: EVERY material must sit at exactly CEFR ${targetLevel}. Use the same vocabulary range and sentence complexity across all three. Do not make one easier or harder than the others. Do not exceed ${targetLevel}.
The three materials should differ by TOPIC and FORMAT, never by length or difficulty.
Each material should be suitable for turning into a listening/reading/vocabulary lesson.
For Dutch, the title and original text MUST be Dutch only. Never put Chinese, English explanations, or translations inside title or text.
Return JSON {"materials":[{"title":<short title in ${lang}>,"source":<one of: Daily story, Dialogue, News explainer, Culture note, Practical situation>,"level":"${targetLevel}","text":<original text in ${lang}, natural and level-appropriate>}]}.
If source is "Dialogue", format each speaker turn on its own line with a short speaker label, for example "Sanne: ..." and "Amir: ...".
If source is not "Dialogue", do not write fake speaker labels. Keep quoted speech intact, for example "Dank u wel. Tot ziens." must remain one quoted utterance.
Use concrete details, not generic textbook filler. Do not include translations.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.7, max: 2600 });
      const p = parseJSON(out);
      const hasCjk = s => /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(s || ""));
      // Map an actual word count to a full-lesson estimate inside the tier, so the
      // displayed time matches the specific text the learner will study.
      const minutesForWords = (wc) => {
        const t = wMax > wMin ? (wc - wMin) / (wMax - wMin) : 0.5;
        const mins = spec.min + (spec.max - spec.min) * Math.max(0, Math.min(1, t));
        return Math.max(spec.min, Math.min(spec.max, Math.round(mins / 5) * 5));
      };
      // Keep the word range soft on the edges (\u00b115%) so we rarely discard a good
      // text, but still filter out anything wildly off-spec.
      const lo = Math.round(wMin * 0.85), hi = Math.round(wMax * 1.15);
      let cleaned = (Array.isArray(p.materials) ? p.materials : [])
        .filter(m => m && m.text && !hasCjk(m.title) && !hasCjk(m.text))
        .map(m => { const wc = wordCount(m.text); return { ...m, duration: spec.label, wordCount: wc, targetMinutes: minutesForWords(wc), level: targetLevel }; });
      const inRange = cleaned.filter(m => m.wordCount >= lo && m.wordCount <= hi);
      // Prefer in-range texts; if too few survived, fall back to whatever we have
      // (sorted by how close they are to the target length) rather than returning nothing.
      const ordered = inRange.length >= Math.min(3, cleaned.length)
        ? inRange
        : cleaned.sort((a, b) => Math.abs(a.wordCount - wMid) - Math.abs(b.wordCount - wMid));
      return Response.json({ materials: ordered.slice(0, 3) });
    }

    // --- translate a handful of sentences (Google Cloud Translation v2) ---
    if (b.mode === "translate") {
      const src = (b.sentences || []).slice(0, 12);
      if (!src.length) return Response.json({ translations: [] });
      if (!AI.gcpKey) return new Response(null, { status: 204 });
      const translationLanguage = b.translationLanguage || "English";
      const r = await googleTranslate(src, { target: translationLanguage, source: lang });
      if (r.error) return new Response(null, { status: 204 });
      return Response.json({ translations: src.map((_, i) => r.translations[i] || null) });
    }

    // --- explain a few words in context (meaning + a NEW example + its translation) ---
    if (b.mode === "explain") {
      const items = (b.items || []).slice(0, 6);
      if (!items.length) return Response.json({ items: [] });
      const explanationLanguage = b.explanationLanguage || "English";
      const words = items.map(it => String((it && it.word) || it || "")).filter(Boolean);

      // 1) Ask the model for meanings + fresh examples (skip if Vertex isn't set up).
      let aiItems = [];
      if (AI.textEnabled) {
        try {
          const sys = "You are a warm, precise language teacher. Reply ONLY with minified JSON, no prose.";
          const user = `A ${level} learner of ${lang} is studying these words, each shown with the sentence it appears in.
Return JSON {"items":[{"word":<word>,"pos":<part of speech in English>,"simpleMeaning":<1-4 very simple ${explanationLanguage} words, as used here>,"detail":<one short ${explanationLanguage} explanation, max 16 words>,"meaning":<same idea as simpleMeaning + detail, concise>,"example":<ONE new, simple example sentence in ${lang} using the word, NOT copied from the context>,"exampleTranslation":<natural ${explanationLanguage} translation of that example sentence>}]} — one object per input word, same order.
Words:\n${JSON.stringify(items)}`;
          const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.4, max: 1800 });
          const p = parseJSON(out);
          aiItems = Array.isArray(p.items) ? p.items : [];
        } catch (e) { aiItems = []; }
      }
      const byWord = {};
      aiItems.forEach(it => { if (it && it.word) byWord[String(it.word).toLowerCase()] = it; });

      // 2) Guarantee every word has a real meaning: whenever the model didn't give
      //    one (Vertex unavailable, quota, or it just echoed the word), fall back to
      //    Google Translate — which uses the separate Cloud API key, so vocabulary
      //    is always translated even when the text model is down.
      const needMeaning = words.filter(w => {
        const it = byWord[w.toLowerCase()];
        const m = String((it && (it.simpleMeaning || it.meaning)) || "").trim();
        return !m || m.toLowerCase() === w.toLowerCase();
      });
      const wordTr = {};
      if (needMeaning.length && AI.gcpKey) {
        const r = await googleTranslate(needMeaning, { target: explanationLanguage, source: lang });
        if (!r.error) needMeaning.forEach((w, i) => { if (r.translations[i]) wordTr[w.toLowerCase()] = r.translations[i]; });
      }

      // 3) Make sure every example sentence carries a translation too.
      const needExTr = aiItems.filter(it => it && it.example && !String(it.exampleTranslation || "").trim());
      if (needExTr.length && AI.gcpKey) {
        const r = await googleTranslate(needExTr.map(it => it.example), { target: explanationLanguage, source: lang });
        if (!r.error) needExTr.forEach((it, i) => { it.exampleTranslation = r.translations[i] || ""; });
      }

      const outItems = words.map(w => {
        const it = byWord[w.toLowerCase()] || {};
        const modelMeaning = String(it.simpleMeaning || it.meaning || "").trim();
        const usableModelMeaning = modelMeaning && modelMeaning.toLowerCase() !== w.toLowerCase() ? modelMeaning : "";
        const simpleMeaning = usableModelMeaning || wordTr[w.toLowerCase()] || null;
        return {
          word: w,
          pos: it.pos || null,
          simpleMeaning,
          detail: it.detail || null,
          meaning: it.meaning || simpleMeaning || null,
          example: it.example || null,
          exampleTranslation: it.exampleTranslation || null,
        };
      });
      return Response.json({ items: outItems });
    }

    // --- explain grammar in the current sentence, matched to the learner level ---
    if (b.mode === "grammar") {
      const sentence = String(b.sentence || "").slice(0, 500);
      if (!sentence) return Response.json({ items: [] });
      const feedbackLanguage = b.feedbackLanguage || "English";
      const translation = b.translation ? `Known translation: ${b.translation}` : "";
      const sys = "You are a diagnostic Dutch teacher. Reply ONLY with minified JSON, no prose.";
      const covered = Array.isArray(b.covered) && b.covered.length ? `Already covered grammar points, DO NOT repeat these unless the sentence cannot be explained otherwise: ${b.covered.slice(0, 8).join("; ")}.` : "";
      const user = `A ${level} learner is studying this ${lang} sentence:
${sentence}
${translation}
${covered}
Explain 1-2 grammar points that are actually useful for this specific learner and this specific sentence.
Use ${feedbackLanguage} for "point" and "explain". Keep each explanation under 22 words.
Give exactly 3 short new ${lang} example sentences for each grammar point, with natural ${feedbackLanguage} translations.
If the sentence is very simple, return one useful review point rather than inventing advanced grammar.
If ${lang} is Dutch and there is a clear Netherlands Dutch vs Belgian Dutch difference relevant to this sentence or examples, mention it briefly in ${feedbackLanguage}. If there is no relevant difference, do not mention Belgium.
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

    if (b.mode === "focus") {
      const src = (b.sentences || []).slice(0, 24);
      const vocab = (b.vocab || []).slice(0, 30);
      const feedbackLanguage = b.feedbackLanguage || "English";
      const sys = "You are a precise language-learning curriculum designer. Reply ONLY with minified JSON.";
      const user = `A ${level} learner of ${lang} will study this text.
Pick today's top learning points: vocabulary and grammar that are exactly useful at this level or one level above.
Return no more than 8 vocabulary items and no more than 3 grammar points.
Also choose up to 10 important source sentences that are worth recall practice later.
Use ${feedbackLanguage} for explanations/translations, but keep source sentences and example sentences in ${lang}.
Return JSON {"vocab":[{"word":<${lang} word or phrase>,"level":<CEFR like A2/B1>,"reason":<short ${feedbackLanguage} reason>}],"grammar":[{"point":<short ${feedbackLanguage} label>,"level":<CEFR>,"reason":<short ${feedbackLanguage} reason>}],"recallSentences":[<exact source sentence from the input>]}.
Source sentences: ${JSON.stringify(src)}
Candidate vocabulary: ${JSON.stringify(vocab)}`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.35, max: 2200 });
      const p = parseJSON(out);
      return Response.json({
        vocab: Array.isArray(p.vocab) ? p.vocab.slice(0, 8) : [],
        grammar: Array.isArray(p.grammar) ? p.grammar.slice(0, 3) : [],
        recallSentences: Array.isArray(p.recallSentences) ? p.recallSentences.slice(0, 10) : [],
      });
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}
