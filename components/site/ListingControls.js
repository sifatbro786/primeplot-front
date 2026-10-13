"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutGrid, Map as MapIcon, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { listingHref } from "@/lib/public/listing";
import { BUDGETS } from "@/lib/public/status";

const STAGES = ["upcoming", "ongoing", "ready", "completed"];

/**
 * Filter bar + results toolbar for /projects. A real GET form (works without JS); with JS each
 * change replaces the URL (shareable, crawlable) and the server re-renders the results.
 * `children` are the results: dimmed while the next set loads.
 */
export function ListingControls({ filters, areas, count, children }) {
  const t = useTranslations("site.list");
  const ts = useTranslations("projects.stages");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const lastQ = useRef(filters.q ?? "");

  const go = (overrides) => start(() => router.replace(listingHref(filters, overrides), { scroll: false }));

  // Search: debounce typing, ignore no-op changes.
  useEffect(() => {
    const v = q.trim();
    if (v === lastQ.current) return undefined;
    const id = setTimeout(() => {
      lastQ.current = v;
      go({ q: v || null });
    }, 450);
    return () => clearTimeout(id);
  });

  const active = Boolean(filters.q || filters.type || filters.stage || filters.area || filters.budget);

  return (
    <>
      <form
        method="get"
        action={`/${locale}/projects`}
        onSubmit={(e) => {
          e.preventDefault();
          lastQ.current = q.trim();
          go({ q: q.trim() || null });
        }}
        role="search"
        aria-label={t("filtersLabel")}
        className="grid gap-3 rounded-lg border border-line bg-surface p-3 sm:p-4 lg:grid-cols-[minmax(0,1.4fr)_auto_repeat(3,minmax(0,1fr))] lg:items-center"
      >
        <Input
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          maxLength={80}
          leading={<Search aria-hidden className="size-4" />}
        />
        <Segmented
          name="type"
          value={filters.type ?? ""}
          onChange={(v) => go({ type: v || null })}
          aria-label={t("type")}
          className="w-full justify-stretch [&>label]:flex-1 lg:w-auto"
          options={[
            { value: "", label: t("typeAll") },
            { value: "apartment", label: t("typeApartment") },
            { value: "plot", label: t("typePlot") },
          ]}
        />
        <Select name="stage" aria-label={t("stage")} value={filters.stage ?? ""} onChange={(e) => go({ stage: e.target.value || null })}>
          <option value="">{t("stageAll")}</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
        <Select name="area" aria-label={t("area")} value={filters.area ?? ""} onChange={(e) => go({ area: e.target.value || null })}>
          <option value="">{t("areaAll")}</option>
          {areas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        <Select name="budget" aria-label={t("budget")} value={filters.budget ?? ""} onChange={(e) => go({ budget: e.target.value || null })}>
          <option value="">{t("budgetAll")}</option>
          {Object.keys(BUDGETS).map((b) => (
            <option key={b} value={b}>
              {t(`budgets.${b}`)}
            </option>
          ))}
        </Select>
        <noscript>
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-ink">
            {t("apply")}
          </button>
        </noscript>
      </form>
      {filters.budget && <p className="mt-2 text-xs text-ink-muted">{t("budgetNote")}</p>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <p className="flex items-center gap-3 text-sm" aria-live="polite">
          <span className="font-medium">{t("count", { count, n: formatNumber(count, locale) })}</span>
          {active && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                lastQ.current = "";
                go({ q: null, type: null, stage: null, area: null, budget: null });
              }}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <X aria-hidden className="size-3.5" />
              {t("reset")}
            </button>
          )}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="hidden sm:inline">{t("sort")}</span>
            <Select value={filters.sort} onChange={(e) => go({ sort: e.target.value })} className="h-9 w-auto min-w-40 text-xs" aria-label={t("sort")}>
              <option value="featured">{t("sortFeatured")}</option>
              <option value="price">{t("sortPrice")}</option>
              <option value="handover">{t("sortHandover")}</option>
            </Select>
          </label>
          <div role="group" aria-label={t("view")} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
            {[
              { v: "grid", icon: LayoutGrid, label: t("viewGrid") },
              { v: "map", icon: MapIcon, label: t("viewMap") },
            ].map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                type="button"
                aria-pressed={filters.view === v}
                onClick={() => go({ view: v })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-medium transition-colors",
                  filters.view === v ? "bg-primary text-primary-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div aria-busy={pending || undefined} className={cn("transition-opacity duration-200", pending && "opacity-50")}>
        {children}
      </div>
    </>
  );
}
