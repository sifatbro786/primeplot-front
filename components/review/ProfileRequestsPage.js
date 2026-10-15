"use client";

import { useState } from "react";
import { UserRoundPen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useDate } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { useProfileRequest, useProfileRequestQueue, useReviewRefresh } from "@/lib/review/queries";
import { useSearchState } from "@/lib/sales/url";
import { ReasonDialog, ViewChips, useReviewError } from "./parts";

const VIEWS = ["pending", "approved", "rejected", "withdrawn", "all"];
const TONE = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };

function useFieldValue() {
  const locale = useLocale();
  return (k, v) => (v == null || v === "" ? null : k === "phone" || k === "altPhone" ? formatPhone(v, locale) : v);
}

/** /dashboard/profile-requests — clients asking to change their contact details. */
export function ProfileRequestsPage() {
  const t = useTranslations("review.profile");
  const tf = useTranslations("portal.profile.fields");
  const tc = useTranslations("common");
  const date = useDate();
  const reviewError = useReviewError();
  const [params, write] = useSearchState();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "pending";
  const open = params.get("request");
  const list = useProfileRequestQueue({ status: view === "all" ? undefined : view, customerId: params.get("customerId") || undefined });
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <ViewChips views={VIEWS} value={view} onChange={(v) => write({ view: v === "pending" ? null : v })} label={t("viewsLabel")} labelOf={(v) => t(`views.${v}`)} />
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(list.error)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={UserRoundPen} title={t(view === "pending" ? "emptyPending" : "empty")} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("cols.customer")}</TH>
                <TH>{t("cols.fields")}</TH>
                <TH className="hidden md:table-cell">{t("cols.sent")}</TH>
                <TH>{t("cols.status")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id} className="cursor-pointer" onClick={() => write({ request: r.id })}>
                  <TD>
                    <button type="button" className="text-left text-sm font-medium hover:underline" onClick={(e) => (e.stopPropagation(), write({ request: r.id }))}>
                      {r.customerName}
                    </button>
                  </TD>
                  <TD className="max-w-64 truncate text-sm text-ink-muted">{Object.keys(r.changes ?? {}).map((k) => tf(k)).join(", ")}</TD>
                  <TD className="hidden text-xs whitespace-nowrap text-ink-muted md:table-cell">{date(r.createdAt, "datetime")}</TD>
                  <TD>
                    <Tag tone={TONE[r.status]}>{t(`views.${r.status}`)}</Tag>
                  </TD>
                </TR>
              ))}
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
      {open && <RequestDrawer id={open} onClose={() => write({ request: null })} />}
    </div>
  );
}

function RequestDrawer({ id, onClose }) {
  const t = useTranslations("review.profile");
  const tf = useTranslations("portal.profile.fields");
  const tc = useTranslations("common");
  const date = useDate();
  const value = useFieldValue();
  const reviewError = useReviewError();
  const refresh = useReviewRefresh();
  const q = useProfileRequest(id);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState(null);
  const r = q.data;

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/profile-requests/${id}/approve`);
      refresh("profile-requests");
      toast.success(t("approved"));
      onClose();
    } catch (err) {
      setBusy(false);
      setError(reviewError(err));
    }
  };

  return (
    <Drawer open onClose={busy ? undefined : onClose} title={t("drawerTitle")} description={r?.customerName} width="lg">
      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/dashboard/customers/${r.customerId}`} className="text-sm font-medium hover:underline">
              {t("openCustomer")}
            </Link>
            <Tag tone={TONE[r.status]}>{t(`views.${r.status}`)}</Tag>
          </div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-surface-2 text-[11px] tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t("cols.field")}</th>
                  <th className="px-4 py-2 font-semibold">{t("cols.before")}</th>
                  <th className="px-4 py-2 font-semibold">{t("cols.requested")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {Object.entries(r.changes ?? {}).map(([k, v]) => {
                  const now = r.current?.[k];
                  const drifted = r.status === "pending" && r.current && (now ?? null) !== (r.before?.[k] ?? null);
                  return (
                    <tr key={k} className="align-top">
                      <td className="px-4 py-3 font-medium">{tf(k)}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        <span className="line-through decoration-ink-muted/50">{value(k, r.before?.[k]) ?? "—"}</span>
                        {drifted && <span className="mt-1 block text-[11px] text-warning">{t("changedSince", { value: value(k, now) ?? "—" })}</span>}
                      </td>
                      <td className={cn("px-4 py-3 font-medium", (k === "phone" || k === "altPhone") && "font-mono text-[13px]")}>{value(k, v) ?? t("cleared")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {r.note && <p className="rounded-md bg-surface-2 px-4 py-3 text-sm whitespace-pre-line">{r.note}</p>}
          <p className="text-xs text-ink-muted">{t("sentAt", { date: date(r.createdAt, "datetime") })}</p>
          {"phone" in (r.changes ?? {}) && r.status === "pending" && <p className="rounded-md bg-info-bg px-4 py-3 text-xs text-info">{t("phoneWarning")}</p>}
          {r.rejectReason && <p className="text-sm text-danger">{t("rejectedBecause", { reason: r.rejectReason })}</p>}
          {error && (
            <p role="alert" className="rounded-md border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}
          {r.status === "pending" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} loading={busy}>
                {t("approve")}
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                {t("reject")}
              </Button>
            </div>
          )}
        </div>
      )}
      <ReasonDialog
        open={rejecting}
        title={t("rejectTitle")}
        description={t("rejectBody")}
        confirm={t("reject")}
        onClose={() => setRejecting(false)}
        onConfirm={async (reason) => {
          try {
            await api.post(`/profile-requests/${id}/reject`, { reason });
          } catch (err) {
            throw new Error(reviewError(err));
          }
          setRejecting(false);
          refresh("profile-requests");
          toast.success(t("rejected"));
          onClose();
        }}
      />
    </Drawer>
  );
}
