"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/sales/parts";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatBDT, poishaToTaka, takaToPoisha } from "@/lib/format";
import { newIdempotencyKey } from "@/lib/sales/money";
import { usePortalError } from "./parts";

/**
 * Pay Now (SSLCommerz). The client picks what to pay; the server re-checks the limits
 * (min = the online minimum or the whole balance if less; max = outstanding − pending slips)
 * and returns the gateway URL. One Idempotency-Key per open drawer: a double tap or a retry
 * after a network blip reuses the same attempt instead of opening a second one.
 */
export function PayDrawer({ b, features, onClose }) {
  const t = useTranslations("portal.pay");
  const locale = useLocale();
  const portalError = usePortalError();
  const [key] = useState(newIdempotencyKey);
  const tot = b.totals ?? {};
  const pendingSlips = b.slips.filter((s) => s.status === "pending").reduce((s, x) => s + x.amount, 0);
  const payable = Math.max(0, (tot.outstanding ?? 0) - pendingSlips);
  const min = Math.min(features?.onlineMinAmount ?? 100_000, payable);

  const options = [];
  const add = (k, amount) => amount > 0 && amount <= payable && !options.some((o) => o.amount === amount) && options.push({ k, amount });
  add("overdue", tot.overdue);
  add("dueNow", tot.dueNow);
  add("next", tot.nextDue?.amount);
  add("all", payable);

  const [choice, setChoice] = useState(options[0]?.k ?? "other");
  const [other, setOther] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const amount = choice === "other" ? takaToPoisha(other) : options.find((o) => o.k === choice)?.amount;
  const money = (v) => formatBDT(v, locale);

  const check = () => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return t("enterAmount");
    if (amount < min) return t("belowMin", { min: money(min) });
    if (amount > payable) return t("aboveMax", { max: money(payable) });
    return null;
  };

  const go = async () => {
    const problem = check();
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const { data } = await apiRequest(`/portal/bookings/${b.id}/pay`, { method: "POST", body: { amount }, headers: { "Idempotency-Key": key } });
      // Only ever leave for an https gateway page (never a script: or relative URL from a bad response).
      const url = new URL(data.redirectUrl);
      if (url.protocol !== "https:") throw new Error("bad redirect");
      window.location.assign(url.href);
    } catch (err) {
      setBusy(false);
      setError(err?.code ? portalError(err) : t("gatewayDown"));
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? undefined : onClose}
      title={t("title")}
      description={t("subtitle", { unit: b.unitCode })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={go} loading={busy} disabled={!payable}>
            <Lock aria-hidden className="size-3.5" />
            {amount > 0 ? t("payAmount", { amount: money(amount) }) : t("pay")}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-3 text-xs font-medium">{t("what")}</legend>
        {options.map((o) => (
          <label
            key={o.k}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 transition-colors",
              choice === o.k ? "border-primary bg-accent-soft" : "border-line-strong/60 hover:border-ink-muted",
            )}
          >
            <span className="flex items-center gap-3">
              <input type="radio" name="pay-choice" value={o.k} checked={choice === o.k} onChange={() => setChoice(o.k)} className="size-4 accent-primary" />
              <span className="text-sm">{t(`options.${o.k}`)}</span>
            </span>
            <span className="font-mono text-sm tabular-nums">{money(o.amount)}</span>
          </label>
        ))}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors",
            choice === "other" ? "border-primary bg-accent-soft" : "border-line-strong/60 hover:border-ink-muted",
          )}
        >
          <input type="radio" name="pay-choice" value="other" checked={choice === "other"} onChange={() => setChoice("other")} className="size-4 accent-primary" />
          <span className="text-sm">{t("options.other")}</span>
        </label>
      </fieldset>

      {choice === "other" && (
        <Field label={t("amount")} hint={t("limits", { min: money(min), max: money(payable) })} className="mt-4">
          <MoneyInput value={other} onChange={setOther} autoFocus placeholder={poishaToTaka(min)} />
        </Field>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/25 bg-danger-bg px-3.5 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {pendingSlips > 0 && <p className="mt-4 text-xs text-ink-muted">{t("pendingSlips", { amount: money(pendingSlips) })}</p>}

      <div className="mt-6 rounded-md bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">
        <p className="font-medium text-ink">{t("howTitle")}</p>
        <p className="mt-1">{t("howBody")}</p>
      </div>
    </Drawer>
  );
}
