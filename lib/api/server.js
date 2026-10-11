import "server-only";
import { cookies, headers } from "next/headers";
import { toApiError } from "./errors";

/**
 * Server-side API call (Server Components / Server Actions / Route Handlers). Talks to Express
 * directly (BACKEND_URL) and forwards the user's cookies, so the backend sees the same session.
 * Server Components cannot set cookies, so there is no refresh here: the proxy refreshes an
 * expired session before the page renders (F1 step 2), and a 401 here means "go to login".
 * Reads request data → call it inside a <Suspense> boundary (cacheComponents).
 */
const BACKEND = (process.env.BACKEND_URL || "http://localhost:5030").replace(/\/$/, "");

export async function serverApi(path, { method = "GET", body, query } = {}) {
  const jar = await cookies();
  const h = await headers();
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null))}` : "";
  const res = await fetch(`${BACKEND}/api/v1${path}${qs}`, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      cookie: jar.toString(),
      ...(h.get("x-request-id") && { "x-request-id": h.get("x-request-id") }),
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return { data: null };
  if (!res.ok) throw await toApiError(res);
  const json = await res.json();
  return { data: json.data ?? null, meta: json.meta };
}
