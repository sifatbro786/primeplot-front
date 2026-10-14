"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { todayDhaka } from "@/lib/sales/money";
import { useBankAccounts } from "@/lib/sales/queries";
import { MoneyInput, useMoney } from "../parts";
import { ErrorBox, useRun } from "./useRun";

const post = (path, body) => apiRequest(path, { method: "POST", body });

/** Cancel: server preview (paid, policy deduction, refundable, open cheques) → confirm. */
export function CancelDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions.cancel");
  const ta = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const salesError = useSalesError();
  const { can } = useSession();
  const { busy, error, setError, run } = useRun(booking);
  const [override, setOverride] = useState(false);
  const [deduction, setDeduction] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayDhaka());
  const deductionAmount = override ? takaToPoisha(deduction) : undefined;
  const preview = useQuery({
    queryKey: ["bookings", "cancel-preview", booking.id, deductionAmount ?? null],
    queryFn: () => post(`/bookings/${booking.id}/cancel/preview`, deductionAmount != null ? { deductionAmount } : {}).then((r) => r.data),
    retry: false,
  });
  const p = preview.data;
  const blocked = p?.blockers?.length > 0;

  const submit = async () => {
    if (reason.trim().length < 3) return setError(tv("reason3"));
    if (override && (deductionAmount == null || deductionAmount < 0)) return setError(tv("amount"));
    if (override && overrideReason.trim().length < 3) return setError(`${t("overrideReason")}: ${tv("reason3")}`);
    const body = { reason: reason.trim(), date, ...(override && { deductionAmount, overrideReason: overrideReason.trim() }) };
    if (await run(() => post(`/bookings/${booking.id}/cancel`, body), t("done", { no: booking.bookingNo }))) onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title", { no: booking.bookingNo })}
      description={t("body")}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" loading={busy} disabled={!p || blocked} onClick={submit}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <ErrorBox>{error}</ErrorBox>
        {preview.isError && <ErrorBox>{salesError(preview.error, locale)}</ErrorBox>}
        {!p && preview.isFetching && <Skeleton className="h-32 w-full" />}
        {p && (
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            <Row label={t("paid")} value={money(p.paid)} />
            <Row label={p.deductionBps != null ? t("deductionPolicy", { pct: p.deductionBps / 100 }) : t("deductionCustom")} value={`− ${money(p.deduction)}`} tone="danger" />
            <Row label={t("refundable")} value={money(p.refundable)} strong />
          </dl>
        )}
        {blocked && <ErrorBox>{t("openCheques", { n: p.openCheques })}</ErrorBox>}

        {can("bookings:override") && (
          <div className="space-y-4 rounded-lg border border-line p-4">
            <Checkbox label={t("override")} description={t("overrideHint")} checked={override} onChange={(e) => {
                setOverride(e.target.checked);
                setDeduction(p ? poishaToTaka(p.policyDeduction) : "");
              }} />
            {override && (
              <>
                <Field label={t("deductionAmount")}>
                  <MoneyInput value={deduction} onChange={setDeduction} />
                </Field>
                <Field label={t("overrideReason")} required>
                  <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} maxLength={300} />
                </Field>
              </>
            )}
          </div>
        )}

        <Field label={t("reason")} required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        <Field label={ta("date")} hint={ta("dateHint")}>
          <Input type="date" value={date} min={booking.bookingDate} max={todayDhaka()} onChange={(e) => setDate(e.target.value)} className="sm:max-w-56" />
        </Field>
        <p className="rounded-md bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">{t("effects")}</p>
      </div>
    </Drawer>
  );
}

function Row({ label, value, tone, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`font-mono tabular-nums ${tone === "danger" ? "text-danger" : ""} ${strong ? "text-base font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

const REFUND_MODES = ["cash", "bank_transfer", "pay_order", "cheque"];

/** Pay back (part of) the refundable amount of a cancelled booking. Gapless LVR-RF- refs. */
export function RefundDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions.refund");
  const ta = useTranslations("sales.actions");
  const tp = useTranslations("sales.payment");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const money = useMoney();
  const due = booking.cancellation?.refundDue ?? 0;
  const { busy, error, setError, run } = useRun(booking);
  const banks = useBankAccounts({ active: "true" });
  const [f, setF] = useState({ amount: poishaToTaka(due), mode: "bank_transfer", bankAccountId: "", reference: "", instrumentNo: "", date: todayDhaka(), note: "" });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));

  const submit = async () => {
    const amount = takaToPoisha(f.amount);
    if (!amount || amount <= 0) return setError(tv("amount"));
    if (amount > due) return setError(t("tooMuch", { amount: money(due) }));
    if (f.mode === "bank_transfer" && (!f.bankAccountId || !f.reference.trim())) return setError(t("needTransfer"));
    if (["cheque", "pay_order"].includes(f.mode) && !f.instrumentNo.trim()) return setError(t("needInstrument"));
    const body = {
      amount,
      mode: f.mode,
      date: f.date,
      ...(f.bankAccountId && { bankAccountId: f.bankAccountId }),
      ...(f.reference.trim() && { reference: f.reference.trim() }),
      ...(f.instrumentNo.trim() && { instrumentNo: f.instrumentNo.trim() }),
      ...(f.note.trim() && { note: f.note.trim() }),
    };
    const r = await run(() => post(`/bookings/${booking.id}/refunds`, body));
    if (r) {
      toast.success(t("done", { ref: r.data.refund.ref }));
      onClose();
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title")}
      description={t("body", { amount: money(due) })}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button loading={busy} onClick={submit}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorBox>{error}</ErrorBox>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("amount")} required>
            <MoneyInput value={f.amount} onChange={set("amount")} />
          </Field>
          <Field label={t("mode")} required>
            <Select value={f.mode} onChange={set("mode")}>
              {REFUND_MODES.map((m) => (
                <option key={m} value={m}>
                  {tp(`modes.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {f.mode !== "cash" && (
          <Field label={t("fromAccount")} required={f.mode === "bank_transfer"}>
            <Select value={f.bankAccountId} onChange={set("bankAccountId")} placeholder={tp("chooseAccount")}>
              {(banks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.accountNo}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {f.mode === "bank_transfer" && (
          <Field label={tp("reference")} required>
            <Input className="font-mono text-[13px]" value={f.reference} onChange={set("reference")} maxLength={80} />
          </Field>
        )}
        {["cheque", "pay_order"].includes(f.mode) && (
          <Field label={t("instrumentNo")} required>
            <Input className="font-mono text-[13px]" value={f.instrumentNo} onChange={set("instrumentNo")} maxLength={40} />
          </Field>
        )}
        <Field label={ta("date")}>
          <Input type="date" value={f.date} max={todayDhaka()} onChange={set("date")} className="sm:max-w-56" />
        </Field>
        <Field label={ta("note")}>
          <Input value={f.note} onChange={set("note")} maxLength={500} />
        </Field>
      </div>
    </Drawer>
  );
}
