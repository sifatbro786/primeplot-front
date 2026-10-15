"use client";

import { useCallback } from "react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Tag } from "@/components/ui/Tag";
import { errorMessage } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatBDT, formatNumber } from "@/lib/format";
import { itemLabel, localName, useDate, useDay, useMoney } from "@/components/sales/parts";

export { itemLabel, localName, useDate, useDay, useMoney };

/** ApiError → message for portal screens (amounts from `details` formatted in). */
export function usePortalError() {
  const t = useTranslations("portal.errors");
  const te = useTranslations("errors");
  const locale = useLocale();
  return useCallback(
    (err) => {
      const code = err?.code;
      if (!code || !t.has(code)) return errorMessage(te, err);
      const d = err.details && !Array.isArray(err.details) ? err.details : {};
      const money = (v) => (v == null ? "—" : formatBDT(v, locale));
      return t(code, { min: money(d.min), max: money(d.max ?? d.payable), outstanding: money(d.outstanding), pending: money(d.pendingSlips) });
    },
    [t, te, locale],
  );
}

/** Share of the contract paid, 0–100 (whole number, never rounds up to 100 early). */
export function paidPct(totals) {
  if (!totals?.total) return 0;
  return Math.min(100, Math.floor((totals.paid / totals.total) * 100));
}

/**
 * The "deed folder": a unit's title block — project, unit code, booking number and the money
 * position. Used on the home list (as a link) and at the top of the booking page.
 */
export function DeedCard({ b, as: Comp = "div", className, children, ...props }) {
  const t = useTranslations("portal.deed");
  const locale = useLocale();
  const money = useMoney();
  const pct = paidPct(b.totals);
  const cancelled = b.status === "cancelled";
  return (
    <Comp className={cn("deed block overflow-hidden p-6 sm:p-7", className)} {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="eyebrow">{localName(b.project, locale)}</span>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-[2rem] leading-none">{b.unitCode}</span>
            <span className="font-mono text-[12px] tracking-wide text-primary-ink/70">{b.bookingNo}</span>
          </p>
        </div>
        {b.role === "co_applicant" && (
          <span className="mt-1 shrink-0 rounded-sm border border-accent-on-dark/50 px-2 py-0.5 text-[11px] text-accent-on-dark">{t("coApplicant")}</span>
        )}
      </div>

      {cancelled ? (
        <p className="mt-6 text-sm text-primary-ink/80">{t("cancelled")}</p>
      ) : (
        <>
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-[11px] text-primary-ink/65">{t("outstanding")}</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums">{money(b.totals?.outstanding ?? 0)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-[11px] text-primary-ink/65">{t("paid")}</dt>
              <dd className="mt-1 font-mono text-xl tabular-nums">{money(b.totals?.paid ?? 0)}</dd>
            </div>
          </dl>
          <div className="mt-4" aria-label={t("paidPct", { pct: formatNumber(pct, locale) })} role="img">
            <div className="h-[3px] bg-primary-ink/15">
              <div className="h-full bg-accent-on-dark" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 flex justify-between text-[11px] text-primary-ink/65">
              <span>{t("paidPct", { pct: formatNumber(pct, locale) })}</span>
              <span>{t("contract", { amount: money(b.contractTotal) })}</span>
            </p>
          </div>
        </>
      )}
      {children}
    </Comp>
  );
}

const STAGES = ["booked", "allotted", "registered", "handed_over"];

/** booking → allotment → registration → handover, with dates where known. */
export function StageTrack({ b }) {
  const t = useTranslations("portal.stages");
  const day = useDay();
  const at = STAGES.indexOf(b.stage ?? "booked");
  const dates = { booked: b.bookingDate, allotted: b.allotment?.date, registered: b.registration?.date, handed_over: b.handover?.date };
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t("label")}>
      {STAGES.map((s, i) => {
        const done = i <= at;
        return (
          <li key={s} aria-current={i === at ? "step" : undefined} className="min-w-0">
            <div className="flex h-6 items-center">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border",
                  done ? "border-primary bg-primary text-primary-ink" : "border-line-strong bg-surface",
                  i === at && "ring-4 ring-primary/10",
                )}
              >
                {done && <Check aria-hidden className="size-3" strokeWidth={3} />}
              </span>
              {i < STAGES.length - 1 && <span className={cn("mx-1.5 h-px flex-1", i < at ? "bg-primary" : "bg-line-strong/50")} />}
            </div>
            <p className={cn("mt-2 text-xs leading-tight", done ? "font-medium text-ink" : "text-ink-muted")}>{t(s)}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">{done && dates[s] ? day(dates[s]) : i === at + 1 ? t("next") : " "}</p>
            {s === "registered" && done && b.registration?.deedNo && <p className="font-mono text-[10px] text-ink-muted">{b.registration.deedNo}</p>}
          </li>
        );
      })}
    </ol>
  );
}

const SLIP_TONE = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };
export function SlipStatusTag({ status }) {
  const t = useTranslations("portal.slipStatus");
  return <Tag tone={SLIP_TONE[status] ?? "neutral"}>{t(status)}</Tag>;
}

const PAY_TONE = { initiated: "info", paid: "success", review: "warning", failed: "danger", cancelled: "neutral", expired: "neutral", rejected: "danger" };
export function PaymentStatusTag({ status }) {
  const t = useTranslations("portal.payStatus");
  return <Tag tone={PAY_TONE[status] ?? "neutral"}>{t(status)}</Tag>;
}

/** Section title on paper: a ruled heading (serif is kept for ≥ 28 px) + optional action. */
export function PaperHeading({ title, action, className }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4 border-b border-ink/15 pb-2", className)}>
      <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
      {action}
    </div>
  );
}
