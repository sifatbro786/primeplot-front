import { Suspense } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { HeroMedia } from "@/components/site/HeroMedia";
import { HeroSearch } from "@/components/site/HeroSearch";
import { LeadForm } from "@/components/site/LeadForm";
import { FeaturedProjectRow, ProjectCard } from "@/components/site/ProjectCard";
import { Reveal } from "@/components/site/Reveal";
import { StatsBand } from "@/components/site/StatsBand";
import { Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { formatNumber, localizeDigits } from "@/lib/format";
import { getPublishedProjectsOrDefer, getSiteOrgOrNull } from "@/lib/public/api";
import { areaOptions, areaSummary, catalogueStats } from "@/lib/public/listing";
import { alternatesFor, HERO_MEDIA, jsonLd, pick, SITE_URL } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.home"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return {
    title: { absolute: `${name} — ${t("metaTitle")}` },
    description: t("metaDescription", { name }),
    alternates: alternatesFor(locale, "/"),
    openGraph: { title: name, description: t("metaDescription", { name }), type: "website" },
  };
}

function Head({ eyebrow, title, link }) {
  return (
    <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{title}</h2>
      </div>
      {link}
    </div>
  );
}

/** Data-driven part of the home page (catalogue + branding), streamed after the static hero. */
async function HomeCatalogue() {
  const [locale, t, projects, org] = await Promise.all([getLocale(), getTranslations("site.home"), getPublishedProjectsOrDefer(), getSiteOrgOrNull()]);
  const stats = catalogueStats(projects);
  const featured = projects.filter((p) => p.featured);
  const lead = featured[0] ?? projects[0];
  const more = projects.filter((p) => p !== lead).slice(0, 3);
  const areas = areaSummary(projects, locale).slice(0, 6);
  const name = pick(org, "name", locale);

  const ld = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: name || undefined,
    url: `${SITE_URL}/${locale}`,
    ...(org?.phone && { telephone: org.phone }),
    ...(org?.email && { email: org.email }),
    ...(org?.logo?.urls?.card && { logo: org.logo.urls.card }),
    ...(pick(org, "address", locale) && { address: { "@type": "PostalAddress", streetAddress: pick(org, "address", locale), addressCountry: "BD" } }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <div className="relative z-10 mx-auto -mt-16 w-full max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <HeroSearch areas={areaOptions(projects, locale)} />
      </div>

      <Reveal className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mt-14">
          <StatsBand stats={stats} dark />
          {stats.available > 0 && <p className="mt-3 text-xs text-ink-subtle">{t("statsNote")}</p>}
        </div>

        {lead && (
          <section aria-labelledby="home-featured" className="mt-24">
            <Head
              eyebrow={t("featuredEyebrow")}
              title={<span id="home-featured">{t("featuredTitle")}</span>}
              link={
                <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
                  {t("allProjects")}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              }
            />
            <div data-reveal className="mt-10">
              <FeaturedProjectRow project={lead} priority={false} />
            </div>
            {more.length > 0 && (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {more.map((p) => (
                  <div key={p.id} data-reveal>
                    <ProjectCard project={p} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </Reveal>

      {areas.length > 0 && (
        <Reveal as="section" aria-labelledby="home-areas" className="grain mt-28 border-y border-sage-line bg-sage-tint">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:px-8">
            <div data-reveal>
              <p className="eyebrow">{t("areasEyebrow")}</p>
              <h2 id="home-areas" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
                {t("areasTitle")}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">{t("areasBody")}</p>
            </div>
            <ul data-reveal className="divide-y divide-sage-line border-y border-sage-line">
              {areas.map((a, i) => (
                <li key={a.value}>
                  <Link href={`/projects?area=${encodeURIComponent(a.value)}`} className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-4 py-5">
                    <span className="font-mono text-xs text-ink-subtle">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                    <span className="font-display text-2xl transition-colors group-hover:text-accent sm:text-3xl">{a.label}</span>
                    <span className="flex items-center gap-4 text-xs text-ink-muted">
                      <span className="hidden sm:inline">{t("areaProjects", { count: a.projects, n: formatNumber(a.projects, locale) })}</span>
                      <span className="font-mono text-ink">{t("areaAvailable", { n: formatNumber(a.available, locale) })}</span>
                      <ArrowUpRight aria-hidden className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      <Reveal as="section" aria-labelledby="home-how" className={`band-dark grain ${areas.length ? "" : "mt-28"}`}>
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div data-reveal className="max-w-2xl">
            <p className="eyebrow">{t("howEyebrow")}</p>
            <h2 id="home-how" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("howTitle")}
            </h2>
          </div>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-primary-deep bg-primary-deep sm:grid-cols-2 lg:grid-cols-4">
            {["choose", "visit", "book", "pay"].map((k, i) => (
              <li key={k} data-reveal className="bg-primary p-6">
                <span className="font-display text-4xl text-accent-on-dark">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                <h3 className="mt-5 text-base font-semibold">{t(`how.${k}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-ink/70">{t(`how.${k}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="home-enquiry" className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8">
        <div data-reveal>
          <p className="eyebrow">{t("enquiryEyebrow")}</p>
          <h2 id="home-enquiry" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {t("enquiryTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted">{t("enquiryBody")}</p>
        </div>
        <div data-reveal>
          <LeadForm phone={org?.phone} projects={projects.map((p) => ({ slug: p.slug, name: pick(p, "name", locale) }))} />
        </div>
      </Reveal>
    </>
  );
}

export default async function HomePage() {
  const t = await getTranslations("site.home");
  return (
    <>
      {/* hero: static (no data) so it is in the prerendered shell — the poster is the LCP image */}
      <section aria-labelledby="home-hero" className="px-2 pt-2 sm:px-4 sm:pt-4">
        <div className="relative mx-auto flex min-h-[34rem] max-w-[96rem] items-end overflow-hidden rounded-lg sm:h-[82svh]">
          <HeroMedia sources={HERO_MEDIA.sources} poster={HERO_MEDIA.poster} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-ink/5" />
          <div className="relative w-full px-5 pt-32 pb-28 sm:px-10 sm:pb-36 lg:px-14">
            <p className="eyebrow text-accent-on-dark">{t("heroEyebrow")}</p>
            <h1 id="home-hero" className="mt-5 max-w-3xl font-display text-[2.6rem] leading-[1.04] text-white sm:text-6xl lg:text-7xl">
              {t.rich("heroTitle", { em: (c) => <em className="italic text-accent-on-dark">{c}</em> })}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85">{t("heroBody")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/projects"
                className="inline-flex h-12 items-center gap-2.5 rounded-md bg-surface px-6 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-canvas"
              >
                {t("heroPrimary")}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-md border border-white/40 px-6 text-sm font-medium tracking-wide text-white transition-colors hover:bg-white/10"
              >
                {t("heroSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto -mt-16 w-full max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
            <Skeleton className="relative h-40 w-full rounded-lg" />
          </div>
        }
      >
        <HomeCatalogue />
      </Suspense>
    </>
  );
}
