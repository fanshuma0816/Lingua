import { generateLesson } from "../../../lib/lesson-client";
import { cleanText } from "../../../lib/text";
import { prepareImport } from "../../../lib/text-chunks";
import { MAX_DOCUMENT_CHARS } from "../../../config/constants";

export const runtime = "nodejs";
export const maxDuration = 30;

// Returns the lesson structure instantly. The AI analysis (translations, word
// meanings, quiz, conversation) is fetched lazily per-step from /api/analyze and
// /api/chat as the learner reaches each screen — small calls that stay fast and
// never truncate on long texts.
export async function POST(req) {
  try {
    const body = await req.json();
    if (String(body.text || "").length > MAX_DOCUMENT_CHARS) return Response.json({ error: "document_too_large" }, { status: 413 });
    let text = cleanText(body.text || "");
    const lang = body.lang || "Dutch";
    const level = body.level || "A2 — Elementary";
    const goal = body.goal || "General fluency";
    const targetMin = Number(body.targetMin) || null;
    // If a validated material analysis came from the generation step, thread it
    // through so its id / level / annotations are preserved verbatim (one source
    // of truth). Otherwise the lesson builder computes it deterministically.
    const providedMaterial = body.material && body.material.validatedTextLevel ? body.material : null;
    const sourceDocument = lang === "Dutch" && !providedMaterial
      ? prepareImport(body.text || "", { level, targetMin, difficulty: body.difficulty }) : null;
    if (sourceDocument) text = sourceDocument.text;
    if (!text.trim()) return Response.json({ error: "empty_text" }, { status: 400 });
    const lesson = generateLesson(text, lang, level, goal, targetMin, providedMaterial);
    return Response.json({ ...lesson, text, ...(sourceDocument ? {
      sourceDocument, importDocumentId: sourceDocument.id, importChunkId: sourceDocument.selectedChunkId,
      importChunkIndex: sourceDocument.selectedChunkIndex,
    } : {}) });
  } catch (e) {
    return Response.json({ error: e?.message === "document_too_large" ? "document_too_large" : "bad request" }, { status: e?.message === "document_too_large" ? 413 : 400 });
  }
}
