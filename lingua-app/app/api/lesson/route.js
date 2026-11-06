import { createHash } from "node:crypto";
import { generateLesson } from "../../../lib/lesson-client";
import { cleanText } from "../../../lib/text";
import { prepareImport } from "../../../lib/text-chunks";
import { MAX_DOCUMENT_CHARS } from "../../../config/constants";
import { resolveIdentity, assertSameOrigin, phaseConfig } from "../../../lib/server-auth";
import { generationAction, reserve } from "../../../lib/entitlements";
import { validateMaterial } from "../../../lib/lesson-store";
import { ApiError, apiError, jsonResult } from "../../../lib/api-errors";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req) {
  let identity, acquired = false, requestId;
  try {
    if (phaseConfig().enabled) assertSameOrigin(req);
    const body = await req.json();
    if (String(body.text || "").length > MAX_DOCUMENT_CHARS) throw new ApiError("document_too_large", 413);
    const lang = body.lang || "Dutch", level = body.level || "A2 — Elementary", goal = body.goal || "General fluency";
    const targetMin = Number(body.targetMin) || null;
    const providedMaterial = body.material?.validatedTextLevel ? body.material : null;
    const sourceDocument = lang === "Dutch" && !providedMaterial ? prepareImport(body.text || "", { level, targetMin, difficulty: body.difficulty }) : null;
    const text = sourceDocument ? sourceDocument.text : cleanText(body.text || "");
    if (!text.trim()) throw new ApiError("empty_text");
    identity = await resolveIdentity(req);
    if (identity.enabled) {
      requestId = body.requestId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId || "")) throw new ApiError("invalid_request_id");
      await validateMaterial(identity, body);
      const hash = createHash("sha256").update(JSON.stringify({ text: body.text,lang,level,goal,targetMin,material:providedMaterial,difficulty:body.difficulty || null })).digest("hex");
      const existing = await reserve(identity, requestId, hash);
      if (!existing.acquired) return jsonResult(existing.lesson || { status: existing.status, requestId }, identity);
      acquired = true;
    }
    const snapshot = { ...generateLesson(text, lang, level, goal, targetMin, providedMaterial), text,
      ...(sourceDocument ? { sourceDocument, importDocumentId: sourceDocument.id, importChunkId: sourceDocument.selectedChunkId, importChunkIndex: sourceDocument.selectedChunkIndex } : {}) };
    if (!identity.enabled) return jsonResult(snapshot);
    const result = await generationAction(identity, "store", { requestId, snapshot });
    return jsonResult(result.lesson, identity);
  } catch (error) {
    // A store timeout may already have committed. Release only a still-processing request.
    if (acquired) await generationAction(identity, "release", { requestId }).catch(() => {});
    return apiError(error);
  }
}
