"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { formatBDT, formatDate, takaToPoisha } from "@/lib/format";
import { amountInWords } from "@/lib/sales/words";

/** Locale-bound money formatter: money(50000000) → "৳ ৫,০০,০০০". */
export function useMoney() {
  const locale = useLocale();
  return useCallback((poisha, opts) => formatBDT(poisha, locale, opts), [locale]);
}

export function useDate() {
  const locale = useLocale();
  return useCallback((d, style) => formatDate(d, locale, style), [locale]);
}

/** Business date 'YYYY-MM-DD' → localized (noon UTC keeps it on the same Dhaka day). */
export function useDay() {
  const locale = useLocale();
  return useCallback((d) => (d ? formatDate(`${d}T06:00:00Z`, locale) : "—"), [locale]);
}

/**
 * Taka input with a live check line under it: the parsed amount and the amount in words, so a
 * missing zero is seen before saving. `value` is the raw string; parse with takaToPoisha().
 */
export function MoneyInput({ value, onChange, showWords = true, className, ...props }) {
  const locale = useLocale();
  const poisha = takaToPoisha(value);
  const words = showWords && poisha != null && poisha > 0 ? amountInWords(poisha, locale) : null;
  return (
    <div className="space-y-1">
      <Input
        inputMode="decimal"
        autoComplete="off"
        leading={<span className="text-sm">৳</span>}
        className={cn("font-mono text-[13px] tabular-nums", className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      {words && (
        <p className="text-[11px] leading-snug text-ink-muted">
          <span className="font-mono tabular-nums text-ink">{formatBDT(poisha, locale)}</span> · {words}
        </p>
      )}
    </div>
  );
}

const STAGE_TONE = { booked: "info", allotted: "accent", registered: "success", handed_over: "success" };

export function StageTag({ stage, status }) {
  const t = useTranslations("sales.stage");
  if (status === "cancelled") return <Tag tone="danger">{t("cancelled")}</Tag>;
  return <Tag tone={STAGE_TONE[stage] ?? "neutral"}>{t(stage ?? "booked")}</Tag>;
}

const ITEM_TONE = { paid: "success", partial: "info", due: "warning", overdue: "danger", upcoming: "neutral", not_called: "outline" };

export function ItemStatusTag({ status }) {
  const t = useTranslations("sales.itemStatus");
  return <Tag tone={ITEM_TONE[status] ?? "neutral"}>{t(status)}</Tag>;
}

export function ReceiptStatusTag({ status }) {
  const t = useTranslations("sales.receipts");
  return status === "reversed" ? <Tag tone="danger">{t("reversed")}</Tag> : <Tag tone="success">{t("valid")}</Tag>;
}

/** Schedule item label in the viewer's language. */
export function itemLabel(item, locale) {
  return (locale === "bn" ? item.labelBn || item.label : item.label || item.labelBn) ?? "";
}

export const localName = (o, locale) => (o ? (locale === "bn" && o.nameBn ? o.nameBn : o.name) : "");

/** Label / value row used on detail pages. */
export function Fact({ label, children, mono, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className={cn("mt-1 text-sm break-words", mono && "font-mono text-[13px] tabular-nums")}>{children ?? "—"}</dd>
    </div>
  );
}

/** Settings-style section: title + description on the left, body on the right. */
export function Section({ title, description, actions, children, className }) {
  return (
    <section className={cn("grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr]", className)}>
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
        {actions && <div className="mt-4">{actions}</div>}
      </header>
      <div className="min-w-0 max-w-3xl space-y-5">{children}</div>
    </section>
  );
}
