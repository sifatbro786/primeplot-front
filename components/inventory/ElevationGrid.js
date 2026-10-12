"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber, localizeDigits } from "@/lib/format";
import { UNIT_STATUS_CELL } from "@/lib/unitStatus";

/** "G" ground, "B1" basement, "12" upper floors (digits localized). */
export function floorLabel(floor, locale, t) {
  if (floor === 0) return t("groundShort");
  if (floor < 0) return t("basementShort", { n: localizeDigits(-floor, locale) });
  return localizeDigits(floor, locale);
}

function floorsOf(block, units) {
  const fl = units.map((u) => u.floor).filter((f) => f != null);
  const hi = block.highestFloor ?? (fl.length ? Math.max(...fl) : 0);
  const lo = block.lowestFloor ?? (fl.length ? Math.min(...fl, 0) : 0);
  const out = [];
  for (let f = Math.max(hi, ...fl); f >= Math.min(lo, ...fl); f--) out.push(f);
  return out;
}

function positionsOf(units) {
  const set = new Set(units.map((u) => u.position ?? "—"));
  return [...set].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b, "en", { numeric: true })));
}

/**
 * Building elevation: floors top → bottom, positions left → right, like a section drawing.
 * The ground line is drawn under floor 0; basements sit below it on a sunken band.
 * Empty slots (inside the building's floor range) invite "add unit" for writers.
 */
export function ElevationGrid({ block, units, highlight, onOpen, onAdd }) {
  const t = useTranslations("inventory");
  const ts = useTranslations("unitStatus");
  const locale = useLocale();
  const floors = floorsOf(block, units);
  const positions = positionsOf(units);
  const cols = Math.max(positions.length, 1);
  const at = new Map(units.map((u) => [`${u.floor}|${u.position ?? "—"}`, u]));

  return (
    <div className="blueprint overflow-x-auto rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div
        role="grid"
        aria-label={t("gridLabel", { block: block.name })}
        className="inline-grid min-w-full gap-1"
        style={{ gridTemplateColumns: `3rem repeat(${cols}, minmax(5.5rem, 1fr))` }}
      >
        {/* roof line + position headers */}
        <div role="row" className="contents">
          {/* corner cell: occupies the label column (an sr-only span would leave the grid) */}
          <span role="columnheader" className="border-b-2 border-ink/70">
            <span className="sr-only">{t("floor")}</span>
          </span>
          {positions.map((pos) => (
            <span key={pos} role="columnheader" className="border-b-2 border-ink/70 pb-1.5 text-center font-mono text-[11px] text-ink-muted">
              {pos}
            </span>
          ))}
        </div>

        {floors.map((floor) => (
          <div
            key={floor}
            role="row"
            className={cn("contents", floor === 0 && "[&>*]:border-b-2 [&>*]:border-b-ink/70 [&>*]:pb-1")}
          >
            <span role="rowheader" className={cn("flex items-center justify-end pr-2 font-mono text-[11px] text-ink-subtle", floor < 0 && "bg-surface-2/60")}>
              {floorLabel(floor, locale, t)}
            </span>
            {positions.map((pos) => {
              const u = at.get(`${floor}|${pos}`);
              if (!u) {
                return (
                  <span key={pos} role="gridcell" className={cn("p-0", floor < 0 && "bg-surface-2/60")}>
                    {onAdd && pos !== "—" ? (
                      <button
                        type="button"
                        onClick={() => onAdd({ floor, position: pos })}
                        className="group grid h-14 w-full place-items-center rounded-sm border border-dashed border-line-strong/50 text-ink-subtle transition-colors hover:border-line-strong hover:bg-surface"
                        aria-label={t("addAt", { floor: floorLabel(floor, locale, t), position: pos })}
                      >
                        <Plus aria-hidden className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                      </button>
                    ) : (
                      <span className="block h-14 rounded-sm border border-dashed border-line/70" />
                    )}
                  </span>
                );
              }
              const dim = highlight && !highlight.includes(u.status);
              return (
                <span key={pos} role="gridcell" className="p-0">
                  <button
                    type="button"
                    onClick={() => onOpen(u.id)}
                    title={`${u.code} · ${ts(u.status)}`}
                    className={cn(
                      "flex h-14 w-full flex-col justify-between rounded-sm border px-2 py-1.5 text-left transition-[background-color,opacity] duration-150",
                      UNIT_STATUS_CELL[u.status],
                      dim && "opacity-25",
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-[11px] font-medium text-ink">{u.code}</span>
                      {u.status === "held" && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-status-held" />}
                    </span>
                    <span className="truncate text-[10px] text-ink-muted">
                      {[u.typeLabel, u.saleableSqft && `${formatNumber(u.saleableSqft, locale)} ${t("sftShort")}`].filter(Boolean).join(" · ") || ts(u.status)}
                    </span>
                    <span className="sr-only">{ts(u.status)}</span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {floors.some((f) => f < 0) && <p className="mt-3 text-[11px] text-ink-subtle">{t("groundLineNote")}</p>}
    </div>
  );
}
