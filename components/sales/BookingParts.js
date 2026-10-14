"use client";

import { useLocale, useTranslations } from "next-intl";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { areaUnitLabel, formatBDT, formatNumber } from "@/lib/format";
import { ItemStatusTag, itemLabel, useDay, useMoney } from "./parts";

/** Frozen price lines + discount + contract total (booking snapshot or a preview). */
export function PriceLines({ price, compact }) {
  const t = useTranslations("inventory.price");
  const ts = useTranslations("sales.price");
  const locale = useLocale();
  const money = useMoney();
  const lineLabel = (l) => (l.code.startsWith("charge:") ? (locale === "bn" && l.labelBn) || l.label : t.has(`lines.${l.code}`) ? t(`lines.${l.code}`) : l.label ?? l.code);
  const basis = (l) => {
    if (l.qty == null || l.rate == null) return l.bps ? t("bps", { pct: formatNumber(l.bps / 100, locale) }) : l.note ?? "";
    const unit = l.qtyUnit === "slot" ? t("slots") : areaUnitLabel(l.qtyUnit, locale);
    return `${formatNumber(l.qty, locale, { maximumFractionDigits: 4 })} ${unit} × ${formatBDT(l.rate, locale)}`;
  };
  const discount = price.discount?.amount ?? 0;
  return (
    <Table>
      <TBody>
        {price.lines.map((l, i) => (
          <TR key={`${l.code}:${i}`}>
            <TD className={compact ? "h-auto py-1.5" : "py-2"}>
              <p className="text-sm">{lineLabel(l)}</p>
              {!compact && basis(l) && <p className="text-[11px] text-ink-subtle">{basis(l)}</p>}
            </TD>
            <TD numeric className={l.amount < 0 ? "text-danger" : undefined}>
              {money(l.amount)}
            </TD>
          </TR>
        ))}
        {discount > 0 && (
          <>
            <TR>
              <TD className="py-2 text-sm text-ink-muted">{ts("listTotal")}</TD>
              <TD numeric className="text-ink-muted">{money(price.listTotal)}</TD>
            </TR>
            <TR>
              <TD className="py-2">
                <p className="text-sm">{ts("discount")}</p>
                {price.discount?.reason && <p className="text-[11px] text-ink-subtle">{price.discount.reason}</p>}
              </TD>
              <TD numeric className="text-danger">− {money(discount)}</TD>
            </TR>
          </>
        )}
        <TR className="bg-surface-2 hover:bg-surface-2">
          <TD className="text-xs font-semibold tracking-wide uppercase">{ts("contractTotal")}</TD>
          <TD numeric className="text-base font-semibold">
            {money(price.contractTotal)}
          </TD>
        </TR>
      </TBody>
    </Table>
  );
}

/**
 * Schedule items. Preview rows have no paid/status; booking rows do (status from the API).
 * `highlight` = Map(itemId → amount) for the allocation preview of a payment being entered.
 */
export function ScheduleTable({ items, highlight, showPaid = true, renderAction }) {
  const t = useTranslations("sales.schedule");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <Table>
      <THead>
        <tr>
          <TH className="hidden w-10 sm:table-cell">#</TH>
          <TH>{t("item")}</TH>
          <TH>{t("due")}</TH>
          <TH align="right">{t("amount")}</TH>
          {showPaid && <TH align="right" className="hidden sm:table-cell">{t("paid")}</TH>}
          {showPaid && <TH>{t("status")}</TH>}
          {renderAction && <TH className="print:hidden" />}
        </tr>
      </THead>
      <TBody>
        {items.map((i, idx) => {
          const take = highlight?.get(i.id);
          return (
            <TR key={i.id ?? idx} className={cn(take && "bg-accent-soft hover:bg-accent-soft")}>
              <TD className="hidden font-mono text-[12px] text-ink-subtle sm:table-cell">{formatNumber(i.seq ?? idx + 1, locale)}</TD>
              <TD>
                <span className="text-sm">{itemLabel(i, locale)}</span>
                {i.code === "charge" && <span className="ml-2 text-[11px] text-ink-subtle">{t("charge")}</span>}
                {take && <span className="block text-[11px] font-medium text-accent">{t("willPay", { amount: money(take) })}</span>}
              </TD>
              <TD className="text-sm whitespace-nowrap text-ink-muted">{i.dueDate ? day(i.dueDate) : t("whenCalled")}</TD>
              <TD numeric>{money(i.amount)}</TD>
              {showPaid && (
                <TD numeric className="hidden text-ink-muted sm:table-cell">
                  {i.paid ? money(i.paid) : "—"}
                </TD>
              )}
              {showPaid && (
                <TD>
                  <ItemStatusTag status={i.status} />
                </TD>
              )}
              {renderAction && (
                <TD align="right" className="print:hidden">
                  {renderAction(i)}
                </TD>
              )}
            </TR>
          );
        })}
        <TR className="bg-surface-2 hover:bg-surface-2">
          <TD className="hidden sm:table-cell" />
          <TD className="text-xs font-semibold tracking-wide uppercase">{t("total")}</TD>
          <TD />
          <TD numeric className="font-semibold">{money(total)}</TD>
          {showPaid && <TD numeric className="hidden font-semibold sm:table-cell">{money(items.reduce((s, i) => s + (i.paid ?? 0), 0))}</TD>}
          {showPaid && <TD />}
          {renderAction && <TD className="print:hidden" />}
        </TR>
      </TBody>
    </Table>
  );
}
