"use client";

import { DB } from "./storage";

function uniqueWords(items) {
  const seen = new Set();
  const out = [];
  (items || []).forEach((item) => {
    const word = String(item?.word || item || "").trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) return;
    seen.add(key);
    out.push(item && typeof item === "object" ? { ...item, word } : { word });
  });
  return out;
}

function lessonMaterialSummary(lesson) {
  const material = lesson?.material || {};
  return {
    id: material.id || null,
    title: material.title || null,
    source: material.source || null,
    validatedTextLevel: material.validatedTextLevel || null,
    difficultyTier: material.difficultyTier || null,
  };
}

function buildCompletedLessonPayload({ lesson, text, userWords, completedSteps }) {
  const focusWords = Array.isArray(lesson?.focus?.vocab) ? lesson.focus.vocab : [];
  const lessonWords = Array.isArray(lesson?.vocab) ? lesson.vocab : [];
  const words = uniqueWords([
    ...(userWords || []).map((word) => ({ word, source: "quick_scan" })),
    ...focusWords.map((item) => ({ ...item, source: "focus" })),
    ...lessonWords.map((item) => ({ ...item, source: "lesson" })),
  ]);
  return {
    localLessonId: lesson?.material?.id || lesson?.id || null,
    lang: lesson?.lang || null,
    level: lesson?.level || null,
    goal: lesson?.goal || null,
    material: lessonMaterialSummary(lesson),
    materialHash: lesson?.material?.id || null,
    stats: {
      charCount: lesson?.charCount || String(text || "").length || null,
      sentenceCount: Array.isArray(lesson?.sents) ? lesson.sents.length : null,
      estimatedMinutes: lesson?.estMin || lesson?.material?.estimatedLessonTime || null,
      vocabCount: words.length,
    },
    completedSteps: Array.isArray(completedSteps) ? completedSteps : [],
    words,
  };
}

async function saveCompletedLesson(payload, accessToken) {
  const response = await fetch("/api/learning/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not save learning progress.");
  DB.remove("pendingSaveAfterLogin");
  return data;
}

export { buildCompletedLessonPayload, saveCompletedLesson };
