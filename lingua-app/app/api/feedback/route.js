export const runtime = "nodejs";

const MAX_FEEDBACK_LENGTH = 2000;

function sanitizeFeedbackText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FEEDBACK_LENGTH);
}

function shortText(value, limit = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

export async function POST(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Feedback is not configured." }, { status: 503 });
    }

    const body = await req.json();
    const originalText = String(body?.text || "");
    const normalizedOriginal = originalText.replace(/\s+/g, " ").trim();

    if (!normalizedOriginal) {
      return Response.json({ error: "Feedback is empty." }, { status: 400 });
    }

    const sanitizedText = sanitizeFeedbackText(originalText);

    if (!sanitizedText) {
      return Response.json({ error: "Feedback is empty after filtering." }, { status: 400 });
    }

    const row = {
      source: "lesson_completion",
      text_redacted: sanitizedText,
      text_length: Math.min(normalizedOriginal.length, MAX_FEEDBACK_LENGTH),
      was_redacted: sanitizedText !== normalizedOriginal,
      language: shortText(body?.language, 80),
      level: shortText(body?.level, 20),
      lesson_id: shortText(body?.lessonId, 120),
      page_path: shortText(body?.pagePath, 300),
      status: "new",
    };

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/feedback_submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json({ error: errorText || "Could not save feedback." }, { status: 502 });
    }

    return Response.json({
      ok: true,
      feedback_length: row.text_length,
      feedback_redacted: row.was_redacted,
    });
  } catch (e) {
    return Response.json({ error: "Could not save feedback." }, { status: 500 });
  }
}
