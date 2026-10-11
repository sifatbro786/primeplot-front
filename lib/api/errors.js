/** Mirrors the backend error envelope: { success:false, error:{ code, message, details?, requestId } }. */
export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.code = code || "UNKNOWN";
    this.details = details;
    this.requestId = requestId;
  }

  /** Field errors from a 422 as { field: message } for react-hook-form / inline errors. */
  get fieldErrors() {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((d) => [d.path, d.message]));
  }
}

export const isApiError = (err) => err instanceof ApiError;

export async function toApiError(res) {
  const body = await res.json().catch(() => null);
  const e = body?.error;
  return new ApiError({
    status: res.status,
    code: e?.code ?? (res.status >= 500 ? "SERVER_UNAVAILABLE" : "UNKNOWN"),
    message: e?.message ?? res.statusText,
    details: e?.details,
    requestId: e?.requestId ?? res.headers.get("x-request-id") ?? undefined,
  });
}
