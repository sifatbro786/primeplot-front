"use client";

import { CornerDownRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatAreaValue, formatNumber } from "@/lib/format";
import { UNIT_STATUS_CELL } from "@/lib/unitStatus";

const byPlotNo = (a, b) => String(a.plotNo ?? a.code).localeCompare(String(b.plotNo ?? b.code), "en", { numeric: true });

/**
 * Plot layout without a drawn master plan (that comes with the plan editor): plots grouped by
 * road, each road a strip like a lane on a layout plan. Tiles show the deed area as entered.
 */
export function PlotGrid({ units, highlight, onOpen }) {
  const t = useTranslations("inventory");
  const ts = useTranslations("unitStatus");
  const locale = useLocale();

  const roads = new Map();
  for (const u of units) {
    const key = u.road || "";
    if (!roads.has(key)) roads.set(key, { road: u.road, width: u.roadWidthFt, list: [] });
    const r = roads.get(key);
    r.list.push(u);
    if (r.width == null && u.roadWidthFt != null) r.width = u.roadWidthFt;
  }
  const groups = [...roads.values()].sort((a, b) => (a.road ?? "~").localeCompare(b.road ?? "~", "en", { numeric: true }));

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.road ?? "none"} className="rounded-lg border border-line bg-surface">
          <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
            <h4 className="text-sm font-semibold">{g.road || t("noRoad")}</h4>
            <p className="font-mono text-[11px] text-ink-subtle">
              {g.width != null && t("roadWidth", { ft: formatNumber(g.width, locale) })}
              {" · "}
              {t("plotCount", { n: g.list.length, count: formatNumber(g.list.length, locale) })}
            </p>
          </header>
          {/* the road itself — a hatched lane the plots face */}
          <div aria-hidden className="hatch h-2 border-b border-line" />
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-1.5 p-3">
            {g.list.sort(byPlotNo).map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onOpen(u.id)}
                  title={`${u.code} · ${ts(u.status)}`}
                  className={cn(
                    "flex h-[4.25rem] w-full flex-col justify-between rounded-sm border px-2.5 py-2 text-left transition-[background-color,opacity] duration-150",
                    UNIT_STATUS_CELL[u.status],
                    highlight && !highlight.includes(u.status) && "opacity-25",
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-xs font-medium text-ink">{u.plotNo ?? u.code}</span>
                    {u.isCorner && <CornerDownRight aria-label={t("corner")} className="size-3 shrink-0 text-ink-muted" />}
                  </span>
                  <span className="truncate text-[10px] text-ink-muted">
                    {u.landArea ? formatAreaValue(u.landArea.value, u.landArea.unit, locale) : "—"}
                  </span>
                  <span className="sr-only">{ts(u.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
