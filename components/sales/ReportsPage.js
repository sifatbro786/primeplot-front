"use client";

import { useState } from "react";
import { Download, LineChart, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useAssignees, useProjectOptions } from "@/lib/crm/queries";
import { formatDate, formatNumber } from "@/lib/format";
import { downloadCsv, takaCell, toCsv } from "@/lib/sales/csv";
import { useSalesError } from "@/lib/sales/errors";
import { todayDhaka } from "@/lib/sales/money";
import { clean, useReport } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { ChequesTable } from "./ChequesPage";
import { StageTag, localName, useDay, useMoney } from "./parts";

const TABS = ["dues", "collections", "pdcs"];
const BUCKETS = ["d1_30", "d31_60", "d61_90", "d90_plus"];

/** /dashboard/reports — dues & aging, collections, PDCs (reports:read). Filters live in the URL. */
export function ReportsPage() {
  const t = useTranslations("sales.reports");
  const [params, write] = useSearchState();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "dues";
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
            <Printer aria-hidden className="size-4" />
            {t("print")}
          </Button>
        }
      />
      <nav aria-label={t("tabsLabel")} className="mb-6 flex gap-6 scroll-x border-b border-line print:hidden">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => write({ tab: k === "dues" ? null : k, page: null })}
            aria-current={tab === k ? "page" : undefined}
            className={cn("-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap", tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </nav>
      <h3 className="mb-4 hidden font-display text-2xl print:block">{t(`tabs.${tab}`)}</h3>
      {tab === "dues" && <Dues params={params} write={write} />}
      {tab === "collections" && <Collections params={params} write={write} />}
      {tab === "pdcs" && <Pdcs params={params} write={write} />}
    </div>
  );
}

function ProjectFilter({ value, onChange }) {
  const t = useTranslations("sales.reports");
  const locale = useLocale();
  const projects = useProjectOptions();
  return (
    <Field label={t("project")}>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t("allProjects")}</option>
        {(projects.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {localName(p, locale)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Strip({ items }) {
  return (
    <dl className="mb-6 grid grid-cols-2 rounded-lg border border-line bg-surface sm:grid-cols-3 lg:flex lg:divide-x lg:divide-line">
      {items.map(([label, value, cls]) => (
        <div key={label} className="min-w-0 flex-1 px-5 py-4">
          <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{label}</dt>
          <dd className={cn("mt-1 font-mono text-[15px] tabular-nums", cls)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Loading({ q, children }) {
  const t = useTranslations("sales.reports");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  if (q.isError) return <ErrorState title={t("loadFailed")} description={salesError(q.error, locale)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (q.isPending) return <Skeleton className="h-80 w-full" />;
  return <div className={q.isFetching ? "opacity-60 transition-opacity" : undefined}>{children}</div>;
}

function Dues({ params, write }) {
  const t = useTranslations("sales.reports.dues");
  const tr = useTranslations("sales.reports");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const sellers = useAssignees();
  const [exporting, setExporting] = useState(false);
  const query = {
    projectId: params.get("projectId") || undefined,
    soldBy: params.get("soldBy") || undefined,
    asOf: params.get("asOf") || undefined,
    overdueOnly: params.get("all") === "1" ? "false" : "true",
    page: Number(params.get("page")) || 1,
    limit: 50,
  };
  const q = useReport("dues", query);
  const r = q.data;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = [];
      for (let page = 1; page <= 40; page += 1) {
        const d = await api.get("/reports/dues", { query: clean({ ...query, page, limit: 100 }) });
        rows.push(...d.items);
        if (page >= d.meta.pages) break;
      }
      const csv = toCsv(rows, [
        { label: "Booking", value: (x) => x.bookingNo },
        { label: "Project", value: (x) => x.project?.name },
        { label: "Unit", value: (x) => x.unitCode },
        { label: "Customer", value: (x) => x.customer?.name },
        { label: "Phone", value: (x) => x.customer?.phone },
        { label: "Sold by", value: (x) => x.soldBy?.name },
        { label: "Outstanding", value: (x) => takaCell(x.outstanding) },
        { label: "Due now", value: (x) => takaCell(x.dueNow) },
        { label: "Overdue", value: (x) => takaCell(x.overdue) },
        { label: "1-30 days", value: (x) => takaCell(x.buckets.d1_30) },
        { label: "31-60 days", value: (x) => takaCell(x.buckets.d31_60) },
        { label: "61-90 days", value: (x) => takaCell(x.buckets.d61_90) },
        { label: "90+ days", value: (x) => takaCell(x.buckets.d90_plus) },
        { label: "Oldest due", value: (x) => x.oldestDueDate },
        { label: "Next due", value: (x) => x.nextDue?.dueDate },
      ]);
      downloadCsv(`dues-${r?.asOf ?? todayDhaka()}.csv`, csv);
    } catch {
      toast.error(tr("exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto_auto] print:hidden">
        <ProjectFilter value={query.projectId} onChange={(v) => write({ projectId: v, page: null })} />
        <Field label={tr("soldBy")}>
          <Select value={query.soldBy ?? ""} onChange={(e) => write({ soldBy: e.target.value || null, page: null })}>
            <option value="">{tr("anyone")}</option>
            {(sellers.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("asOf")}>
          <Input type="date" value={query.asOf ?? ""} onChange={(e) => write({ asOf: e.target.value || null, page: null })} />
        </Field>
        <Checkbox className="pb-2.5" label={t("includeNotOverdue")} checked={query.overdueOnly === "false"} onChange={(e) => write({ all: e.target.checked ? "1" : null, page: null })} />
        <Button variant="secondary" loading={exporting} disabled={!r?.items?.length} onClick={exportCsv}>
          <Download aria-hidden className="size-4" />
          {tr("csv")}
        </Button>
      </div>
      <Loading q={q}>
        {r && (
          <>
            <Strip
              items={[
                [t("bookings"), formatNumber(r.totals.bookings, locale)],
                [t("outstanding"), money(r.totals.outstanding)],
                [t("overdue"), money(r.totals.overdue), r.totals.overdue > 0 && "text-danger"],
                ...BUCKETS.map((b) => [t(`buckets.${b}`), money(r.totals.buckets[b]), b === "d90_plus" && r.totals.buckets[b] > 0 && "text-danger"]),
              ]}
            />
            <p className="mb-3 text-xs text-ink-muted">{t("asOfNote", { date: day(r.asOf) })}</p>
            {r.items.length === 0 ? (
              <EmptyState icon={LineChart} title={t("none")} />
            ) : (
              <>
                <Table>
                  <THead>
                    <tr>
                      <TH>{t("cols.booking")}</TH>
                      <TH>{t("cols.customer")}</TH>
                      <TH align="right">{t("cols.overdue")}</TH>
                      {BUCKETS.map((b) => (
                        <TH key={b} align="right" className="hidden xl:table-cell">
                          {t(`bucketsShort.${b}`)}
                        </TH>
                      ))}
                      <TH align="right" className="hidden md:table-cell">
                        {t("cols.outstanding")}
                      </TH>
                      <TH className="hidden lg:table-cell">{t("cols.oldest")}</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {r.items.map((x) => (
                      <TR key={x.bookingId}>
                        <TD>
                          <Link href={`/dashboard/bookings/${x.bookingId}`} className="font-mono text-[13px] hover:underline">
                            {x.bookingNo}
                          </Link>
                          <span className="block text-[11px] text-ink-subtle">
                            {x.unitCode} · {localName(x.project, locale)}
                          </span>
                        </TD>
                        <TD>
                          <span className="block max-w-48 truncate text-sm">{x.customer?.name}</span>
                          {x.customer?.phone && (
                            <a href={`tel:${x.customer.phone}`} className="font-mono text-[11px] text-ink-subtle hover:underline">
                              {x.customer.phone}
                            </a>
                          )}
                        </TD>
                        <TD numeric className={x.overdue > 0 ? "text-danger" : undefined}>
                          {money(x.overdue)}
                        </TD>
                        {BUCKETS.map((b) => (
                          <TD key={b} numeric className="hidden text-ink-muted xl:table-cell">
                            {x.buckets[b] ? money(x.buckets[b]) : "—"}
                          </TD>
                        ))}
                        <TD numeric className="hidden md:table-cell">
                          {money(x.outstanding)}
                        </TD>
                        <TD className="hidden whitespace-nowrap lg:table-cell">
                          {x.oldestDueDate ? day(x.oldestDueDate) : "—"}
                          <span className="ml-2">
                            <StageTag stage={x.stage} />
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <div className="print:hidden">
                  <Pagination meta={r.meta} onPage={(p) => write({ page: p > 1 ? p : null })} />
                </div>
              </>
            )}
          </>
        )}
      </Loading>
    </div>
  );
}

function Collections({ params, write }) {
  const t = useTranslations("sales.reports.collections");
  const tr = useTranslations("sales.reports");
  const tp = useTranslations("sales.payment");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const today = todayDhaka();
  const query = {
    projectId: params.get("projectId") || undefined,
    from: params.get("from") || `${today.slice(0, 8)}01`,
    to: params.get("to") || today,
    interval: params.get("interval") === "month" ? "month" : "day",
  };
  const q = useReport("collections", query);
  const r = q.data;
  const periodLabel = (p) => (query.interval === "month" ? formatDate(`${p}-15T06:00:00Z`, locale, "long").replace(/^\S+\s/, "") : day(p));

  const exportCsv = () => {
    if (!r) return;
    const rows = [
      ...r.byPeriod.map((x) => ({ group: "period", key: x.period, ...x })),
      ...r.byMode.map((x) => ({ group: "mode", key: x.mode, ...x })),
      ...r.byProject.map((x) => ({ group: "project", key: x.project?.name ?? x.projectId, ...x })),
      { group: "refunds", key: "refunds", ...r.refunds },
    ];
    downloadCsv(
      `collections-${r.from}-${r.to}.csv`,
      toCsv(rows, [
        { label: "Group", value: (x) => x.group },
        { label: "Key", value: (x) => x.key },
        { label: "Receipts", value: (x) => x.count },
        { label: "Amount", value: (x) => takaCell(x.amount) },
      ]),
    );
  };

  return (
    <div>
      <div className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto_auto] print:hidden">
        <ProjectFilter value={query.projectId} onChange={(v) => write({ projectId: v })} />
        <Field label={tr("from")}>
          <Input type="date" value={query.from} max={query.to} onChange={(e) => write({ from: e.target.value || null })} />
        </Field>
        <Field label={tr("to")}>
          <Input type="date" value={query.to} min={query.from} onChange={(e) => write({ to: e.target.value || null })} />
        </Field>
        <Segmented
          value={query.interval}
          onChange={(v) => write({ interval: v === "day" ? null : v })}
          options={[
            { value: "day", label: t("daily") },
            { value: "month", label: t("monthly") },
          ]}
          aria-label={t("interval")}
        />
        <Button variant="secondary" disabled={!r} onClick={exportCsv}>
          <Download aria-hidden className="size-4" />
          {tr("csv")}
        </Button>
      </div>
      <Loading q={q}>
        {r && (
          <>
            <Strip
              items={[
                [t("collected"), money(r.total.amount)],
                [t("receipts"), formatNumber(r.total.count, locale)],
                [t("refunds"), money(r.refunds.amount), r.refunds.amount > 0 && "text-danger"],
                [t("net"), money(r.total.amount - r.refunds.amount)],
                [t("reversed"), formatNumber(r.reversedReceipts, locale)],
              ]}
            />
            <p className="mb-4 text-xs text-ink-muted">{t("range", { from: day(r.from), to: day(r.to) })}</p>
            {r.total.count === 0 ? (
              <EmptyState icon={LineChart} title={t("none")} />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section>
                  <h3 className="mb-3 text-sm font-semibold">{t("byPeriod")}</h3>
                  <GroupTable rows={r.byPeriod.map((x) => ({ key: x.period, label: periodLabel(x.period), ...x }))} total={r.total} />
                </section>
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">{t("byMode")}</h3>
                    <GroupTable rows={r.byMode.map((x) => ({ key: x.mode, label: tp.has(`modes.${x.mode}`) ? tp(`modes.${x.mode}`) : x.mode, ...x }))} total={r.total} />
                  </section>
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">{t("byProject")}</h3>
                    <GroupTable rows={r.byProject.map((x) => ({ key: x.projectId, label: localName(x.project, locale) || "—", ...x }))} total={r.total} />
                  </section>
                </div>
              </div>
            )}
          </>
        )}
      </Loading>
    </div>
  );
}

/** Group rows with a thin share bar (a ledger column, not a chart). */
function GroupTable({ rows, total }) {
  const t = useTranslations("sales.reports.collections");
  const locale = useLocale();
  const money = useMoney();
  return (
    <Table>
      <THead>
        <tr>
          <TH>{t("cols.group")}</TH>
          <TH align="right">{t("cols.count")}</TH>
          <TH align="right">{t("cols.amount")}</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((x) => (
          <TR key={x.key}>
            <TD>
              <span className="text-sm">{x.label}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className="block h-full bg-accent/60" style={{ width: `${total.amount ? Math.max(2, Math.round((x.amount / total.amount) * 100)) : 0}%` }} />
              </span>
            </TD>
            <TD numeric className="text-ink-muted">{formatNumber(x.count, locale)}</TD>
            <TD numeric>{money(x.amount)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function Pdcs({ params, write }) {
  const t = useTranslations("sales.reports.pdcs");
  const tr = useTranslations("sales.reports");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const query = { projectId: params.get("projectId") || undefined, from: params.get("from") || undefined, to: params.get("to") || undefined };
  const q = useReport("pdcs", query);
  const r = q.data;
  const exportCsv = () => {
    if (!r) return;
    const rows = [...r.dueNow.map((c) => ({ ...c, group: "due" })), ...r.upcoming.map((c) => ({ ...c, group: "upcoming" })), ...r.bounced.map((c) => ({ ...c, group: "bounced" }))];
    downloadCsv(
      `pdcs-${r.today}.csv`,
      toCsv(rows, [
        { label: "Group", value: (c) => c.group },
        { label: "Cheque no", value: (c) => c.chequeNo },
        { label: "Bank", value: (c) => c.bank },
        { label: "Cheque date", value: (c) => c.chequeDate },
        { label: "Amount", value: (c) => takaCell(c.amount) },
        { label: "Status", value: (c) => c.status },
        { label: "Booking", value: (c) => c.bookingNo },
        { label: "Unit", value: (c) => c.unitCode },
        { label: "Customer", value: (c) => c.customerName },
      ]),
    );
  };
  return (
    <div>
      <div className="mb-6 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto] print:hidden">
        <ProjectFilter value={query.projectId} onChange={(v) => write({ projectId: v })} />
        <Field label={tr("from")}>
          <Input type="date" value={query.from ?? ""} onChange={(e) => write({ from: e.target.value || null })} />
        </Field>
        <Field label={tr("to")}>
          <Input type="date" value={query.to ?? ""} onChange={(e) => write({ to: e.target.value || null })} />
        </Field>
        <Button variant="secondary" disabled={!r} onClick={exportCsv}>
          <Download aria-hidden className="size-4" />
          {tr("csv")}
        </Button>
      </div>
      <Loading q={q}>
        {r && (
          <>
            <Strip
              items={[
                [t("dueNow"), `${money(r.totals.dueNow.amount)} · ${formatNumber(r.totals.dueNow.count, locale)}`],
                [t("upcoming"), `${money(r.totals.upcoming.amount)} · ${formatNumber(r.totals.upcoming.count, locale)}`],
                [t("bounced"), `${money(r.totals.bounced.amount)} · ${formatNumber(r.totals.bounced.count, locale)}`, r.totals.bounced.count > 0 && "text-danger"],
              ]}
            />
            <p className="mb-4 text-xs text-ink-muted">{t("range", { from: day(r.from), to: day(r.to) })}</p>
            {["dueNow", "upcoming", "bounced"].map((k) => (
              <section key={k} className="mb-8">
                <h3 className="mb-3 text-sm font-semibold">{t(`${k}Title`)}</h3>
                {r[k].length ? <ChequesTable rows={r[k]} /> : <p className="text-sm text-ink-muted">{t("none")}</p>}
              </section>
            ))}
          </>
        )}
      </Loading>
    </div>
  );
}
