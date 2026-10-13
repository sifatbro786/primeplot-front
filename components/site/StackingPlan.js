"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/Checkbox";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatBDTCompact, formatNumber, localizeDigits } from "@/lib/format";
import { pick } from "@/lib/public/site";
import { PUBLIC_CELL } from "@/lib/public/status";
import { floorShort, sizeShort } from "@/lib/public/units";
import { useProjectLive } from "@/lib/socket";
import { LiveBadge, StatusLegend } from "./LiveBadge";

/**
 * Live availability: apartments as a building elevation (floors top → bottom × positions),
 * plots as tiles per road. Statuses update over the public Socket.IO room; after a reconnect
 * the server data is refreshed (events may have been missed).
 */
export function StackingPlan({ project, blocks, units: initial }) {
  const t = useTranslations("site.units");
  const tst = useTranslations("site.status");
  const locale = useLocale();
  const router = useRouter();
  const [live, setLive] = useState({}); // unitId → status (deltas since the page loaded)
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    // Fresh server data after router.refresh(): it already includes the deltas.
    setPrev(initial);
    setLive({});
  }

  const state = useProjectLive(project.id, {
    scope: "public",
    onDelta: (d) => setLive((m) => ({ ...m, [d.unitId]: d.status })),
    onResync: () => router.refresh(),
  });

  const units = useMemo(() => initial.map((u) => (live[u.id] ? { ...u, status: live[u.id] } : u)), [initial, live]);
  const groups = useMemo(() => {
    const m = new Map(blocks.map((b) => [b.id, []]));
    for (const u of units) m.get(u.blockId)?.push(u);
    return blocks.map((b) => ({ block: b, units: m.get(b.id) ?? [] })).filter((g) => g.units.length);
  }, [blocks, units]);
  const [tab, setTab] = useState(groups[0]?.block.id);
  const current = groups.find((g) => g.block.id === tab) ?? groups[0];
  if (!current) return null;

  const href = (u) => `/projects/${project.slug}/units/${u.id}`;
  const dim = (u) => onlyAvailable && u.status !== "available";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {groups.length > 1 ? (
          <div role="tablist" aria-label={t(project.kind === "plot" ? "blocksLabel" : "buildingsLabel")} className="flex flex-wrap gap-1.5">
            {groups.map(({ block, units: bu }) => {
              const sel = block.id === current.block.id;
              const avail = bu.filter((u) => u.status === "available").length;
              return (
                <button
                  key={block.id}
                  type="button"
                  role="tab"
                  aria-selected={sel}
                  onClick={() => setTab(block.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                    sel ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
                  )}
                >
                  {pick(block, "name", locale)}
                  <span className={cn("font-mono text-[11px]", sel ? "text-primary-ink/75" : "text-ink-muted")}>
                    {formatNumber(avail, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-medium">{pick(current.block, "name", locale)}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Checkbox checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} label={t("onlyAvailable")} />
          <LiveBadge state={state} />
        </div>
      </div>

      <div role="tabpanel" className="mt-5">
        {project.kind === "plot" ? (
          <PlotTiles units={current.units} href={href} dim={dim} locale={locale} t={t} tst={tst} />
        ) : (
          <Elevation block={current.block} units={current.units} href={href} dim={dim} locale={locale} t={t} tst={tst} />
        )}
      </div>
      <StatusLegend className="mt-4" />
    </div>
  );
}

function cellTitle(u, locale, tst) {
  return [u.code, sizeShort(u, locale), u.price != null && formatBDTCompact(u.price, locale), tst(u.status)].filter(Boolean).join(" · ");
}

function UnitCell({ u, href, dim, locale, tst, children, className }) {
  const base = cn("rounded-sm border transition-[background-color,opacity] duration-150", PUBLIC_CELL[u.status], dim(u) && "opacity-25", className);
  if (u.status === "unavailable") {
    return (
      <span className={base} title={tst("unavailable")}>
        <span className="sr-only">{tst("unavailable")}</span>
      </span>
    );
  }
  return (
    <Link href={href(u)} title={cellTitle(u, locale, tst)} className={cn(base, "focus-visible:outline-2 focus-visible:outline-focus")}>
      {children}
      <span className="sr-only">{tst(u.status)}</span>
    </Link>
  );
}

function Elevation({ block, units, href, dim, locale, t, tst }) {
  const floorsWithUnits = units.map((u) => u.floor).filter((f) => f != null);
  const hi = Math.max(block.highestFloor ?? 0, ...floorsWithUnits);
  const lo = Math.min(block.lowestFloor ?? 0, ...floorsWithUnits, 0);
  const floors = [];
  for (let f = hi; f >= lo; f--) floors.push(f);
  const positions = [...new Set(units.map((u) => u.position ?? "—"))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const at = new Map(units.map((u) => [`${u.floor}|${u.position ?? "—"}`, u]));

  return (
    <div className="blueprint overflow-x-auto rounded-lg border border-line bg-surface p-3 sm:p-5">
      <table className="w-full min-w-max border-separate border-spacing-1">
        <caption className="sr-only">{t("gridCaption", { name: pick(block, "name", locale) })}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-10 border-b-2 border-ink/70">
              <span className="sr-only">{t("floor")}</span>
            </th>
            {positions.map((p) => (
              <th key={p} scope="col" className="border-b-2 border-ink/70 pb-1 text-center font-mono text-[11px] font-normal text-ink-muted">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {floors.map((f) => (
            <tr key={f} className={cn(f === 0 && "[&>*]:border-b-2 [&>*]:border-b-ink/70")}>
              <th scope="row" className={cn("pr-1.5 text-right font-mono text-[11px] font-normal text-ink-subtle", f < 0 && "bg-surface-2/60")}>
                <span className="sr-only">{t("floor")} </span>
                {floorShort(f, locale, t)}
              </th>
              {positions.map((p) => {
                const u = at.get(`${f}|${p}`);
                return (
                  <td key={p} className={cn("p-0", f < 0 && "bg-surface-2/60")}>
                    {u ? (
                      <UnitCell u={u} href={href} dim={dim} locale={locale} tst={tst} className="flex h-12 min-w-[4.75rem] flex-col justify-center px-2 sm:h-14 sm:min-w-[5.5rem]">
                        <span className="font-mono text-[11px] font-medium text-ink">{u.code}</span>
                        <span className="truncate text-[10px] text-ink-muted">
                          {[u.bedrooms != null && t("bedShort", { n: localizeDigits(u.bedrooms, locale) }), sizeShort(u, locale)].filter(Boolean).join(" · ")}
                        </span>
                      </UnitCell>
                    ) : (
                      <span className="block h-12 rounded-sm border border-dashed border-line/70 sm:h-14" aria-hidden />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlotTiles({ units, href, dim, locale, t, tst }) {
  const roads = new Map();
  for (const u of units) {
    const k = u.road ?? "";
    if (!roads.has(k)) roads.set(k, []);
    roads.get(k).push(u);
  }
  const sorted = [...roads.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "en", { numeric: true })));
  return (
    <div className="blueprint space-y-6 rounded-lg border border-line bg-surface p-4 sm:p-6">
      {sorted.map(([road, list]) => (
        <section key={road || "none"}>
          <h3 className="flex items-baseline gap-2 text-xs font-medium text-ink-muted">
            {road ? t("road", { road }) : t("otherPlots")}
            {list[0]?.roadWidthFt != null && road && <span className="font-mono text-[11px] text-ink-subtle">{t("roadWidth", { ft: localizeDigits(list[0].roadWidthFt, locale) })}</span>}
          </h3>
          {/* the road itself: a band the plots sit along */}
          <div aria-hidden className="mt-2 h-1.5 rounded-[1px] bg-ink/10" />
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...list]
              .sort((a, b) => String(a.plotNo ?? a.code).localeCompare(String(b.plotNo ?? b.code), "en", { numeric: true }))
              .map((u) => (
                <li key={u.id}>
                  <UnitCell u={u} href={href} dim={dim} locale={locale} tst={tst} className="flex h-16 w-24 flex-col justify-center px-2">
                    <span className="font-mono text-[11px] font-medium text-ink">{u.plotNo ? t("plotNo", { no: u.plotNo }) : u.code}</span>
                    <span className="truncate text-[10px] text-ink-muted">{sizeShort(u, locale)}</span>
                  </UnitCell>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
