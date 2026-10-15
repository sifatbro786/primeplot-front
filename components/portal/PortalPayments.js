"use client";

import { useState } from "react";
import { CircleCheck, CircleX, Clock, Hourglass, Wallet } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useDate } from "@/components/sales/parts";
import { usePortalDues, usePortalPayment, usePortalPayments, usePortalRefresh, usePortalSlips } from "@/lib/portal/queries";
import { PaperHeading, PaymentStatusTag, SlipStatusTag, itemLabel, localName, useDay, useMoney, usePortalError } from "./parts";

/** /portal/payments — what is due, slips sent, online payments made. */
export function PortalPaymentsPage() {
  const t = useTranslations("portal.payments");
  return (
    <div className="space-y-10">
      <header>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="mt-3 font-display text-[2rem] leading-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-muted">{t("intro")}</p>
      </header>
      <Dues />
      <Slips />
      <Online />
    </div>
  );
}

function Dues() {
  const t = useTranslations("portal.payments");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const portalError = usePortalError();
  const dues = usePortalDues(60);
  const items = dues.data?.items ?? [];
  // One block per booking: "pay / upload slip" acts on a booking, not on a single item.
  const byBooking = [];
  for (const i of items) {
    let g = byBooking.find((x) => x.bookingId === i.bookingId);
    if (!g) byBooking.push((g = { bookingId: i.bookingId, unitCode: i.unitCode, project: i.project, items: [] }));
    g.items.push(i);
  }
  return (
    <section>
      <PaperHeading title={t("duesTitle")} action={dues.data?.totals?.overdue > 0 ? <span className="text-xs font-medium text-danger">{t("overdueTotal", { amount: money(dues.data.totals.overdue) })}</span> : null} />
      {dues.isError ? (
        <ErrorState title={t("loadFailed")} description={portalError(dues.error)} requestId={dues.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : dues.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : byBooking.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink/20 px-5 py-6 text-center text-sm text-ink-muted">{t("nothingDue")}</p>
      ) : (
        <div className="space-y-4">
          {byBooking.map((g) => (
            <div key={g.bookingId} className="rounded-md border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <p className="min-w-0 truncate text-sm font-medium">
                  {g.unitCode} <span className="font-normal text-ink-muted">· {localName(g.project, locale)}</span>
                </p>
                <Button as={Link} href={`/portal/bookings/${g.bookingId}`} size="sm" variant="secondary">
                  {t("payThis")}
                </Button>
              </div>
              <ul className="divide-y divide-line">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{itemLabel(i, locale)}</p>
                      <p className={cn("text-[11px]", i.status === "overdue" ? "font-medium text-danger" : "text-ink-muted")}>{day(i.dueDate)}</p>
                    </div>
                    <span className={cn("font-mono text-sm tabular-nums", i.status === "overdue" && "text-danger")}>{money(i.remaining ?? i.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Slips() {
  const t = useTranslations("portal.payments");
  const tch = useTranslations("portal.slip.channels");
  const money = useMoney();
  const day = useDay();
  const portalError = usePortalError();
  const refresh = usePortalRefresh();
  const list = usePortalSlips();
  const [busy, setBusy] = useState(null);
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  const withdraw = async (s) => {
    setBusy(s.id);
    try {
      await api.post(`/portal/slips/${s.id}/withdraw`);
      refresh();
      toast.success(t("withdrawn"));
    } catch (err) {
      toast.error(portalError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <PaperHeading title={t("slipsTitle")} />
      {list.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("noSlips")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="rounded-md border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-base tabular-nums">{money(s.amount)}</p>
                <SlipStatusTag status={s.status} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {s.unitCode} · {day(s.paidOn)} · {tch.has(s.channel) ? tch(s.channel) : s.channel}
                {s.reference ? ` · ${s.reference}` : ""}
              </p>
              {s.status === "rejected" && s.rejectReason && <p className="mt-2 text-sm text-danger">{t("rejectedBecause", { reason: s.rejectReason })}</p>}
              {s.status === "approved" && s.receipt && <p className="mt-2 text-sm text-success">{t("approvedReceipt", { no: s.receipt.receiptNo })}</p>}
              {s.status === "pending" && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">{t("pendingNote")}</p>
                  <Button size="sm" variant="ghost" loading={busy === s.id} onClick={() => withdraw(s)}>
                    {t("withdraw")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <Button size="sm" variant="secondary" className="mt-3" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          {t("more")}
        </Button>
      )}
    </section>
  );
}

function Online() {
  const t = useTranslations("portal.payments");
  const money = useMoney();
  const date = useDate();
  const list = usePortalPayments();
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];
  if (!list.isPending && rows.length === 0) return null;
  return (
    <section>
      <PaperHeading title={t("onlineTitle")} />
      {list.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/payments/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                <div className="min-w-0">
                  <p className="font-mono text-sm tabular-nums">{money(p.amount)}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {p.unitCode} · {date(p.paidAt ?? p.createdAt, "datetime")}
                    {p.receipt ? ` · ${p.receipt.receiptNo}` : ""}
                  </p>
                </div>
                <PaymentStatusTag status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <Button size="sm" variant="secondary" className="mt-3" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          {t("more")}
        </Button>
      )}
    </section>
  );
}

const RESULT = {
  paid: { icon: CircleCheck, tone: "text-success", ring: "border-success/30 bg-success-bg" },
  review: { icon: Hourglass, tone: "text-warning", ring: "border-warning/30 bg-warning-bg" },
  initiated: { icon: Clock, tone: "text-info", ring: "border-info/20 bg-info-bg" },
  failed: { icon: CircleX, tone: "text-danger", ring: "border-danger/25 bg-danger-bg" },
  cancelled: { icon: CircleX, tone: "text-ink-muted", ring: "border-line bg-surface" },
  expired: { icon: CircleX, tone: "text-ink-muted", ring: "border-line bg-surface" },
  rejected: { icon: CircleX, tone: "text-danger", ring: "border-danger/25 bg-danger-bg" },
};

/**
 * /portal/payments/[id]?result=success|fail|cancel — where SSLCommerz sends the buyer back.
 * The `result` query is only a hint from the browser trip; the status shown is the server's
 * (validated with SSLCommerz), polled while it is still `initiated`.
 */
export function PaymentResult() {
  const { id } = useParams();
  const params = useSearchParams();
  const t = useTranslations("portal.result");
  const tc = useTranslations("common");
  const money = useMoney();
  const date = useDate();
  const portalError = usePortalError();
  const q = usePortalPayment(id);

  if (q.isError) {
    return q.error?.status === 404 ? (
      <EmptyState icon={Wallet} title={t("notFound")} action={<Button as={Link} href="/portal/payments" size="sm" variant="secondary">{t("toPayments")}</Button>} />
    ) : (
      <ErrorState title={t("loadFailed")} description={portalError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
    );
  }
  if (q.isPending) return <Skeleton className="h-72 w-full" />;
  const p = q.data;
  const hint = params.get("result");
  const waiting = p.status === "initiated";
  const stillWaiting = waiting && q.dataUpdateCount >= 40;
  const look = RESULT[p.status] ?? RESULT.initiated;
  const Icon = look.icon;
  const key = waiting ? (hint === "fail" || hint === "cancel" ? `initiated_${hint}` : stillWaiting ? "initiated_late" : "initiated") : p.status;

  return (
    <div className="mx-auto max-w-lg">
      <section className={cn("rounded-md border px-6 py-8 text-center", look.ring)} aria-live="polite">
        {waiting && !stillWaiting ? <Spinner className="mx-auto size-8 text-info" /> : <Icon aria-hidden className={cn("mx-auto size-10", look.tone)} strokeWidth={1.5} />}
        <h1 className="mt-4 font-display text-[1.75rem] leading-tight">{t(`${key}.title`)}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t(`${key}.body`)}</p>
        <p className="mt-6 font-mono text-3xl tabular-nums">{money(p.amount)}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {p.unitCode} · {p.bookingNo}
        </p>
      </section>

      <dl className="mt-6 divide-y divide-line rounded-md border border-line bg-surface text-sm">
        {[
          ["tranId", <span key="v" className="font-mono text-[12px]">{p.tranId}</span>],
          p.method && ["method", p.method],
          p.receipt && ["receipt", <span key="v" className="font-mono text-[12px]">{p.receipt.receiptNo}</span>],
          ["time", date(p.paidAt ?? p.createdAt, "datetime")],
        ]
          .filter(Boolean)
          .map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-ink-muted">{t(`fields.${k}`)}</dt>
              <dd className="min-w-0 truncate text-right">{v}</dd>
            </div>
          ))}
      </dl>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button as={Link} href={`/portal/bookings/${p.bookingId}${p.receipt ? "?tab=receipts" : ""}`}>
          {p.receipt ? t("seeReceipt") : t("toBooking")}
        </Button>
        {["failed", "cancelled", "expired"].includes(p.status) && (
          <Button as={Link} href={`/portal/bookings/${p.bookingId}?pay=1`} variant="secondary">
            {t("tryAgain")}
          </Button>
        )}
      </div>
    </div>
  );
}
