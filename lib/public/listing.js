import { BUDGETS } from "./status";

/**
 * /projects query → normalized filters (unknown values are dropped, never trusted).
 * type=apartment|plot · stage · area (English area name) · budget (BUDGETS key) · q · sort · view
 */
const STAGES = ["upcoming", "ongoing", "ready", "completed"];
const SORTS = ["featured", "price", "handover"];
const one = (v) => (Array.isArray(v) ? v[0] : v);
const clean = (v, max = 100) => {
  const s = typeof one(v) === "string" ? one(v).trim().slice(0, max) : "";
  return s || null;
};

export function parseListingQuery(sp = {}) {
  const type = clean(sp.type);
  const stage = clean(sp.stage);
  const budget = clean(sp.budget);
  const sort = clean(sp.sort);
  return {
    q: clean(sp.q, 80),
    type: type === "apartment" || type === "plot" ? type : null,
    stage: STAGES.includes(stage) ? stage : null,
    area: clean(sp.area),
    budget: budget && budget in BUDGETS ? budget : null,
    sort: SORTS.includes(sort) ? sort : "featured",
    view: clean(sp.view) === "map" ? "map" : "grid",
  };
}

export const hasActiveFilters = (f) => Boolean(f.q || f.type || f.stage || f.area || f.budget);

const norm = (s) => (s ?? "").toLocaleLowerCase().normalize("NFC");

/** Distinct areas for the filter, labelled in the page language, sorted by label. */
export function areaOptions(projects, locale) {
  const map = new Map();
  for (const p of projects) {
    const en = p.location?.area?.trim();
    if (!en || map.has(norm(en))) continue;
    map.set(norm(en), { value: en, label: (locale === "bn" && p.location.areaBn) || en });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function applyListing(projects, f) {
  const q = norm(f.q);
  let out = projects.filter((p) => {
    if (f.type && p.kind !== f.type) return false;
    if (f.stage && p.stage !== f.stage) return false;
    if (f.area && norm(p.location?.area) !== norm(f.area)) return false;
    if (f.budget) {
      const from = p.inventory?.priceFrom;
      const [min, max] = BUDGETS[f.budget];
      if (from == null || from < min || from >= max) return false;
    }
    if (q) {
      const hay = [p.name, p.nameBn, p.location?.area, p.location?.areaBn, p.location?.city].map(norm).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const last = (v) => (v == null ? Infinity : v);
  if (f.sort === "price") out = [...out].sort((a, b) => last(a.inventory?.priceFrom) - last(b.inventory?.priceFrom));
  if (f.sort === "handover") {
    out = [...out].sort((a, b) => last(a.handoverAt && Date.parse(a.handoverAt)) - last(b.handoverAt && Date.parse(b.handoverAt)));
  }
  return out;
}

/** Same query without one key (for "remove filter" links) or with overrides. */
export function listingHref(f, overrides = {}) {
  const next = { ...f, ...overrides };
  const qs = new URLSearchParams();
  for (const k of ["q", "type", "stage", "area", "budget"]) if (next[k]) qs.set(k, next[k]);
  if (next.sort && next.sort !== "featured") qs.set("sort", next.sort);
  if (next.view === "map") qs.set("view", "map");
  const s = qs.toString();
  return s ? `/projects?${s}` : "/projects";
}
