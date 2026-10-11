/**
 * Route areas and the post-login redirect rules — shared by proxy.js and client code.
 * Paths here are WITHOUT the locale prefix ("/dashboard", not "/bn/dashboard").
 */
export const STAFF_HOME = "/dashboard";
export const CLIENT_HOME = "/portal";
export const LOGIN = "/login";
export const SESSION = "/session"; // silent refresh hop
export const GUEST_PAGES = ["/login", "/forgot-password", "/reset-password", "/setup-account"];

export const homeFor = (role) => (role === "client" ? CLIENT_HOME : STAFF_HOME);

export function areaOf(path) {
  if (path === STAFF_HOME || path.startsWith(`${STAFF_HOME}/`)) return "staff";
  if (path === CLIENT_HOME || path.startsWith(`${CLIENT_HOME}/`)) return "client";
  if (GUEST_PAGES.includes(path)) return "guest";
  return null;
}

/**
 * Only same-site, locale-less app paths are accepted as `next` (open-redirect guard):
 * must start with a single "/", no scheme, no backslashes, no protocol-relative "//".
 */
export function safeNext(next, role) {
  if (typeof next !== "string" || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /^\/[^/]*:/.test(next)) {
    return null;
  }
  const area = areaOf(next.split(/[?#]/)[0]);
  if (area === "guest" || next === SESSION) return null;
  // A client must never be bounced into the staff area (and vice versa).
  if (role && area && area !== (role === "client" ? "client" : "staff")) return null;
  return next;
}
