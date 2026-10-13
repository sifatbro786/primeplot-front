import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { PUBLIC_SWATCH } from "@/lib/public/status";

/** Public stock at a glance: thin proportional strip + "12 of 40 available". */
export function InventoryStrip({ inventory, className }) {
  const t = useTranslations("site.card");
  const locale = useLocale();
  const total = inventory?.total ?? 0;
  if (!total) return <p className={cn("text-xs text-ink-subtle", className)}>{t("unitsSoon")}</p>;
  const parts = ["available", "held", "sold"].map((k) => ({ k, n: inventory[k] ?? 0 }));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-1 overflow-hidden rounded-[1px] bg-surface-3" aria-hidden>
        {parts.map((p) => p.n > 0 && <span key={p.k} className={PUBLIC_SWATCH[p.k]} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {inventory.available > 0
          ? t("available", { count: formatNumber(inventory.available, locale), total: formatNumber(total, locale) })
          : t("soldOut")}
      </p>
    </div>
  );
}
