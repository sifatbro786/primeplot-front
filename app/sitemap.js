import { connection } from "next/server";
import { LOCALES } from "@/i18n/routing";
import { getProject, getProjectUnits, getPublishedProjects, getSiteSeo } from "@/lib/public/api";
import { ALLOW_INDEXING, absoluteUrl } from "@/lib/public/site";

/**
 * /sitemap.xml — every public page in both languages with hreflang alternates: the projects
 * index, each published project, its floor/site plans and its available or reserved units.
 * Built from the same cached catalogue reads as the pages (revalidated by the API webhook).
 */
const MAX_URLS = 45_000; // Google's limit is 50k per file

function entry(path, extra = {}) {
  const languages = Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(l, path)]));
  return LOCALES.map((l) => ({ url: absoluteUrl(l, path), alternates: { languages }, ...extra }));
}

const PAGES = [
  ["home", "/", { priority: 1 }],
  ["projects", "/projects", { changeFrequency: "daily", priority: 0.9 }],
  ["about", "/about", { priority: 0.4 }],
  ["contact", "/contact", { priority: 0.5 }],
  ["landowners", "/landowners", { priority: 0.5 }],
  ["privacy", "/privacy", { priority: 0.2 }],
  ["terms", "/terms", { priority: 0.2 }],
];

async function build(site) {
  // Website › SEO: pages marked noindex are left out; lastModified = last publish.
  const meta = new Map((site?.pages ?? []).map((p) => [p.key, p]));
  const out = PAGES.filter(([key]) => !meta.get(key)?.noindex).flatMap(([key, path, extra]) => {
    const at = meta.get(key)?.publishedAt;
    return entry(path, { ...extra, ...(at && { lastModified: new Date(at) }) });
  });
  const projects = await getPublishedProjects();
  for (const card of projects) {
    const [project, units] = await Promise.all([getProject(card.slug), getProjectUnits(card.slug)]);
    if (!project || project.seo?.noindex) continue;
    const lastModified = project.updatedAt ? new Date(project.updatedAt) : undefined;
    out.push(...entry(`/projects/${project.slug}`, { lastModified, changeFrequency: "daily", priority: 0.8 }));
    for (const plan of project.floorPlans ?? []) out.push(...entry(`/projects/${project.slug}/plans/${plan.id}`, { priority: 0.5 }));
    for (const u of units ?? []) {
      if (u.status === "available" || u.status === "held") out.push(...entry(`/projects/${project.slug}/units/${u.id}`, { priority: 0.6 }));
    }
    if (out.length >= MAX_URLS) break;
  }
  return out.slice(0, MAX_URLS);
}

export default async function sitemap() {
  if (!ALLOW_INDEXING) return []; // staging/dev: nothing to advertise
  // Never call the API during `next build` — the sitemap is rendered (and cached) on request.
  if (process.env.NEXT_PHASE === "phase-production-build") await connection();
  const site = await getSiteSeo().catch(() => null);
  if (site?.settings?.indexing === false) return []; // switched off in Website › SEO
  return build(site);
}
