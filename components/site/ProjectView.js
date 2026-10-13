import { ArrowDown, ArrowUpRight, FileDown, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SmartImage } from "@/components/media/SmartImage";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatBDTCompact, formatDate, formatLand, formatNumber, localizeDigits } from "@/lib/format";
import { absoluteUrl, jsonLd, pick, pickPair, SITE_URL } from "@/lib/public/site";
import { rangeLabel, typeRows } from "@/lib/public/units";
import { Amenities } from "./Amenities";
import { Breadcrumbs } from "./Breadcrumbs";
import { ContactBand } from "./ContactBand";
import { Gallery } from "./Gallery";
import { placeOf } from "./ProjectCard";
import { googleMapsUrl } from "./mapLinks";
import { SiteMapLazy } from "./SiteMapLazy";
import { StackingPlan } from "./StackingPlan";

const PLACEHOLDER_SETS = {
  apartment: ["apartment-exterior", "interior", "interior", "amenity", "apartment-exterior", "interior"],
  plot: ["plot-land", "plot-land", "city", "plot-land"],
};

function Section({ id, eyebrow, title, aside, children, className }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24 border-t border-line py-16 lg:py-20", className)}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${id}-title`} className="mt-3 font-display text-3xl leading-tight">
            {title}
          </h2>
          {aside && <div className="mt-4 text-sm leading-relaxed text-ink-muted">{aside}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/** Project page body (data already loaded by the route). Server component; live parts are islands. */
export async function ProjectView({ project, units }) {
  const locale = await getLocale();
  const t = await getTranslations("site.project");
  const tf = await getTranslations("site.facts");
  const tu = await getTranslations("site.units");
  const ts = await getTranslations("projects.stages");
  const tsite = await getTranslations("site");

  const name = pick(project, "name", locale);
  const place = placeOf(project.location, locale);
  const isPlot = project.kind === "plot";
  const inv = project.inventory ?? {};
  const description = pick(project, "description", locale);
  const address = pick(project.location, "address", locale);
  const hasLocation = project.location?.lat != null && project.location?.lng != null;

  const facts = [
    { k: tf("stage"), v: ts(project.stage) },
    project.landArea && { k: tf("land"), v: formatLand(project.landArea, locale) },
    inv.total > 0 && { k: tf(isPlot ? "plots" : "homes"), v: formatNumber(inv.total, locale) },
    inv.total > 0 && { k: tf("availableNow"), v: formatNumber(inv.available, locale) },
    { k: tf("startingPrice"), v: inv.priceFrom != null ? formatBDTCompact(inv.priceFrom, locale) : tf("onRequest") },
    project.handoverAt && { k: tf("handover"), v: formatDate(project.handoverAt, locale, "date") },
    project.approval?.number && {
      k: tf("approval"),
      v: `${project.approval.authority === "other" ? tf("authorityOther") : project.approval.authority} · ${project.approval.number}`,
    },
  ].filter(Boolean);

  const gallery = project.gallery?.length
    ? project.gallery.map((m, i) => ({ media: m, seed: `${project.id}-${i}`, alt: m.alt || t("galleryAlt", { name, n: i + 1 }) }))
    : PLACEHOLDER_SETS[isPlot ? "plot" : "apartment"].map((category, i) => ({
        category,
        seed: `${project.id}-${i}`,
        alt: t("galleryAlt", { name, n: i + 1 }),
      }));

  const rows = typeRows(units, project.kind, tu);
  const plans = project.floorPlans ?? [];
  const blockName = (id) => pick(project.blocks?.find((b) => b.id === id), "name", locale);

  const ld = {
    "@context": "https://schema.org",
    "@type": isPlot ? "Place" : "ApartmentComplex",
    name,
    url: absoluteUrl(locale, `/projects/${project.slug}`),
    ...(description && { description: description.slice(0, 500) }),
    ...(project.cover?.urls?.full && { image: project.cover.urls.full }),
    address: {
      "@type": "PostalAddress",
      ...(address && { streetAddress: address }),
      ...(project.location?.area && { addressLocality: project.location.area }),
      ...(project.location?.city && { addressRegion: project.location.city }),
      addressCountry: "BD",
    },
    ...(hasLocation && { geo: { "@type": "GeoCoordinates", latitude: project.location.lat, longitude: project.location.lng } }),
    ...(!isPlot && inv.total > 0 && { numberOfAccommodationUnits: inv.total, numberOfAvailableAccommodationUnits: inv.available }),
    ...(project.amenities?.length && {
      amenityFeature: project.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })),
    }),
    ...(inv.priceFrom != null && {
      offers: { "@type": "AggregateOffer", priceCurrency: "BDT", lowPrice: inv.priceFrom / 100, offerCount: inv.available, url: `${SITE_URL}/${locale}/projects/${project.slug}` },
    }),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />

      {/* ── hero: words left, the building on a diagonal right ── */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs
          locale={locale}
          label={t("breadcrumb")}
          items={[{ href: "/", label: tsite("nav.home") }, { href: "/projects", label: tsite("nav.projects") }, { label: name }]}
        />
      </div>
      <header className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-8 pb-14 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-0 lg:px-8 lg:pb-0">
        <div className="flex flex-col justify-center lg:py-16 lg:pr-12">
          <p className="eyebrow">{place || t(isPlot ? "kindPlot" : "kindApartment")}</p>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl xl:text-6xl">{name}</h1>
          {pick(project, "tagline", locale) && <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">{pick(project, "tagline", locale)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#availability"
              className="inline-flex h-12 items-center gap-2.5 rounded-md bg-primary px-6 text-sm font-medium tracking-wide text-primary-ink transition-colors hover:bg-primary-hover"
            >
              {t("seeAvailability")}
              <ArrowDown aria-hidden className="size-4" />
            </a>
            {project.brochure?.urls?.file && (
              <a
                href={project.brochure.urls.file}
                target="_blank"
                rel="noopener"
                className="inline-flex h-12 items-center gap-2.5 rounded-md border border-line-strong bg-surface px-6 text-sm font-medium transition-colors hover:bg-surface-2"
              >
                <FileDown aria-hidden className="size-4" strokeWidth={1.75} />
                {t("brochure")}
              </a>
            )}
          </div>
        </div>
        <div className="relative -mx-4 aspect-[4/3] sm:mx-0 lg:aspect-auto lg:min-h-[34rem]">
          <SmartImage
            media={project.cover}
            variant="full"
            category={isPlot ? "plot-land" : "apartment-exterior"}
            seed={project.id}
            alt={name}
            preload
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="absolute inset-0 sm:rounded-lg lg:rounded-none lg:[clip-path:polygon(16%_0,100%_0,100%_100%,0_100%)]"
          />
        </div>
      </header>

      {/* ── facts band ── */}
      <div className="border-y border-line bg-line">
        <dl className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
          {facts.map((f) => (
            <div key={f.k} className="bg-surface-3 px-4 py-6 sm:px-6">
              <dt className="text-[10px] font-semibold caps text-ink-muted ">{f.k}</dt>
              <dd className="mt-2 font-display text-xl leading-snug">{f.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {(description || project.highlights?.length > 0) && (
          <Section id="overview" eyebrow={t("overviewEyebrow")} title={t("overviewTitle", { name })} className="border-t-0">
            <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              {description && (
                <div className="max-w-prose space-y-4 text-[15px] leading-relaxed">
                  {description.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}
              {project.highlights?.length > 0 && (
                <ol className="divide-y divide-line border-y border-line">
                  {project.highlights.map((h, i) => (
                    <li key={i} className="flex gap-4 py-3.5 text-sm">
                      <span className="font-mono text-[11px] text-accent">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                      {pickPair(h, locale)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Section>
        )}
      </div>

      <section aria-label={t("galleryTitle")} className="overflow-hidden border-t border-line py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t("galleryEyebrow")}</p>
              <h2 className="mt-3 font-display text-3xl">{t("galleryTitle")}</h2>
            </div>
          </div>
          <Gallery items={gallery} label={t("galleryTitle")} />
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Section
          id="availability"
          eyebrow={t("availabilityEyebrow")}
          title={t(isPlot ? "availabilityTitlePlot" : "availabilityTitle")}
          aside={t("availabilityIntro")}
        >
          {units.length === 0 ? (
            <p className="blueprint rounded-lg border border-dashed border-line-strong/60 px-6 py-12 text-center text-sm text-ink-muted">{t("noUnits")}</p>
          ) : (
            <div className="space-y-10">
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <caption className="sr-only">{t("typesCaption")}</caption>
                  <thead className="border-b border-line bg-surface-2 text-[10px] font-semibold caps text-ink-muted ">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">{t(isPlot ? "colRoad" : "colType")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("colSize")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{t("colAvailable")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{t("colFrom")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <th scope="row" className="px-4 py-3.5 font-medium">{r.label}</th>
                        <td className="px-4 py-3.5 text-ink-muted">{rangeLabel(r, locale)}</td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {formatNumber(r.available, locale)}
                          <span className="text-ink-subtle"> / {formatNumber(r.count, locale)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">{r.fromPrice != null ? formatBDTCompact(r.fromPrice, locale) : <span className="font-sans text-ink-subtle">{tf("onRequest")}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <StackingPlan project={{ id: project.id, slug: project.slug, kind: project.kind }} blocks={project.blocks ?? []} units={units} />
            </div>
          )}
        </Section>

        {plans.length > 0 && (
          <Section id="plans" eyebrow={t("plansEyebrow")} title={t(isPlot ? "plansTitlePlot" : "plansTitle")} aside={t("plansIntro")}>
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {plans.map((pl) => (
                <li key={pl.id}>
                  <Link
                    href={`/projects/${project.slug}/plans/${pl.id}`}
                    className="group block overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong/60"
                  >
                    <div className="relative aspect-[16/11] border-b border-line bg-surface-2">
                      <SmartImage media={pl.image} variant="card" fit="contain" category="plot-land" seed={pl.id} alt="" className="absolute inset-3" />
                    </div>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{pick(pl, "title", locale)}</p>
                        <p className="mt-1 text-xs text-ink-muted">
                          {pl.kind === "master"
                            ? pick(pl, "title", locale) === t("sitePlan")
                              ? t("sitePlanHint")
                              : t("sitePlan")
                            : [blockName(pl.blockId), t("floorsLabel", { floors: floorsText(pl.floors, locale, tu) })].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {project.amenities?.length > 0 && (
          <Section id="amenities" eyebrow={t("amenitiesEyebrow")} title={t("amenitiesTitle")}>
            <Amenities codes={project.amenities} />
          </Section>
        )}

        <Section id="location" eyebrow={t("locationEyebrow")} title={place || t("locationTitle")} aside={address && <p className="flex gap-2"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />{address}</p>}>
          {hasLocation ? (
            <>
              <SiteMapLazy
                className="aspect-[4/3] w-full sm:aspect-[16/8]"
                label={t("mapLabel", { name })}
                points={[{ id: project.id, lat: project.location.lat, lng: project.location.lng, title: name, subtitle: address || place }]}
              />
              <a
                href={googleMapsUrl(project.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
              >
                {t("openGoogle")}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
            </>
          ) : (
            <p className="blueprint rounded-lg border border-dashed border-line-strong/60 px-6 py-12 text-center text-sm text-ink-muted">{t("locationOnRequest")}</p>
          )}
        </Section>
      </div>

      <ContactBand title={t("contactTitle", { name })} body={t("contactBody")} />
    </article>
  );
}

/** [3,4,5,7] → "3–5, 7" (localized digits; G/B for ground and basements). */
function floorsText(floors = [], locale, t) {
  const s = [...floors].sort((a, b) => a - b);
  const label = (f) => (f === 0 ? t("groundShort") : f < 0 ? t("basementShort", { n: localizeDigits(-f, locale) }) : localizeDigits(f, locale));
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${label(s[i])}–${label(s[j])}` : label(s[i]));
    i = j;
  }
  return out.join(", ");
}
