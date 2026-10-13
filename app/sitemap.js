import { connection } from "next/server";
import { LOCALES } from "@/i18n/routing";
import { getProject, getProjectUnits, getPublishedProjects } from "@/lib/public/api";
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

async function build() {
  const out = [...entry("/", { priority: 1 }), ...entry("/projects", { changeFrequency: "daily", priority: 0.9 }),
    ...entry("/about", { priority: 0.4 }),
    ...entry("/contact", { priority: 0.5 }),
    ...entry("/landowners", { priority: 0.5 }),
    ...entry("/privacy", { priority: 0.2 }),
    ...entry("/terms", { priority: 0.2 }),
  ];
  const projects = await getPublishedProjects();
  for (const card of projects) {
    const [project, units] = await Promise.all([getProject(card.slug), getProjectUnits(card.slug)]);
    if (!project) continue;
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
  return build();
}
