"use client";

import { useLocale, useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/auth/session";
import { useSalesError } from "@/lib/sales/errors";
import { addDays, todayDhaka } from "@/lib/sales/money";
import { useAccountSettings, usePlans } from "@/lib/sales/queries";
import { PriceLines, ScheduleTable } from "../BookingParts";
import { usePlanSummary } from "../PlansPanel";
import { MoneyInput, localName, useMoney } from "../parts";
import { ScheduleEditor, scheduleRowsFrom } from "./ScheduleEditor";

/** Booking date, payment plan (template or custom), discount — with the server's live preview. */
export function StepPrice({ draft, patch, preview, errors }) {
  const t = useTranslations("sales.wizard.price");
  const tv = useTranslations("sales.validation");
  const locale = useLocale();
  const money = useMoney();
  const summary = usePlanSummary();
  const salesError = useSalesError();
  const { can } = useSession();
  const settings = useAccountSettings();
  const plans = usePlans({ projectId: draft.projectId, active: "true" }, { enabled: Boolean(draft.projectId) });
  const today = todayDhaka();
  const minDate = addDays(today, -(settings.data?.receiptBackdateDays ?? 31));
  const canCustom = can("bookings:override");
  const p = preview.data;
  const plan = (plans.data ?? []).find((x) => x.id === draft.planId);
  const cap = p?.discountCap;

  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <Field label={t("bookingDate")} hint={t("bookingDateHint")} error={errors.bookingDate && tv(errors.bookingDate)} required>
          <Input type="date" value={draft.bookingDate} min={minDate} max={today} onChange={(e) => patch({ bookingDate: e.target.value })} />
        </Field>
        <div className="space-y-3">
          {canCustom && (
            <Segmented
              size="sm"
              value={draft.planMode}
              onChange={(planMode) => patch({ planMode })}
              options={[
                { value: "template", label: t("modeTemplate") },
                { value: "custom", label: t("modeCustom") },
              ]}
              aria-label={t("planMode")}
            />
          )}
          {(draft.planMode === "template" || plans.data?.length > 0) && (
            <Field
              label={draft.planMode === "template" ? t("plan") : t("planSeed")}
              hint={plan ? summary(plan.spec) : undefined}
              error={errors.planId && tv(errors.planId)}
              required={draft.planMode === "template"}
            >
              <Select value={draft.planId} onChange={(e) => patch({ planId: e.target.value })} placeholder={plans.data?.length === 0 ? t("noPlans") : t("choosePlan")}>
                {(plans.data ?? []).map((x) => (
                  <option key={x.id} value={x.id}>
                    {localName(x, locale)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("discount")}
          hint={cap ? (can("bookings:discount_unlimited") ? t("noCap") : t("cap", { amount: money(cap.maxAmount), pct: cap.bps / 100 })) : t("discountHint")}
          error={errors.discountAmount && tv(errors.discountAmount)}
        >
          <MoneyInput value={draft.discountAmount} onChange={(discountAmount) => patch({ discountAmount })} />
        </Field>
        <Field label={t("discountReason")} error={errors.discountReason && tv(errors.discountReason)} required={Boolean(draft.discountAmount && draft.discountAmount !== "0")}>
          <Input value={draft.discountReason} onChange={(e) => patch({ discountReason: e.target.value })} maxLength={300} />
        </Field>
      </div>

      {draft.planMode === "custom" && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("customTitle")}</h3>
          <ScheduleEditor
            rows={draft.schedule}
            onChange={(schedule) => patch({ schedule })}
            contract={p?.price?.contractTotal ?? null}
            bookingDate={draft.bookingDate}
            canSeed={Boolean(p?.schedule?.length)}
            onSeed={() => patch({ schedule: scheduleRowsFrom(p.schedule) })}
          />
        </section>
      )}

      <section aria-live="polite" className="space-y-5">
        <h3 className="text-sm font-semibold">{t("previewTitle")}</h3>
        {preview.isError && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
            {salesError(preview.error, locale)}
          </p>
        )}
        {!p && preview.isFetching && <Skeleton className="h-64 w-full" />}
        {!p && !preview.isFetching && !preview.isError && <p className="text-sm text-ink-muted">{t("previewWaiting")}</p>}
        {p && (
          <div className={preview.isFetching ? "opacity-60 transition-opacity" : undefined}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <PriceLines price={p.price} />
              {p.schedule?.length > 0 && <ScheduleTable items={p.schedule} showPaid={false} />}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
