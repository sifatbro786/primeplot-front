"use client";

import { useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PaymentStatusTag } from "@/components/portal/parts";
import { useDate, useMoney } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useOnlinePayment, useOnlinePayments, useReviewRefresh } from "@/lib/review/queries";
import { useSearchState } from "@/lib/sales/url";
import { ReasonDialog, ViewChips, useReviewError } from "./parts";

const VIEWS = ["review", "paid", "initiated", "failed", "cancelled", "expired", "rejected", "all"];

/** /dashboard/online-payments — SSLCommerz payments; held ones wait for a manager here. */
export function OnlinePaymentsPage() {
  const t = useTranslations("review.online");
  const tc = useTranslations("common");
  const money = useMoney();
  const date = useDate();
  const reviewError = useReviewError();
  const [params, write] = useSearchState();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "review";
  const open = params.get("payment");
  const list = useOnlinePayments({ status: view === "all" ? undefined : view, bookingId: params.get("bookingId") || undefined });
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <ViewChips views={VIEWS} value={view} onChange={(v) => write({ view: v === "review" ? null : v })} label={t("viewsLabel")} labelOf={(v) => t(`views.${v}`)} />
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(list.error)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={CreditCard} title={t(view === "review" ? "emptyReview" : "empty")} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("cols.customer")}</TH>
                <TH className="hidden md:table-cell">{t("cols.tran")}</TH>
                <TH align="right">{t("cols.amount")}</TH>
                <TH className="hidden lg:table-cell">{t("cols.time")}</TH>
                <TH>{t("cols.status")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id} className="cursor-pointer" onClick={() => write({ payment: p.id })}>
                  <TD>
                    <button type="button" className="text-left text-sm font-medium hover:underline" onClick={(e) => (e.stopPropagation(), write({ payment: p.id }))}>
                      {p.customerName}
                    </button>
                    <span className="block font-mono text-[11px] text-ink-subtle">
                      {p.bookingNo} · {p.unitCode}
                    </span>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <span className="font-mono text-[12px]">{p.tranId}</span>
                    {p.method && <span className="block text-[11px] text-ink-subtle">{p.method}</span>}
                  </TD>
                  <TD numeric>{money(p.amount)}</TD>
                  <TD className="hidden text-xs whitespace-nowrap text-ink-muted lg:table-cell">{date(p.paidAt ?? p.createdAt, "datetime")}</TD>
                  <TD>
                    <PaymentStatusTag status={p.status} />
                    {p.reviewReason && p.status === "review" && <span className="mt-1 block text-[11px] text-warning">{t(`reasons.${p.reviewReason}`)}</span>}
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
      {open && <PaymentDrawer id={open} onClose={() => write({ payment: null })} />}
    </div>
  );
}

function PaymentDrawer({ id, onClose }) {
  const t = useTranslations("review.online");
  const tc = useTranslations("common");
  const money = useMoney();
  const date = useDate();
  const reviewError = useReviewError();
  const refresh = useReviewRefresh();
  const { can } = useSession();
  const q = useOnlinePayment(id);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState(null);
  const p = q.data;
  const decide = can("online_payments:review");

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      refresh("online-payments");
      await q.refetch();
      toast.success(t(`done.${kind}`));
    } catch (err) {
      setError(reviewError(err));
    } finally {
      setBusy(null);
    }
  };

  const g = p?.gateway ?? {};
  const facts = p
    ? [
        ["tranId", p.tranId, true],
        ["bankTranId", g.bankTranId, true],
        ["valId", g.valId, true],
        ["method", [g.cardType, g.cardBrand, g.cardIssuer].filter(Boolean).join(" · ") || null],
        ["validated", g.validatedAmount != null ? `${money(g.validatedAmount)} · ${g.validationStatus ?? ""}` : g.validationStatus],
        ["risk", g.riskLevel != null ? `${g.riskLevel} · ${g.riskTitle ?? ""}` : null],
        ["tranDate", g.tranDate],
        ["receipt", p.receipt?.receiptNo, true],
      ].filter(([, v]) => v)
    : [];

  return (
    <Drawer open onClose={busy ? undefined : onClose} title={t("drawerTitle")} description={p ? `${p.customerName} · ${p.bookingNo}` : undefined} width="md">
      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-3xl tabular-nums">{money(p.amount)}</p>
              <Link href={`/dashboard/bookings/${p.bookingId}`} className="font-mono text-[12px] text-ink-muted hover:underline">
                {p.bookingNo} · {p.unitCode}
              </Link>
            </div>
            <PaymentStatusTag status={p.status} />
          </div>

          {p.status === "review" && p.reviewReason && (
            <p className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
              <span className="font-medium">{t(`reasons.${p.reviewReason}`)}</span>
              <span className="mt-1 block text-ink-muted">{t(`reasonHelp.${p.reviewReason}`)}</span>
            </p>
          )}

          <dl className="divide-y divide-line rounded-md border border-line text-sm">
            {facts.map(([k, v, mono]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-ink-muted">{t(`fields.${k}`)}</dt>
                <dd className={mono ? "min-w-0 truncate font-mono text-[12px]" : "min-w-0 truncate text-right"}>{v}</dd>
              </div>
            ))}
          </dl>

          {p.review && (
            <p className="text-sm text-ink-muted">
              {t(`decided.${p.review.decision}`, { name: p.review.by?.name ?? "—", date: date(p.review.at, "datetime") })}
              {p.review.note ? ` — ${p.review.note}` : ""}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          {decide && (
            <div className="space-y-3">
              {p.status === "review" && (
                <>
                  <Field label={t("note")} optionalLabel={t("optional")}>
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => run("approve", () => api.post(`/online-payments/${p.id}/approve`, note.trim() ? { note: note.trim() } : {}))} loading={busy === "approve"} disabled={Boolean(busy)} className="flex-1">
                      {t("approve")}
                    </Button>
                    <Button variant="secondary" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
                      {t("reject")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-ink-muted">{t("rejectNote")}</p>
                </>
              )}
              {!["paid", "rejected"].includes(p.status) && (
                <Button variant="ghost" size="sm" onClick={() => run("recheck", () => api.post(`/online-payments/${p.id}/recheck`))} loading={busy === "recheck"} disabled={Boolean(busy)}>
                  <RefreshCw aria-hidden className="size-3.5" />
                  {t("recheck")}
                </Button>
              )}
            </div>
          )}

          <section>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("events")}</h3>
            <ol className="space-y-2 border-l border-line pl-4">
              {[...(p.events ?? [])].reverse().map((e, i) => (
                <li key={`${e.at}:${i}`} className="text-xs">
                  <span className="text-ink-muted">{date(e.at, "datetime")}</span> · <Tag tone="outline" className="h-5 px-1.5 text-[10px]">{t(`sources.${e.source}`)}</Tag>
                  {e.status && <span className="ml-1 font-mono text-[11px]">{e.status}</span>}
                  {e.note && <span className="block text-ink-muted">{e.note}</span>}
                </li>
              ))}
            </ol>
          </section>
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
            await api.post(`/online-payments/${id}/reject`, { reason });
          } catch (err) {
            throw new Error(reviewError(err));
          }
          setRejecting(false);
          refresh("online-payments");
          q.refetch();
          toast.success(t("done.reject"));
        }}
      />
    </Drawer>
  );
}
