import "server-only";
import { createHmac } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { connection } from "next/server";

/**
 * Website catalogue reads (contract: API.md › Public catalogue). Server-only, no cookies — every
 * visitor sees the same data, so results are cached with `use cache` and tagged the way the API's
 * revalidation webhook names them (`projects`, `project:<slug>`, `org`; see app/api/revalidate).
 * The time-based lifetime is only a safety net for when the webhook is off or a call is lost.
 *
 * Errors: a 404 resolves to `null` (→ notFound()); anything else throws, so a failure is never
 * cached and the page's error boundary shows a retry.
 */
const BACKEND = (process.env.BACKEND_URL || "http://localhost:5030").replace(/\/$/, "");

// stale: client router reuse · revalidate: background refresh · expire: hard limit when idle.
const CATALOG = { stale: 60, revalidate: 300, expire: 86_400 };
const BRANDING = { stale: 300, revalidate: 3_600, expire: 604_800 };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = /^[a-f0-9]{24}$/;
export const isSlug = (s) => typeof s === "string" && s.length <= 120 && SLUG_RE.test(s);
export const isId = (s) => typeof s === "string" && ID_RE.test(s);

async function get(path, query, headers) {
  const qs = query
    ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null))}`
    : "";
  const res = await fetch(`${BACKEND}/api/v1${path}${qs}`, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public API ${path} responded ${res.status}`);
  const json = await res.json();
  return { data: json.data ?? null, meta: json.meta ?? null };
}

/** Every page of a paginated list (the catalogue is small; caps keep a bad response bounded). */
async function getAll(path, { limit, maxPages, query }) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await get(path, { ...query, page, limit });
    if (!r) return null;
    items.push(...(r.data ?? []));
    if (!r.meta || page >= r.meta.pages) break;
  }
  return items;
}

/** Name, logo, contact and licence numbers for the header/footer. */
export async function getSiteOrg() {
  "use cache";
  cacheLife(BRANDING);
  cacheTag("org");
  return (await get("/org/public"))?.data ?? null;
}

/** All published projects (cards). Filtering/sorting happens on the page — a developer lists tens, not thousands. */
export async function getPublishedProjects() {
  "use cache";
  cacheLife(CATALOG);
  cacheTag("projects");
  return (await getAll("/public/projects", { limit: 100, maxPages: 10 })) ?? [];
}

export async function getProject(slug) {
  "use cache";
  cacheLife(CATALOG);
  if (!isSlug(slug)) return null;
  cacheTag(`project:${slug}`);
  return (await get(`/public/projects/${slug}`))?.data ?? null;
}

/** Every listed unit of a project (blocked/cancelled are never sent by the API). */
export async function getProjectUnits(slug) {
  "use cache";
  cacheLife(CATALOG);
  if (!isSlug(slug)) return null;
  cacheTag(`project:${slug}`);
  return getAll(`/public/projects/${slug}/units`, { limit: 500, maxPages: 8 });
}

/** Unit + layout + its project. Tagged with the project it belongs to (known only after the read). */
export async function getUnit(id) {
  "use cache";
  cacheLife(CATALOG);
  if (!isId(id)) return null;
  const unit = (await get(`/public/units/${id}`))?.data ?? null;
  if (unit?.project?.slug) cacheTag(`project:${unit.project.slug}`);
  return unit;
}

/** Resolved floor/master plan. `slug` comes from the URL and scopes the cache tag. */
export async function getFloorPlan(slug, id, floor) {
  "use cache";
  cacheLife(CATALOG);
  if (!isSlug(slug) || !isId(id)) return null;
  cacheTag(`project:${slug}`);
  return (await get(`/public/floorplans/${id}`, floor === undefined ? undefined : { floor }))?.data ?? null;
}

// ── Site content & SEO (B2b) — tag `site` ───────────────────────────────────────

export const PAGE_KEYS = ["home", "about", "projects", "contact", "landowners", "compare", "privacy", "terms"];

/** Site-wide SEO settings + which pages are published / noindex. */
export async function getSiteSeo() {
  "use cache";
  cacheLife(BRANDING);
  cacheTag("site");
  return (await get("/public/site"))?.data ?? null;
}

/**
 * A page's visible sections + SEO. In Draft Mode (turned on by /api/preview for signed-in
 * editors) the draft is read instead, signed server-to-server with REVALIDATE_SECRET — the
 * browser never holds that credential, and Draft Mode bypasses this cache for that editor only.
 */
export async function getSitePage(key) {
  "use cache";
  cacheLife(BRANDING); // changes only on publish → pushed by the `site` revalidation tag
  cacheTag("site");
  if (!PAGE_KEYS.includes(key)) return null;
  const { isEnabled } = await draftMode();
  const secret = process.env.REVALIDATE_SECRET ?? "";
  if (isEnabled && secret.length >= 32) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = `sha256=${createHmac("sha256", secret).update(`${ts}.preview:${key}`).digest("hex")}`;
    const draft = await get(`/public/site/pages/${key}`, { preview: "1" }, { "X-PrimePlot-Timestamp": ts, "X-PrimePlot-Signature": sig });
    if (draft) return { ...draft.data, preview: true };
  }
  return (await get(`/public/site/pages/${key}`))?.data ?? null;
}

/**
 * Published page only — for generateMetadata(). Metadata must not depend on request data (Draft
 * Mode) or a short-lived cache: on a page that is otherwise fully prerendered (e.g. /landowners)
 * Next refuses to block the static shell on it. Previews show draft content with live SEO tags.
 */
export async function getPublishedSitePage(key) {
  "use cache";
  cacheLife(BRANDING); // changes only on publish → pushed by the `site` revalidation tag
  cacheTag("site");
  if (!PAGE_KEYS.includes(key)) return null;
  return (await get(`/public/site/pages/${key}`))?.data ?? null;
}

/** Newest published construction update per project (home page). */
export async function getLatestConstruction(limit = 3) {
  "use cache";
  cacheLife(CATALOG);
  cacheTag("site");
  cacheTag("projects");
  return (await get("/public/construction/latest", { limit }))?.data ?? [];
}

/** A project's published construction updates, newest first (first page + cursor). */
export async function getProjectUpdates(slug, limit = 12) {
  "use cache";
  cacheLife(CATALOG);
  if (!isSlug(slug)) return null;
  cacheTag(`project:${slug}`);
  const r = await get(`/public/projects/${slug}/updates`, { limit });
  return r ? { items: r.data ?? [], nextCursor: r.meta?.nextCursor ?? null } : null;
}

/**
 * `next build` never talks to the API: pages that are otherwise static (home, about, contact,
 * header/footer branding) postpone their catalogue part to request time while building, so a
 * build works whether or not the API is up. At runtime the reads are cached (`use cache`) and
 * refreshed by the revalidation webhook, so this costs one cached lookup per request.
 */
async function deferDuringBuild() {
  if (process.env.NEXT_PHASE === "phase-production-build") await connection();
}

/** Branding for the header/footer. Never takes the page down: an API failure → null (generic brand). */
export async function getSiteOrgOrNull() {
  await deferDuringBuild();
  try {
    return await getSiteOrg();
  } catch {
    return null;
  }
}

/** Published projects for home/about/contact. A request-time failure throws (error page with retry). */
export async function getPublishedProjectsOrDefer() {
  await deferDuringBuild();
  return getPublishedProjects();
}

/** Site SEO for metadata: never takes a page down (null → built-in defaults). */
export async function getSiteSeoOrNull() {
  await deferDuringBuild();
  try {
    return await getSiteSeo();
  } catch {
    return null;
  }
}

/** Page content for home/about. A request-time failure throws (error page with retry), like the catalogue. */
export async function getSitePageOrDefer(key) {
  await deferDuringBuild();
  return getSitePage(key);
}

/** Page SEO only (metadata): failures → null so the page keeps its automatic title. */
export async function getPageSeoOrNull(key) {
  await deferDuringBuild();
  try {
    return (await getPublishedSitePage(key))?.seo ?? null;
  } catch {
    return null;
  }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * QR verification of a printed document (API.md › B4.3). Never cached: a document can be voided
 * at any time. Unknown / malformed token → null.
 */
export async function verifyDocument(token) {
  await connection();
  if (!TOKEN_RE.test(token ?? "")) return null;
  const res = await fetch(`${BACKEND}/api/v1/public/verify/${token}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Verify responded ${res.status}`);
  return (await res.json()).data ?? null;
}
