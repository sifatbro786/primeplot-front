import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/** Hairline band of real catalogue figures. Hidden items with a zero would only look sad. */
export function StatsBand({ stats, className, dark = false }) {
  const t = useTranslations("site.stats");
  const locale = useLocale();
  const items = [
    { k: "projects", v: stats.projects },
    { k: "available", v: stats.available },
    { k: "areas", v: stats.areas },
    { k: "ready", v: stats.ready },
  ].filter((i) => i.v > 0);
  if (!items.length) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4",
        dark ? "border-primary-deep bg-primary-deep text-primary-ink" : "border-line bg-line",
        className,
      )}
    >
      {items.map((i) => (
        <div key={i.k} className={cn("px-5 py-6 sm:px-7", dark ? "bg-primary" : "bg-surface")}>
          <dt className={cn("caps text-[10px] font-semibold", dark ? "text-accent-on-dark" : "text-ink-muted")}>{t(i.k)}</dt>
          <dd className="mt-2 font-display text-4xl leading-none">{formatNumber(i.v, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}
