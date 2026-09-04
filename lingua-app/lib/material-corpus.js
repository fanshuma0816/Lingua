import fs from "fs";
import path from "path";
import { cefrIdx, materialId, validateMaterialFit } from "./cefr.mjs";
import { cleanText } from "./text.js";

let corpusCache = null;

function loadCorpus() {
  if (corpusCache) return corpusCache;
  const file = path.join(process.cwd(), "data", "corpus", "a1-a2-materials.json");
  corpusCache = JSON.parse(fs.readFileSync(file, "utf8"));
  return corpusCache;
}

function wordCount(text) {
  return (String(text || "").toLowerCase().match(/[\p{L}][\p{L}'’-]{1,}/gu) || []).length;
}

function hasTopic(item, topic) {
  if (!topic) return true;
  return (item.tags || []).map(x => String(x).toLowerCase()).includes(String(topic).toLowerCase());
}

function levelRank(item) {
  return cefrIdx(item.level || "A1");
}

function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed || Date.now())) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13; h ^= h >>> 7;
    h += h << 3; h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) % 1000000) / 1000000;
  };
}

function singleStoryCandidates(items) {
  return items.map(item => ({
    ...item,
    primaryTitle: item.title,
    parts: [item.title].filter(Boolean),
    pairKey: item.title,
  }));
}

function selectTextbookMaterials({ lang, level, topics = [], avoid = [], wordRange = [0, Infinity], count = 2, duration, targetMinutes, seed }) {
  if (lang !== "Dutch" || cefrIdx(level) > cefrIdx("A2")) return [];
  const topic = topics[0] || null;
  const [minWords, maxWords] = wordRange;
  const avoidSet = new Set((avoid || []).map(x => String(x || "").toLowerCase()).filter(Boolean));
  const rand = seededRandom(seed);
  const base = loadCorpus()
    .filter(item => levelRank(item) <= Math.min(cefrIdx(level) + 1, cefrIdx("B1")))
    .map(item => ({ ...item, topicScore: Number(hasTopic(item, topic)), rand: rand() }))
    .sort((a, b) => b.topicScore - a.topicScore || levelRank(a) - levelRank(b) || a.rand - b.rand);
  const candidates = singleStoryCandidates(base).map(item => ({ ...item, rand: rand() }))
    .sort((a, b) => b.topicScore - a.topicScore || levelRank(a) - levelRank(b) || a.rand - b.rand);
  const accepted = [];
  const seen = new Set();
  const seenPrimary = new Set();
  const seenPairs = new Set();
  const ranges = [[minWords, maxWords]];
  if (minWords > 60) ranges.push([35, maxWords]);

  for (const [lo, hi] of ranges) {
    for (const raw of candidates) {
      if (accepted.length >= count) break;
      const text = cleanText(raw.text || "");
      const wc = wordCount(text);
      if (wc < lo || wc > hi) continue;
      const id = materialId(text);
      const titleKey = String(raw.title || "").toLowerCase();
      if (seen.has(id) || avoidSet.has(id) || avoidSet.has(titleKey)) continue;
      const primaryKey = String(raw.primaryTitle || raw.title || "").toLowerCase();
      if (avoidSet.has(primaryKey)) continue;
      if ((raw.parts || []).some(part => avoidSet.has(String(part || "").toLowerCase()))) continue;
      if (seenPrimary.has(primaryKey)) continue;
      const pairKey = String(raw.pairKey || raw.title || "").toLowerCase();
      if (seenPairs.has(pairKey)) continue;
      const fit = validateMaterialFit(text, level);
      if (!fit.ok) continue;
      seen.add(id);
      seenPrimary.add(primaryKey);
      seenPairs.add(pairKey);
      accepted.push({
        id,
        title: raw.title,
        parts: raw.parts || [raw.title].filter(Boolean),
        source: raw.source || "Textbook adapted",
        text,
        duration,
        wordCount: wc,
        targetMinutes,
        targetUserLevel: fit.analysis.targetUserLevel,
        validatedTextLevel: fit.analysis.validatedTextLevel,
        level: fit.analysis.validatedTextLevel,
        hardWordRatio: fit.analysis.hardWordRatio,
        difficultyTier: fit.analysis.difficultyTier,
        vocabularyAnnotations: fit.analysis.annotations,
        resultSource: "textbook",
      });
    }
    if (accepted.length >= count) break;
  }

  return accepted;
}

export { selectTextbookMaterials };
