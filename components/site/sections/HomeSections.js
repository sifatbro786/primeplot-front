import { ArrowRight, ArrowUpRight, Quote } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { HeroSearch } from "@/components/site/HeroSearch";
import { LeadForm } from "@/components/site/LeadForm";
import { FeaturedProjectRow, ProjectCard } from "@/components/site/ProjectCard";
import { Reveal } from "@/components/site/Reveal";
import { StatsBand } from "@/components/site/StatsBand";
import { Link } from "@/i18n/navigation";
import { formatNumber, localizeDigits } from "@/lib/format";
import { makeText, Paragraphs } from "@/lib/public/content";
import { areaOptions, areaSummary, catalogueStats } from "@/lib/public/listing";
import { pick } from "@/lib/public/site";
import { ConstructionCard, FaqList, FeatureList, LogoGroups, Monogram, OwnImage, SectionHead } from "./parts";
import { VideoTour } from "./VideoTour";

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * Home page body (everything below the hero), in the order set in the dashboard. Only visible
 * sections arrive from the API; data-driven ones (featured, areas, construction) also hide
 * when there is nothing to show. Contract: API.md › B2b.
 */
export async function HomeSections({ page, projects, org, latest }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("site.home")]);
  const company = pick(org, "name", locale);
  const T = makeText(locale, company);
  const stats = catalogueStats(projects);
  const featured = projects.filter((p) => p.featured);
  const lead = featured[0] ?? projects[0];
  const more = projects.filter((p) => p !== lead).slice(0, 3);
  const areas = areaSummary(projects, locale).slice(0, 6);
  const sections = (page?.sections ?? []).filter((s) => s.key !== "hero");

  const render = {
    stats: ({ data }) =>
      stats.projects > 0 && (
        <Reveal className={WRAP}>
          <div data-reveal className="mt-14">
            <StatsBand stats={stats} dark />
            {stats.available > 0 && T(data.note) && <p className="mt-3 text-xs text-ink-subtle">{T(data.note)}</p>}
          </div>
        </Reveal>
      ),

    featured: ({ data }) =>
      lead && (
        <Reveal as="section" aria-labelledby="home-featured" className={`${WRAP} mt-24`}>
          <SectionHead
            id="home-featured"
            eyebrow={T(data.eyebrow)}
            title={T(data.title)}
            body={T(data.body)}
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
        </Reveal>
      ),

    whyUs: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-why" className={`${WRAP} mt-28 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="home-why" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
        </div>
        <FeatureList items={data.items} T={T} />
      </Reveal>
    ),

    trackRecord: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-record" className={`${WRAP} mt-28`}>
        <SectionHead id="home-record" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
        <dl data-reveal className="mt-10 grid grid-cols-2 border-y border-line-strong lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
          {data.items.map((it, i) => (
            <div key={i} className="border-line py-8 pr-4 odd:border-r lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0">
              <dd className="font-display text-5xl leading-none tracking-tight sm:text-6xl">{localizeDigits(it.value, locale)}</dd>
              <dt className="mt-3 text-sm text-ink-muted">{T(it.label)}</dt>
            </div>
          ))}
        </dl>
      </Reveal>
    ),

    construction: ({ data }) =>
      latest.length > 0 && (
        <Reveal as="section" aria-labelledby="home-construction" className={`${WRAP} mt-28`}>
          <SectionHead id="home-construction" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((u) => (
              <li key={u.id} data-reveal>
                <ConstructionCard update={u} T={T} />
              </li>
            ))}
          </ul>
        </Reveal>
      ),

    areas: ({ data }) =>
      areas.length > 0 && (
        <Reveal as="section" aria-labelledby="home-areas" className="grain mt-28 border-y border-sage-line bg-sage-tint">
          <div className={`${WRAP} grid gap-10 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
            <SectionHead id="home-areas" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
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
      ),

    howItWorks: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-how" className="band-dark grain mt-28">
        <div className={`${WRAP} py-20`}>
          <SectionHead id="home-how" eyebrow={T(data.eyebrow)} title={T(data.title)} dark />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-primary-deep bg-primary-deep sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr">
            {data.items.map((it, i) => (
              <li key={i} data-reveal className="bg-primary p-6">
                <span className="font-display text-4xl text-accent-on-dark">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                <h3 className="mt-5 text-base font-semibold">{T(it.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-ink/70">{T(it.body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    ),

    testimonials: ({ data }) => {
      const [first, ...rest] = data.items;
      return (
        <Reveal as="section" aria-labelledby="home-voices" className="grain mt-28 border-y border-sage-line bg-sage-tint">
          <div className={`${WRAP} py-20`}>
            <SectionHead id="home-voices" eyebrow={T(data.eyebrow)} title={T(data.title)} />
            <figure data-reveal className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end">
              <blockquote className="relative font-display text-2xl leading-snug sm:text-3xl">
                <Quote aria-hidden className="mb-4 size-8 text-accent" strokeWidth={1.25} />
                <Paragraphs text={T(first.quote)} className="space-y-4" />
              </blockquote>
              <Person name={T(first.name)} role={T(first.role)} photo={first.photo} large />
            </figure>
            {rest.length > 0 && (
              <ul className="mt-14 grid gap-px overflow-hidden rounded-lg border border-sage-line bg-sage-line sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((it, i) => (
                  <li key={i} data-reveal className="bg-paper">
                    <figure className="flex h-full flex-col gap-6 p-6">
                      <blockquote className="text-[15px] leading-relaxed">
                        <Paragraphs text={T(it.quote)} className="space-y-3" />
                      </blockquote>
                      <Person name={T(it.name)} role={T(it.role)} photo={it.photo} />
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      );
    },

    landownerCta: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-landowner" className={`${WRAP} mt-28`}>
        <div data-reveal className="grid gap-8 rounded-lg border border-line-strong bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <SectionHead id="home-landowner" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
          {data.href && T(data.label) && (
            <div className="lg:justify-self-end">
              <CtaLink href={data.href} label={T(data.label)} />
            </div>
          )}
        </div>
      </Reveal>
    ),

    partners: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-partners" className={`${WRAP} mt-28`}>
        <SectionHead id="home-partners" eyebrow={T(data.eyebrow)} title={T(data.title)} />
        <div className="mt-10">
          <LogoGroups items={data.items} />
        </div>
      </Reveal>
    ),

    video: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-video" className="band-dark grain mt-28">
        <div className={`${WRAP} grid gap-10 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center`}>
          <SectionHead id="home-video" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} dark />
          <div data-reveal>
            <VideoTour youtubeId={data.youtubeId} title={T(data.title)} poster={data.poster} />
          </div>
        </div>
      </Reveal>
    ),

    faq: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-faq" className={`${WRAP} mt-28 grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
        <SectionHead id="home-faq" eyebrow={T(data.eyebrow)} title={T(data.title)} />
        <FaqList items={data.items} T={T} />
      </Reveal>
    ),

    enquiry: ({ data }) => (
      <Reveal as="section" aria-labelledby="home-enquiry" className={`${WRAP} grid gap-10 py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
        <SectionHead id="home-enquiry" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
        <div data-reveal>
          <LeadForm phone={org?.phone} projects={projects.map((p) => ({ slug: p.slug, name: pick(p, "name", locale) }))} />
        </div>
      </Reveal>
    ),
  };

  const last = sections.at(-1)?.key;
  return (
    <>
      <div className="relative z-10 mx-auto -mt-16 w-full max-w-6xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <HeroSearch areas={areaOptions(projects, locale)} />
      </div>
      {sections.map((s) => {
        const node = render[s.key]?.(s);
        return node ? <div key={s.key}>{node}</div> : null;
      })}
      {last !== "enquiry" && <div className="pb-24" />}
    </>
  );
}

function Person({ name, role, photo, large = false }) {
  const size = large ? "size-16" : "size-11";
  return (
    <figcaption className="flex items-center gap-3.5">
      {photo?.urls ? (
        <OwnImage media={photo} alt="" sizes="64px" className={`${size} shrink-0 rounded-full`} />
      ) : (
        <Monogram name={name} className={`${size} shrink-0 rounded-full text-base`} />
      )}
      <span>
        <span className="block text-sm font-semibold">{name}</span>
        {role && <span className="block text-xs text-ink-muted">{role}</span>}
      </span>
    </figcaption>
  );
}

export function CtaLink({ href, label, dark = false }) {
  const cls = dark
    ? "inline-flex h-12 items-center gap-2.5 rounded-md bg-surface px-6 text-sm font-medium text-ink transition-colors hover:bg-canvas"
    : "inline-flex h-12 items-center gap-2.5 rounded-md bg-primary px-6 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover";
  const inner = (
    <>
      {label}
      <ArrowRight aria-hidden className="size-4" />
    </>
  );
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  );
}
