"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/Segmented";
import { formatBDT, formatBDTCompact, formatNumber, poishaToTaka, takaToPoisha } from "@/lib/format";
import { installmentPlan, loanEmi } from "@/lib/public/emi";
import { CALCULATOR as C } from "@/lib/public/site";

function Range({ label, value, display, min, max, step, onChange }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium">
          {label}
        </label>
        <span className="font-mono text-xs text-ink">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

/**
 * Installment estimate (owner defaults in lib/public/site.js › CALCULATOR). `price` is the unit's
 * public price in poisha, or null ("price on request") — then the visitor types a figure.
 */
export function PaymentCalculator({ price }) {
  const t = useTranslations("site.calc");
  const locale = useLocale();
  const priceId = useId();
  const [priceText, setPriceText] = useState(price != null ? poishaToTaka(price) : "");
  const [downPct, setDownPct] = useState(C.downPaymentPct);
  const [months, setMonths] = useState(C.months);
  const [mode, setMode] = useState("installments");
  const [rate, setRate] = useState(C.loanRatePct);
  const [years, setYears] = useState(C.loanYears);

  const amount = price ?? takaToPoisha(priceText);
  const plan = installmentPlan(amount, downPct, months);
  const loan = mode === "loan" && plan ? loanEmi(plan.rest, rate, years) : null;

  return (
    <section aria-labelledby={`${priceId}-t`} className="rounded-lg border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <h2 id={`${priceId}-t`} className="text-sm font-semibold">
          {t("title")}
        </h2>
      </header>
      <div className="space-y-5 px-5 py-5">
        {price == null && (
          <div>
            <label htmlFor={priceId} className="text-xs font-medium">
              {t("price")}
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-subtle">৳</span>
              <input
                id={priceId}
                inputMode="decimal"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder={t("pricePlaceholder")}
                className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-7 font-mono text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        )}
        {C.showLoan && (
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            aria-label={t("mode")}
            className="w-full [&>label]:flex-1"
            options={[
              { value: "installments", label: t("modeInstallments") },
              { value: "loan", label: t("modeLoan") },
            ]}
          />
        )}
        <Range
          label={t("down")}
          value={downPct}
          display={`${formatNumber(downPct, locale)}%`}
          min={C.downPaymentMin}
          max={C.downPaymentMax}
          step={5}
          onChange={setDownPct}
        />
        {mode === "installments" ? (
          <Range
            label={t("months")}
            value={months}
            display={t("monthsValue", { n: formatNumber(months, locale) })}
            min={C.monthsMin}
            max={C.monthsMax}
            step={C.monthsStep}
            onChange={setMonths}
          />
        ) : (
          <>
            <Range label={t("rate")} value={rate} display={`${formatNumber(rate, locale, { maximumFractionDigits: 2 })}%`} min={5} max={16} step={0.25} onChange={setRate} />
            <Range label={t("years")} value={years} display={t("yearsValue", { n: formatNumber(years, locale) })} min={1} max={C.loanYearsMax} step={1} onChange={setYears} />
          </>
        )}
      </div>

      <dl className="border-t border-line bg-surface-2/60 px-5 py-4 text-sm" aria-live="polite">
        {plan ? (
          <>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-ink-muted">{t("downAmount")}</dt>
              <dd className="font-mono">{formatBDT(plan.down, locale)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-ink-muted">{t("rest")}</dt>
              <dd className="font-mono">{formatBDTCompact(plan.rest, locale)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt className="font-medium">{mode === "loan" ? t("emi") : t("monthly")}</dt>
              <dd className="font-display text-2xl">{formatBDT((loan ?? plan).monthly, locale)}</dd>
            </div>
            {loan && (
              <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
                <dt className="text-ink-muted">{t("totalInterest")}</dt>
                <dd className="font-mono">{formatBDTCompact(loan.totalInterest, locale)}</dd>
              </div>
            )}
          </>
        ) : (
          <p className="text-ink-muted">{t("enterPrice")}</p>
        )}
      </dl>
      <p className="px-5 pt-3 pb-4 text-[11px] leading-relaxed text-ink-subtle">{t("disclaimer")}</p>
    </section>
  );
}
