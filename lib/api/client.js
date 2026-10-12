"use client";

import { ApiError, toApiError } from "./errors";

/**
 * Browser API client. Always same-origin `/api/v1/*` (Next rewrite → Express), so the HttpOnly
 * auth cookies travel automatically and JS never touches tokens.
 *
 * 401 handling (contract: docs/API.md › Auth model):
 *  - Any 401 on a normal call → ONE shared refresh for all concurrent callers → retry once.
 *    (An expired access cookie is simply absent, so the 401 code may be UNAUTHORIZED rather
 *    than TOKEN_EXPIRED — both trigger a refresh.)
 *  - 409 REFRESH_SUPERSEDED → another tab won the race; the cookie jar is fresh → retry.
 *  - Refresh fails → emit `pp:session-expired` (the app shell redirects to login) and throw.
 */
const BASE = "/api/v1";
const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshing = null;

async function refreshSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
    .then((res) => res.ok || (res.status === 409 && "superseded"))
    .catch(() => false)
    .finally(() => {
      // Let every caller that joined this round see the same result before resetting.
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

function buildUrl(path, query) {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function send(path, { method = "GET", body, query, signal, headers }) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  return fetch(buildUrl(path, query), {
    method,
    credentials: "same-origin",
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
}

/**
 * @returns {Promise<{ data: any, meta?: any }>} the success envelope (data + meta)
 * @throws {ApiError}
 */
export async function apiRequest(path, opts = {}) {
  let res;
  try {
    res = await send(path, opts);
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: "Network error — check your connection" });
  }

  if (res.status === 401 && !NO_REFRESH.some((p) => path.startsWith(p))) {
    const ok = await refreshSession();
    if (ok) {
      res = await send(path, opts);
    } else {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pp:session-expired"));
    }
  }

  if (res.status === 204) return { data: null };
  if (!res.ok) throw await toApiError(res);
  const json = await res.json().catch(() => ({}));
  return { data: json.data ?? null, meta: json.meta };
}

/** Convenience: resolve to `data` only. */
export const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: "GET" }).then((r) => r.data),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: "POST", body }).then((r) => r.data),
  patch: (path, body, opts) => apiRequest(path, { ...opts, method: "PATCH", body }).then((r) => r.data),
  put: (path, body, opts) => apiRequest(path, { ...opts, method: "PUT", body }).then((r) => r.data),
  delete: (path, opts) => apiRequest(path, { ...opts, method: "DELETE" }).then((r) => r.data),
  /** Multipart upload — `form` is a FormData with `file` (+ visibility, purpose, alt). */
  upload: (path, form, opts) => apiRequest(path, { ...opts, method: "POST", body: form }).then((r) => r.data),
};
