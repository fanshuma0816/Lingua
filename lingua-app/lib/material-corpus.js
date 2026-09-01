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

function combinedCandidates(items) {
  const out = [...items];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      out.push({
        title: `${a.title} + ${b.title}`,
        source: "Textbook adapted",
        level: cefrIdx(a.level) >= cefrIdx(b.level) ? a.level : b.level,
        tags: [...new Set([...(a.tags || []), ...(b.tags || [])])],
        text: `${a.text}\n\n${b.text}`,
      });
    }
  }
  return out;
}

function selectTextbookMaterials({ lang, level, topics = [], avoid = [], wordRange = [0, Infinity], count = 3, duration, targetMinutes }) {
  if (lang !== "Dutch" || cefrIdx(level) > cefrIdx("A2")) return [];
  const topic = topics[0] || null;
  const [minWords, maxWords] = wordRange;
  const avoidSet = new Set((avoid || []).map(x => String(x || "").toLowerCase()).filter(Boolean));
  const base = loadCorpus()
    .filter(item => levelRank(item) <= Math.min(cefrIdx(level) + 1, cefrIdx("B1")))
    .sort((a, b) => Number(hasTopic(b, topic)) - Number(hasTopic(a, topic)) || levelRank(a) - levelRank(b));
  const candidates = combinedCandidates(base);
  const accepted = [];
  const seen = new Set();

  for (const raw of candidates) {
    if (accepted.length >= count) break;
    const text = cleanText(raw.text || "");
    const wc = wordCount(text);
    if (wc < minWords || wc > maxWords) continue;
    const id = materialId(text);
    const titleKey = String(raw.title || "").toLowerCase();
    if (seen.has(id) || avoidSet.has(id) || avoidSet.has(titleKey)) continue;
    const fit = validateMaterialFit(text, level);
    if (!fit.ok) continue;
    seen.add(id);
    accepted.push({
      id,
      title: raw.title,
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

  return accepted;
}

export { selectTextbookMaterials };
