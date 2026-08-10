// Server-side lesson builder.
// Always returns a valid lesson from a deterministic mock; when OPENAI_API_KEY
// is set, enrich() upgrades the simulated parts (translations, word meanings +
// fresh examples, target-language quiz) with real model output.

import { AI, chatComplete, parseJSON } from "./ai";

const STOP = new Set(("the a an and or but of to in on for with at by from as is are was were be been being this that these those it its i you he she we they my your our their not no so if then than into about over under out up down el la los las de que y a en un una por con para se su lo le les des du le la un une et ou de à dans pour qui ne pas ce cette der die das und ist im den").split(" "));
const POS = ["noun", "verb", "adjective", "adverb", "phrase"];
export const LEVELS = ["A1 — Beginner", "A2 — Elementary", "B1 — Intermediate", "B2 — Upper-intermediate", "C1 — Advanced"];

const TOPIC_KEYWORDS = {
  Technology: ["technology","computer","software","internet","digital","data","robot","device","online","machine","algorithm","artificial","intelligence"],
  Environment: ["climate","energy","environment","solar","renewable","carbon","pollution","nature","planet","sustainable","emissions","wind","ecosystem","forest"],
  Health: ["health","medical","doctor","disease","brain","mental","exercise","diet","patient","medicine","wellness","sleep","body"],
  Business: ["business","company","market","money","economy","finance","invest","startup","customer","profit","trade","price","industry"],
  Travel: ["travel","country","city","trip","journey","flight","hotel","tourist","abroad","destination","adventure"],
  Food: ["food","cook","recipe","meal","restaurant","kitchen","taste","dish","ingredient","dinner","flavour"],
  Education: ["school","student","learn","teacher","study","education","university","class","knowledge","course","exam"],
  Sports: ["game","team","player","sport","match","football","soccer","score","training","athlete","championship"],
  Science: ["science","research","experiment","scientist","theory","discovery","space","physics","biology","chemistry","universe"],
  Culture: ["music","film","book","story","history","culture","tradition","festival","artist","painting","poem"],
  Society: ["people","society","community","government","social","public","policy","politics","rights","citizen"],
};

export function cleanText(raw) {
  let t = String(raw || "").normalize("NFKC");
  t = t.replace(/[\uFFFD\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
  t = t.replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'").replace(/[‐‑‒–—―]/g, "-");
  t = t.replace(/^\s*WEBVTT[^\n]*$/gim, " ");
  t = t.replace(/^\s*(kind:\s*captions|language:\s*\w+|subscribe|like and subscribe|advertentie|reclame)\s*$/gim, " ");
  t = t.replace(/\[(music|muziek|applause|applaus|laughter|gelach|inaudible|onverstaanbaar|crosstalk|silence)\]/gi, " ");
  t = t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*(?:-->|-\s*>|→)\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g, " ");
  t = t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g, " ");
  t = t.replace(/^\s*\d+\s*$/gm, " ").replace(/-->/g, " ");
  t = t.replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/giu, "$1$2");
  t = t.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\s+([,.;:!?])/g, "$1").replace(/([¿¡])\s+/g, "$1");
  t = t.replace(/([!?]){3,}/g, "$1$1").replace(/([,;:]){2,}/g, "$1").replace(/\.{4,}/g, "...");
  const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    if (out.length && !/[.!?。！？:;]$/.test(out[out.length - 1]) && /^[\p{Ll}'"]/u.test(line)) out[out.length - 1] += " " + line;
    else out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function words(text) { return (text.toLowerCase().match(/[\p{L}][\p{L}'’-]{2,}/gu) || []); }
function pickVocab(text, n) {
  const ws = words(text); const freq = {};
  ws.forEach(w => { if (!STOP.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1; });
  const uniq = [...new Set(ws)].filter(w => !STOP.has(w) && w.length > 3);
  uniq.sort((a, b) => (b.length + (freq[b] || 0)) - (a.length + (freq[a] || 0)));
  return uniq.slice(0, n);
}
const ABBR = "Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|e\\.g|i\\.e|bijv|enz|nr|resp|approx|no|No|Inc|Ltd|Co";
function sentencesOf(text) {
  if (!text) return [];
  let t = text.replace(/\s*[•·▪‣◦]\s*/g, "\n");
  const primary = new RegExp("(?<!\\b(?:" + ABBR + ")\\.)(?<=[.!?…。！？])\\s+(?=[\\p{Lu}\"“'(\\[])|\\s*[;；]\\s+(?=[\\p{Lu}])|\\s*\\n+\\s*", "u");
  const MAX = 110, out = [];
  for (let p of t.split(primary)) {
    if (p == null) continue;
    p = p.replace(/\s+/g, " ").trim(); if (!p) continue;
    out.push(p);
  }
  const merged = [];
  for (const s of out) { if (s.length < 10 && merged.length) merged[merged.length - 1] += " " + s; else merged.push(s); }
  return merged.filter(s => s.length > 3);
}
function contextFor(word, sents) { return sents.find(x => x.toLowerCase().includes(word.toLowerCase())) || null; }
function levelIdx(l) { const p = (l || "").slice(0, 2); return Math.max(0, LEVELS.findIndex(x => x.startsWith(p))); }
function recommendLevel(text, sents) {
  const ws = words(text); if (!ws.length) return LEVELS[1];
  const avgLen = ws.reduce((a, w) => a + w.length, 0) / ws.length; const avgSent = ws.length / (sents.length || 1);
  const score = avgLen + avgSent * 0.4;
  if (score < 7) return LEVELS[0]; if (score < 8.5) return LEVELS[1]; if (score < 10) return LEVELS[2]; if (score < 12) return LEVELS[3]; return LEVELS[4];
}
function inferTopics(text) {
  const wl = words(text).join(" ");
  const scored = Object.entries(TOPIC_KEYWORDS).map(([k, list]) => [k, list.reduce((a, w) => a + (wl.includes(w) ? 1 : 0), 0)]).filter(x => x[1] > 0);
  scored.sort((a, b) => b[1] - a[1]);
  if (scored.length) return scored.slice(0, 3).map(x => x[0]);
  return pickVocab(text, 2).map(w => w.replace(/^./, c => c.toUpperCase()));
}
function altered(sentence, pool) {
  const toks = sentence.split(/(\s+)/);
  const idxs = toks.map((t, i) => ({ t, i })).filter(o => /[\p{L}]{4,}/u.test(o.t));
  if (!idxs.length) return sentence + " (variant)";
  const pick = idxs[Math.floor(Math.random() * idxs.length)];
  const rep = pool[Math.floor(Math.random() * pool.length)] || "different";
  const clone = [...toks]; clone[pick.i] = rep; return clone.join("");
}
function quizItems(sents, pool, count) {
  const items = []; const used = new Set(); const pickable = sents.filter(s => s.length < 160);
  for (let k = 0; k < count && pickable.length; k++) {
    let ci; do { ci = Math.floor(Math.random() * pickable.length); } while (used.has(ci) && used.size < pickable.length);
    used.add(ci); const correct = pickable[ci]; const opts = [{ t: correct, ok: true }]; let g = 0;
    while (opts.length < 4 && g++ < 20) { const d = altered(correct, pool); if (d !== correct && !opts.some(o => o.t === d)) opts.push({ t: d, ok: false }); }
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[opts[i], opts[j]] = [opts[j], opts[i]]; }
    items.push({ correct, options: opts });
  }
  return items;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function estimateVocabCount(text, chars) {
  const wc = words(text || "").length;
  return clamp(Math.round(Math.max((chars || 0) / 120, wc * 0.08)), 6, 30);
}

// Estimate the full lesson, not just reading time: meaning, vocabulary,
// sentence work, practice, checks, and a buffer for mistakes/repetition.
function estimateMinutes(chars, sentCount, vocabCount, diff, wordCount = 0) {
  const wc = wordCount || Math.max(1, Math.round((chars || 0) / 6));
  const s = sentCount || 1;
  const base = 6 + wc / 70 + (vocabCount || 8) * 0.7 + s * 1.8 + 5 + ((vocabCount || 8) + s) * 0.25;
  const mult = 0.92 + (diff || 3) * 0.08;
  return clamp(Math.round((base * mult) / 5) * 5, 20, 180);
}

export function generateLesson(text, lang, level, goal) {
  const chars = text.length; const sents = sentencesOf(text);
  const vocabCount = estimateVocabCount(text, chars);
  const vlist = pickVocab(text, vocabCount);
  const vocab = vlist.map((w, i) => ({ word: w.replace(/^./, c => c.toUpperCase()), pos: POS[i % POS.length], context: contextFor(w, sents), meaning: null, example: null }));
  const recommended = recommendLevel(text, sents);
  const simple = [...sents].sort((a, b) => a.split(/\s+/).length - b.split(/\s+/).length);
  return {
    lang, level, goal, charCount: chars, sents, vocab, vocabCount, vlist, recommended,
    topics: inferTopics(text),
    diff: Math.max(1, Math.min(5, 3 + (levelIdx(recommended) - levelIdx(level)))),
    estMin: estimateMinutes(chars, sents.length, vocabCount, Math.max(1, Math.min(5, 3 + (levelIdx(recommended) - levelIdx(level)))), words(text).length),
    grammarFocus: ["Verb position in main clauses", "Useful tense patterns", "Connectors and sentence flow"],
    comprehension: quizItems(simple, vlist, 3),
    recognition: quizItems(sents, vlist, 3),
    watch: sents.slice(0, 10).map(s => ({ s, tr: null })),
    ai: false,
  };
}

// ---- LLM enrichment (only runs when a key is present) ----
export async function enrich(base, { text, lang, level, goal }) {
  if (!AI.key) return base;
  const topSents = base.sents.slice(0, 10);
  const vocab = base.vocab.map(v => v.word);

  const sys = "You are a warm, precise language teacher creating a study lesson from a text. Reply ONLY with valid minified JSON, no prose.";
  const user = `Target language: ${lang}. Learner level: ${level}. Goal: ${goal}.
From the text below, produce JSON with exactly these keys:
"translations": array of {"s": <original sentence>, "tr": <natural English translation>} for each sentence provided,
"vocab": array of {"word": <word>, "pos": <part of speech>, "meaning": <short English meaning>, "example": <a NEW practical example sentence in ${lang} using the word, NOT copied from the text>} for each word provided,
"comprehension": array of 3 {"q": <a comprehension question written in ${lang}, simple enough for a ${level} learner>, "options": array of 4 {"t": <option in ${lang}>, "ok": <true for exactly one correct option>}}.
Keep everything at or slightly above ${level}.
Sentences: ${JSON.stringify(topSents)}
Words: ${JSON.stringify(vocab)}`;

  const raw = await chatComplete(
    [{ role: "system", content: sys }, { role: "user", content: user }],
    { json: true, temp: 0.4, max: 5000 }
  );
  const parsed = parseJSON(raw);

  // merge translations
  if (Array.isArray(parsed.translations)) {
    const map = {}; parsed.translations.forEach(t => { if (t && t.s) map[t.s] = t.tr; });
    base.watch = topSents.map(s => ({ s, tr: map[s] || null }));
  }
  // merge vocab meanings/examples
  if (Array.isArray(parsed.vocab)) {
    const map = {}; parsed.vocab.forEach(v => { if (v && v.word) map[v.word.toLowerCase()] = v; });
    base.vocab = base.vocab.map(v => {
      const m = map[v.word.toLowerCase()];
      return m ? { ...v, meaning: m.meaning || null, example: m.example || null } : v;
    });
  }
  // real comprehension in target language: q + options
  if (Array.isArray(parsed.comprehension) && parsed.comprehension.length) {
    base.comprehension = parsed.comprehension.map(item => ({
      q: item.q || null,
      correct: (item.options || []).find(o => o.ok)?.t || "",
      options: (item.options || []).slice(0, 4),
    }));
  }
  base.ai = true;
  return base;
}
