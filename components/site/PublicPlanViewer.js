"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PlanCanvas } from "@/components/plans/PlanCanvas";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatBDTCompact, formatNumber } from "@/lib/format";
import { pick } from "@/lib/public/site";
import { PUBLIC_TONE } from "@/lib/public/status";
import { floorShort, sizeShort } from "@/lib/public/units";
import { useProjectLive } from "@/lib/socket";
import { LiveBadge, StatusLegend } from "./LiveBadge";
import { PublicStatusChip } from "./PublicStatusChip";

const ZOOMS = [1, 1.5, 2, 3];

function toneOf(h) {
  if (!h.target) return h.unitId || h.position || h.blockId ? "missing" : "label";
  if (h.target.type === "block") return "block";
  const u = h.target.unit;
  return u ? (PUBLIC_TONE[u.status] ?? "blocked") : "missing";
}

/**
 * Public floor / site plan: the same SVG engine as the dashboard in view mode. Floor switching
 * loads the resolved plan for that floor from the public API (cached per floor); unit colours
 * follow the public Socket.IO room. Below the drawing, the same homes as an accessible list.
 */
export function PublicPlanViewer({ project, initialPlan }) {
  const t = useTranslations("site.plan");
  const tu = useTranslations("site.units");
  const tst = useTranslations("site.status");
  const locale = useLocale();
  const router = useRouter();
  const [floor, setFloor] = useState(initialPlan.floor);
  const [zoom, setZoom] = useState(1);
  const [live, setLive] = useState({});

  const q = useQuery({
    queryKey: ["public", "floorplan", initialPlan.id, floor],
    queryFn: ({ signal }) => api.get(`/public/floorplans/${initialPlan.id}`, { query: floor == null ? undefined : { floor }, signal }),
    initialData: floor === initialPlan.floor ? initialPlan : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const plan = q.data ?? initialPlan;

  const state = useProjectLive(project.id, {
    scope: "public",
    onDelta: (d) => setLive((m) => ({ ...m, [d.unitId]: d.status })),
    onResync: () => q.refetch(),
  });

  const hotspots = useMemo(
    () =>
      plan.hotspots.map((h) => {
        const u = h.target?.type === "unit" ? h.target.unit : null;
        if (!u?.id || !live[u.id]) return h;
        return { ...h, target: { ...h.target, unit: { ...u, status: live[u.id] } } };
      }),
    [plan, live],
  );

  const selectFloor = (f) => {
    setFloor(f);
    // Shareable URL without a server round-trip (Next syncs native history with the router).
    const url = new URL(window.location.href);
    url.searchParams.set("floor", String(f));
    window.history.replaceState(null, "", url);
  };

  const unitHref = (u) => `/projects/${project.slug}/units/${u.id}`;
  const homes = hotspots.filter((h) => h.target?.type === "unit" && h.target.unit?.id);
  const blockTitle = (b) => pick(b, "name", locale);

  const tooltip = (h) => {
    if (h.target?.type === "block") {
      const b = h.target.block;
      const avail = b.inventory?.byStatus?.available ?? 0;
      return (
        <div className="space-y-1">
          <p className="font-medium">{blockTitle(b)}</p>
          <p className="text-ink-muted">{t("blockAvailable", { n: formatNumber(avail, locale), total: formatNumber(b.inventory?.total ?? 0, locale) })}</p>
        </div>
      );
    }
    const u = h.target?.unit;
    if (!u || u.status === "unavailable") return <p className="text-ink-muted">{h.label || tst("unavailable")}</p>;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm font-semibold">{u.code}</span>
          <PublicStatusChip status={u.status} size="sm" />
        </div>
        <p className="text-ink-muted">
          {[u.typeLabel, u.bedrooms != null && tu("bedType", { n: u.bedrooms }), sizeShort(u, locale)].filter(Boolean).join(" · ")}
        </p>
        {u.price != null && <p className="font-mono">{formatBDTCompact(u.price, locale)}</p>}
      </div>
    );
  };

  const activate = (h) => {
    if (h.target?.type === "block") return router.push(`/projects/${project.slug}#availability`);
    const u = h.target?.unit;
    if (u?.id && u.status !== "unavailable") router.push(unitHref(u));
  };

  const zi = ZOOMS.indexOf(zoom);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {plan.kind === "floor" && plan.floors.length > 1 ? (
          <div role="group" aria-label={t("floors")} className="flex max-w-full gap-1 overflow-x-auto pb-1">
            {plan.floors.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={f === floor}
                onClick={() => selectFloor(f)}
                className={cn(
                  "h-9 min-w-10 shrink-0 rounded-md border px-2.5 font-mono text-xs transition-colors",
                  f === floor ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface hover:bg-surface-2",
                )}
              >
                {floorShort(f, locale, tu)}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          <LiveBadge state={state} />
          <div className="inline-flex items-center rounded-md border border-line-strong bg-surface">
            <button type="button" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1])} aria-label={t("zoomOut")} className="grid size-9 place-items-center text-ink-muted hover:text-ink disabled:opacity-40">
              <Minus aria-hidden className="size-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(1)} aria-label={t("zoomFit")} className="h-9 min-w-12 border-x border-line px-1 font-mono text-[11px] text-ink-muted hover:text-ink">
              {formatNumber(Math.round(zoom * 100), locale)}%
            </button>
            <button type="button" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zi + 1])} aria-label={t("zoomIn")} className="grid size-9 place-items-center text-ink-muted hover:text-ink disabled:opacity-40">
              <Plus aria-hidden className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn("mt-4 overflow-auto rounded-lg border border-line bg-surface p-2 sm:p-4", q.isFetching && q.isPlaceholderData && "opacity-60")} aria-busy={q.isFetching || undefined}>
        <PlanCanvas
          image={plan.image}
          width={plan.imageWidth}
          height={plan.imageHeight}
          hotspots={hotspots}
          zoom={zoom}
          toneOf={toneOf}
          labelOf={(h) => (h.target?.type === "unit" ? h.target.unit?.code : h.target?.type === "block" ? h.target.block.code : h.label) || null}
          titleOf={(h) => {
            const u = h.target?.unit;
            if (h.target?.type === "block") return blockTitle(h.target.block);
            return u?.code ? `${u.code}, ${tst(u.status)}` : h.label || tst("unavailable");
          }}
          tooltipOf={tooltip}
          onActivate={activate}
          ariaLabel={pick(plan, "title", locale)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <StatusLegend />
        <p className="text-xs text-ink-subtle">{t("hint")}</p>
      </div>

      {homes.length > 0 && (
        <section aria-labelledby="plan-homes" className="mt-12">
          <h2 id="plan-homes" className="text-sm font-semibold">
            {plan.kind === "floor" ? t("homesOnFloor", { floor: floorShort(plan.floor, locale, tu) }) : t("homesOnPlan")}
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {homes.map((h) => {
              const u = h.target.unit;
              return (
                <li key={h.key}>
                  <Link href={unitHref(u)} className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-surface-2/60">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="font-mono font-medium">{u.code}</span>
                      <span className="truncate text-ink-muted">
                        {[u.bedrooms != null && tu("bedType", { n: u.bedrooms }), sizeShort(u, locale)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {u.price != null && <span className="hidden font-mono sm:inline">{formatBDTCompact(u.price, locale)}</span>}
                      <PublicStatusChip status={u.status} size="sm" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
