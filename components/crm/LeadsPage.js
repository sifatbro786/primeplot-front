"use client";

import { useState } from "react";
import { ClipboardList, Download, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { apiFilters } from "@/lib/crm/constants";
import { useCrmError } from "@/lib/crm/errors";
import { clean, flatPages, useAssignees, useCrmRefresh, useLeadList } from "@/lib/crm/queries";
import { useLeadParam, useUrlFilters } from "@/lib/crm/url";
import { formatDate, formatPhone } from "@/lib/format";
import { LeadCreateDrawer } from "./LeadCreateDrawer";
import { LeadDrawer } from "./LeadDrawer";
import { LeadFilters, ViewChips } from "./LeadFilters";
import { FollowUp, Owner, SlaChip, SourceLabel, StageBadge, useNow, useNum } from "./parts";

function BulkBar({ ids, onDone }) {
  const t = useTranslations("crm.bulk");
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const num = useNum();
  const assignees = useAssignees();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post("/leads/assign", { ids, assigneeId: to === "none" ? null : to });
      toast.success(t("done", { n: num(r.updated) }));
      refresh();
      onDone();
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="toast-in sticky bottom-4 z-20 mx-auto mt-4 flex max-w-2xl flex-wrap items-center gap-3 rounded-lg border border-primary bg-primary px-4 py-3 text-primary-ink shadow-[0_18px_40px_-20px_rgb(28_29_26_/_0.6)]">
      <span className="text-sm font-medium">{t("selected", { n: num(ids.length) })}</span>
      <div className="min-w-44 flex-1 text-ink">
        <Select value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("assignTo")} placeholder={t("assignTo")}>
          <option value="none">{t("unassign")}</option>
          {(assignees.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>
      <Button variant="accent" size="sm" disabled={!to} loading={busy} onClick={run}>
        {t("apply")}
      </Button>
      <Button variant="ghost" size="sm" className="text-primary-ink hover:bg-white/10" onClick={onDone}>
        {t("clear")}
      </Button>
    </div>
  );
}

/** /dashboard/leads — every lead the user may see, filters in the URL, drawer via ?lead=. */
export function LeadsPage() {
  const t = useTranslations("crm");
  const tc = useTranslations("common");
  const tt = useTranslations("crm.types");
  const locale = useLocale();
  const { can } = useSession();
  const crmError = useCrmError();
  const now = useNow();
  const num = useNum();
  const [filters, setFilters] = useUrlFilters();
  const drawer = useLeadParam();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const query = clean(apiFilters(filters));
  const list = useLeadList(query);
  const rows = flatPages(list.data);
  const canAssign = can("leads:assign");
  const canWrite = can("leads:write");
  const filtered = Object.keys(query).length > 0;

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const exportHref = `/api/v1/leads/export?${new URLSearchParams(query).toString()}`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("leads.title")}
        description={t("leads.description")}
        actions={
          <>
            {can("leads:read_all") && (
              <Button as="a" href={exportHref} variant="secondary" download>
                <Download aria-hidden className="size-4" />
                <span className="hidden sm:inline">{t("leads.export")}</span>
              </Button>
            )}
            {canWrite && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" />
                {t("newLead")}
              </Button>
            )}
          </>
        }
      />

      <ViewChips filters={filters} setFilters={setFilters} />
      <LeadFilters filters={filters} setFilters={setFilters} mode="table" />

      {list.isError ? (
        <ErrorState
          title={t("leads.loadFailed")}
          description={crmError(list.error)}
          requestId={list.error?.requestId}
          requestIdLabel={tc("requestId")}
          action={
            <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : list.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? t("leads.noMatches") : t("leads.emptyTitle")}
          description={filtered ? t("leads.noMatchesBody") : t("leads.emptyBody")}
          action={
            !filtered &&
            canWrite && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" />
                {t("newLead")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table aria-busy={list.isFetching || undefined}>
            <THead>
              <tr>
                {canAssign && (
                  <TH className="w-10 pr-0">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                      aria-label={t("bulk.selectAll")}
                    />
                  </TH>
                )}
                <TH>{t("cols.lead")}</TH>
                <TH>{t("cols.stage")}</TH>
                <TH className="hidden md:table-cell">{t("cols.owner")}</TH>
                <TH className="hidden lg:table-cell">{t("cols.interest")}</TH>
                <TH className="hidden sm:table-cell">{t("cols.next")}</TH>
                <TH className="hidden xl:table-cell">{t("cols.created")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((l) => {
                const project = l.interest?.project;
                return (
                  <TR key={l.id} className={cn("cursor-pointer", selected.has(l.id) && "bg-accent-soft")} onClick={() => drawer.open(l.id)}>
                    {canAssign && (
                      <TD className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                          aria-label={t("bulk.select", { name: l.name })}
                        />
                      </TD>
                    )}
                    <TD>
                      <button type="button" className="block max-w-56 min-w-0 text-left" onClick={(e) => (e.stopPropagation(), drawer.open(l.id))}>
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{l.name}</span>
                          {l.type === "landowner" && <Tag tone="info">{tt("landowner")}</Tag>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs">
                          <span className="font-mono text-ink-muted">{formatPhone(l.phone, locale)}</span>
                          <SourceLabel source={l.source} compact />
                          {l.enquiryCount > 1 && <span className="text-ink-subtle">×{num(l.enquiryCount)}</span>}
                        </span>
                      </button>
                    </TD>
                    <TD>
                      <StageBadge stage={l.stage} />
                    </TD>
                    <TD className="hidden md:table-cell">
                      <Owner name={l.assigneeName} />
                    </TD>
                    <TD className="hidden max-w-48 truncate text-sm text-ink-muted lg:table-cell">
                      {l.type === "landowner" ? l.land?.location || "—" : project ? (locale === "bn" && project.nameBn) || project.name : "—"}
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        <SlaChip lead={l} now={now} />
                        {l.status === "open" && <FollowUp at={l.nextFollowUpAt} now={now} />}
                        {l.status !== "open" && <span className="text-xs text-ink-muted">{t(`status.${l.status}`)}</span>}
                      </div>
                    </TD>
                    <TD className="hidden text-xs text-ink-muted xl:table-cell">{formatDate(l.createdAt, locale, "datetime")}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}

      {canAssign && selected.size > 0 && <BulkBar ids={[...selected]} onDone={() => setSelected(new Set())} />}

      <LeadDrawer leadId={drawer.leadId} onClose={drawer.close} onOpenLead={drawer.open} />
      {canWrite && <LeadCreateDrawer open={creating} onClose={() => setCreating(false)} onCreated={(l) => drawer.open(l.id)} onOpenLead={drawer.open} />}
    </div>
  );
}
