function normalizeTopics(topics) {
  if (Array.isArray(topics)) return topics.join(", ");
  return topics || "";
}

export function trackGenerateMaterialsClicked({ currentLevel, sessionGoal, fullLessonTime, topicsYouLike }) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "generate_materials_clicked", {
    current_level: currentLevel || "",
    session_goal: sessionGoal || "",
    full_lesson_time: fullLessonTime || "",
    topics_you_like: normalizeTopics(topicsYouLike),
  });
}
