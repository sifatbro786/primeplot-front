import { Suspense } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { CompareSync } from "@/components/site/CompareSync";
import { PublicStatusChip } from "@/components/site/PublicStatusChip";
import { Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { formatBDT, formatBDTCompact, formatLand, formatNumber, formatSqftArea } from "@/lib/format";
import { getUnit, isId } from "@/lib/public/api";
import { installmentPlan } from "@/lib/public/emi";
import { CALCULATOR, COMPARE_MAX, pick } from "@/lib/public/site";
import { floorShort, isSellable } from "@/lib/public/units";

export async function generateMetadata() {
  const t = await getTranslations("site.compare");
  // Personal shortlist pages: never indexed, and not in the sitemap.
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

/** "?u=a,b,c" → up to 3 distinct valid ids (anything else is ignored). */
const idsFrom = (u) => [...new Set(String(Array.isArray(u) ? u[0] : (u ?? "")).split(",").map((s) => s.trim()).filter(isId))].slice(0, COMPARE_MAX);

/** Index of the min/max numeric value, only when the values actually differ. */
function bestIndex(values, dir) {
  const nums = values.map((v, i) => [v, i]).filter(([v]) => typeof v === "number");
  if (nums.length < 2 || nums.every(([v]) => v === nums[0][0])) return -1;
  return nums.reduce((b, c) => (dir === "min" ? c[0] < b[0] : c[0] > b[0]) ? c : b)[1];
}

async function CompareBody({ searchParams }) {
  const { u } = await searchParams;
  const ids = idsFrom(u);
  const [locale, t, tu, tun, tf, units] = await Promise.all([
    getLocale(),
    getTranslations("site.compare"),
    getTranslations("site.unit"),
    getTranslations("site.units"),
    getTranslations("inventory.facing"),
    Promise.all(ids.map((id) => getUnit(id).catch(() => null))),
  ]);
  const list = units.filter(Boolean);
  const { downPaymentPct: pct, months } = CALCULATOR;

  const titleOf = (x) => (x.kind === "plot" && x.plotNo ? tu("plotTitle", { no: x.plotNo }) : tu("unitTitle", { code: x.code }));
  const hrefOf = (x) => `/projects/${x.project.slug}/units/${x.id}`;
  const without = (id) => {
    const rest = list.filter((x) => x.id !== id).map((x) => x.id);
    return rest.length ? `/compare?u=${rest.join(",")}` : "/compare";
  };

  const header = (
    <header className="grain border-b border-sage-line bg-sage-tint">
      <div className="mx-auto w-full max-w-7xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {t("intro", { down: formatNumber(pct, locale), months: formatNumber(months, locale) })}
        </p>
      </div>
    </header>
  );

  if (list.length < 2) {
    return (
      <>
        {header}
        <CompareSync items={list.map((x) => ({ id: x.id, label: `${titleOf(x)} · ${pick(x.project, "name", locale)}`, project: pick(x.project, "name", locale) }))} />
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-lg rounded-lg border border-dashed border-line-strong/40 bg-surface p-8">
            <h2 className="font-display text-2xl">{t("emptyTitle")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("emptyBody")}</p>
            <Link href="/projects" className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-primary-hover">
              {t("browse")}
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </>
    );
  }

  const anyPlot = list.some((x) => x.kind === "plot");
  const anyFlat = list.some((x) => x.kind !== "plot");
  const plans = list.map((x) => (isSellable(x) && x.price != null ? installmentPlan(x.price, pct, months) : null));
  const priceBest = bestIndex(list.map((x) => (isSellable(x) ? x.price : null)), "min");
  // "Largest" only among the same kind — a plot's land and a flat's floor area aren't comparable.
  const sizeBest = anyPlot && anyFlat ? -1 : bestIndex(list.map((x) => (x.kind === "plot" ? x.landArea?.sqft : x.saleableSqft) ?? null), "max");
  const dash = <span className="text-ink-subtle">—</span>;
  const Best = ({ children }) => <span className="ml-2 rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-ink caps">{children}</span>;

  const rows = [
    { k: t("rows.project"), v: (x) => <Link href={`/projects/${x.project.slug}`} className="hover:underline">{pick(x.project, "name", locale)}</Link> },
    { k: t("rows.status"), v: (x) => <PublicStatusChip status={x.status} size="sm" /> },
    anyFlat && { k: t("rows.type"), v: (x) => (x.kind === "plot" ? null : [x.typeLabel, x.bedrooms != null && tun("bedType", { n: x.bedrooms })].filter(Boolean).join(" · ") || null) },
    {
      k: anyPlot && !anyFlat ? t("rows.land") : t("rows.size"),
      v: (x, i) => (
        <>
          {x.kind === "plot" ? (x.landArea ? formatLand(x.landArea, locale) : null) : formatSqftArea(x.saleableSqft, x.saleableSqm, locale)}
          {i === sizeBest && <Best>{t("largest")}</Best>}
        </>
      ),
    },
    anyFlat && { k: t("rows.floor"), v: (x) => (x.kind === "plot" || x.floor == null ? null : floorShort(x.floor, locale, tun)) },
    anyPlot && { k: t("rows.road"), v: (x) => x.road ?? null },
    anyPlot && { k: t("rows.roadWidth"), v: (x) => (x.roadWidthFt != null ? tu("feet", { n: formatNumber(x.roadWidthFt, locale) }) : null) },
    { k: t("rows.facing"), v: (x) => (x.facing ? tf(x.facing) : null) },
    { k: t("rows.corner"), v: (x) => (x.isCorner ? t("yes") : t("no")) },
    anyFlat && { k: t("rows.parking"), v: (x) => (x.kind === "plot" ? null : x.parkingSlots ? formatNumber(x.parkingSlots, locale) : t("none")) },
    {
      k: t("rows.price"),
      strong: true,
      v: (x, i) =>
        isSellable(x) ? (
          x.price != null ? (
            <span className="flex flex-col">
              <span className="flex items-center font-display text-xl">
                {formatBDTCompact(x.price, locale)}
                {i === priceBest && <Best>{t("lowest")}</Best>}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">{formatBDT(x.price, locale)}</span>
            </span>
          ) : (
            t("onRequest")
          )
        ) : (
          <span className="text-ink-muted">{tu("notForSale")}</span>
        ),
    },
    { k: t("rows.down", { pct: formatNumber(pct, locale) }), v: (x, i) => (plans[i] ? <span className="font-mono">{formatBDT(plans[i].down, locale, { decimals: false })}</span> : null) },
    { k: t("rows.monthly", { months: formatNumber(months, locale) }), v: (x, i) => (plans[i] ? <span className="font-mono">{formatBDT(plans[i].monthly, locale, { decimals: false })}</span> : null) },
  ].filter(Boolean);

  return (
    <>
      {header}
      <CompareSync items={list.map((x) => ({ id: x.id, label: `${titleOf(x)} · ${pick(x.project, "name", locale)}`, project: pick(x.project, "name", locale) }))} />
      <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-24 sm:px-6 lg:px-8">
        {/* The table scrolls inside its own box on small screens; the label column stays put. */}
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr className="border-b border-line">
                <td className="sticky left-0 z-10 w-40 bg-surface" />
                {list.map((x) => (
                  <th key={x.id} scope="col" className="min-w-52 px-5 py-5 text-left align-top font-normal">
                    <span className="flex items-start justify-between gap-3">
                      <Link href={hrefOf(x)} className="font-display text-2xl leading-tight hover:underline">
                        {titleOf(x)}
                      </Link>
                      <Link href={without(x.id)} aria-label={`${t("removeCol")}: ${titleOf(x)}`} className="grid size-8 shrink-0 place-items-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink">
                        <X aria-hidden className="size-4" />
                      </Link>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} className={r.strong ? "border-b border-line bg-paper" : "border-b border-line"}>
                  <th scope="row" className={`sticky left-0 z-10 px-5 ${r.strong ? "bg-paper" : "bg-surface"} py-3.5 text-left align-top text-xs font-medium text-ink-muted`}>
                    {r.k}
                  </th>
                  {list.map((x, i) => (
                    <td key={x.id} className="px-5 py-3.5 align-top">
                      {r.v(x, i) ?? dash}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 bg-surface" />
                {list.map((x) => (
                  <td key={x.id} className="px-5 py-5">
                    <Link href={hrefOf(x)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                      {t("view")}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink-muted">{t("notice")}</p>
      </div>
    </>
  );
}

export default function ComparePage({ searchParams }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <CompareBody searchParams={searchParams} />
    </Suspense>
  );
}
