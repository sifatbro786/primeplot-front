"use client";

import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useAssignees, useProjectOptions } from "@/lib/crm/queries";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useSalesError } from "@/lib/sales/errors";
import { useBookings } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { StageTag, localName, useDay, useMoney } from "./parts";

/** /dashboard/bookings — every booking the user may see (executives: their own), filters in the URL. */
export function BookingsPage() {
  const t = useTranslations("sales.bookings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const money = useMoney();
  const day = useDay();
  const salesError = useSalesError();
  const { can } = useSession();
  const readAll = can("bookings:read_all");
  const [params, write] = useSearchState();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebounced(q.trim(), 300);
  const projects = useProjectOptions();
  const sellers = useAssignees({ enabled: readAll });
  const filters = {
    q: debounced || undefined,
    projectId: params.get("projectId") || undefined,
    status: params.get("status") || undefined,
    soldBy: (readAll && params.get("soldBy")) || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    page: Number(params.get("page")) || 1,
    limit: 25,
  };
  const list = useBookings(filters);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(filters.q || filters.projectId || filters.status || filters.soldBy || filters.from || filters.to);
  const setFilter = (k) => (e) => write({ [k]: e.target.value || null, page: null });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          can("bookings:create") && (
            <Button as={Link} href="/dashboard/bookings/new">
              <Plus aria-hidden className="size-4" />
              {t("new")}
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr_0.8fr]">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            write({ q: e.target.value.trim() || null, page: null });
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          leading={<Search className="size-4" />}
        />
        <Select value={filters.projectId ?? ""} onChange={setFilter("projectId")} aria-label={t("project")}>
          <option value="">{t("allProjects")}</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {localName(p, locale)}
            </option>
          ))}
        </Select>
        <Select value={filters.status ?? ""} onChange={setFilter("status")} aria-label={t("status")}>
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("statuses.active")}</option>
          <option value="cancelled">{t("statuses.cancelled")}</option>
        </Select>
        {readAll ? (
          <Select value={filters.soldBy ?? ""} onChange={setFilter("soldBy")} aria-label={t("soldBy")}>
            <option value="">{t("allSellers")}</option>
            {(sellers.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="hidden lg:block" />
        )}
        <Input type="date" value={filters.from ?? ""} onChange={setFilter("from")} aria-label={t("from")} title={t("from")} />
        <Input type="date" value={filters.to ?? ""} onChange={setFilter("to")} aria-label={t("to")} title={t("to")} />
      </div>

      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(list.error, locale)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? t("noMatches") : t("emptyTitle")}
          description={filtered ? undefined : t("emptyBody")}
          action={
            !filtered &&
            can("bookings:create") && (
              <Button as={Link} href="/dashboard/bookings/new" size="sm">
                <Plus aria-hidden className="size-4" />
                {t("new")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table aria-busy={list.isFetching || undefined}>
            <THead>
              <tr>
                <TH>{t("cols.booking")}</TH>
                <TH>{t("cols.unit")}</TH>
                <TH className="hidden md:table-cell">{t("cols.customer")}</TH>
                <TH align="right" className="hidden lg:table-cell">{t("cols.contract")}</TH>
                <TH align="right">{t("cols.outstanding")}</TH>
                <TH align="right" className="hidden sm:table-cell">{t("cols.overdue")}</TH>
                <TH>{t("cols.stage")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((b) => (
                <TR key={b.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/bookings/${b.id}`)}>
                  <TD>
                    <Link href={`/dashboard/bookings/${b.id}`} className="font-mono text-[13px] hover:underline" onClick={(e) => e.stopPropagation()}>
                      {b.bookingNo}
                    </Link>
                    <span className="block text-[11px] text-ink-subtle">
                      {day(b.bookingDate)}
                      {readAll && b.soldBy?.name ? ` · ${b.soldBy.name}` : ""}
                    </span>
                  </TD>
                  <TD>
                    <span className="font-mono text-[13px]">{b.unitCode}</span>
                    <span className="block max-w-40 truncate text-[11px] text-ink-subtle">{localName(b.project, locale)}</span>
                  </TD>
                  <TD className="hidden max-w-48 truncate md:table-cell">{b.customerName}</TD>
                  <TD numeric className="hidden lg:table-cell">{money(b.contractTotal)}</TD>
                  <TD numeric>{money(b.totals?.outstanding)}</TD>
                  <TD numeric className={cn("hidden sm:table-cell", b.totals?.overdue > 0 ? "text-danger" : "text-ink-subtle")}>
                    {b.totals?.overdue > 0 ? money(b.totals.overdue) : "—"}
                  </TD>
                  <TD>
                    <StageTag stage={b.stage} status={b.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination meta={list.data?.meta} onPage={(n) => write({ page: n > 1 ? n : null })} />
        </>
      )}
    </div>
  );
}
