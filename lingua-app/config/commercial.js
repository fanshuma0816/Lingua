// Server-only configuration. Nothing becomes active merely because a date changes.
const RULE_VERSION = "2026-11-v1";
const GUEST_GENERATIONS = 1;
const ACCOUNT_GENERATIONS = 3;

function learningAccessMode(env = process.env) {
  const mode = env.LEARNING_ACCESS_MODE || "off";
  if (!["off", "test", "live"].includes(mode)) throw new Error("invalid_learning_mode");
  if (mode === "test" && (env.LEARNING_ACCESS_ENVIRONMENT !== "staging" || env.VERCEL_ENV === "production")) {
    throw new Error("test_mode_requires_staging");
  }
  return mode;
}

export { RULE_VERSION, GUEST_GENERATIONS, ACCOUNT_GENERATIONS, learningAccessMode };
