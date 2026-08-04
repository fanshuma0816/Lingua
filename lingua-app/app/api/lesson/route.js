import { generateLesson, enrich, cleanText } from "../../../lib/lesson";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const text = cleanText(body.text || "");
    const lang = body.lang || "Spanish";
    const level = body.level || "A2 — Elementary";
    const goal = body.goal || "General fluency";

    const base = generateLesson(text, lang, level, goal);
    try {
      const full = await enrich(base, { text, lang, level, goal });
      return Response.json(full);
    } catch (e) {
      // key missing or model error → serve the deterministic mock lesson
      return Response.json(base);
    }
  } catch (e) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
}
