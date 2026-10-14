"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { useSession } from "@/lib/auth/session";
import { PaymentFields, STAFF_MODES } from "../PaymentFields";
import { useDay, useMoney } from "../parts";

/** Booking money taken now (cash / transfer / pay order / cheque), waived (override), or later (if allowed). */
export function StepPayment({ draft, patch, preview, errors }) {
  const t = useTranslations("sales.wizard.payment");
  const tv = useTranslations("sales.validation");
  const money = useMoney();
  const day = useDay();
  const { can } = useSession();
  const p = preview.data;
  const required = p?.bookingMoneyRequired ?? true;
  const options = [{ value: "pay", label: t("pay") }];
  if (can("bookings:override")) options.push({ value: "waive", label: t("waive") });
  if (!required) options.push({ value: "later", label: t("later") });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-line bg-surface-2/60 px-4 py-3">
        <p className="text-sm">{t("due", { amount: money(p?.bookingMoney ?? 0) })}</p>
        <p className="text-xs text-ink-muted">{t("dated", { date: day(draft.bookingDate) })}</p>
      </div>

      {options.length > 1 && <Segmented value={draft.payMode} onChange={(payMode) => patch({ payMode })} options={options} aria-label={t("how")} />}

      {draft.payMode === "pay" && (
        <PaymentFields
          value={draft.payment}
          onChange={(v) => patch({ payment: { ...draft.payment, ...v } })}
          errors={errors.payment ?? {}}
          modes={[...STAFF_MODES, "cheque"]}
          amountHint={t("amountHint", { amount: money(p?.bookingMoney ?? 0) })}
          chequeHint={t("chequeHint")}
        />
      )}
      {draft.payMode === "pay" && draft.payment.mode === "cheque" && <p className="rounded-md bg-info-bg px-4 py-3 text-sm text-info">{t("chequeNote")}</p>}

      {draft.payMode === "waive" && (
        <Field label={t("waiveReason")} hint={t("waiveHint")} error={errors.waiveReason && tv(errors.waiveReason)} required>
          <Textarea rows={3} value={draft.waiveReason} onChange={(e) => patch({ waiveReason: e.target.value })} maxLength={300} />
        </Field>
      )}
      {draft.payMode === "later" && <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-muted">{t("laterNote")}</p>}
    </div>
  );
}
