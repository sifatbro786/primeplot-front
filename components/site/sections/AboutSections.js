import { BadgeCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SmartImage } from "@/components/media/SmartImage";
import { ContactBand } from "@/components/site/ContactBand";
import { ProjectCard } from "@/components/site/ProjectCard";
import { Reveal } from "@/components/site/Reveal";
import { StatsBand } from "@/components/site/StatsBand";
import { Link } from "@/i18n/navigation";
import { localizeDigits } from "@/lib/format";
import { Emph, makeText, Paragraphs } from "@/lib/public/content";
import { catalogueStats } from "@/lib/public/listing";
import { pick } from "@/lib/public/site";
import { FeatureList, ICONS, LogoGroups, Monogram, OwnImage, pad2, SectionHead } from "./parts";

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/** About page, in the order set in the dashboard (contract: API.md › B2b). */
export async function AboutSections({ page, projects, org }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("site.about")]);
  const ts = await getTranslations("site.sections");
  const company = pick(org, "name", locale) || "";
  const T = makeText(locale, company);
  const stats = catalogueStats(projects);
  const delivered = projects.filter((p) => p.stage === "ready" || p.stage === "completed");
  const sections = page?.sections ?? [];

  const render = {
    intro: ({ data }) => (
      <header className={`${WRAP} grid gap-10 pt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:pt-24`}>
        <div>
          {T(data.eyebrow) && <p className="eyebrow">{T(data.eyebrow)}</p>}
          <h1 className="mt-5 font-display text-4xl leading-[1.06] sm:text-5xl lg:text-6xl">
            <Emph text={T(data.title)} />
          </h1>
          <Paragraphs text={T(data.body)} className="mt-8 max-w-xl space-y-4 text-[15px] leading-relaxed text-ink-muted" />
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg lg:aspect-auto lg:min-h-[32rem]">
          <SmartImage
            media={data.image}
            category="apartment-exterior"
            seed="about"
            alt=""
            preload
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="absolute inset-0"
          />
        </div>
      </header>
    ),

    stats: () =>
      stats.projects > 0 && (
        <Reveal className={WRAP}>
          <div data-reveal className="mt-16">
            <StatsBand stats={stats} />
          </div>
        </Reveal>
      ),

    story: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-story" className={`${WRAP} mt-28 grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]`}>
        <div>
          <SectionHead id="about-story" eyebrow={T(data.eyebrow)} title={T(data.title)} />
          <Paragraphs text={T(data.body)} className="mt-6 max-w-xl space-y-4 text-[15px] leading-relaxed text-ink-muted" />
        </div>
        {data.milestones.length > 0 && (
          <ol className="relative border-l border-line-strong pl-8">
            {data.milestones.map((m, i) => (
              <li key={i} data-reveal className="relative pb-10 last:pb-0">
                <span aria-hidden className="absolute top-2 -left-[2.31rem] size-2.5 rounded-full bg-accent ring-4 ring-paper" />
                <p className="font-display text-3xl leading-none text-accent">{localizeDigits(m.year, locale)}</p>
                <h3 className="mt-2 text-base font-semibold">{T(m.title)}</h3>
                {T(m.body) && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{T(m.body)}</p>}
              </li>
            ))}
          </ol>
        )}
      </Reveal>
    ),

    missionVision: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-purpose" className={`${WRAP} mt-28`}>
        <SectionHead id="about-purpose" eyebrow={T(data.eyebrow)} title={T(data.title)} />
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
          {[
            ["mission", data.mission],
            ["vision", data.vision],
          ]
            .filter(([, v]) => T(v))
            .map(([k, v]) => (
              <div key={k} data-reveal className="bg-surface p-7 sm:p-10">
                <p className="caps text-[11px] font-semibold text-accent">{ts(`purpose.${k}`)}</p>
                <p className="mt-4 font-display text-2xl leading-snug sm:text-[1.7rem]">{T(v)}</p>
              </div>
            ))}
        </div>
        {data.values.length > 0 && (
          <>
            <p data-reveal className="caps mt-12 text-[11px] font-semibold text-ink-muted">
              {ts("purpose.values")}
            </p>
            <ul className="mt-4 grid gap-x-8 gap-y-6 border-t border-line pt-6 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr">
              {data.values.map((v, i) => (
                <li key={i} data-reveal>
                  <span className="font-mono text-xs text-ink-subtle">{pad2(i, locale)}</span>
                  <h3 className="mt-2 text-base font-semibold">{T(v.title)}</h3>
                  {T(v.body) && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{T(v.body)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Reveal>
    ),

    principles: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-principles" className="band-dark grain mt-28">
        <div className={`${WRAP} py-20`}>
          <SectionHead id="about-principles" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} dark />
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-primary-deep bg-primary-deep sm:grid-cols-2">
            {data.items.map((it, i) => {
              const Icon = ICONS[it.icon] ?? ICONS.sparkles;
              return (
                <li key={i} data-reveal className="bg-primary p-6 sm:p-8">
                  <Icon aria-hidden className="size-6 text-accent-on-dark" strokeWidth={1.25} />
                  <h3 className="mt-5 text-base font-semibold">{T(it.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-primary-ink/70">{T(it.body)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Reveal>
    ),

    leaderMessage: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-message" className="grain mt-28 border-y border-sage-line bg-sage-tint">
        <div className={`${WRAP} grid gap-12 py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
          <div data-reveal>
            {data.photo?.urls ? (
              <OwnImage media={data.photo} alt={T(data.name)} sizes="(min-width: 1024px) 30vw, 80vw" className="aspect-[4/5] w-full max-w-sm rounded-lg" />
            ) : (
              <Monogram name={T(data.name)} className="aspect-[4/5] w-full max-w-sm rounded-lg border border-sage-line text-6xl" />
            )}
          </div>
          <figure data-reveal>
            {T(data.eyebrow) && <p id="about-message" className="eyebrow">{T(data.eyebrow)}</p>}
            <blockquote className="mt-6">
              <Paragraphs
                text={T(data.message)}
                className="space-y-5 text-[15px] leading-relaxed text-ink-muted [&>p:first-child]:font-display [&>p:first-child]:text-2xl [&>p:first-child]:leading-snug [&>p:first-child]:text-ink"
              />
            </blockquote>
            <figcaption className="mt-8">
              {data.signature?.urls && (
                <OwnImage media={data.signature} alt="" fit="contain" sizes="200px" className="mb-3 h-14 w-48 bg-transparent" />
              )}
              <span className="block text-base font-semibold">{T(data.name)}</span>
              {T(data.designation) && <span className="block text-sm text-ink-muted">{T(data.designation)}</span>}
            </figcaption>
          </figure>
        </div>
      </Reveal>
    ),

    team: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-team" className={`${WRAP} mt-28`}>
        <SectionHead id="about-team" eyebrow={T(data.eyebrow)} title={T(data.title)} />
        <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {data.items.map((p, i) => (
            <li key={i} data-reveal>
              {p.photo?.urls ? (
                <OwnImage media={p.photo} alt={T(p.name)} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-[4/5] w-full rounded-lg" />
              ) : (
                <Monogram name={T(p.name)} className="aspect-[4/5] w-full rounded-lg border border-line text-4xl" />
              )}
              <h3 className="mt-4 text-base font-semibold">{T(p.name)}</h3>
              {T(p.designation) && <p className="text-sm text-accent">{T(p.designation)}</p>}
              {T(p.bio) && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{T(p.bio)}</p>}
            </li>
          ))}
        </ul>
      </Reveal>
    ),

    quality: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-quality" className={`${WRAP} mt-28`}>
        <SectionHead id="about-quality" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
        <div className="mt-10">
          <FeatureList items={data.items} T={T} columns={3} />
        </div>
      </Reveal>
    ),

    completed: ({ data }) =>
      delivered.length > 0 && (
        <Reveal as="section" aria-labelledby="about-completed" className={`${WRAP} mt-28`}>
          <SectionHead id="about-completed" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {delivered.slice(0, 6).map((p) => (
              <div key={p.id} data-reveal>
                <ProjectCard project={p} />
              </div>
            ))}
          </div>
        </Reveal>
      ),

    credentials: ({ data }) => {
      const creds = [
        org?.tradeLicenseNo && { k: t("tradeLicense"), v: org.tradeLicenseNo },
        org?.rehabMemberNo && { k: t("rehab"), v: org.rehabMemberNo },
        pick(org, "address", locale) && { k: t("office"), v: pick(org, "address", locale) },
      ].filter(Boolean);
      if (!creds.length && !data.items.length) return null;
      return (
        <Reveal as="section" aria-labelledby="about-creds" className={`${WRAP} mt-28 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
          <SectionHead id="about-creds" eyebrow={T(data.eyebrow)} title={T(data.title)} />
          <div className="space-y-10">
            {creds.length > 0 && (
              <dl data-reveal className="divide-y divide-line border-y border-line">
                {creds.map((c) => (
                  <div key={c.k} className="flex flex-wrap justify-between gap-4 py-4 text-sm">
                    <dt className="flex items-center gap-2 text-ink-muted">
                      <BadgeCheck aria-hidden className="size-4 text-accent" strokeWidth={1.5} />
                      {c.k}
                    </dt>
                    <dd className="text-right font-mono">{c.v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {data.items.length > 0 && <LogoGroups items={data.items} />}
          </div>
        </Reveal>
      );
    },

    awards: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-awards" className={`${WRAP} mt-28`}>
        <SectionHead id="about-awards" eyebrow={T(data.eyebrow)} title={T(data.title)} />
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {data.items.map((a, i) => (
            <li key={i} data-reveal className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-5 py-5">
              <span className="font-display text-2xl text-accent">{localizeDigits(a.year, locale)}</span>
              <span>
                <span className="block text-base font-semibold">{T(a.title)}</span>
                {T(a.by) && <span className="block text-sm text-ink-muted">{T(a.by)}</span>}
              </span>
              {a.logo?.urls && <OwnImage media={a.logo} alt="" fit="contain" sizes="96px" className="h-12 w-20 bg-transparent" />}
            </li>
          ))}
        </ul>
      </Reveal>
    ),

    csr: ({ data }) => (
      <Reveal as="section" aria-labelledby="about-csr" className={`${WRAP} mt-28`}>
        <SectionHead id="about-csr" eyebrow={T(data.eyebrow)} title={T(data.title)} body={T(data.body)} />
        {data.items.length > 0 && (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((c, i) => (
              <li key={i} data-reveal className="overflow-hidden rounded-lg border border-line bg-surface">
                {c.image?.urls && <OwnImage media={c.image} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[16/10] w-full" />}
                <div className="p-5">
                  <h3 className="text-base font-semibold">{T(c.title)}</h3>
                  {T(c.body) && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{T(c.body)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    ),

    cta: ({ data }) => (
      <div className="mt-28">
        <ContactBand
          title={T(data.title)}
          body={
            <>
              {T(data.body)}{" "}
              {data.href &&
                T(data.label) &&
                (data.href.startsWith("/") ? (
                  <Link href={data.href} className="text-accent underline-offset-4 hover:underline">
                    {T(data.label)}
                  </Link>
                ) : (
                  <a href={data.href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
                    {T(data.label)}
                  </a>
                ))}
            </>
          }
        />
      </div>
    ),
  };

  const last = sections.at(-1)?.key;
  return (
    <>
      {sections.map((s) => {
        const node = render[s.key]?.(s);
        return node ? <div key={s.key}>{node}</div> : null;
      })}
      {last !== "cta" && <div className="pb-24" />}
    </>
  );
}
