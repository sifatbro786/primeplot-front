"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Pencil, Printer, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { salesKeys, useBooking, useDocuments, useLedger, useSalesRefresh } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { BookingActionsMenu, CancellationPanel, StageTimeline, useScheduleActions } from "./BookingActions";
import { PriceLines, ScheduleTable } from "./BookingParts";
import { ChequesTable } from "./ChequesPage";
import { DocumentsTab } from "./Documents";
import { ReceiptDrawer } from "./ReceiptDrawer";
import { NomineesEditor, checkNominees, nomineesBody, nomineesToForm } from "./wizard/NomineesEditor";
import { Fact, ReceiptStatusTag, StageTag, localName, useDay, useDate, useMoney } from "./parts";

const TABS = ["schedule", "receipts", "documents", "ledger", "details"];

/** /dashboard/bookings/[id] — the account of one sale: schedule, receipts, ledger, parties. */
export function BookingDetail() {
  const { id } = useParams();
  const t = useTranslations("sales.booking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const booking = useBooking(id);

  if (booking.isError) {
    return booking.error?.status === 404 ? (
      <EmptyState
        icon={FileText}
        title={t("notFound")}
        className="mx-auto max-w-2xl"
        action={
          <Button as={Link} href="/dashboard/bookings" size="sm" variant="secondary">
            {t("back")}
          </Button>
        }
      />
    ) : (
      <ErrorState title={t("loadFailed")} description={salesError(booking.error, locale)} requestId={booking.error?.requestId} requestIdLabel={tc("requestId")} className="mx-auto max-w-2xl" />
    );
  }
  if (booking.isPending) return <Skeleton className="mx-auto h-[32rem] w-full max-w-7xl" />;
  return <Detail b={booking.data} />;
}

function Detail({ b }) {
  const t = useTranslations("sales.booking");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const { can } = useSession();
  const [params, write] = useSearchState();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "schedule";
  const created = params.get("created") === "1";
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const active = b.status === "active";
  const tot = b.totals ?? {};
  const paidPct = tot.total ? Math.min(100, Math.round((tot.paid / tot.total) * 100)) : 0;
  const firstReceipt = b.receipts?.find((r) => r.context === "booking");
  const pendingCheques = (b.cheques ?? []).filter((c) => ["received", "deposited", "bounced"].includes(c.status));
  const scheduleActions = useScheduleActions(b);

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>

      {created && (
        <div role="status" className="toast-in mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-bg px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="size-5 text-success" />
          <span className="flex-1">
            {t("created", { no: b.bookingNo })}
            {firstReceipt ? ` ${t("createdReceipt", { no: firstReceipt.receiptNo })}` : pendingCheques.length ? ` ${t("createdCheque")}` : ""}
          </span>
          <Button size="sm" variant="secondary" onClick={() => write({ created: null, tab: "documents" })}>
            {t("printDocs")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => write({ created: null })}>
            {t("dismiss")}
          </Button>
        </div>
      )}

      <header className="mt-4 mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">{localName(b.project, locale)}</span>
          <h2 className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-display text-4xl leading-tight">
            <span className="font-mono text-3xl tracking-tight">{b.bookingNo}</span>
            <span className="text-2xl text-ink-muted">{b.unitCode}</span>
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <Link href={`/dashboard/customers/${b.customerId}`} className="font-medium text-ink hover:underline">
              {localName(b.customer, locale) || b.customerName}
            </Link>
            <span aria-hidden>·</span>
            <span>{t("bookedOn", { date: day(b.bookingDate) })}</span>
            {b.soldBy?.name && (
              <>
                <span aria-hidden>·</span>
                <span>{t("soldBy", { name: b.soldBy.name })}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageTag stage={b.stage} status={b.status} />
          {active && can("receipts:create") && (
            <Button onClick={() => setPaying(true)} disabled={tot.outstanding <= 0}>
              <Wallet aria-hidden className="size-4" />
              {t("takePayment")}
            </Button>
          )}
          <BookingActionsMenu b={b} />
        </div>
      </header>

      <StageTimeline b={b} />
      <CancellationPanel b={b} />

      {/* Money position — a ledger strip, not a dashboard. A cancelled booking owes nothing; the
          cancellation panel above carries the settlement instead. */}
      {b.status !== "cancelled" && (
        <section aria-label={t("position")} className="mb-8 rounded-lg border border-line bg-surface">
          <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            {[
              ["contract", b.contractTotal],
              ["paid", tot.paid],
              ["outstanding", tot.outstanding],
              ["dueNow", tot.dueNow],
              ["overdue", tot.overdue, tot.overdue > 0 && "text-danger"],
            ].map(([k, v, cls]) => (
              <div key={k} className="px-5 py-4">
                <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t(`totals.${k}`)}</dt>
                <dd className={cn("mt-1 font-mono text-[15px] tabular-nums", cls)}>{money(v ?? 0)}</dd>
              </div>
            ))}
            <div className="px-5 py-4">
              <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("totals.nextDue")}</dt>
              <dd className="mt-1 text-sm">{tot.nextDue ? `${money(tot.nextDue.amount)} · ${day(tot.nextDue.dueDate)}` : "—"}</dd>
            </div>
          </dl>
          <div className="h-1 overflow-hidden rounded-b-lg bg-surface-2" aria-hidden>
            <div className="h-full bg-success/70" style={{ width: `${paidPct}%` }} />
          </div>
        </section>
      )}

      {b.bookingMoneyWaived && (
        <p className="mb-6 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
          {t("waived", {
            name: b.bookingMoneyWaived.by?.name ?? "—",
            reason: b.bookingMoneyWaived.reason,
          })}
        </p>
      )}
      {pendingCheques.length > 0 && (
        <p className="mb-6 rounded-md bg-info-bg px-4 py-3 text-sm text-info">
          {t("pendingCheques", {
            n: pendingCheques.length,
            amount: money(pendingCheques.reduce((s, c) => s + c.amount, 0)),
          })}
        </p>
      )}

      <nav aria-label={t("tabsLabel")} className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => write({ tab: k === "schedule" ? null : k })}
            aria-current={tab === k ? "page" : undefined}
            className={cn("-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap", tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {t(`tabs.${k}`)}
            {k === "receipts" && b.receipts?.length > 0 && <span className="ml-1.5 font-mono text-[11px] text-ink-subtle">{b.receipts.length}</span>}
          </button>
        ))}
      </nav>

      {tab === "schedule" && <ScheduleTable items={b.schedule} renderAction={scheduleActions.render} />}
      {tab === "receipts" && <ReceiptsTab b={b} />}
      {tab === "documents" && <DocumentsTab booking={b} />}
      {tab === "ledger" && <LedgerTab b={b} />}
      {tab === "details" && <DetailsTab b={b} onEdit={() => setEditing(true)} />}

      {scheduleActions.dialogs}
      <ReceiptDrawer open={paying} booking={b} onClose={() => setPaying(false)} />
      <EditDrawer open={editing} b={b} onClose={() => setEditing(false)} />
    </div>
  );
}

function ReceiptsTab({ b }) {
  const t = useTranslations("sales.receipts");
  const tp = useTranslations("sales.payment");
  const money = useMoney();
  const day = useDay();
  const { can } = useSession();
  const [reversing, setReversing] = useState(null);
  const rows = b.receipts ?? [];
  const docs = useDocuments(b.id);
  const docOf = new Map((docs.data ?? []).filter((d) => d.type === "receipt").map((d) => [d.refId, d]));

  return (
    <div className="space-y-8">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong/60 px-5 py-10 text-center text-sm text-ink-muted">{t("none")}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t("cols.receipt")}</TH>
              <TH>{t("cols.mode")}</TH>
              <TH align="right">{t("cols.amount")}</TH>
              <TH className="hidden md:table-cell">{t("cols.by")}</TH>
              <TH>{t("cols.status")}</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} className={r.status === "reversed" ? "text-ink-muted" : undefined}>
                <TD>
                  <span className={cn("font-mono text-[13px]", r.status === "reversed" && "line-through")}>{r.receiptNo}</span>
                  <span className="block text-[11px] text-ink-subtle">{day(r.date)}</span>
                </TD>
                <TD>
                  <span className="text-sm">{tp(`modes.${r.mode}`)}</span>
                  {(r.reference || r.instrumentNo) && <span className="block font-mono text-[11px] text-ink-subtle">{r.reference ?? r.instrumentNo}</span>}
                </TD>
                <TD numeric>{money(r.amount)}</TD>
                <TD className="hidden text-sm text-ink-muted md:table-cell">{r.receivedBy?.name ?? "—"}</TD>
                <TD>
                  <ReceiptStatusTag status={r.status} />
                  {r.reversal?.reason && (
                    <span className="mt-1 block max-w-48 truncate text-[11px] text-ink-subtle" title={r.reversal.reason}>
                      {r.reversal.reason}
                    </span>
                  )}
                </TD>
                <TD align="right" className="whitespace-nowrap">
                  {docOf.get(r.id) && (
                    <Button as={Link} href={`/dashboard/documents/${docOf.get(r.id).id}`} size="sm" variant="ghost">
                      <Printer aria-hidden className="size-3.5" />
                      <span className="sr-only sm:not-sr-only">{t("print")}</span>
                    </Button>
                  )}
                  {r.status === "valid" && can("receipts:reverse") && (
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setReversing(r)}>
                      {t("reverse")}
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {(b.cheques ?? []).length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">{t("chequesTitle")}</h3>
          <ChequesTable rows={b.cheques} showBooking={false} />
          <p className="mt-2 text-xs text-ink-muted">{t("chequesHint")}</p>
        </section>
      )}

      <ReverseDialog receipt={reversing} booking={b} onClose={() => setReversing(null)} />
    </div>
  );
}

function ReverseDialog({ receipt, booking, onClose }) {
  const t = useTranslations("sales.receipts");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (reason.trim().length < 3) return setError(tv("reason3"));
    setBusy(true);
    try {
      await api.post(`/receipts/${receipt.id}/reverse`, {
        reason: reason.trim(),
      });
      refresh({ bookingId: booking.id });
      toast.success(t("reversedOk", { no: receipt.receiptNo }));
      setReason("");
      onClose();
    } catch (err) {
      setError(salesError(err, locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(receipt)}
      onClose={onClose}
      title={t("reverseTitle", { no: receipt?.receiptNo ?? "" })}
      description={receipt ? t("reverseBody", { amount: money(receipt.amount) }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" loading={busy} onClick={run}>
            {t("reverseConfirm")}
          </Button>
        </>
      }
    >
      <Field label={t("reason")} error={error} required>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
    </Dialog>
  );
}

function LedgerTab({ b }) {
  const t = useTranslations("sales.ledger");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const salesError = useSalesError();
  const ledger = useLedger(b.id);
  if (ledger.isError) return <ErrorState title={t("loadFailed")} description={salesError(ledger.error, locale)} requestId={ledger.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (ledger.isPending) return <Skeleton className="h-64 w-full" />;
  const { entries, integrity } = ledger.data;
  return (
    <div className="space-y-4">
      <p className={cn("flex items-center gap-2 text-sm", integrity?.ok ? "text-success" : "text-danger")}>
        {integrity?.ok ? <ShieldCheck aria-hidden className="size-4" /> : <ShieldAlert aria-hidden className="size-4" />}
        {integrity?.ok ? t("ok") : t("mismatch", { n: integrity?.mismatchedItems?.length ?? 0 })}
      </p>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong/60 px-5 py-10 text-center text-sm text-ink-muted">{t("none")}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t("cols.date")}</TH>
              <TH>{t("cols.entry")}</TH>
              <TH align="right">{t("cols.amount")}</TH>
              <TH align="right" className="hidden sm:table-cell">
                {t("cols.balance")}
              </TH>
              <TH className="hidden md:table-cell">{t("cols.by")}</TH>
            </tr>
          </THead>
          <TBody>
            {entries.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap">{day(e.date)}</TD>
                <TD>
                  <span className="text-sm">{t(`types.${e.type}`)}</span>
                  <span className="block font-mono text-[11px] text-ink-subtle">{e.ref}</span>
                  {e.note && <span className="block max-w-64 truncate text-[11px] text-ink-subtle">{e.note}</span>}
                </TD>
                <TD numeric className={e.amount < 0 ? "text-danger" : undefined}>
                  {e.amount < 0 ? `− ${money(-e.amount)}` : money(e.amount)}
                </TD>
                <TD numeric className="hidden text-ink-muted sm:table-cell">
                  {money(e.paidToDate)}
                </TD>
                <TD className="hidden text-sm text-ink-muted md:table-cell">{e.by?.name ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function DetailsTab({ b, onEdit }) {
  const t = useTranslations("sales.booking");
  const tn = useTranslations("sales.nominees");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const date = useDate();
  const { can } = useSession();
  const parties = [b.customer, ...(b.coApplicants ?? [])].filter(Boolean);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <section>
          <h3 className="mb-3 text-sm font-semibold">{t("parties")}</h3>
          <ul className="space-y-2">
            {parties.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-wide text-ink-subtle uppercase">{i === 0 ? t("applicant") : t("coApplicant")}</p>
                  <Link href={`/dashboard/customers/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                    {localName(c, locale)}
                  </Link>
                  <p className="font-mono text-[11px] text-ink-muted">
                    {c.customerNo} · {formatPhone(c.phone, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("nomineesTitle")}</h3>
            {b.status === "active" && can("bookings:create") && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil aria-hidden className="size-3.5" />
                {t("edit")}
              </Button>
            )}
          </div>
          {b.nominees?.length ? (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {b.nominees.map((n, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    {n.name} <span className="text-ink-muted">· {n.relation}</span>
                  </span>
                  <span className="font-mono text-[13px]">{n.sharePct}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">{tn("none")}</p>
          )}
          {b.note && <p className="mt-4 rounded-md bg-surface-2 px-4 py-3 text-sm whitespace-pre-line text-ink-muted">{b.note}</p>}
        </section>
        {b.holders?.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold">{t("holdersTitle")}</h3>
            <ol className="divide-y divide-line rounded-md border border-line bg-surface">
              {b.holders.map((h) => (
                <li key={h.id} className="px-4 py-2.5 text-sm">
                  <Link href={`/dashboard/customers/${h.customerId}`} className="font-medium hover:underline">
                    {h.customerName}
                  </Link>
                  <span className="block text-[11px] text-ink-subtle">
                    {t("holderUntil", { date: day(h.until) })}
                    {h.fee ? ` · ${t("holderFee", { amount: money(h.fee) })}` : h.feeWaivedReason ? ` · ${t("holderFeeWaived", { reason: h.feeWaivedReason })}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <dl className="grid gap-5 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2">
          <Fact label={t("plan")}>{b.plan?.custom ? t("customPlan") : b.plan?.name}</Fact>
          <Fact label={t("bookingDate")}>{day(b.bookingDate)}</Fact>
          <Fact label={t("createdAt")}>{date(b.createdAt, "datetime")}</Fact>
          {b.leadId && (
            <Fact label={t("lead")}>
              <Link href={`/dashboard/leads?lead=${b.leadId}`} className="hover:underline">
                {t("openLead")}
              </Link>
            </Fact>
          )}
        </dl>
      </div>
      <section>
        <h3 className="mb-3 text-sm font-semibold">{t("priceTitle")}</h3>
        <PriceLines price={b.price} />
        <p className="mt-2 text-xs text-ink-muted">{t("priceFrozen")}</p>
      </section>
    </div>
  );
}

function EditDrawer({ open, b, onClose }) {
  const t = useTranslations("sales.booking");
  return (
    <Drawer open={open} onClose={onClose} title={t("editTitle")} description={b.bookingNo} width="lg">
      {open && <EditForm key={b.version} b={b} onClose={onClose} />}
    </Drawer>
  );
}

function EditForm({ b, onClose }) {
  const t = useTranslations("sales.booking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const [nominees, setNominees] = useState(() => nomineesToForm(b.nominees));
  const [note, setNote] = useState(b.note ?? "");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e = checkNominees(nominees);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const updated = await api.patch(`/bookings/${b.id}`, {
        version: b.version,
        nominees: nomineesBody(nominees),
        note: note.trim() || null,
      });
      qc.setQueryData(salesKeys.booking(b.id), updated);
      toast.success(t("saved"));
      onClose();
    } catch (err) {
      if (err?.code === "STALE_VERSION") qc.invalidateQueries({ queryKey: salesKeys.booking(b.id) });
      setErrors({ root: salesError(err, locale) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {errors.root && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
          {errors.root}
        </p>
      )}
      <NomineesEditor value={nominees} onChange={setNominees} errors={errors} />
      <Field label={t("note")}>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button loading={busy} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
