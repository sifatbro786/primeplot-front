"use client";

import { useState } from "react";
import { Ellipsis, ScrollText, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useProjectOptions } from "@/lib/crm/queries";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useSalesError } from "@/lib/sales/errors";
import { todayDhaka } from "@/lib/sales/money";
import { useCheques } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { ChequeActionDialog, ChequeStatusTag, chequeActions } from "./ChequeActions";
import { localName, useDay, useMoney } from "./parts";

const VIEWS = ["open", "received", "deposited", "bounced", "cleared", "returned", "all"];

/** Cheques table — used by the register and the booking page. */
export function ChequesTable({ rows, showBooking = true }) {
  const t = useTranslations("sales.cheques");
  const money = useMoney();
  const day = useDay();
  const { can } = useSession();
  const [action, setAction] = useState(null);
  const today = todayDhaka();
  const manage = can("cheques:manage");
  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>{t("cols.cheque")}</TH>
            {showBooking && <TH className="hidden md:table-cell">{t("cols.booking")}</TH>}
            <TH>{t("cols.date")}</TH>
            <TH align="right">{t("cols.amount")}</TH>
            <TH>{t("cols.status")}</TH>
            {manage && <TH />}
          </tr>
        </THead>
        <TBody>
          {rows.map((c) => {
            const acts = manage ? chequeActions(c) : [];
            const pdc = c.chequeDate > today && ["received", "deposited"].includes(c.status);
            return (
              <TR key={c.id}>
                <TD>
                  <span className="font-mono text-[13px]">{c.chequeNo}</span>
                  <span className="block text-[11px] text-ink-subtle">
                    {c.bank}
                    {c.branch ? ` · ${c.branch}` : ""}
                  </span>
                </TD>
                {showBooking && (
                  <TD className="hidden md:table-cell">
                    <Link href={`/dashboard/bookings/${c.bookingId}`} className="font-mono text-[13px] hover:underline">
                      {c.bookingNo}
                    </Link>
                    <span className="block max-w-44 truncate text-[11px] text-ink-subtle">
                      {c.unitCode} · {c.customerName}
                    </span>
                  </TD>
                )}
                <TD className="whitespace-nowrap">
                  {day(c.chequeDate)}
                  {pdc && (
                    <Tag tone="outline" className="ml-2">
                      {t("pdc")}
                    </Tag>
                  )}
                </TD>
                <TD numeric>{money(c.amount)}</TD>
                <TD>
                  <ChequeStatusTag status={c.status} />
                  {c.status === "bounced" && c.bounceReason && (
                    <span className="mt-1 block max-w-40 truncate text-[11px] text-danger" title={c.bounceReason}>
                      {c.bounceReason}
                    </span>
                  )}
                </TD>
                {manage && (
                  <TD align="right">
                    {acts.length > 0 && (
                      <Menu
                        label={t("actionsLabel")}
                        trigger={(p) => (
                          <Button size="sm" variant="ghost" {...p} aria-label={t("actionsLabel")}>
                            <Ellipsis className="size-4" />
                          </Button>
                        )}
                        items={acts.map((a) => ({
                          key: a,
                          label: t(`${a === "deposit" && c.status === "bounced" ? "redeposit" : a}.menu`),
                          danger: a === "bounce" || a === "return",
                          onSelect: () => setAction({ cheque: c, action: a }),
                        }))}
                      />
                    )}
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
      {action && <ChequeActionDialog cheque={action.cheque} action={action.action} onClose={() => setAction(null)} />}
    </>
  );
}

/** /dashboard/cheques — the cheque / PDC register. */
export function ChequesPage() {
  const t = useTranslations("sales.cheques");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const [params, write] = useSearchState();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "open";
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebounced(q.trim(), 300);
  const projects = useProjectOptions();
  const query = {
    ...(view === "open" ? { open: "true" } : view !== "all" ? { status: view } : {}),
    projectId: params.get("projectId") || undefined,
    q: debounced.length >= 2 ? debounced : undefined,
    dueFrom: params.get("from") || undefined,
    dueTo: params.get("to") || undefined,
  };
  const list = useCheques(query);
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <nav aria-label={t("viewsLabel")} className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => write({ view: v === "open" ? null : v })}
            aria-pressed={view === v}
            className={cn(
              "h-8 shrink-0 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors",
              view === v ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface text-ink-muted hover:text-ink",
            )}
          >
            {t(`views.${v}`)}
          </button>
        ))}
      </nav>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} leading={<Search className="size-4" />} />
        <Select value={params.get("projectId") ?? ""} onChange={(e) => write({ projectId: e.target.value || null })} aria-label={t("project")}>
          <option value="">{t("allProjects")}</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {localName(p, locale)}
            </option>
          ))}
        </Select>
        <Input type="date" value={params.get("from") ?? ""} onChange={(e) => write({ from: e.target.value || null })} aria-label={t("from")} title={t("from")} />
        <Input type="date" value={params.get("to") ?? ""} onChange={(e) => write({ to: e.target.value || null })} aria-label={t("to")} title={t("to")} />
      </div>
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(list.error, locale)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <>
          <ChequesTable rows={rows} />
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
