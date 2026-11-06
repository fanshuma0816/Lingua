import { database } from "./server-auth";
import { ApiError } from "./api-errors";
export async function generationAction(identity, action, args = {}) {
  const data = await database("rpc/lingua_generation", { method: "POST", body: JSON.stringify({
    p_action: action, p_environment: identity.environment, p_subject: identity.subject,
    p_user_id: identity.user?.id || null, p_args: args,
  }) });
  if (data?.error) {
    const status = { sign_in_required: 401, quota_exhausted: 402, lesson_not_found: 404, request_not_found: 404,
      request_conflict: 409, request_expired: 409, request_failed: 409, lesson_not_delivered: 409, rate_limited: 429 }[data.error] || 400;
    throw new ApiError(data.error, status);
  }
  return data;
}
export const entitlements = identity => generationAction(identity, "balance");
export const reserve = (identity, requestId, hash) => generationAction(identity, "reserve", { requestId, hash });
