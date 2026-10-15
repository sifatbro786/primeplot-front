"use client";

import { useState } from "react";
import { BarChart3, TableProperties } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatBDT, formatBDTCompact, formatNumber } from "@/lib/format";

/**
 * Chart palette (validated with the dataviz validator against the white card surface):
 *  - SERIES[0] moss / SERIES[1] ochre: CVD ΔE 15 (protan), normal 26 — pass. Ochre is 2.9:1
 *    against white, so every chart also has a table view and the ochre bars carry a hatch.
 *  - AGE: one clay hue light→dark (ordinal, monotone, light end 2.2:1) for overdue buckets.
 * Earthy on purpose (owner's palette), saturated just enough to clear the chroma floor.
 */
export const SERIES = ["#356B2C", "#C28A2C"];
export const AGE = ["#CFA27E", "#B5784C", "#8E5130", "#62301A"];
const GRID = "#E5E3DF";
const AXIS_TEXT = "#666861";

/** 'YYYY-MM' → "Oct 26" / "অক্টো ২৬". */
export function useMonthLabel() {
  const locale = useLocale();
  const f = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  return (period) => (period ? f.format(new Date(`${period}-15T00:00:00Z`)) : "");
}

/** Card with a title, an optional note and a chart ⇄ table switch (the table is the accessible view). */
export function ChartCard({ title, note, legend, table, children, className, action }) {
  const t = useTranslations("analytics");
  const [view, setView] = useState("chart");
  return (
    <section className={cn("min-w-0 rounded-lg border border-line bg-surface p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <div className="flex rounded-md border border-line p-0.5" role="group" aria-label={t("view")}>
              {[
                ["chart", BarChart3],
                ["table", TableProperties],
              ].map(([k, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setView(k)}
                  aria-pressed={view === k}
                  aria-label={t(`views.${k}`)}
                  title={t(`views.${k}`)}
                  className={cn("grid size-7 place-items-center rounded-[3px]", view === k ? "bg-surface-2 text-ink" : "text-ink-subtle hover:text-ink")}
                >
                  <Icon aria-hidden className="size-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {view === "table" && table ? <DataTable {...table} /> : (
        <>
          {children}
          {legend && <Legend items={legend} />}
        </>
      )}
    </section>
  );
}

export function Legend({ items }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ backgroundColor: i.color, backgroundImage: i.hatch ? "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.55) 0 1.5px, transparent 1.5px 4px)" : undefined }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** { columns: [{ key, label, numeric?, render? }], rows: [] } */
export function DataTable({ columns, rows }) {
  return (
    <div className="max-h-80 overflow-y-auto">
      <Table>
        <THead>
          <tr>
            {columns.map((c) => (
              <TH key={c.key} align={c.numeric ? "right" : "left"}>
                {c.label}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {rows.map((r, i) => (
            <TR key={i}>
              {columns.map((c) => (
                <TD key={c.key} numeric={c.numeric} className="h-10">
                  {c.render ? c.render(r) : r[c.key]}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function TooltipCard({ active, payload, label, labelOf, rows }) {
  if (!active || !payload?.length) return null;
  const shown = rows(payload[0].payload).filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className="min-w-44 rounded-md border border-line bg-surface px-3 py-2.5 text-xs shadow-[0_8px_24px_-12px_rgb(28_29_26_/_0.3)]">
      <p className="mb-1.5 font-medium text-ink">{labelOf(label)}</p>
      <ul className="space-y-1">
        {shown.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              {r.color && <span aria-hidden className="size-2 rounded-[2px]" style={{ backgroundColor: r.color }} />}
              {r.label}
            </span>
            <span className="font-mono tabular-nums text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rounded data-end, square at the baseline; a 2px surface gap on top of a stacked segment. */
function Column({ x, y, width, height, fill, hatch, top }) {
  if (!height || height <= 0) return null;
  const r = top ? Math.min(4, width / 2, height) : 0;
  const h = top ? height : Math.max(0, height - 2);
  const y0 = top ? y : y + 2;
  const d = `M${x},${y0 + h} V${y0 + r} Q${x},${y0} ${x + r},${y0} H${x + width - r} Q${x + width},${y0} ${x + width},${y0 + r} V${y0 + h} Z`;
  return (
    <g>
      <path d={d} fill={fill} />
      {hatch && <path d={d} fill="url(#pp-hatch)" />}
    </g>
  );
}

/**
 * Monthly columns (one or two stacked series). `series` = [{ key, label, color, hatch? }].
 * The y axis shows compact taka (lakh/crore) or plain counts; the tooltip has exact values.
 */
export function MonthColumns({ data, series, money = true, height = 240 }) {
  const locale = useLocale();
  const month = useMonthLabel();
  const fmtTick = (v) => (money ? formatBDTCompact(v, locale).replace("৳ ", "") : formatNumber(v, locale));
  const fmt = (v) => (money ? formatBDT(v, locale) : formatNumber(v, locale));
  const last = series.length - 1;
  return (
    <div style={{ height }} className="-ml-2">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <pattern id="pp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.55" />
          </pattern>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="period" tickFormatter={month} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 11, fill: AXIS_TEXT }} tickLine={false} axisLine={false} width={money ? 58 : 32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgb(45 50 40 / 0.05)" }}
            content={<TooltipCard labelOf={month} rows={(row) => series.map((s) => (row[s.key] ? { label: s.label, value: fmt(row[s.key]), color: s.color } : null))} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={series.length > 1 ? "a" : undefined}
              fill={s.color}
              maxBarSize={24}
              isAnimationActive={false}
              shape={(p) => {
                // A segment is the "top" when no later series has a value in this month.
                const top = series.slice(i + 1).every((n) => !p.payload?.[n.key]) || i === last;
                return <Column {...p} fill={s.color} hatch={s.hatch} top={top} />;
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Horizontal bars in HTML (ranked lists, buckets, funnels) — crisp text, no chart chrome.
 * rows: [{ key, label, value, display, color?, sub? }]; the longest bar = `max` (default: largest value).
 */
export function BarList({ rows, max, color = SERIES[0], empty }) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || top <= 0) return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
          <span className="truncate text-ink-muted" title={typeof r.label === "string" ? r.label : undefined}>
            {r.label}
          </span>
          <span className="relative h-3 rounded-r-[3px] bg-surface-2" title={r.display}>
            <span className="absolute inset-y-0 left-0 rounded-r-[3px]" style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%`, backgroundColor: r.color ?? color }} />
          </span>
          <span className="text-right font-mono text-[13px] whitespace-nowrap tabular-nums">
            {r.display}
            {r.sub && <span className="block text-[11px] text-ink-subtle">{r.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
