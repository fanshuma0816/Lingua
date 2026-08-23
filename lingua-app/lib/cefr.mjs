// Shared, deterministic CEFR analysis — the single source of truth for a
// material's difficulty. Imported by BOTH the server (lib/lesson.js, API routes)
// and the client (app/page.jsx), so the SAME text always yields the SAME level,
// difficulty tier, and vocabulary annotations on every page.
//
// This module has NO server-only dependencies (no AI SDK), so it is safe in the
// client bundle. It never asks a language model to grade CEFR — grading is a
// pure function of the text, which is what keeps card / preview / diagnosis
// perfectly consistent for the same material id.

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

export function cefrIdx(level) {
  const p = String(level || "").trim().slice(0, 2).toUpperCase();
  const i = CEFR_LEVELS.indexOf(p);
  return i < 0 ? 0 : i;
}
export function idxToCefr(i) {
  return CEFR_LEVELS[Math.max(0, Math.min(CEFR_LEVELS.length - 1, i))];
}

// ---- compact Dutch CEFR lexicon (base forms; deterministic) ----
// Not exhaustive — a curated core plus a morphological/length heuristic for the
// long tail. Correctness at the invariant level (a beginner base with a small
// fraction of harder words) matters more than perfect per-word labels.
const A1_WORDS = new Set((
  "ik jij je jou u hij zij ze wij we het de een en of maar want van te in op aan naar voor met zonder door over onder om bij uit tot als dan ook nog al niet geen wel ja nee " +
  "dit dat deze die hier daar nu toen wat wie waar hoe waarom wanneer welke heel erg veel weinig meer heel goed groot klein nieuw oud jong mooi leuk " +
  "is ben bent zijn was waren word wordt worden heb hebt heeft hebben had hadden kan kunt kunnen moet moeten mag mogen " +
  "ga gaat gaan ging kom komt komen kwam zie ziet zien zag zeg zegt zeggen zei doe doet doen deed maak maakt maken maakte " +
  "eet eten drink drinkt drinken koop koopt kopen woon woont wonen werk werkt werken lees leest lezen " +
  "dag dagen week weken jaar jaren tijd uur morgen vandaag avond nacht " +
  "huis stad straat man vrouw kind kinderen mens mensen naam vriend vrienden zus broer moeder vader familie " +
  "water brood kaas fruit koffie thee melk eten huis thuis samen weekend school boek geld winkel supermarkt " +
  "mijn jouw zijn haar ons onze hun je zo maar even klein"
).split(/\s+/).filter(Boolean));

const A2_WORDS = new Set((
  "wil wilt willen wilde markt omdat kazen misschien cadeau gezellig zullen zul zult idee ideeen " +
  "afspreken afspraak proberen probeer probeert natuurlijk eigenlijk meestal soms altijd nooit vaak " +
  "beginnen begint eindigen betalen betaalt betaald contant vriendelijk rustig langzaam snel druk " +
  "reis reizen station trein bus fiets fietst fietsen lopen loopt wandelen bakker slager kassa " +
  "vertellen vertelt gebeuren gebeurt herinneren voelen voelt merken merkt kiezen kiest kies " +
  "belangrijk moeilijk makkelijk gemakkelijk verschillend zeker bijna genoeg misschien ergens iemand iets niemand niets " +
  "helder wakker gewoon plan plannen weer omdat terwijl toch echter bijvoorbeeld zowel"
).split(/\s+/).filter(Boolean));

const B1_WORDS = new Set((
  "proeven proeft ergens duurzaam duurzamer reiziger reizigers toonbank gracht klacht klachten volgens " +
  "vervoer vervoersbedrijf vervoersbedrijven verschijnen verdwijnen ontwikkelen ontwikkeling invloed gevolg gevolgen " +
  "hoewel ondanks daarnaast bovendien namelijk vanwege betreffende dergelijk voornamelijk nauwelijks " +
  "beschouwen beweren benadrukken verwachten veroorzaken vermijden bereiken toenemen afnemen " +
  "regering maatschappij samenleving overheid beleid onderzoek resultaat gemiddeld"
).split(/\s+/).filter(Boolean));

const B2_WORDS = new Set((
  "desalniettemin niettemin weliswaar cruciaal ingrijpend genuanceerd complex problematisch " +
  "implicatie perspectief tendens fenomeen consequentie doorslaggevend"
).split(/\s+/).filter(Boolean));

const C1_WORDS = new Set((
  "ambivalentie paradigma paradigmaverschuiving legitimeren institutionalisering conceptualiseren " +
  "onverenigbaar epistemologisch decentralisatie veronderstelling vooronderstelling ondermijning"
).split(/\s+/).filter(Boolean));

// Function words that are trivially known (A1) and should never be treated as
// "hard" vocabulary regardless of length.
const FUNCTION_WORDS = new Set((
  "de het een en of maar want van te in op aan naar voor met door over onder om bij uit tot als dan ook nog al niet geen " +
  "ik jij je hij zij ze wij we u dit dat deze die hier daar er"
).split(/\s+/).filter(Boolean));

// Common given names in the demo/sample content — treated as proper nouns
// (excluded from difficulty) even when they open a sentence or a dialogue line.
const NAMES = new Set((
  "sanne amir noor tom sara sarah emma lisa mark jan piet peter kees anna eva sofie sophie lotte femke daan sem bram lars mila julia julie thomas lucas luuk tim bas jeroen koen sam max noa"
).split(/\s+/).filter(Boolean));

// Estimate a single word's CEFR level (lowercased, no punctuation).
export function estimateWordCefr(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-zà-ÿ'’-]/g, "");
  if (!w) return "A1";
  if (FUNCTION_WORDS.has(w) || A1_WORDS.has(w)) return "A1";
  if (A2_WORDS.has(w)) return "A2";
  if (B1_WORDS.has(w)) return "B1";
  if (B2_WORDS.has(w)) return "B2";
  if (C1_WORDS.has(w)) return "C1";
  // Diminutives (-je/-tje/-pje) are usually easy.
  if (/(tje|pje|je)$/.test(w) && w.length <= 8) return "A2";
  // Length heuristic for the long tail (conservative so we don't over-reject).
  const len = w.replace(/[-']/g, "").length;
  if (len <= 4) return "A1";
  if (len <= 7) return "A2";
  if (len <= 10) return "B1";
  if (len <= 14) return "B2";
  return "C1";
}

// A token that carries no learnable difficulty (pure number, single letter).
function isSkippable(surface) {
  return !/[a-zà-ÿ]/i.test(surface) || /^\d+$/.test(surface);
}

// Tokenize into word tokens with character spans and a sentence-initial flag
// (so we can spot proper nouns that aren't just the first word of a sentence).
export function tokenize(text) {
  const s = String(text || "");
  const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*|\d+/g;
  const tokens = [];
  let m;
  let sentenceStart = true;
  let lastEnd = 0;
  while ((m = re.exec(s)) !== null) {
    const surface = m[0];
    const start = m.index;
    const end = start + surface.length;
    // If the gap since the previous token contains sentence-ending punctuation
    // or a newline, the next word begins a new sentence.
    const gap = s.slice(lastEnd, start);
    if (tokens.length === 0) sentenceStart = true;
    else if (/[.!?…\n]|:\s|["“”]/.test(gap)) sentenceStart = true;
    // Speaker label like "Amir:" — a capitalized token immediately followed by ":".
    const label = /^\s{0,2}:/.test(s.slice(end, end + 3));
    tokens.push({ surface, lower: surface.toLowerCase(), start, end, sentenceStart, label });
    sentenceStart = false;
    lastEnd = end;
  }
  return tokens;
}

// Proper-noun detection: known names and speaker labels always count as proper
// nouns; otherwise a capitalized word that isn't at the start of a sentence and
// isn't a known common word is treated as a proper noun. Proper nouns are
// excluded from difficulty scoring.
export function isProperNoun(token) {
  if (!token) return false;
  const { surface, lower, sentenceStart, label } = token;
  if (NAMES.has(lower)) return true;
  if (label && /^[A-ZÀ-Þ]/.test(surface)) return true;
  if (!/^[A-ZÀ-Þ]/.test(surface)) return false;
  if (FUNCTION_WORDS.has(lower) || A1_WORDS.has(lower) || A2_WORDS.has(lower) || B1_WORDS.has(lower)) return false;
  if (sentenceStart) return false; // ambiguous — don't over-count sentence openers
  return true;
}

// The heart of the module. Returns ONE analysis object for a text + the learner
// level it is being judged against.
export function analyzeDifficulty(text, userLevel) {
  const userIdx = cefrIdx(userLevel);
  const tokens = tokenize(text);
  const counts = [0, 0, 0, 0, 0]; // scorable token counts per CEFR index
  let scorable = 0;
  let above = 0;
  const annMap = new Map(); // lemma -> { surface, lemma, cefr, cefrIdx, spans: [[s,e]] }
  for (const tk of tokens) {
    if (isSkippable(tk.surface)) continue;
    if (isProperNoun(tk)) continue;           // proper nouns don't count as difficult
    const cefr = estimateWordCefr(tk.lower);
    const ci = cefrIdx(cefr);
    counts[ci]++;
    scorable++;
    if (ci > userIdx) {
      above++;
      const key = tk.lower;
      if (!annMap.has(key)) annMap.set(key, { surface: tk.surface, lemma: tk.lower, cefr, cefrIdx: ci, spans: [] });
      annMap.get(key).spans.push([tk.start, tk.end]);
    }
  }
  const total = Math.max(1, scorable);
  const hardWordRatio = above / total;

  // validatedTextLevel = highest CEFR level that holds at least ~8% of the
  // scorable tokens at-or-above it. This treats a beginner base sprinkled with
  // ~10-30% harder words as an "i+1" text one level up, not as that hard level.
  let validatedIdx = 0;
  for (let k = CEFR_LEVELS.length - 1; k >= 1; k--) {
    let mass = 0;
    for (let i = k; i < CEFR_LEVELS.length; i++) mass += counts[i];
    if (mass / total >= 0.08) { validatedIdx = k; break; }
  }

  const difficultyTier =
    hardWordRatio < 0.15 ? "comfortable" :
    hardWordRatio < 0.22 ? "balanced" :
    hardWordRatio <= 0.30 ? "stretch" : "over";

  const annotations = [...annMap.values()].sort((a, b) => b.cefrIdx - a.cefrIdx || a.spans[0][0] - b.spans[0][0]);

  return {
    targetUserLevel: idxToCefr(userIdx),
    validatedTextLevel: idxToCefr(validatedIdx),
    validatedTextLevelIdx: validatedIdx,
    hardWordRatio: Math.round(hardWordRatio * 1000) / 1000,
    difficultyTier,
    scorableTokens: scorable,
    aboveTokens: above,
    annotations,
  };
}

// Enforce the level constraints. A text is acceptable for a learner when it does
// not exceed userLevel+1 and no more than 30% of scorable tokens are above the
// learner's level.
export function validateForLevel(text, userLevel, { maxHardRatio = 0.30 } = {}) {
  const userIdx = cefrIdx(userLevel);
  const capIdx = Math.min(CEFR_LEVELS.length - 1, userIdx + 1);
  const analysis = analyzeDifficulty(text, userLevel);
  const levelOk = analysis.validatedTextLevelIdx <= capIdx;
  const ratioOk = analysis.hardWordRatio <= maxHardRatio;
  const reasons = [];
  if (!levelOk) reasons.push(`level ${analysis.validatedTextLevel} exceeds cap ${idxToCefr(capIdx)}`);
  if (!ratioOk) reasons.push(`hard-word ratio ${(analysis.hardWordRatio * 100).toFixed(0)}% exceeds ${(maxHardRatio * 100).toFixed(0)}%`);
  return { ok: levelOk && ratioOk, reason: reasons.join("; ") || "ok", analysis };
}

// Strict fit for generated recommendations: material must be at the learner's
// level or one level above. C1 has no C2 support in this app yet, so C1 learners
// only receive C1 materials.
export function validateMaterialFit(text, userLevel, { maxHardRatio = 0.30 } = {}) {
  const userIdx = cefrIdx(userLevel);
  const capIdx = Math.min(CEFR_LEVELS.length - 1, userIdx + 1);
  const analysis = analyzeDifficulty(text, userLevel);
  const minOk = analysis.validatedTextLevelIdx >= userIdx;
  const maxOk = analysis.validatedTextLevelIdx <= capIdx;
  const ratioOk = analysis.hardWordRatio <= maxHardRatio;
  const reasons = [];
  if (!minOk) reasons.push(`level ${analysis.validatedTextLevel} is below learner level ${idxToCefr(userIdx)}`);
  if (!maxOk) reasons.push(`level ${analysis.validatedTextLevel} exceeds cap ${idxToCefr(capIdx)}`);
  if (!ratioOk) reasons.push(`hard-word ratio ${(analysis.hardWordRatio * 100).toFixed(0)}% exceeds ${(maxHardRatio * 100).toFixed(0)}%`);
  return { ok: minOk && maxOk && ratioOk, reason: reasons.join("; ") || "ok", analysis };
}

// Which of the three graded options a hard-word ratio corresponds to.
export function tierForRatio(ratio) {
  if (ratio < 0.15) return "comfortable";
  if (ratio < 0.22) return "balanced";
  return "stretch";
}

// Stable, deterministic id for a piece of text (FNV-1a). Same text -> same id,
// so a selected material keeps its identity across the session.
export function materialId(text) {
  const s = String(text || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "m_" + (h >>> 0).toString(36);
}

// Convenience: build the persistent material analysis object used across pages.
export function buildMaterialAnalysis(text, userLevel, { id, estimatedLessonTime = null, source, title } = {}) {
  const a = analyzeDifficulty(text, userLevel);
  return {
    id: id || materialId(text),
    title: title || null,
    source: source || null,
    targetUserLevel: a.targetUserLevel,
    validatedTextLevel: a.validatedTextLevel,
    difficultyTier: a.difficultyTier,
    hardWordRatio: a.hardWordRatio,
    vocabularyAnnotations: a.annotations,
    estimatedLessonTime,
  };
}
