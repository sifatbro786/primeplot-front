import { ArrowRight, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BUDGETS } from "@/lib/public/status";

const control =
  "h-11 w-full cursor-pointer appearance-none rounded-md border border-line-strong bg-surface pr-9 pl-3 text-sm text-ink transition-colors hover:border-ink-muted focus:border-primary focus:outline-none";

function Pick({ name, label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-ink-muted">{label}</span>
      <span className="relative">
        <select name={name} className={control} defaultValue="">
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" />
      </span>
    </label>
  );
}

/**
 * "Find a home" card under the hero: a plain GET form to /projects (works without JS; empty
 * selects are simply ignored by the listing's query parser).
 */
export function HeroSearch({ areas }) {
  const t = useTranslations("site.home");
  const tl = useTranslations("site.list");
  const locale = useLocale();
  return (
    <form
      method="get"
      action={`/${locale}/projects`}
      role="search"
      aria-label={t("searchTitle")}
      className="relative grid gap-4 rounded-lg border border-line bg-surface p-5 shadow-[0_18px_48px_-24px_rgb(28_29_26_/_0.35)] sm:p-6 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end"
    >
      {/* editorial "stamp" — a sticker-like accent, not a stat */}
      <span aria-hidden className="stamp absolute -top-7 right-5 size-[4.5rem] bg-accent-on-dark p-2 text-[9px] font-semibold text-primary caps sm:-top-9 sm:right-8 sm:size-20">
        {t("stamp")}
      </span>
      <p className="font-display text-xl md:col-span-4">{t("searchTitle")}</p>
      <Pick name="type" label={tl("type")}>
        <option value="">{tl("typeAll")}</option>
        <option value="apartment">{tl("typeApartment")}</option>
        <option value="plot">{tl("typePlot")}</option>
      </Pick>
      <Pick name="area" label={tl("area")}>
        <option value="">{tl("areaAll")}</option>
        {areas.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Pick>
      <Pick name="budget" label={tl("budget")}>
        <option value="">{tl("budgetAll")}</option>
        {Object.keys(BUDGETS).map((b) => (
          <option key={b} value={b}>
            {tl(`budgets.${b}`)}
          </option>
        ))}
      </Pick>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium tracking-wide text-primary-ink transition-colors hover:bg-primary-hover"
      >
        {t("searchSubmit")}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </form>
  );
}
