"use client";

import { LineChart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useProjectOptions } from "@/lib/crm/queries";
import { formatBDT, formatBDTCompact, formatNumber } from "@/lib/format";
import { useAnalytics } from "@/lib/review/queries";
import { addDays, todayDhaka } from "@/lib/sales/money";
import { useSearchState } from "@/lib/sales/url";
import { useReviewError } from "@/components/review/parts";
import { localName } from "@/components/sales/parts";
import { AGE, BarList, ChartCard, MonthColumns, SERIES, useMonthLabel } from "./charts";

const RANGES = ["12m", "6m", "fy", "custom"];
const BUCKETS = ["d1_30", "d31_60", "d61_90", "d90_plus"];
const STATUS_ORDER = ["available", "held", "booked", "allotted", "registered", "handed_over", "blocked"];

/** Dhaka-calendar range for a preset. FY = July–June (Bangladesh fiscal year). */
function rangeOf(preset, params) {
  const today = todayDhaka();
  const monthStart = (d, back) => {
    const [y, m] = d.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 - back, 1));
    return t.toISOString().slice(0, 10);
  };
  if (preset === "6m") return { from: monthStart(today, 5), to: today };
  if (preset === "fy") {
    const [y, m] = today.split("-").map(Number);
    return { from: `${m >= 7 ? y : y - 1}-07-01`, to: today };
  }
  if (preset === "custom") return { from: params.get("from") || addDays(today, -364), to: params.get("to") || today };
  return { from: monthStart(today, 11), to: today };
}

/** /dashboard/analytics — sales, money, stock and pipeline at a glance (F6.4). */
export function AnalyticsPage() {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reviewError = useReviewError();
  const [params, write] = useSearchState();
  const preset = RANGES.includes(params.get("range")) ? params.get("range") : "12m";
  const range = rangeOf(preset, params);
  const projectId = params.get("projectId") || undefined;
  const projects = useProjectOptions();
  const q = useAnalytics({ ...range, projectId });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="mb-8 flex flex-wrap items-end gap-3">
        <div role="radiogroup" aria-label={t("range")} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={preset === r}
              onClick={() => write({ range: r === "12m" ? null : r, ...(r !== "custom" && { from: null, to: null }) })}
              className={cn("h-8 rounded-[3px] px-3 text-xs font-medium whitespace-nowrap", preset === r ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink")}
            >
              {t(`ranges.${r}`)}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <div className="w-40">
              <Input type="date" value={range.from} max={range.to} onChange={(e) => write({ from: e.target.value || null })} aria-label={t("from")} />
            </div>
            <div className="w-40">
              <Input type="date" value={range.to} min={range.from} onChange={(e) => write({ to: e.target.value || null })} aria-label={t("to")} />
            </div>
          </>
        )}
        <div className="w-full sm:ml-auto sm:w-60">
          <Select value={projectId ?? ""} onChange={(e) => write({ projectId: e.target.value || null })} aria-label={t("project")}>
            <option value="">{t("allProjects")}</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {localName(p, locale)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-28 lg:col-span-2" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className={cn("transition-opacity", q.isPlaceholderData && "opacity-60")} aria-busy={q.isPlaceholderData || undefined}>
          <Body d={q.data} />
        </div>
      )}
    </div>
  );
}

function Body({ d }) {
  const t = useTranslations("analytics");
  const ts = useTranslations("crm.sources");
  const tl = useTranslations("crm.lostReasons");
  const tm = useTranslations("sales.payment.modes");
  const tb = useTranslations("sales.reports.dues.bucketsShort");
  const locale = useLocale();
  const month = useMonthLabel();
  const { can } = useSession();
  const money = (v) => formatBDT(v ?? 0, locale);
  const compact = (v) => formatBDTCompact(v ?? 0, locale);
  const num = (v) => formatNumber(v ?? 0, locale);
  const { inventory: inv, sales, collections: col, pipeline: pipe, portal } = d;
  const dues = col.dues;

  const anything = sales.totals.bookings || col.collected.count || inv.units || pipe.newTotal;
  if (!anything) return <EmptyState icon={LineChart} title={t("emptyTitle")} description={t("emptyBody")} />;

  // Collections: past months collected + the next three months expected (stacked in the current month).
  const byPeriod = new Map(col.byMonth.map((m) => [m.period, { period: m.period, collected: m.amount, expected: 0 }]));
  for (const e of col.expected) byPeriod.set(e.period, { period: e.period, collected: byPeriod.get(e.period)?.collected ?? 0, expected: e.amount });
  const money2 = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  const expectedTotal = col.expected.reduce((s, e) => s + e.amount, 0);

  const tiles = [
    { k: "sales", value: compact(sales.totals.value), sub: t("tiles.salesSub", { n: num(sales.totals.bookings) }) },
    { k: "collected", value: compact(col.collected.amount), sub: t("tiles.collectedSub", { n: num(col.collected.count) }) },
    { k: "outstanding", value: compact(dues.outstanding), sub: dues.overdue ? t("tiles.overdueSub", { amount: compact(dues.overdue) }) : t("tiles.noOverdue"), warn: dues.overdue > 0 },
    { k: "sold", value: inv.units ? `${num(Math.round((inv.sold / inv.units) * 100))}%` : "—", sub: t("tiles.soldSub", { sold: num(inv.sold), units: num(inv.units) }) },
    { k: "winRate", value: pipe.winRatePct == null ? "—" : `${num(pipe.winRatePct)}%`, sub: t("tiles.winSub", { won: num(pipe.won), lost: num(pipe.lost) }) },
  ];

  return (
    <div className="space-y-5">
      {/* Headline figures — a ledger strip, plain numbers (no counters). */}
      <section aria-label={t("tiles.label")} className="rounded-lg border border-line bg-surface">
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {tiles.map((x) => (
            <div key={x.k} className="px-5 py-4">
              <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t(`tiles.${x.k}`)}</dt>
              <dd className="mt-1.5 font-mono text-xl tabular-nums">{x.value}</dd>
              <dd className={cn("mt-0.5 text-xs", x.warn ? "text-danger" : "text-ink-muted")}>{x.sub}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title={t("sales.title")}
          note={t("sales.note", { from: month(sales.from.slice(0, 7)), to: month(sales.to.slice(0, 7)) })}
          table={{
            columns: [
              { key: "period", label: t("cols.month"), render: (r) => month(r.period) },
              { key: "bookings", label: t("cols.bookings"), numeric: true, render: (r) => num(r.bookings) },
              { key: "value", label: t("cols.value"), numeric: true, render: (r) => money(r.value) },
            ],
            rows: sales.byMonth,
          }}
        >
          <MonthColumns data={sales.byMonth} series={[{ key: "value", label: t("sales.value"), color: SERIES[0] }]} />
        </ChartCard>

        <ChartCard
          title={t("collections.title")}
          note={t("collections.note", { amount: compact(expectedTotal) })}
          legend={[
            { label: t("collections.collected"), color: SERIES[0] },
            { label: t("collections.expected"), color: SERIES[1], hatch: true },
          ]}
          table={{
            columns: [
              { key: "period", label: t("cols.month"), render: (r) => month(r.period) },
              { key: "collected", label: t("collections.collected"), numeric: true, render: (r) => money(r.collected) },
              { key: "expected", label: t("collections.expected"), numeric: true, render: (r) => (r.expected ? money(r.expected) : "—") },
            ],
            rows: money2,
          }}
        >
          <MonthColumns
            data={money2}
            series={[
              { key: "collected", label: t("collections.collected"), color: SERIES[0] },
              { key: "expected", label: t("collections.expected"), color: SERIES[1], hatch: true },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t("aging.title")}
          note={t("aging.note", { n: num(dues.bookingsOverdue), amount: money(dues.overdue) })}
          action={
            can("reports:read") ? (
              <Link href="/dashboard/reports" className="mr-2 text-xs font-medium text-accent hover:underline">
                {t("aging.report")}
              </Link>
            ) : null
          }
          table={{
            columns: [
              { key: "b", label: t("cols.bucket"), render: (r) => tb(r.b) },
              { key: "v", label: t("cols.amount"), numeric: true, render: (r) => money(r.v) },
            ],
            rows: BUCKETS.map((b) => ({ b, v: dues.buckets?.[b] ?? 0 })),
          }}
        >
          <BarList
            empty={t("aging.none")}
            rows={BUCKETS.map((b, i) => ({ key: b, label: t(`aging.buckets.${b}`), value: dues.buckets?.[b] ?? 0, display: money(dues.buckets?.[b] ?? 0), color: AGE[i] }))}
          />
        </ChartCard>

        <ChartCard
          title={t("inventory.title")}
          note={t("inventory.note", { units: num(inv.units), sold: num(inv.sold) })}
          table={{
            columns: [
              { key: "p", label: t("cols.project"), render: (r) => localName(r.project, locale) || "—" },
              { key: "units", label: t("cols.units"), numeric: true, render: (r) => num(r.units) },
              { key: "sold", label: t("cols.sold"), numeric: true, render: (r) => `${num(r.sold)} (${num(r.soldPct)}%)` },
              { key: "av", label: t("cols.availableValue"), numeric: true, render: (r) => money(r.availableValue) },
            ],
            rows: inv.projects,
          }}
        >
          <BarList
            max={100}
            empty={t("inventory.none")}
            rows={inv.projects.map((p) => ({
              key: p.project.id,
              label: localName(p.project, locale) || "—",
              value: p.soldPct,
              display: `${num(p.soldPct)}%`,
              sub: t("inventory.left", { amount: compact(p.availableValue) }),
            }))}
          />
          <ul className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            {STATUS_ORDER.filter((s) => inv.byStatus?.[s]).map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-xs">
                <StatusChip status={s} size="sm" />
                <span className="font-mono tabular-nums">{num(inv.byStatus[s])}</span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title={t("pipeline.title")}
          note={t("pipeline.note", { n: num(pipe.openTotal) })}
          table={{
            columns: [
              { key: "s", label: t("cols.stage"), render: (r) => (locale === "bn" && r.nameBn) || r.name },
              { key: "count", label: t("cols.leads"), numeric: true, render: (r) => num(r.count) },
            ],
            rows: pipe.stages,
          }}
        >
          <BarList empty={t("pipeline.none")} rows={pipe.stages.map((s) => ({ key: s.id, label: (locale === "bn" && s.nameBn) || s.name, value: s.count, display: num(s.count) }))} />
          {pipe.lostReasons?.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="mb-2 text-xs font-medium text-ink-muted">{t("pipeline.lostReasons", { n: num(pipe.lost) })}</h4>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {pipe.lostReasons.slice(0, 6).map((r) => (
                  <li key={r.reason ?? "none"}>
                    {r.reason ? (tl.has(r.reason) ? tl(r.reason) : r.reason) : t("pipeline.noReason")} <span className="font-mono text-ink-muted">{num(r.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={t("leads.title")}
          note={t("leads.note", { n: num(pipe.newTotal) })}
          table={{
            columns: [
              { key: "source", label: t("cols.source"), render: (r) => (ts.has(r.source) ? ts(r.source) : r.source) },
              { key: "count", label: t("cols.leads"), numeric: true, render: (r) => num(r.count) },
            ],
            rows: pipe.newBySource,
          }}
        >
          <BarList empty={t("leads.none")} rows={pipe.newBySource.map((r) => ({ key: r.source, label: ts.has(r.source) ? ts(r.source) : r.source, value: r.count, display: num(r.count) }))} />
        </ChartCard>

        <ChartCard
          title={t("sellers.title")}
          table={{
            columns: [
              { key: "name", label: t("cols.seller"), render: (r) => r.name ?? "—" },
              { key: "bookings", label: t("cols.bookings"), numeric: true, render: (r) => num(r.bookings) },
              { key: "value", label: t("cols.value"), numeric: true, render: (r) => money(r.value) },
            ],
            rows: sales.bySeller,
          }}
        >
          <BarList empty={t("sellers.none")} rows={sales.bySeller.map((s) => ({ key: s.id, label: s.name ?? "—", value: s.value, display: compact(s.value), sub: t("sellers.bookings", { n: num(s.bookings) }) }))} />
        </ChartCard>

        <ChartCard
          title={t("modes.title")}
          note={col.refunds?.amount ? t("modes.refunds", { amount: money(col.refunds.amount) }) : undefined}
          table={{
            columns: [
              { key: "mode", label: t("cols.mode"), render: (r) => (tm.has(r.mode) ? tm(r.mode) : r.mode) },
              { key: "count", label: t("cols.receipts"), numeric: true, render: (r) => num(r.count) },
              { key: "amount", label: t("cols.amount"), numeric: true, render: (r) => money(r.amount) },
            ],
            rows: col.byMode,
          }}
        >
          <BarList empty={t("modes.none")} rows={[...col.byMode].sort((a, b) => b.amount - a.amount).map((m) => ({ key: m.mode, label: tm.has(m.mode) ? tm(m.mode) : m.mode, value: m.amount, display: compact(m.amount), sub: t("modes.count", { n: num(m.count) }) }))} />
        </ChartCard>
      </div>

      <PortalStrip p={portal} />
    </div>
  );
}

function PortalStrip({ p }) {
  const t = useTranslations("analytics.portal");
  const locale = useLocale();
  const num = (v) => formatNumber(v ?? 0, locale);
  const compact = (v) => formatBDTCompact(v ?? 0, locale);
  const c = p.clients ?? {};
  const items = [
    ["clients", num(c.active), t("clientsSub", { invited: num(c.invited), off: num(c.disabled) }), "/dashboard/customers"],
    ["slipsPending", num(p.slips?.pending?.count), compact(p.slips?.pending?.amount), "/dashboard/payment-slips"],
    ["slipsApproved", num(p.slips?.approved?.count), compact(p.slips?.approved?.amount), "/dashboard/payment-slips?view=approved"],
    ["onlinePaid", num(p.onlinePayments?.paid?.count), compact(p.onlinePayments?.paid?.amount), "/dashboard/online-payments?view=paid"],
    ["onlineReview", num(p.onlinePayments?.review?.count), compact(p.onlinePayments?.review?.amount), "/dashboard/online-payments"],
  ];
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold">{t("title")}</h3>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(([k, v, sub, href]) => (
          <li key={k}>
            <Link href={href} className="block rounded-md border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-canvas">
              <span className="block text-[11px] tracking-wide text-ink-subtle uppercase">{t(k)}</span>
              <span className="mt-1 block font-mono text-lg tabular-nums">{v}</span>
              <span className="block text-xs text-ink-muted">{sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
