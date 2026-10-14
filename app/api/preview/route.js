import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Turns on Draft Mode for a signed-in editor and opens the page (dashboard › Website › Preview).
 *   GET /api/preview?page=home&locale=bn
 * The editor's session is checked against the API (`site:manage`); the redirect target comes
 * from a fixed page map, never from the query (no open redirect). Draft content itself is read
 * server-to-server with a signed request (lib/public/api.js › getSitePage).
 */
const BACKEND = (process.env.BACKEND_URL || "http://localhost:5030").replace(/\/$/, "");
const PATHS = { home: "/", about: "/about", projects: "/projects", contact: "/contact", landowners: "/landowners", compare: "/compare", privacy: "/privacy", terms: "/terms" };
const LOCALES = ["bn", "en"];

export async function GET(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "home";
  const locale = LOCALES.includes(url.searchParams.get("locale")) ? url.searchParams.get("locale") : "bn";
  if (!Object.hasOwn(PATHS, page)) return new Response("Unknown page", { status: 404 });
  if ((process.env.REVALIDATE_SECRET ?? "").length < 32) {
    return new Response("Preview needs REVALIDATE_SECRET (same value as the API's).", { status: 503 });
  }

  const me = await fetch(`${BACKEND}/api/v1/auth/me`, {
    headers: { Accept: "application/json", cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const perms = me?.ok ? (await me.json())?.data?.user?.permissions : null;
  if (!Array.isArray(perms) || !perms.includes("site:manage")) {
    return new Response("Sign in to the dashboard as an editor, then press Preview again.", { status: 401 });
  }

  (await draftMode()).enable();
  redirect(`/${locale}${PATHS[page] === "/" ? "" : PATHS[page]}`);
}
