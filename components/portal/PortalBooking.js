"use client";

import { ArrowLeft, Building2, CreditCard, Download, FileText, Landmark, ReceiptText } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { usePortalBooking, usePortalMe } from "@/lib/portal/queries";
import { useSearchState } from "@/lib/sales/url";
import { DocList, useDownloadPortalPdf } from "./PortalDocuments";
import { PayDrawer } from "./PayDrawer";
import { SlipDrawer } from "./SlipDrawer";
import { DeedCard, PaperHeading, PaymentStatusTag, SlipStatusTag, StageTrack, itemLabel, useDay, useMoney, usePortalError } from "./parts";

const TABS = ["ledger", "receipts", "documents", "progress"];

/** /portal/bookings/[id] — the passbook of one unit. */
export function PortalBooking() {
  const { id } = useParams();
  const t = useTranslations("portal.booking");
  const tc = useTranslations("common");
  const portalError = usePortalError();
  const booking = usePortalBooking(id);

  if (booking.isError) {
    return booking.error?.status === 404 ? (
      <EmptyState
        icon={Building2}
        title={t("notFound")}
        action={
          <Button as={Link} href="/portal" size="sm" variant="secondary">
            {t("back")}
          </Button>
        }
      />
    ) : (
      <ErrorState title={t("loadFailed")} description={portalError(booking.error)} requestId={booking.error?.requestId} requestIdLabel={tc("requestId")} />
    );
  }
  if (booking.isPending) return <Skeleton className="h-[32rem] w-full rounded-lg" />;
  return <Passbook b={booking.data} />;
}

function Passbook({ b }) {
  const t = useTranslations("portal.booking");
  const money = useMoney();
  const day = useDay();
  const me = usePortalMe();
  const [params, write] = useSearchState();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "ledger";
  const drawer = params.get("pay") === "1" && b.canPayOnline ? "pay" : params.get("slip") === "1" && b.canUploadSlip ? "slip" : null;
  const pendingSlips = b.slips.filter((s) => s.status === "pending");
  const rejected = b.slips.find((s) => s.status === "rejected");
  const reviewing = b.onlinePayments.filter((p) => p.status === "review");
  const tot = b.totals ?? {};

  return (
    <div className="space-y-8">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>

      <DeedCard b={b}>
        {b.status === "active" && tot.outstanding > 0 && (
          <div className="mt-6 border-t border-primary-ink/15 pt-5">
            <p className="text-sm text-primary-ink/85">
              {tot.overdue > 0
                ? t("overdueLine", { amount: money(tot.overdue) })
                : tot.nextDue
                  ? t("nextLine", { amount: money(tot.nextDue.amount), date: day(tot.nextDue.dueDate) })
                  : t("noDateLine")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {b.canPayOnline && (
                <Button variant="secondary" onClick={() => write({ pay: "1" })} className="border-transparent">
                  <CreditCard aria-hidden className="size-4" />
                  {t("payNow")}
                </Button>
              )}
              {b.canUploadSlip && (
                <Button variant="ghost" onClick={() => write({ slip: "1" })} className="border-primary-ink/40 text-primary-ink hover:bg-primary-ink/10">
                  <Landmark aria-hidden className="size-4" />
                  {t("uploadSlip")}
                </Button>
              )}
            </div>
          </div>
        )}
      </DeedCard>

      {(pendingSlips.length > 0 || reviewing.length > 0 || rejected) && (
        <section aria-label={t("inProgress")} className="space-y-2">
          {pendingSlips.map((s) => (
            <p key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
              <SlipStatusTag status="pending" />
              {t("slipPending", { amount: money(s.amount), date: day(s.paidOn) })}
            </p>
          ))}
          {reviewing.map((p) => (
            <p key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
              <PaymentStatusTag status="review" />
              {t("paymentReview", { amount: money(p.amount) })}
            </p>
          ))}
          {rejected && pendingSlips.length === 0 && (
            <p className="rounded-md border border-danger/25 bg-danger-bg px-4 py-3 text-sm">
              <span className="font-medium text-danger">{t("slipRejected", { amount: money(rejected.amount) })}</span>
              {rejected.rejectReason && <span className="mt-1 block text-ink-muted">{t("reason", { reason: rejected.rejectReason })}</span>}
            </p>
          )}
        </section>
      )}

      {b.status === "cancelled" && b.cancellation ? (
        <section className="rounded-md border border-line bg-surface p-5 text-sm">
          <p className="font-medium">{t("cancelledOn", { date: day(b.cancellation.date) })}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["paid", "deduction", "refundable", "refunded"].map((k) => (
              <div key={k}>
                <dt className="text-[11px] text-ink-muted">{t(`cancel.${k}`)}</dt>
                <dd className="font-mono tabular-nums">{money(b.cancellation[k] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <section className="rounded-md border border-line bg-surface px-5 pt-5 pb-4">
          <StageTrack b={b} />
        </section>
      )}

      <div>
        <nav aria-label={t("tabsLabel")} className="mb-5 flex gap-5 overflow-x-auto border-b border-ink/15">
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => write({ tab: k === "ledger" ? null : k })}
              aria-current={tab === k ? "page" : undefined}
              className={cn(
                "-mb-px h-11 shrink-0 border-b-2 text-sm font-medium whitespace-nowrap",
                tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </nav>
        {tab === "ledger" && <Ledger b={b} />}
        {tab === "receipts" && <Receipts b={b} />}
        {tab === "documents" && <DocList docs={b.documents} />}
        {tab === "progress" && <Progress b={b} />}
      </div>

      {drawer === "pay" && <PayDrawer b={b} features={me.data?.features} onClose={() => write({ pay: null })} />}
      {drawer === "slip" && <SlipDrawer b={b} me={me.data} onClose={() => write({ slip: null })} />}
    </div>
  );
}

/** The schedule as passbook rows: paid lines get a stamp, overdue ones a red amount. */
function Ledger({ b }) {
  const t = useTranslations("portal.ledger");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const tot = b.totals ?? {};
  return (
    <section>
      <ol className="divide-y divide-dashed divide-line-strong/35 rounded-md border border-line bg-surface">
        {b.schedule.map((i, idx) => {
          const left = i.remaining ?? Math.max(0, i.amount - (i.paid ?? 0));
          return (
            <li key={i.id} className="grid min-h-13 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
              <span className="font-mono text-[11px] text-ink-muted">{formatNumber(i.seq ?? idx + 1, locale, { minimumIntegerDigits: 2, useGrouping: false })}</span>
              <div className="min-w-0">
                <p className={cn("truncate text-sm", i.status === "paid" && "text-ink-muted")}>{itemLabel(i, locale)}</p>
                <p className={cn("text-[11px]", i.status === "overdue" ? "font-medium text-danger" : "text-ink-muted")}>
                  {i.dueDate ? (i.status === "overdue" ? t("overdueSince", { date: day(i.dueDate) }) : day(i.dueDate)) : t("whenCalled")}
                  {i.status !== "paid" && i.paid > 0 && ` · ${t("partPaid", { paid: money(i.paid) })}`}
                </p>
              </div>
              <div className="text-right">
                {i.status === "paid" ? (
                  <span className="paid-stamp">{t("paidStamp")}</span>
                ) : (
                  <span className={cn("font-mono text-sm tabular-nums", i.status === "overdue" && "text-danger")}>{money(left)}</span>
                )}
                {i.status !== "paid" && left !== i.amount && <span className="block font-mono text-[10px] text-ink-muted line-through">{money(i.amount)}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-right">
        {[
          ["total", tot.total],
          ["paid", tot.paid],
          ["outstanding", tot.outstanding],
        ].map(([k, v]) => (
          <div key={k} className={k === "total" ? "text-left" : undefined}>
            <dt className="text-[11px] text-ink-muted">{t(k)}</dt>
            <dd className="font-mono text-sm tabular-nums">{money(v ?? 0)}</dd>
          </div>
        ))}
      </dl>
      {b.planName && <p className="mt-3 text-xs text-ink-muted">{t("plan", { name: b.planName })}</p>}
    </section>
  );
}

/** Receipts as tear-off slips; the matching document (same number) opens / downloads. */
function Receipts({ b }) {
  const t = useTranslations("portal.receipts");
  const tm = useTranslations("sales.payment.modes");
  const money = useMoney();
  const day = useDay();
  const download = useDownloadPortalPdf();
  const docByNo = new Map(b.documents.filter((d) => d.type === "receipt").map((d) => [d.number, d]));
  if (!b.receipts.length) return <EmptyState icon={ReceiptText} title={t("none")} className="bg-surface/60" />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {b.receipts.map((r) => {
        const doc = docByNo.get(r.receiptNo);
        const reversed = r.status === "reversed";
        return (
          <li key={r.id} className="perforated rounded-b-md border-x border-b border-line px-5 pt-6 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[12px] tracking-wide">{r.receiptNo}</p>
                <p className="text-[11px] text-ink-muted">
                  {day(r.date)} · {tm.has(r.mode) ? tm(r.mode) : r.mode}
                </p>
              </div>
              {reversed && <Tag tone="danger">{t("reversed")}</Tag>}
            </div>
            <p className={cn("mt-4 font-mono text-2xl tabular-nums", reversed && "text-ink-muted line-through")}>{money(r.amount)}</p>
            {r.reference && <p className="mt-1 truncate font-mono text-[11px] text-ink-muted">{r.reference}</p>}
            {doc && (
              <div className="mt-4 flex gap-2 border-t border-dashed border-line-strong/50 pt-3">
                <Button as={Link} href={`/portal/documents/${doc.id}`} size="sm" variant="secondary">
                  <FileText aria-hidden className="size-3.5" />
                  {t("view")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => download(doc)}>
                  <Download aria-hidden className="size-3.5" />
                  {t("pdf")}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Progress({ b }) {
  const t = useTranslations("portal.progress");
  const locale = useLocale();
  const day = useDay();
  const ups = b.constructionUpdates ?? [];
  if (!ups.length) return <EmptyState icon={Building2} title={t("none")} description={t("noneBody")} className="bg-surface/60" />;
  const pick = (x) => (locale === "bn" ? x?.bn || x?.en : x?.en || x?.bn) ?? "";
  return (
    <ol className="space-y-6">
      {ups.map((u) => (
        <li key={u.id} className="rounded-md border border-line bg-surface">
          {u.photos?.[0]?.media && <SmartImage media={u.photos[0].media} alt={pick(u.photos[0].caption)} className="aspect-[16/9] rounded-t-md" sizes="(min-width: 1024px) 60vw, 100vw" />}
          <div className="p-5">
            <PaperHeading title={pick(u.title)} action={<span className="text-[11px] text-ink-muted">{day(u.date)}</span>} className="mb-3 border-b-0 pb-0" />
            {u.percent != null && (
              <div className="mb-3">
                <div className="h-1 bg-surface-3">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, u.percent)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">{t("percent", { pct: formatNumber(u.percent, locale) })}</p>
              </div>
            )}
            {pick(u.body) && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-muted">{pick(u.body)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

