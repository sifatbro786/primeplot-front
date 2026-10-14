"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api/client";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { addDays, newIdempotencyKey, outstandingOf, previewAllocation, todayDhaka } from "@/lib/sales/money";
import { useAccountSettings, useSalesRefresh } from "@/lib/sales/queries";
import { PaymentFields, checkPayment, emptyPayment, paymentBody } from "./PaymentFields";
import { itemLabel, useDay, useMoney } from "./parts";

/** Take a payment on a booking (receipts:create). Shows where the money will go before saving. */
export function ReceiptDrawer({ open, booking, onClose }) {
  const t = useTranslations("sales.receiptForm");
  return (
    <Drawer open={open} onClose={onClose} title={t("title")} description={`${booking.bookingNo} · ${booking.unitCode} · ${booking.customerName}`} width="md">
      {open && <ReceiptForm booking={booking} onClose={onClose} />}
    </Drawer>
  );
}

function defaultAmount(b) {
  const tot = b.totals ?? {};
  return tot.dueNow > 0 ? tot.dueNow : tot.nextDue?.amount ?? tot.outstanding ?? 0;
}

function ReceiptForm({ booking, onClose }) {
  const t = useTranslations("sales.receiptForm");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const settings = useAccountSettings();
  const [key, setKey] = useState(newIdempotencyKey); // one per receipt being entered
  const [pay, setPay] = useState(() => emptyPayment(poishaToTaka(defaultAmount(booking))));
  const today = todayDhaka();
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const outstanding = outstandingOf(booking.schedule);
  const amount = takaToPoisha(pay.amount);
  const alloc = amount && amount <= outstanding ? previewAllocation(booking.schedule, amount) : [];
  const backMin = addDays(today, -(settings.data?.receiptBackdateDays ?? 31));
  const minDate = backMin > booking.bookingDate ? backMin : booking.bookingDate;

  const submit = async (e) => {
    e.preventDefault();
    const pe = checkPayment(pay, { max: outstanding });
    if (!date || date > today) pe.date = "dateFuture";
    else if (date < minDate) pe.date = date < booking.bookingDate ? "beforeBooking" : "dateTooOld";
    setErrors(pe);
    if (Object.keys(pe).length) return;
    setBusy(true);
    try {
      const { data: receipt } = await apiRequest(`/bookings/${booking.id}/receipts`, {
        method: "POST",
        body: { ...paymentBody(pay), date },
        headers: { "Idempotency-Key": key },
      });
      refresh({ bookingId: booking.id, customerId: booking.customerId });
      toast.success(t("saved", { no: receipt.receiptNo }));
      onClose();
    } catch (err) {
      if (err?.code === "IDEMPOTENCY_KEY_REUSED") setKey(newIdempotencyKey());
      if (err?.code === "OVERPAYMENT") refresh({ bookingId: booking.id });
      setErrors({ root: salesError(err, locale) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {errors.root && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
          {errors.root}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-3 rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm">
        <div>
          <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("dueNow")}</dt>
          <dd className="mt-0.5 font-mono tabular-nums">{money(booking.totals?.dueNow ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("overdue")}</dt>
          <dd className={`mt-0.5 font-mono tabular-nums ${booking.totals?.overdue > 0 ? "text-danger" : ""}`}>{money(booking.totals?.overdue ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("outstanding")}</dt>
          <dd className="mt-0.5 font-mono tabular-nums">{money(outstanding)}</dd>
        </div>
      </dl>

      <PaymentFields value={pay} onChange={(v) => setPay((o) => ({ ...o, ...v }))} errors={errors} />

      <Field label={t("date")} hint={t("dateHint", { days: settings.data?.receiptBackdateDays ?? 31 })} error={errors.date && tv(errors.date)} required>
        <Input type="date" value={date} min={minDate} max={today} onChange={(e) => setDate(e.target.value)} className="sm:max-w-56" />
      </Field>

      <section aria-live="polite">
        <h3 className="text-sm font-semibold">{t("allocation")}</h3>
        <p className="mt-1 text-xs text-ink-muted">{t("allocationHint")}</p>
        {alloc.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{amount > outstanding ? tv("aboveMax") : "—"}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-md border border-line">
            {alloc.map((a) => (
              <li key={a.item.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{itemLabel(a.item, locale)}</span>
                  <span className="text-[11px] text-ink-subtle">
                    {a.item.dueDate ? day(a.item.dueDate) : t("notCalled")} · {a.settles ? t("settles") : t("partly")}
                  </span>
                </span>
                <span className="font-mono text-[13px] tabular-nums">{money(a.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
