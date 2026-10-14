import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { HeroMedia } from "@/components/site/HeroMedia";
import { HomeSections } from "@/components/site/sections/HomeSections";
import { Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { getLatestConstruction, getPublishedProjectsOrDefer, getSiteOrgOrNull, getSitePageOrDefer, getSiteSeoOrNull } from "@/lib/public/api";
import { Emph, makeText, plain, sectionMap } from "@/lib/public/content";
import { buildMetadata, sameAs } from "@/lib/public/seo";
import { HERO_MEDIA, jsonLd, pick, SITE_URL } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.home"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return buildMetadata({
    key: "home",
    locale,
    path: "/",
    company: name,
    title: `${name} — ${t("metaTitle")}`,
    description: t("metaDescription", { name }),
    absolute: true,
    openGraph: { type: "website" },
  });
}

/** Hero copy from the dashboard (the built-in text when the hero section is switched off). */
async function HeroText() {
  const [locale, t, page, org] = await Promise.all([getLocale(), getTranslations("site.home"), getSitePageOrDefer("home"), getSiteOrgOrNull()]);
  const T = makeText(locale, pick(org, "name", locale));
  const hero = sectionMap(page).get("hero")?.data;
  const title = hero ? T(hero.title) : t("heroTitle").replace(/<\/?em>/g, "*");
  const primary = hero ? { label: T(hero.primary.label), href: hero.primary.href } : { label: t("heroPrimary"), href: "/projects" };
  const secondary = hero ? { label: T(hero.secondary.label), href: hero.secondary.href } : { label: t("heroSecondary"), href: "/contact" };
  const link = (l, cls, icon) =>
    l.label &&
    l.href &&
    (l.href.startsWith("/") ? (
      <Link href={l.href} className={cls}>
        {l.label}
        {icon}
      </Link>
    ) : (
      <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {l.label}
        {icon}
      </a>
    ));
  return (
    <>
      {(hero ? T(hero.eyebrow) : t("heroEyebrow")) && <p className="eyebrow text-accent-on-dark">{hero ? T(hero.eyebrow) : t("heroEyebrow")}</p>}
      <h1 id="home-hero" className="mt-5 max-w-3xl font-display text-[2.6rem] leading-[1.04] text-white sm:text-6xl lg:text-7xl">
        <Emph text={title} emClassName="italic text-accent-on-dark" />
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85">{hero ? T(hero.body) : t("heroBody")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {link(
          primary,
          "inline-flex h-12 items-center gap-2.5 rounded-md bg-surface px-6 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-canvas",
          <ArrowRight aria-hidden className="size-4" />,
        )}
        {link(
          secondary,
          "inline-flex h-12 items-center rounded-md border border-white/40 px-6 text-sm font-medium tracking-wide text-white transition-colors hover:bg-white/10",
        )}
      </div>
    </>
  );
}

/** Data-driven body (sections from the dashboard + catalogue), streamed after the hero. */
async function HomeBody() {
  const [locale, page, projects, org, site] = await Promise.all([
    getLocale(),
    getSitePageOrDefer("home"),
    getPublishedProjectsOrDefer(),
    getSiteOrgOrNull(),
    getSiteSeoOrNull(),
  ]);
  const sections = sectionMap(page);
  const latest = sections.has("construction") ? await getLatestConstruction(3) : [];
  const name = pick(org, "name", locale);
  const T = makeText(locale, name);

  const organization = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: name || undefined,
    url: `${SITE_URL}/${locale}`,
    ...(org?.phone && { telephone: org.phone }),
    ...(org?.email && { email: org.email }),
    ...(org?.logo?.urls?.card && { logo: org.logo.urls.card }),
    ...(pick(org, "address", locale) && { address: { "@type": "PostalAddress", streetAddress: pick(org, "address", locale), addressCountry: "BD" } }),
    ...(sameAs(site).length && { sameAs: sameAs(site) }),
  };
  const faq = sections.get("faq")?.data.items ?? [];
  const faqLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq
          .filter((f) => T(f.q) && T(f.a))
          .map((f) => ({ "@type": "Question", name: plain(T(f.q)), acceptedAnswer: { "@type": "Answer", text: plain(T(f.a)) } })),
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />}
      <HomeSections page={page} projects={projects} org={org} latest={latest} />
    </>
  );
}

export default function HomePage() {
  return (
    <>
      {/* hero frame + media are static (in the prerendered shell — the poster is the LCP image); the copy streams in */}
      <section aria-labelledby="home-hero" className="px-2 pt-2 sm:px-4 sm:pt-4">
        <div className="relative mx-auto flex min-h-[34rem] max-w-[96rem] items-end overflow-hidden rounded-lg sm:h-[82svh]">
          <HeroMedia sources={HERO_MEDIA.sources} poster={HERO_MEDIA.poster} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-ink/5" />
          <div className="relative w-full px-5 pt-32 pb-28 sm:px-10 sm:pb-36 lg:px-14">
            <Suspense
              fallback={
                <div aria-hidden className="max-w-3xl space-y-5">
                  <div className="h-3 w-40 rounded bg-white/20" />
                  <div className="h-14 w-full rounded bg-white/15 sm:h-20" />
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                </div>
              }
            >
              <HeroText />
            </Suspense>
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
        <HomeBody />
      </Suspense>
    </>
  );
}
