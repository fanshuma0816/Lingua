export class ApiError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function apiError(error) {
  const status = error instanceof ApiError ? error.status : 503;
  return Response.json({ error: error instanceof ApiError ? error.code : "service_unavailable" }, {
    status, headers: { "Cache-Control": "no-store" },
  });
}
export function jsonResult(data, identity) {
  return Response.json(data, { headers: { "Cache-Control": "no-store", ...(identity?.cookie ? { "Set-Cookie": identity.cookie } : {}) } });
}
