"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatBDT } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";

/** Error text for review screens: portal/payment codes first, then the sales catalogue. */
export function useReviewError() {
  const t = useTranslations("review.errors");
  const salesError = useSalesError();
  const locale = useLocale();
  return useCallback(
    (err) => {
      if (err?.code && t.has(err.code)) {
        const d = err.details && !Array.isArray(err.details) ? err.details : {};
        return t(err.code, { outstanding: d.outstanding != null ? formatBDT(d.outstanding, locale) : "—" });
      }
      return salesError(err, locale);
    },
    [t, salesError, locale],
  );
}

/** Horizontal view chips (same look as the cheque register). */
export function ViewChips({ views, value, onChange, label, labelOf }) {
  return (
    <nav aria-label={label} className="mb-5 flex gap-2 scroll-x pb-1">
      {views.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "h-8 shrink-0 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors",
            value === v ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface text-ink-muted hover:text-ink",
          )}
        >
          {labelOf(v)}
        </button>
      ))}
    </nav>
  );
}

/** "Why?" dialog for rejections — the reason goes to the client by SMS / e-mail. */
export function ReasonDialog({ open, title, description, confirm, onClose, onConfirm }) {
  const t = useTranslations("review");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (reason.trim().length < 3) return setError(t("reasonShort"));
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            {confirm}
          </Button>
        </>
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} error={error}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
      </Field>
    </Dialog>
  );
}
