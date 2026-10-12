"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { SOLD_STATUSES } from "@/lib/unitStatus";

const GROUPS = [
  { key: "available", statuses: ["available"], swatch: "bg-status-available" },
  { key: "held", statuses: ["held"], swatch: "bg-status-held" },
  { key: "sold", statuses: SOLD_STATUSES, swatch: "bg-status-sold" },
  { key: "blocked", statuses: ["blocked", "cancelled"], swatch: "bg-status-blocked hatch" },
];

/**
 * Stock at a glance: one thin proportional strip + exact counts with labels (never colour
 * alone, never animated numbers). `inventory` = { total, byStatus }.
 */
export function InventoryBar({ inventory, className }) {
  const t = useTranslations("inventory.groups");
  const locale = useLocale();
  const total = inventory?.total ?? 0;
  const counts = GROUPS.map((g) => ({ ...g, n: g.statuses.reduce((s, k) => s + (inventory?.byStatus?.[k] ?? 0), 0) }));
  if (!total) return <p className="text-xs text-ink-subtle">{t("none")}</p>;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-1.5 overflow-hidden rounded-[1px] bg-surface-2" aria-hidden>
        {counts.map((c) => c.n > 0 && <span key={c.key} className={c.swatch} style={{ width: `${(c.n / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {counts.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-[1px]", c.swatch)} />
            {t(c.key)} <span className="font-mono text-ink">{formatNumber(c.n, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
