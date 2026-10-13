import { ArrowUpRight, LayoutPanelTop } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SmartImage } from "@/components/media/SmartImage";
import { Link } from "@/i18n/navigation";
import { formatAreaValue, formatBDT, formatBDTCompact, formatLand, formatNumber, formatSqftArea, localizeDigits } from "@/lib/format";
import { absoluteUrl, jsonLd, pick } from "@/lib/public/site";
import { floorShort, isSellable, sizeShort } from "@/lib/public/units";
import { Breadcrumbs } from "./Breadcrumbs";
import { ContactBand } from "./ContactBand";
import { LiveUnitStatus } from "./LiveUnitStatus";
import { PaymentCalculator } from "./PaymentCalculator";
import { placeOf } from "./ProjectCard";
import { PublicStatusChip } from "./PublicStatusChip";

/** Plan to open for this unit: the floor plan covering its building + floor, else a site plan. */
function planFor(unit, plans = []) {
  if (unit.kind !== "plot") {
    const fp = plans.find((p) => p.kind === "floor" && p.blockId === unit.blockId && p.floors.includes(unit.floor));
    if (fp) return { plan: fp, floor: unit.floor };
  }
  const master = plans.find((p) => p.kind === "master");
  return master ? { plan: master } : null;
}

/** Up to 3 other available homes like this one (same bedrooms / same road), nearest price first. */
function similarTo(unit, units) {
  const same = (u) => (unit.kind === "plot" ? u.road === unit.road : u.bedrooms === unit.bedrooms);
  const dist = (u) => (u.price != null && unit.price != null ? Math.abs(u.price - unit.price) : Number.MAX_SAFE_INTEGER);
  return units
    .filter((u) => u.id !== unit.id && u.status === "available" && same(u))
    .sort((a, b) => dist(a) - dist(b))
    .slice(0, 3);
}

export async function UnitView({ unit, project, units }) {
  const locale = await getLocale();
  const t = await getTranslations("site.unit");
  const tu = await getTranslations("site.units");
  const tf = await getTranslations("inventory.facing");
  const tsite = await getTranslations("site");
  const isPlot = unit.kind === "plot";
  const name = pick(project, "name", locale);
  const block = project.blocks?.find((b) => b.id === unit.blockId);
  const title = isPlot && unit.plotNo ? t("plotTitle", { no: unit.plotNo }) : t("unitTitle", { code: unit.code });
  const sellable = isSellable(unit);
  const onPlan = planFor(unit, project.floorPlans);
  const similar = sellable || unit.status === "sold" ? similarTo(unit, units) : [];

  const subtitle = [
    unit.typeLabel,
    !isPlot && unit.bedrooms != null && tu("bedType", { n: unit.bedrooms }),
    pick(block, "name", locale),
    !isPlot && unit.floor != null && t("floorValue", { floor: floorShort(unit.floor, locale, tu) }),
    isPlot && unit.road && tu("road", { road: unit.road }),
  ].filter(Boolean);

  const yes = t("yes");
  const facts = isPlot
    ? [
        { k: t("landArea"), v: formatLand(unit.landArea, locale) },
        unit.landArea?.sqft != null && { k: t("inSqft"), v: formatAreaValue(unit.landArea.sqft, "sqft", locale, 0) },
        unit.plotNo && { k: t("plotNo"), v: localizeDigits(unit.plotNo, locale) },
        unit.road && { k: t("road"), v: unit.road },
        unit.roadWidthFt != null && { k: t("roadWidth"), v: t("feet", { n: formatNumber(unit.roadWidthFt, locale) }) },
        unit.dimensions && Object.values(unit.dimensions).some((v) => v != null) && {
          k: t("dimensions"),
          v: ["frontFt", "backFt", "leftFt", "rightFt"]
            .filter((d) => unit.dimensions[d] != null)
            .map((d) => `${t(`dim.${d}`)} ${formatNumber(unit.dimensions[d], locale)}`)
            .join(" · "),
        },
        unit.facing && { k: t("facing"), v: tf(unit.facing) },
        unit.isCorner && { k: t("corner"), v: yes },
      ]
    : [
        { k: t("size"), v: formatSqftArea(unit.saleableSqft, unit.saleableSqm, locale) },
        unit.carpetSqft != null && { k: t("carpet"), v: formatSqftArea(unit.carpetSqft, unit.carpetSqm, locale) },
        unit.floor != null && { k: t("floor"), v: floorShort(unit.floor, locale, tu) },
        unit.bedrooms != null && { k: t("bedrooms"), v: formatNumber(unit.bedrooms, locale) },
        unit.bathrooms != null && { k: t("bathrooms"), v: formatNumber(unit.bathrooms, locale) },
        unit.balconies != null && { k: t("balconies"), v: formatNumber(unit.balconies, locale) },
        { k: t("parking"), v: unit.parkingSlots ? formatNumber(unit.parkingSlots, locale) : t("none") },
        unit.facing && { k: t("facing"), v: tf(unit.facing) },
        unit.isCorner && { k: t("corner"), v: yes },
      ];

  const url = absoluteUrl(locale, `/projects/${project.slug}/units/${unit.id}`);
  const ld = {
    "@context": "https://schema.org",
    "@type": isPlot ? "Place" : "Apartment",
    name: `${title} · ${name}`,
    url,
    ...(!isPlot && unit.saleableSqft != null && { floorSize: { "@type": "QuantitativeValue", value: unit.saleableSqft, unitCode: "FTK" } }),
    ...(!isPlot && unit.bedrooms != null && { numberOfBedrooms: unit.bedrooms }),
    ...(!isPlot && unit.bathrooms != null && { numberOfBathroomsTotal: unit.bathrooms }),
    containedInPlace: { "@type": isPlot ? "Place" : "ApartmentComplex", name, url: absoluteUrl(locale, `/projects/${project.slug}`) },
    ...(unit.price != null && {
      offers: {
        "@type": "Offer",
        price: unit.price / 100,
        priceCurrency: "BDT",
        availability: unit.status === "available" ? "https://schema.org/InStock" : unit.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/LimitedAvailability",
        url,
      },
    }),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
        <Breadcrumbs
          locale={locale}
          label={t("breadcrumb")}
          items={[
            { href: "/", label: tsite("nav.home") },
            { href: "/projects", label: tsite("nav.projects") },
            { href: `/projects/${project.slug}`, label: name },
            { label: title },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
          <div className="min-w-0">
            <header>
              <p className="eyebrow">
                <Link href={`/projects/${project.slug}`} className="hover:underline">
                  {name}
                </Link>
                {placeOf(project.location, locale) && <span className="text-ink-subtle">&nbsp;·&nbsp;{placeOf(project.location, locale)}</span>}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <h1 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
                <LiveUnitStatus projectId={project.id} unitId={unit.id} initial={unit.status} />
              </div>
              {subtitle.length > 0 && <p className="mt-3 text-sm text-ink-muted">{subtitle.join(" · ")}</p>}
            </header>

            <figure className="mt-8 overflow-hidden rounded-lg border border-line bg-surface">
              <div className="relative aspect-[4/3]">
                <SmartImage
                  media={unit.layout}
                  variant="full"
                  fit={unit.layout ? "contain" : "cover"}
                  category={isPlot ? "plot-land" : "interior"}
                  seed={unit.id}
                  alt={t("layoutAlt", { code: unit.code })}
                  sampleBadge={!unit.layout}
                  preload
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="absolute inset-0"
                />
              </div>
              <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-muted">
                {unit.layout ? t("layoutCaption") : t("sampleCaption")}
                {onPlan && (
                  <Link
                    href={`/projects/${project.slug}/plans/${onPlan.plan.id}${onPlan.floor != null ? `?floor=${onPlan.floor}` : ""}`}
                    className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                  >
                    <LayoutPanelTop aria-hidden className="size-3.5" />
                    {t("onPlan")}
                  </Link>
                )}
              </figcaption>
            </figure>

            <section aria-labelledby="unit-facts" className="mt-10">
              <h2 id="unit-facts" className="eyebrow">
                {t("details")}
              </h2>
              <dl className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
                {facts.filter(Boolean).map((f) => (
                  <div key={f.k} className="flex justify-between gap-4 border-b border-line py-3 text-sm">
                    <dt className="text-ink-muted">{f.k}</dt>
                    <dd className="text-right">{f.v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-line bg-surface p-5">
              <p className="text-[10px] font-semibold caps text-ink-muted ">{t("price")}</p>
              {unit.price != null ? (
                <>
                  <p className="mt-2 font-display text-4xl">{formatBDTCompact(unit.price, locale)}</p>
                  <p className="mt-1 font-mono text-xs text-ink-muted">{formatBDT(unit.price, locale)}</p>
                  <p className="mt-3 text-xs leading-relaxed text-ink-subtle">{t("priceNote")}</p>
                </>
              ) : (
                <p className="mt-2 text-lg">{sellable ? t("priceOnRequest") : t("notForSale")}</p>
              )}
            </div>
            {sellable ? (
              <PaymentCalculator price={unit.price} />
            ) : (
              <div className="rounded-lg border border-line bg-surface-2 p-5 text-sm">
                <PublicStatusChip status={unit.status} />
                <p className="mt-3 text-ink-muted">{t(unit.status === "sold" ? "soldBody" : "unavailableBody")}</p>
              </div>
            )}
          </aside>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar" className="mt-20 border-t border-line pt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{t("similarEyebrow")}</p>
                <h2 id="similar" className="mt-3 font-display text-3xl">
                  {t("similarTitle")}
                </h2>
              </div>
              <Link href={`/projects/${project.slug}#availability`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                {t("allUnits")}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {similar.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/projects/${project.slug}/units/${u.id}`}
                    className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong/60"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-semibold">{u.code}</span>
                      <PublicStatusChip status={u.status} size="sm" />
                    </span>
                    <span className="mt-3 text-sm text-ink-muted">
                      {[!isPlot && u.floor != null && t("floorValue", { floor: floorShort(u.floor, locale, tu) }), sizeShort(u, locale)].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-auto flex items-end justify-between pt-5">
                      <span className="font-mono text-sm">{u.price != null ? formatBDTCompact(u.price, locale) : t("priceOnRequest")}</span>
                      <ArrowUpRight aria-hidden className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <ContactBand title={t("contactTitle", { title })} body={t("contactBody")} />
    </article>
  );
}
