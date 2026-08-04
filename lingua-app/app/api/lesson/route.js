import { generateLesson, cleanText } from "../../../lib/lesson";

export const runtime = "nodejs";
export const maxDuration = 30;

// Returns the lesson structure instantly. The AI analysis (translations, word
// meanings, quiz, conversation) is fetched lazily per-step from /api/analyze and
// /api/chat as the learner reaches each screen — small calls that stay fast and
// never truncate on long texts.
export async function POST(req) {
  try {
    const body = await req.json();
    const text = cleanText(body.text || "");
    const lang = body.lang || "Spanish";
    const level = body.level || "A2 — Elementary";
    const goal = body.goal || "General fluency";
    return Response.json(generateLesson(text, lang, level, goal));
  } catch (e) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
}
