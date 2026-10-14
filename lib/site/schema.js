/**
 * Editor descriptors for site sections — mirror of the API's section schemas
 * (pb: src/modules/site/site.schema.js; contract: API.md › B2b). One generic form renders all.
 *
 * Field kinds: t (bilingual line) · ta (bilingual paragraph) · long (bilingual long text) ·
 * text (one string) · href (site path or https) · url (https) · youtube · icon · image ·
 * select · group (nested fields) · list (repeating items).
 */
export const ICON_KEYS = [
  "shield-check", "building", "hammer", "hard-hat", "handshake", "key", "clock", "receipt", "map-pin", "leaf", "users", "award", "ruler",
  "landmark", "sparkles", "eye", "qr-code", "home", "file-check", "phone", "wallet", "trees", "sun", "droplets", "zap", "lock",
];
export const LOGO_GROUPS = ["approval", "membership", "bank", "partner"];

const f = (name, kind, max, extra = {}) => ({ name, kind, max, ...extra });
const list = (name, max, item, labelField) => ({ name, kind: "list", max, item, labelField });
const group = (name, fields) => ({ name, kind: "group", fields });

const eyebrow = f("eyebrow", "t", 80);
const title = f("title", "t", 160, { emph: true });
const body = f("body", "ta", 600);

export const TYPES = {
  hero: [eyebrow, title, f("body", "ta", 400), group("primary", [f("label", "t", 40), f("href", "href")]), group("secondary", [f("label", "t", 40), f("href", "href")])],
  stats: [f("note", "ta", 300)],
  heading: [eyebrow, title, body],
  cards: [eyebrow, title, body, list("items", 8, [f("icon", "icon"), f("title", "t", 120), f("body", "ta", 400)], "title")],
  figures: [eyebrow, title, body, list("items", 6, [f("value", "text", 12), f("label", "t", 80)], "value")],
  steps: [eyebrow, title, list("items", 6, [f("title", "t", 120), f("body", "ta", 400)], "title")],
  testimonials: [
    eyebrow,
    title,
    list("items", 12, [f("name", "t", 80), f("role", "t", 120), f("quote", "ta", 800), f("photoMediaId", "image", undefined, { round: true })], "name"),
  ],
  cta: [eyebrow, title, body, f("label", "t", 40), f("href", "href")],
  logos: [
    eyebrow,
    title,
    list("items", 24, [f("name", "text", 120), f("group", "select", undefined, { options: LOGO_GROUPS }), f("logoMediaId", "image", undefined, { contain: true }), f("url", "url")], "name"),
  ],
  video: [eyebrow, title, body, f("youtubeUrl", "youtube"), f("posterMediaId", "image")],
  faq: [eyebrow, title, list("items", 20, [f("q", "t", 200), f("a", "ta", 1500)], "q")],
  intro: [eyebrow, title, f("body", "long", 5000), f("imageMediaId", "image")],
  story: [eyebrow, title, f("body", "long", 5000), list("milestones", 20, [f("year", "text", 10), f("title", "t", 120), f("body", "ta", 400)], "year")],
  mission: [eyebrow, title, f("mission", "ta", 800), f("vision", "ta", 800), list("values", 8, [f("title", "t", 80), f("body", "ta", 300)], "title")],
  message: [eyebrow, f("name", "t", 80), f("designation", "t", 120), f("message", "long", 5000), f("photoMediaId", "image"), f("signatureMediaId", "image", undefined, { contain: true })],
  people: [eyebrow, title, list("items", 24, [f("name", "t", 80), f("designation", "t", 120), f("bio", "ta", 500), f("photoMediaId", "image")], "name")],
  awards: [eyebrow, title, list("items", 20, [f("year", "text", 10), f("title", "t", 160), f("by", "t", 120), f("logoMediaId", "image", undefined, { contain: true })], "title")],
  csr: [eyebrow, title, body, list("items", 12, [f("title", "t", 120), f("body", "ta", 500), f("imageMediaId", "image")], "title")],
};

/** Pages with sections (the rest are SEO-only). Hero / intro carry the page's main heading: pinned on top, always on. */
export const PAGES = {
  home: ["hero", "stats", "featured", "whyUs", "trackRecord", "construction", "areas", "howItWorks", "testimonials", "landownerCta", "partners", "video", "faq", "enquiry"],
  about: ["intro", "stats", "story", "missionVision", "principles", "leaderMessage", "team", "quality", "completed", "credentials", "awards", "csr", "cta"],
};
export const PINNED = { home: ["hero"], about: ["intro"] };
export const PAGE_KEYS = ["home", "about", "projects", "contact", "landowners", "compare", "privacy", "terms"];
export const PAGE_PATHS = { home: "/", about: "/about", projects: "/projects", contact: "/contact", landowners: "/landowners", compare: "/compare", privacy: "/privacy", terms: "/terms" };

/** Sections whose main content comes from projects/settings (the editor only sets the heading). */
export const DATA_DRIVEN = new Set(["stats", "featured", "construction", "areas", "enquiry", "completed"]);

const has = (t) => Boolean(t?.en?.trim() || t?.bn?.trim());

/** Same rule as the API: an enabled section shows only when it has something to show. */
export function hasContent(key, type, data) {
  switch (type) {
    case "cards":
    case "figures":
    case "steps":
    case "testimonials":
    case "faq":
    case "people":
    case "awards":
      return (data.items ?? []).length > 0;
    case "logos":
      return key === "credentials" || (data.items ?? []).length > 0;
    case "video":
      return Boolean(youtubeId(data.youtubeUrl));
    case "message":
      return has(data.message);
    case "story":
      return has(data.body) || (data.milestones ?? []).length > 0;
    case "mission":
      return has(data.mission) || has(data.vision) || (data.values ?? []).length > 0;
    case "csr":
      return has(data.body) || (data.items ?? []).length > 0;
    default:
      return true;
  }
}

const YT = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#].*)?$/;
export const youtubeId = (url) => YT.exec(url ?? "")?.[1] ?? null;
export const isHref = (v) => v === "" || /^\/(?!\/)[^\s<>"']*$/.test(v) || /^https:\/\/[^\s<>"']+$/.test(v);
export const isHttps = (v) => v === "" || /^https:\/\/[^\s<>"']+$/.test(v);

/** Empty value for a field (new list items). */
export function emptyOf(field) {
  switch (field.kind) {
    case "t":
    case "ta":
    case "long":
      return { en: "", bn: "" };
    case "icon":
      return "sparkles";
    case "image":
      return null;
    case "select":
      return field.options[0];
    case "list":
      return [];
    case "group":
      return Object.fromEntries(field.fields.map((x) => [x.name, emptyOf(x)]));
    default:
      return "";
  }
}

/** Drop resolved media (`photo` next to `photoMediaId`) — what the API stores. */
export function stripResolved(value) {
  if (Array.isArray(value)) return value.map(stripResolved);
  if (!value || typeof value !== "object") return value;
  const drop = new Set(Object.keys(value).filter((k) => k.endsWith("MediaId")).map((k) => k.slice(0, -"MediaId".length)));
  return Object.fromEntries(Object.entries(value).filter(([k]) => !drop.has(k)).map(([k, v]) => [k, stripResolved(v)]));
}

/** Immutable set at a path: setIn(obj, ["items", 0, "title"], v). */
export function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  copy[k] = setIn(obj?.[k], rest, value);
  return copy;
}
