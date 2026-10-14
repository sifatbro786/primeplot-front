import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ListingControls } from "@/components/site/ListingControls";
import { FeaturedProjectRow, placeOf, ProjectCard } from "@/components/site/ProjectCard";
import { SiteMapLazy } from "@/components/site/SiteMapLazy";
import { getPublishedProjects, getSiteOrgOrNull } from "@/lib/public/api";
import { applyListing, areaOptions, hasActiveFilters, parseListingQuery } from "@/lib/public/listing";
import { buildMetadata } from "@/lib/public/seo";
import { pick } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([
    getLocale(),
    getTranslations("site.list"),
    getTranslations("site"),
    getSiteOrgOrNull(),
  ]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return buildMetadata({
    key: "projects",
    locale,
    path: "/projects",
    company: name,
    title: t("metaTitle"),
    description: t("metaDescription", { name }),
    openGraph: { type: "website" },
  });
}

function ResultsSkeleton() {
  return (
    <div className="relative -mt-7">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function Results({ searchParams }) {
  // Request data first: nothing below may run (or call the API) while the page is prerendered.
  const sp = await searchParams;
  const [locale, t, all] = await Promise.all([getLocale(), getTranslations("site.list"), getPublishedProjects()]);
  const filters = parseListingQuery(sp);
  const results = applyListing(all, filters);
  const plain = !hasActiveFilters(filters) && filters.sort === "featured" && filters.view === "grid";
  // Unfiltered: featured projects get the wide editorial rows, the rest the grid.
  const featured = plain ? results.filter((p) => p.featured).slice(0, 2) : [];
  const rest = plain ? results.filter((p) => !featured.includes(p)) : results;
  const located = results.filter((p) => p.location?.lat != null && p.location?.lng != null);

  return (
    <div className="relative -mt-7">
      <ListingControls filters={filters} areas={areaOptions(all, locale)} count={results.length}>
        {all.length === 0 ? (
          <EmptyState icon={Building2} title={t("noneTitle")} description={t("noneBody")} className="mt-10" />
        ) : results.length === 0 ? (
          <EmptyState icon={Building2} title={t("emptyTitle")} description={t("emptyBody")} className="mt-10" />
        ) : filters.view === "map" ? (
          <div className="mt-8">
            <SiteMapLazy
              className="h-[60vh] min-h-96"
              label={t("mapLabel")}
              points={located.map((p) => ({
                id: p.id,
                lat: p.location.lat,
                lng: p.location.lng,
                title: pick(p, "name", locale),
                subtitle: placeOf(p.location, locale),
                href: `/${locale}/projects/${p.slug}`,
              }))}
            />
            {located.length < results.length && (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-ink-muted">{t("notOnMap")}</h2>
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {results
                    .filter((p) => !located.includes(p))
                    .map((p) => (
                      <ProjectCard key={p.id} project={p} />
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <div className="mt-10 space-y-6">
                {featured.map((p, i) => (
                  <FeaturedProjectRow key={p.id} project={p} priority={i === 0} flip={i % 2 === 1} />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p, i) => (
                  <ProjectCard key={p.id} project={p} priority={!featured.length && i < 3} />
                ))}
              </div>
            )}
          </>
        )}
      </ListingControls>
    </div>
  );
}

export default async function ProjectsPage({ searchParams }) {
  const t = await getTranslations("site.list");
  return (
    <>
      <header className="grain border-b border-sage-line bg-sage-tint">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-14 pb-12 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:px-8 lg:pt-20 lg:pb-16">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
              {t.rich("title", { em: (c) => <em className="text-accent italic">{c}</em> })}
            </h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-ink-muted lg:justify-self-end">{t("intro")}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Suspense fallback={<ResultsSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
