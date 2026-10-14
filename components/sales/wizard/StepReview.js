"use client";

import { useLocale, useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { formatPhone, takaToPoisha } from "@/lib/format";
import { PriceLines, ScheduleTable } from "../BookingParts";
import { Fact, localName, useDay, useMoney } from "../parts";
import { unitFacts } from "./StepUnit";

/** Everything at a glance before the one-transaction save. */
export function StepReview({ draft, patch, preview, unit, project }) {
  const t = useTranslations("sales.wizard.review");
  const tp = useTranslations("sales.payment");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const p = preview.data;
  const amount = takaToPoisha(draft.payment.amount);

  return (
    <div className="space-y-8">
      <dl className="grid gap-5 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label={t("unit")}>
          <span className="font-mono">{unit?.code}</span>
          <span className="block text-xs text-ink-muted">{localName(project, locale)}</span>
          <span className="block text-xs text-ink-muted">{unitFacts(unit, locale)}</span>
        </Fact>
        <Fact label={t("applicant")}>
          {localName(draft.customer, locale)}
          <span className="block font-mono text-xs text-ink-muted">
            {draft.customer?.customerNo} · {formatPhone(draft.customer?.phone, locale)}
          </span>
          {draft.coApplicants.length > 0 && <span className="block text-xs text-ink-muted">+ {draft.coApplicants.map((c) => localName(c, locale)).join(", ")}</span>}
        </Fact>
        <Fact label={t("bookingDate")}>{day(draft.bookingDate)}</Fact>
        <Fact label={t("bookingMoney")}>
          {draft.payMode === "pay" ? (
            <>
              <span className="font-mono">{money(amount)}</span>
              <span className="block text-xs text-ink-muted">
                {tp(`modes.${draft.payment.mode}`)}
                {draft.payment.mode === "cheque" && ` · ${draft.payment.chequeNo}`}
              </span>
            </>
          ) : draft.payMode === "waive" ? (
            <span className="text-warning">{t("waived")}</span>
          ) : (
            <span className="text-ink-muted">{t("later")}</span>
          )}
        </Fact>
      </dl>

      {draft.nominees.length > 0 && (
        <p className="text-sm text-ink-muted">
          {t("nominees")}: {draft.nominees.map((n) => `${n.name} (${n.relation}, ${n.sharePct}%)`).join(" · ")}
        </p>
      )}

      {p && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <PriceLines price={p.price} compact />
          <ScheduleTable items={p.schedule} showPaid={false} />
        </div>
      )}

      <Field label={t("note")} hint={t("noteHint")}>
        <Textarea rows={2} value={draft.note} onChange={(e) => patch({ note: e.target.value })} maxLength={1000} />
      </Field>
    </div>
  );
}
