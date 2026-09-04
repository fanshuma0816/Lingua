// Small, focused, per-section AI calls. Each request handles ONE screen's worth
// of analysis (a few sentences or words), so it stays fast and never truncates —
// unlike the old one-shot enrichment that failed on long texts.
// Modes: materials | grade | translate | explain | grammar | quiz | focus
import { AI, chatComplete, parseJSON, googleTranslate } from "../../../lib/ai";
import { cleanText } from "../../../lib/text";
import { cefrIdx, validateForLevel, validateMaterialFit, materialId } from "../../../lib/cefr.mjs";
import { selectTextbookMaterials } from "../../../lib/material-corpus";

export const runtime = "nodejs";
export const maxDuration = 60;
// Generation must never be cached — regenerating should yield genuinely new text.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function durationSpec(label) {
  const nums = String(label || "").match(/\d+/g)?.map(Number) || [];
  // Full-lesson time is capped at 60 min, so tiers never exceed it.
  const min = Math.min(60, nums[0] || 45);
  const max = Math.min(60, nums[1] || min);
  let words = [140, 240], vocab = [10, 18];
  if (max <= 15) { words = [40, 70]; vocab = [4, 6]; }
  else if (max <= 35) { words = [90, 150]; vocab = [7, 12]; }
  return { min, max, words, vocab, target: Math.round((min + max) / 2), label: `${min}-${max}` };
}
function wordCount(text) {
  return (String(text || "").toLowerCase().match(/[\p{L}][\p{L}'’-]{1,}/gu) || []).length;
}

export async function POST(req) {
  try {
    const b = await req.json();
    // Text modes need Vertex AI; the translate mode needs the Cloud API key.
    // Materials can still use the local A1/A2 corpus when live AI is unavailable.
    if (b.mode !== "materials" && !AI.textEnabled && !AI.gcpKey) return new Response(null, { status: 204 });
    const lang = b.lang || "the target language";
    const level = b.level || "A2";

    // --- recommend/generate a few learner-ready materials ---
    if (b.mode === "materials") {
      const duration = b.duration || "25-35 min";
      const spec = durationSpec(duration);
      const goal = b.goal || "General fluency";
      const topics = (Array.isArray(b.topics) ? b.topics : []).filter(Boolean).slice(0, 1);
      const n = Math.min(2, Math.max(1, Number(b.count) || 2));
      const tier = ["comfortable", "balanced"].includes(b.tier) ? b.tier : null;
      const levels = ["A1", "A2", "B1", "B2", "C1"];
      const cur = Math.max(0, levels.indexOf(String(level).slice(0, 2)));
      const targetLevel = levels[cur];
      const capLevel = levels[Math.min(levels.length - 1, cur + 1)]; // i+1 ceiling
      const aboveCapLimit = cur <= 0 ? 2 : cur === 1 ? 3 : cur === 2 ? 4 : 0;
      const mainRange = cur <= 0 ? "A1" : cur === 1 ? "A2/B1" : cur === 2 ? "B1/B2" : `${targetLevel}/${capLevel}`;
      const [wMin, wMax] = spec.words;
      const wMid = Math.round((wMin + wMax) / 2);
      const lengthGuide = `between ${wMin} and ${wMax} words (aim for about ${wMid})`;
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const avoid = (Array.isArray(b.avoid) ? b.avoid : []).filter(Boolean).slice(0, 12);
      const avoidLine = avoid.length ? `Avoid these recently shown titles or texts \u2014 pick clearly different scenarios: ${avoid.join(" | ")}.` : "";
      const topicLine = topics.length
        ? `Light topic preference: ${topics.join(", ")}. Use it only as inspiration; level fit is more important.`
        : "No topic preference. Choose one simple, concrete everyday scenario.";
      const beginnerLine = cur <= 1 ? "Use short sentences, concrete situations, very common words, and little or no subordination." : "";
      const overCapLine = aboveCapLimit
        ? `The main vocabulary body should be ${mainRange}. At most ${aboveCapLimit} natural words may be above ${capLevel}, only when they are easy to infer from context.`
        : `Keep the vocabulary within ${mainRange}.`;
      const hasCjk = s => /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(s || ""));
      const minutesForWords = (wc) => {
        const t = wMax > wMin ? (wc - wMin) / (wMax - wMin) : 0.5;
        const mins = spec.min + (spec.max - spec.min) * Math.max(0, Math.min(1, t));
        return Math.max(spec.min, Math.min(spec.max, Math.round(mins / 5) * 5));
      };
      const lo = Math.round(wMin * 0.85), hi = Math.round(wMax * 1.15);

      const tierPct = { comfortable: "about 10-15%", balanced: "about 15-22%" };
      const buildPrompt = (nonce, extra = "") => (n === 1
        ? `Create 1 short learning material in ${lang} for a CEFR ${targetLevel} learner.
Goal: ${goal}. Full lesson time: ${duration}. ${topicLine}
DIFFICULTY MODEL \u2014 comprehensible input at "i+1":
- ${overCapLine}
- It must validate as ${targetLevel}${capLevel !== targetLevel ? ` or ${capLevel}` : ""}; do NOT return an easier text.
- Difficulty tier "${tier || "balanced"}": ${tierPct[tier] || tierPct.balanced} of words above ${targetLevel}.
LENGTH: the "text" must be ${lengthGuide}. Count the words.
${avoidLine}
${beginnerLine}
For Dutch, the title and text MUST be Dutch only \u2014 never Chinese/English explanations or translations.
Return JSON {"materials":[{"title":<short title in ${lang}>,"source":<one of: Daily story, Dialogue, News explainer, Culture note, Practical situation>,"tier":"${tier || "balanced"}","text":<original text in ${lang}>}]}.
If source is "Dialogue", put each speaker turn on its own line with a short label (e.g. "Sanne: ..."). Otherwise no fake speaker labels; keep quoted speech intact.
Use concrete, specific details, not generic textbook filler. Do not include translations. Variation token: ${nonce}.${extra}`
        : `Create ${n} different short learning materials in ${lang} for a CEFR ${targetLevel} learner.
Goal: ${goal}. Full lesson time: ${duration}. ${topicLine}
DIFFICULTY MODEL \u2014 comprehensible input at "i+1":
- ${overCapLine}
- Every option must validate as ${targetLevel}${capLevel !== targetLevel ? ` or ${capLevel}` : ""}; do NOT return easier texts.
- Option 1 should feel easier: direct, concrete, shorter sentences.
- Option 2 should feel a bit richer: a different scenario, slightly more detail, still level-safe.
LENGTH: each "text" must be ${lengthGuide}. Count the words. The options should be close in length (within ~20%).
${avoidLine}
${beginnerLine}
For Dutch, the title and text MUST be Dutch only \u2014 never Chinese/English explanations or translations.
Return JSON {"materials":[{"title":<short title in ${lang}>,"source":<one of: Daily story, Dialogue, News explainer, Culture note, Practical situation>,"tier":<"comfortable"|"balanced">,"text":<original text in ${lang}>}]}.
If source is "Dialogue", put each speaker turn on its own line with a short label (e.g. "Sanne: ..."). Otherwise no fake speaker labels; keep quoted speech intact.
Use concrete, specific details, not generic textbook filler. Do not include translations. Variation token: ${nonce}.${extra}`);

      const sys = "You are a careful language teacher writing short study texts calibrated to a learner's level. Reply ONLY with minified JSON, no prose.";
      const runOnce = async (nonce, extra) => {
        const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: buildPrompt(nonce, extra) }], { json: true, temp: 0.9, max: n === 1 ? 1200 : 2600 });
        const p = parseJSON(out);
        return (Array.isArray(p.materials) ? p.materials : [])
          .filter(m => m && m.text && !hasCjk(m.title) && !hasCjk(m.text));
      };

      // Validate against the deterministic CEFR analyzer \u2014 never trust the model's
      // self-reported level.
      const textbook = selectTextbookMaterials({ lang, level, topics, avoid, wordRange: [lo, hi], count: n, duration: spec.label, targetMinutes: spec.target, seed: b.nonce || requestId });
      const seen = new Set(textbook.map(m => m.id));
      const accepted = [];
      const usable = [];
      let rejected = 0;
      const consider = (raw) => {
        for (const m of raw) {
          // Analyze the SAME cleaned text the lesson will be built from, so the
          // id, level and annotations stay identical downstream.
          const text = cleanText(m.text || "");
          const wc = wordCount(text);
          if (wc < lo || wc > hi) { rejected++; continue; }
          const v = validateMaterialFit(text, level);
          const id = materialId(text);
          if (seen.has(id)) continue;
          seen.add(id);
          const material = {
            id, title: m.title || null, source: m.source || "AI text", text,
            duration: spec.label, wordCount: wc, targetMinutes: minutesForWords(wc),
            targetUserLevel: targetLevel,
            validatedTextLevel: v.analysis.validatedTextLevel,
            level: v.analysis.validatedTextLevel,       // card badge reads this
            hardWordRatio: v.analysis.hardWordRatio,
            difficultyTier: v.analysis.difficultyTier,
            vocabularyAnnotations: v.analysis.annotations,
            resultSource: "ai",
          };
          if (v.ok) accepted.push(material);
          else {
            rejected++;
            // The deterministic CEFR analyzer is intentionally conservative
            // and has a compact Dutch lexicon. For B2/C1, model-generated
            // learner texts can be useful while being under-scored locally.
            // Keep the best non-dangerous candidates as a fallback instead of
            // showing an empty state after multiple slow retries.
            const loose = validateForLevel(text, level, { maxHardRatio: 0.36 });
            const nearEnough = cefrIdx(loose.analysis.validatedTextLevel) >= Math.max(0, cefrIdx(level) - 1);
            if (loose.ok && nearEnough) {
              usable.push({
                ...material,
                validationWarning: v.reason,
                resultSource: "ai-relaxed",
              });
            }
          }
        }
      };

      if (textbook.length < n && AI.textEnabled) {
        try { consider(await runOnce(requestId, "")); } catch (e) { rejected++; }
      }

      // Order by increasing difficulty and label the two choices accordingly.
      accepted.sort((a, b2) => a.hardWordRatio - b2.hardWordRatio);
      usable.sort((a, b2) => {
        const aGap = Math.abs(cefrIdx(a.validatedTextLevel) - cefrIdx(level));
        const bGap = Math.abs(cefrIdx(b2.validatedTextLevel) - cefrIdx(level));
        return aGap - bGap || a.hardWordRatio - b2.hardWordRatio;
      });
      const tierNames = ["comfortable", "balanced"];
      const final = [...textbook, ...accepted, ...usable]
        .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
        .slice(0, n)
        .map((m, i) => ({ ...m, difficultyTier: n === 1 ? (tier || m.difficultyTier) : (tierNames[i] || m.difficultyTier) }));

      const debug = { requestId, requestedLevel: level, capLevel, aboveCapLimit, materialIds: final.map(m => m.id), resultSource: final.length ? "mixed" : "none", textbook: textbook.length, accepted: accepted.length, relaxed: usable.length, rejected, aiEnabled: !!AI.textEnabled };
      console.log("[analyze:materials]", JSON.stringify(debug));
      return Response.json({ materials: final, debug });
    }

    // --- grade candidate words by strict CEFR level (for the reading check) ---
    if (b.mode === "grade") {
      const words = (Array.isArray(b.words) ? b.words : []).map(w => String(w || "").trim()).filter(Boolean).slice(0, 40);
      if (!words.length) return Response.json({ words: [] });
      const heuristic = () => words.map(w => {
        const L = w.length;
        const lvl = L <= 4 ? "A1" : L <= 6 ? "A2" : L <= 8 ? "B1" : "B2";
        return { word: w, level: lvl };
      });
      if (!AI.textEnabled) return Response.json({ words: heuristic() });
      try {
        const sys = "You are a strict CEFR vocabulary grader. Reply ONLY with minified JSON, no prose.";
        const user = `Grade each ${lang} word by strict CEFR level (one of A1, A2, B1, B2, C1) as it would be classified for a learner of ${lang}.
Judge the base word in ${lang}, not a translation. Be strict: only truly beginner words are A1.
Return JSON {"words":[{"word":<word>,"level":<A1|A2|B1|B2|C1>}]} — one object per input word, SAME order.
Words: ${JSON.stringify(words)}`;
        const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.2, max: 1200 });
        const p = parseJSON(out);
        const graded = Array.isArray(p.words) ? p.words : [];
        const byWord = {};
        graded.forEach(g => { if (g && g.word) byWord[String(g.word).toLowerCase()] = String(g.level || "").toUpperCase().slice(0, 2); });
        const valid = new Set(["A1", "A2", "B1", "B2", "C1"]);
        const h = heuristic();
        return Response.json({ words: words.map((w, i) => ({ word: w, level: valid.has(byWord[w.toLowerCase()]) ? byWord[w.toLowerCase()] : h[i].level })) });
      } catch (e) {
        return Response.json({ words: heuristic() });
      }
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
Return JSON {"items":[{"word":<word>,"pos":<part of speech in English>,"simpleMeaning":<1-4 very simple ${explanationLanguage} words, as used here>,"detail":<one short ${explanationLanguage} explanation, max 16 words>,"meaning":<same idea as simpleMeaning + detail, concise>,"lemma":<base dictionary form in ${lang}, or null>,"formLabel":<short English form label, e.g. "third-person singular present", or null>,"formExplanation":<one short ${explanationLanguage} explanation of the form, or null>,"example":<ONE new, simple example sentence in ${lang} using the word, NOT copied from the context>,"exampleTranslation":<natural ${explanationLanguage} translation of that example sentence>}]} — one object per input word, same order.
For Dutch verbs, always include lemma, formLabel, and formExplanation. For non-verbs, use null unless there is a very obvious beginner-level form.
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
            lemma: it.lemma || null,
            formLabel: it.formLabel || null,
            formExplanation: it.formExplanation || null,
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
Explain EXACTLY ONE grammar point \u2014 the single most useful one for a ${level} learner in THIS sentence.
Use ${feedbackLanguage} for "point" and "explain". Keep each explanation under 22 words.
Give exactly 3 short new ${lang} example sentences for each grammar point, with natural ${feedbackLanguage} translations.
If the sentence is very simple, return one useful review point rather than inventing advanced grammar.
If ${lang} is Dutch and there is a clear Netherlands Dutch vs Belgian Dutch difference relevant to this sentence or examples, mention it briefly in ${feedbackLanguage}. If there is no relevant difference, do not mention Belgium.
Do not repeat the original sentence as an example.
Return JSON {"items":[{"point":<short label>,"explain":<level-specific explanation>,"examples":[{"sentence":<new sentence in ${lang}>,"translation":<translation in ${feedbackLanguage}>}]}]}.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, temp: 0.35, max: 1000 });
      const p = parseJSON(out);
      return Response.json({ items: Array.isArray(p.items) ? p.items.slice(0, 1) : [] });
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
