"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { bpsToPct, pctToBps } from "@/lib/sales/money";
import { salesKeys, useAccountSettings } from "@/lib/sales/queries";
import { MoneyInput, Section } from "./parts";

const toForm = (s) => ({
  exec: bpsToPct(s.discountLimitBps?.sales_executive ?? 100),
  manager: bpsToPct(s.discountLimitBps?.sales_manager ?? 300),
  bookingMoneyRequired: s.bookingMoneyRequired ?? true,
  backdate: String(s.receiptBackdateDays ?? 31),
  bounceFee: poishaToTaka(s.chequeBounceFee ?? 0),
  receiptEmail: s.notify?.receiptEmail ?? true,
  receiptSms: s.notify?.receiptSms ?? false,
});

/** Accounts settings (API.md › B4.1 Accounts settings): discount caps, booking money, back-dating, notices. */
export function AccountSettingsPanel() {
  const t = useTranslations("sales.accounts.settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const q = useAccountSettings();
  if (q.isError) return <ErrorState title={t("loadFailed")} description={salesError(q.error, locale)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  return <SettingsForm key={q.data.version} settings={q.data} />;
}

function SettingsForm({ settings }) {
  const t = useTranslations("sales.accounts.settings");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const { can } = useSession();
  const editable = can("accounts:settings");
  const initial = toForm(settings);
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async (e) => {
    e.preventDefault();
    const err = {};
    const exec = pctToBps(f.exec);
    const manager = pctToBps(f.manager);
    const backdate = /^\d{1,3}$/.test(f.backdate.trim()) ? Number(f.backdate) : null;
    const fee = f.bounceFee.trim() === "" ? 0 : takaToPoisha(f.bounceFee);
    if (exec == null || exec > 10_000) err.exec = tv("percent");
    if (manager == null || manager > 10_000) err.manager = tv("percent");
    if (backdate == null || backdate > 366) err.backdate = tv("days366");
    if (fee == null || fee < 0 || fee > 10_000_000) err.bounceFee = tv("bounceFee");
    setErrors(err);
    if (Object.keys(err).length) return;
    const patch = { version: settings.version };
    if (exec !== settings.discountLimitBps?.sales_executive || manager !== settings.discountLimitBps?.sales_manager) {
      patch.discountLimitBps = { sales_executive: exec, sales_manager: manager };
    }
    if (f.bookingMoneyRequired !== initial.bookingMoneyRequired) patch.bookingMoneyRequired = f.bookingMoneyRequired;
    if (backdate !== settings.receiptBackdateDays) patch.receiptBackdateDays = backdate;
    if (fee !== (settings.chequeBounceFee ?? 0)) patch.chequeBounceFee = fee;
    if (f.receiptEmail !== initial.receiptEmail || f.receiptSms !== initial.receiptSms) patch.notify = { receiptEmail: f.receiptEmail, receiptSms: f.receiptSms };
    if (Object.keys(patch).length === 1) return;
    setBusy(true);
    try {
      const saved = await api.patch("/accounts/settings", patch);
      qc.setQueryData(salesKeys.settings, saved);
      toast.success(t("saved"));
    } catch (e2) {
      if (e2?.code === "STALE_VERSION") qc.invalidateQueries({ queryKey: salesKeys.settings });
      setErrors({ root: salesError(e2, locale) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <FormAlert>{errors.root}</FormAlert>
      {!editable && <p className="mb-6 rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-muted">{t("readOnly")}</p>}
      <fieldset disabled={!editable || busy}>
        <Section title={t("discount.title")} description={t("discount.body")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("discount.executive")} error={errors.exec} hint={t("discount.hint")}>
              <Input inputMode="decimal" className="font-mono text-[13px]" value={f.exec} onChange={set("exec")} trailing={<span className="pr-1 text-sm text-ink-muted">%</span>} />
            </Field>
            <Field label={t("discount.manager")} error={errors.manager} hint={t("discount.hint")}>
              <Input inputMode="decimal" className="font-mono text-[13px]" value={f.manager} onChange={set("manager")} trailing={<span className="pr-1 text-sm text-ink-muted">%</span>} />
            </Field>
          </div>
          <p className="text-xs text-ink-muted">{t("discount.admin")}</p>
        </Section>

        <Section title={t("booking.title")} description={t("booking.body")}>
          <Checkbox label={t("booking.required")} description={t("booking.requiredHint")} checked={f.bookingMoneyRequired} onChange={set("bookingMoneyRequired")} />
          <Field label={t("booking.backdate")} hint={t("booking.backdateHint")} error={errors.backdate}>
            <Input inputMode="numeric" className="font-mono text-[13px] sm:max-w-40" value={f.backdate} onChange={set("backdate")} />
          </Field>
        </Section>

        <Section title={t("cheque.title")} description={t("cheque.body")}>
          <Field label={t("cheque.bounceFee")} hint={t("cheque.bounceFeeHint")} error={errors.bounceFee}>
            <div className="sm:max-w-64">
              <MoneyInput value={f.bounceFee} onChange={set("bounceFee")} />
            </div>
          </Field>
        </Section>

        <Section title={t("notify.title")} description={t("notify.body")}>
          <Checkbox label={t("notify.email")} description={t("notify.emailHint")} checked={f.receiptEmail} onChange={set("receiptEmail")} />
          <Checkbox label={t("notify.sms")} description={t("notify.smsHint")} checked={f.receiptSms} onChange={set("receiptSms")} />
        </Section>
      </fieldset>

      {editable && dirty && (
        <div className="toast-in sticky bottom-4 z-20 mx-auto mt-4 flex max-w-xl items-center justify-between gap-3 rounded-lg border border-primary bg-primary px-4 py-3 text-primary-ink">
          <span className="text-sm">{t("unsaved")}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-primary-ink hover:bg-white/10" onClick={() => (setF(initial), setErrors({}))}>
              {t("discard")}
            </Button>
            <Button size="sm" variant="accent" type="submit" loading={busy}>
              {tc("save")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
