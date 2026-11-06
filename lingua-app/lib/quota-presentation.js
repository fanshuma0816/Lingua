// Presentation only. Permission and quota mutations remain exclusively on the server.
export function quotaPresentation(phase, { status = "ready" } = {}) {
  if (phase?.enabled === false || phase?.pro === true) return { state: "off" };
  if (phase?.enabled !== true || typeof phase.signedIn !== "boolean")
    return { state: status === "loading" ? "loading" : "unavailable" };
  const fields = ["granted", "used", "remaining", "reserved", "available"];
  if (!fields.every(key => Number.isSafeInteger(phase[key]) && phase[key] >= 0)
      || phase.used + phase.remaining !== phase.granted
      || phase.available + phase.reserved !== phase.remaining
      || (phase.canGenerate !== undefined && (typeof phase.canGenerate !== "boolean" || phase.canGenerate !== (phase.available > 0))))
    return { state: status === "loading" ? "loading" : "unavailable" };
  return {
    state: phase.reserved > 0 ? "reserved" : phase.available === 0 ? "exhausted" : phase.available === 1 ? "last" : "available",
    refreshing: status === "loading", stale: status === "error",
    identity: phase.signedIn ? "free" : "guest",
    available: phase.available, reserved: phase.reserved, used: phase.used, granted: phase.granted,
  };
}
