"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { takaToPoisha } from "@/lib/format";
import { useBankAccounts } from "@/lib/sales/queries";
import { MoneyInput } from "./parts";

/** Modes staff can record (API.md › B4.1 Payment); cheque only where the caller allows it. */
export const STAFF_MODES = ["cash", "bank_transfer", "pay_order"];

export const emptyPayment = (amount = "") => ({
  mode: "cash",
  amount,
  bankAccountId: "",
  reference: "",
  instrumentNo: "",
  instrumentBank: "",
  instrumentDate: "",
  chequeNo: "",
  bank: "",
  branch: "",
  chequeDate: "",
  note: "",
});

const s = (v) => (v ?? "").trim();
const opt = (v) => s(v) || undefined;

/**
 * Client checks (same rules as zPayment / zChequePayment) → { field: messageKey }.
 * `min`/`max` in poisha are optional bounds (booking money, outstanding).
 */
export function checkPayment(p, { min, max } = {}) {
  const e = {};
  const amount = takaToPoisha(p.amount);
  if (amount == null || amount <= 0) e.amount = "amount";
  else if (min != null && amount < min) e.amount = "belowMin";
  else if (max != null && amount > max) e.amount = "aboveMax";
  if (p.mode === "bank_transfer") {
    if (!p.bankAccountId) e.bankAccountId = "required";
    if (!s(p.reference)) e.reference = "required";
  }
  if (p.mode === "pay_order") {
    if (!s(p.instrumentNo)) e.instrumentNo = "required";
    if (!s(p.instrumentBank)) e.instrumentBank = "required";
  }
  if (p.mode === "cheque") {
    if (!/^[0-9A-Za-z-]{4,20}$/.test(s(p.chequeNo))) e.chequeNo = "chequeNo";
    if (s(p.bank).length < 2) e.bank = "required";
    if (!p.chequeDate) e.chequeDate = "required";
  }
  return e;
}

/** Form state → API body (Payment or cheque payment). `date` is added by the caller. */
export function paymentBody(p) {
  const amount = takaToPoisha(p.amount);
  if (p.mode === "cheque") {
    return { mode: "cheque", amount, chequeNo: s(p.chequeNo), bank: s(p.bank), branch: opt(p.branch), chequeDate: p.chequeDate, note: opt(p.note) };
  }
  return {
    amount,
    mode: p.mode,
    ...(p.mode === "bank_transfer" && { bankAccountId: p.bankAccountId, reference: s(p.reference) }),
    ...(p.mode === "pay_order" && { instrumentNo: s(p.instrumentNo), instrumentBank: s(p.instrumentBank), instrumentDate: p.instrumentDate || undefined }),
    note: opt(p.note),
  };
}

/** Amount + mode + the fields that mode needs. Controlled: value / onChange(patch). */
export function PaymentFields({ value, onChange, errors = {}, modes = STAFF_MODES, amountLabel, amountHint, chequeHint }) {
  const t = useTranslations("sales.payment");
  const tv = useTranslations("sales.validation");
  const banks = useBankAccounts({ active: "true" }, { enabled: value.mode === "bank_transfer" });
  const set = (k) => (e) => onChange({ [k]: e?.target ? e.target.value : e });
  const err = (k) => (errors[k] ? (tv.has(errors[k]) ? tv(errors[k]) : errors[k]) : undefined);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={amountLabel ?? t("amount")} hint={amountHint} error={err("amount")} required>
          <MoneyInput value={value.amount} onChange={set("amount")} />
        </Field>
        <Field label={t("mode")} required>
          <Select value={value.mode} onChange={set("mode")}>
            {modes.map((m) => (
              <option key={m} value={m}>
                {t(`modes.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {value.mode === "bank_transfer" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("bankAccount")} error={err("bankAccountId")} required hint={banks.data?.length === 0 ? t("noBankAccounts") : undefined}>
            <Select value={value.bankAccountId} onChange={set("bankAccountId")} placeholder={t("chooseAccount")}>
              {(banks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.bankName} · {b.accountNo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("reference")} error={err("reference")} required>
            <Input className="font-mono text-[13px]" value={value.reference} onChange={set("reference")} maxLength={80} />
          </Field>
        </div>
      )}

      {value.mode === "pay_order" && (
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={t("instrumentNo")} error={err("instrumentNo")} required>
            <Input className="font-mono text-[13px]" value={value.instrumentNo} onChange={set("instrumentNo")} maxLength={40} />
          </Field>
          <Field label={t("instrumentBank")} error={err("instrumentBank")} required>
            <Input value={value.instrumentBank} onChange={set("instrumentBank")} maxLength={120} />
          </Field>
          <Field label={t("instrumentDate")}>
            <Input type="date" value={value.instrumentDate} onChange={set("instrumentDate")} />
          </Field>
        </div>
      )}

      {value.mode === "cheque" && (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t("chequeNo")} error={err("chequeNo")} required>
              <Input className="font-mono text-[13px]" value={value.chequeNo} onChange={set("chequeNo")} maxLength={20} />
            </Field>
            <Field label={t("bank")} error={err("bank")} required>
              <Input value={value.bank} onChange={set("bank")} maxLength={120} />
            </Field>
            <Field label={t("branch")}>
              <Input value={value.branch} onChange={set("branch")} maxLength={120} />
            </Field>
          </div>
          <Field label={t("chequeDate")} error={err("chequeDate")} hint={chequeHint ?? t("chequeDateHint")} required>
            <Input type="date" value={value.chequeDate} onChange={set("chequeDate")} className="sm:max-w-56" />
          </Field>
        </>
      )}

      <Field label={t("note")}>
        <Input value={value.note} onChange={set("note")} maxLength={500} />
      </Field>
    </div>
  );
}
