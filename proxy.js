import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { areaOf, homeFor, SESSION } from "./lib/auth/paths";

const handleI18n = createMiddleware(routing);
const LOCALE_RE = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/**
 * Read the access token's claims WITHOUT verifying the signature. This only decides where to
 * route a page request (UX); every API call is verified by Express. A forged cookie can at most
 * render an empty shell whose data requests all fail with 401.
 */
function peekAccess(token) {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json);
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now() + 5_000) return null;
    return { role: claims.role };
  } catch {
    return null;
  }
}

function redirectTo(request, locale, path, params) {
  const url = new URL(`/${locale}${path}`, request.url);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export default function proxy(request) {
  const response = handleI18n(request);
  // next-intl redirected (missing/unsupported locale) — let that happen first.
  if (response.headers.get("location")) return response;

  const { pathname, search } = request.nextUrl;
  const m = LOCALE_RE.exec(pathname);
  if (!m) return response;
  const locale = m[1];
  const path = pathname.slice(m[0].length) || "/";
  const area = areaOf(path);
  if (!area) return response; // public pages

  const token = request.cookies.get("pp_at")?.value;
  const session = token ? peekAccess(token) : null;

  if (area === "guest") {
    // Already signed in → straight to the right home.
    return session ? redirectTo(request, locale, homeFor(session.role)) : response;
  }

  if (!session) {
    // No (valid) access cookie. The refresh cookie is scoped to /api/v1/auth, so the proxy can't
    // see it — hand over to the /session page, which refreshes from the browser and comes back,
    // or continues to the login page if there is no session.
    return redirectTo(request, locale, SESSION, { next: `${path}${search}` });
  }

  const allowed = area === "client" ? session.role === "client" : session.role !== "client";
  return allowed ? response : redirectTo(request, locale, homeFor(session.role));
}

export const config = {
  // Everything except the API proxy, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|uploads|.*\\..*).*)"],
};
