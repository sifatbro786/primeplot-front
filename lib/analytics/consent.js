/**
 * Visitor cookie consent for the public site (client only).
 *
 * One first-party cookie `pp_consent` = "granted.<tools>" | "denied", kept 180 days. No value = not
 * asked yet. `<tools>` records what the visitor agreed to (g = GA4, p = Meta Pixel): if the admin
 * switches on a tool later, the visitor is asked again. Tags load only while consent covers them.
 * Changes are broadcast with a `pp:consent` window event so the banner and the tag loader stay in sync.
 */
const COOKIE = "pp_consent";
const MAX_AGE = 180 * 24 * 60 * 60;
export const CONSENT_EVENT = "pp:consent";
export const CONSENT_OPEN_EVENT = "pp:consent-open";

/** Raw cookie value: "granted.gp" | "denied" | null. */
export function readConsent() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)pp_consent=(granted\.[gp]*|denied)(?:;|$)/);
  return m ? m[1] : null;
}

/** "granted" only when the stored grant covers every tool in `tools` ("g", "p", "gp"). */
export function consentFor(raw, tools) {
  if (raw === "denied") return "denied";
  if (raw?.startsWith("granted.") && [...tools].every((c) => raw.slice(8).includes(c))) return "granted";
  return "none";
}

/** Tracking cookies the tags set on this site; removed when a visitor withdraws consent. */
const TRACKING_COOKIE = /^(_ga(_.*)?|_gid|_gat.*|_fbp|_fbc)$/;

function clearTrackingCookies() {
  const host = location.hostname;
  // GA/Pixel write on the registrable domain (".example.com"); try the host and each parent.
  const parts = host.split(".");
  const domains = ["", ...parts.slice(0, -1).map((_, i) => `.${parts.slice(i).join(".")}`)];
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!TRACKING_COOKIE.test(name)) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
  }
}

/** value: "granted" | "denied"; tools: the tags switched on right now ("g", "p", "gp"). */
export function setConsent(value, tools = "") {
  const previous = readConsent();
  const stored = value === "granted" ? `granted.${tools}` : "denied";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${stored}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: stored }));
  // Loaded tags can't be unloaded: drop their cookies and reload once so nothing keeps running.
  if (previous?.startsWith("granted") && value === "denied") {
    clearTrackingCookies();
    location.reload();
  }
}

/** Re-open the banner (footer "Cookie settings"). */
export const openConsent = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
