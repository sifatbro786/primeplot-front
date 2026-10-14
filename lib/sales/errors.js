"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/auth/session";
import { formatBDT } from "@/lib/format";

/**
 * ApiError → message for sales & accounts screens. Codes with amounts in `details`
 * (OVERPAYMENT, BOOKING_MONEY_SHORT, DISCOUNT_LIMIT…) get them formatted in.
 */
export function useSalesError() {
  const t = useTranslations("sales.errors");
  const te = useTranslations("errors");
  return useCallback(
    (err, locale = "bn") => {
      const code = err?.code;
      if (!code || !t.has(code)) return errorMessage(te, err);
      const d = err.details ?? {};
      const money = (v) => (v == null ? "—" : formatBDT(v, locale));
      return t(code, {
        outstanding: money(d.outstanding),
        required: money(d.required),
        maxAmount: money(d.maxAmount),
        difference: money(d.difference),
        listTotal: money(d.listTotal),
        overdue: money(d.overdue),
        refundDue: money(d.refundDue),
        stage: d.stage ?? "",
        cap: d.capBps != null ? String(d.capBps / 100) : "—",
        status: d.status ?? "",
      });
    },
    [t, te],
  );
}

/** First field error path → message, from a 422 VALIDATION_ERROR or a business error with details[]. */
export function fieldErrorsOf(err) {
  if (!Array.isArray(err?.details)) return {};
  return Object.fromEntries(err.details.filter((d) => d?.path).map((d) => [String(d.path), d.message]));
}
