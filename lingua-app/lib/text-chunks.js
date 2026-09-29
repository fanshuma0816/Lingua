import { cleanText } from "./text.js";
import { analyzeDifficulty, cefrIdx, materialId } from "./cefr.mjs";

export const MAX_DOCUMENT_CHARS = 200000;
const countWords = text => (text.match(/[\p{L}\p{N}]+/gu) || []).length;
export function prepareImport(raw, { level = "A2", targetMin = 30, difficulty = "balanced" } = {}) {
  const originalText = String(raw || "");
  if (originalText.length > MAX_DOCUMENT_CHARS) throw new Error("document_too_large");
  const text = cleanText(originalText);
  const id = materialId(originalText);
  // Units end at paragraph/turn boundaries or complete sentences; never slice a sentence.
  const units = [];
  const segmenter = new Intl.Segmenter("nl", { granularity: "sentence" });
  for (const match of text.matchAll(/[^\n]+(?:\n+|$)/g)) {
    const paragraph = match[0];
    if (/^\s*[\p{Lu}][\p{L} -]{0,30}:\s/u.test(paragraph)) {
      units.push({ start: match.index, end: match.index + paragraph.length });
    } else {
      for (const part of segmenter.segment(paragraph)) units.push({ start: match.index + part.index, end: match.index + part.index + part.segment.length });
    }
  }
  const minutes = Math.max(10, Math.min(60, Number(targetMin) || 30));
  const target = minutes <= 15 ? 60 : minutes <= 35 ? (cefrIdx(level) < 2 ? 110 : 140) : 200;
  const chunks = []; let start = null, end = 0, size = 0;
  const flush = () => {
    if (start === null) return;
    const content = text.slice(start, end);
    if (content.trim()) chunks.push({ id: materialId(content.trim()), index: chunks.length, text: content.trim(),
      start, end, coordinateSpace: "cleanedText", wordCount: countWords(content),
      analysis: analyzeDifficulty(content, level), status: "pending" });
    start = null; size = 0;
  };
  for (const unit of units) {
    const length = countWords(text.slice(unit.start, unit.end));
    if (size && size + length > target * 1.25) flush();
    if (start === null) start = unit.start;
    end = unit.end; size += length;
    if (size >= target && /\n$/.test(text.slice(unit.start, unit.end))) flush();
  }
  flush();
  // Keep a short upload whole, including its original paragraph breaks.
  const desired = { comfortable: 0.10, balanced: 0.18, stretch: 0.26 }[difficulty] ?? 0.18;
  let selected = 0, best = Infinity;
  chunks.forEach((chunk, i) => {
    const score = Math.abs(chunk.analysis.hardWordRatio - desired) + Math.abs(chunk.wordCount - target) / target * 0.12 + i * 0.025;
    if (score < best) { best = score; selected = i; }
  });
  return { id, originalText, cleanedText: text, chunks, selectedChunkIndex: selected,
    selectedChunkId: chunks[selected]?.id || null, text: chunks[selected]?.text || "" };
}
