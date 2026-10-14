"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { MoneyInput, useMoney } from "../parts";

const CODES = ["booking_money", "down_payment", "installment", "milestone", "handover"];

export const scheduleRowsFrom = (items) =>
  items.map((i) => ({ code: i.code, label: i.label ?? "", labelBn: i.labelBn ?? "", dueDate: i.dueDate ?? "", amount: poishaToTaka(i.amount) }));

const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n) => String(n).replace(/\d/g, (d) => BN[d]);

/** Rows → API items. Unlabelled installments get "Installment k of n" (same text as the generator). */
export function scheduleBody(rows) {
  const n = rows.filter((r) => r.code === "installment").length;
  let k = 0;
  return rows.map((r) => {
    const auto = r.code === "installment" && !r.label.trim() ? ((k += 1), { label: `Installment ${k} of ${n}`, labelBn: `কিস্তি ${bn(k)}/${bn(n)}` }) : {};
    if (r.code === "installment" && r.label.trim()) k += 1;
    return {
      code: r.code,
      ...auto,
      ...(r.label.trim() && { label: r.label.trim() }),
      ...(r.labelBn.trim() && { labelBn: r.labelBn.trim() }),
      dueDate: r.code === "booking_money" ? null : r.dueDate || null,
      amount: takaToPoisha(r.amount),
    };
  });
}

/** Problems the server would also reject (INVALID_SCHEDULE / SCHEDULE_TOTAL_MISMATCH). */
export function checkSchedule(rows, contract, bookingDate) {
  const e = {};
  rows.forEach((r, i) => {
    const a = takaToPoisha(r.amount);
    if (a == null || a < 1) e[`${i}.amount`] = true;
    if (r.code !== "booking_money" && r.dueDate && bookingDate && r.dueDate < bookingDate) e[`${i}.dueDate`] = true;
  });
  if (Object.keys(e).some((k) => k.endsWith(".dueDate"))) e.dates = "dueBeforeBooking";
  if (rows.filter((r) => r.code === "booking_money").length !== 1) e.bookingMoney = "oneBookingMoney";
  const sum = rows.reduce((s, r) => s + (takaToPoisha(r.amount) ?? 0), 0);
  if (contract != null && sum !== contract) e.total = "scheduleTotal";
  if (!rows.length) e.total = "scheduleEmpty";
  return { errors: e, sum };
}

/** Custom schedule (bookings:override): rows must add up to the contract exactly. */
export function ScheduleEditor({ rows, onChange, contract, bookingDate, onSeed, canSeed }) {
  const t = useTranslations("sales.customSchedule");
  const ts = useTranslations("sales.schedule");
  const tv = useTranslations("sales.validation");
  const money = useMoney();
  const { errors, sum } = checkSchedule(rows, contract, bookingDate);
  const diff = contract != null ? contract - sum : 0;
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fixLast = () => {
    if (!rows.length || contract == null) return;
    const last = rows.length - 1;
    const v = (takaToPoisha(rows[last].amount) ?? 0) + diff;
    if (v > 0) set(last, { amount: poishaToTaka(v) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!canSeed} onClick={onSeed}>
          {t("seed")}
        </Button>
        <Button size="sm" variant="secondary" disabled={rows.length >= 300} onClick={() => onChange([...rows, { code: "installment", label: "", labelBn: "", dueDate: "", amount: "" }])}>
          <Plus aria-hidden className="size-3.5" />
          {t("addRow")}
        </Button>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] tracking-[0.08em] text-ink-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">{t("type")}</th>
                <th className="px-3 py-2 font-semibold">{t("label")}</th>
                <th className="px-3 py-2 font-semibold">{ts("due")}</th>
                <th className="px-3 py-2 text-right font-semibold">{ts("amount")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-2 py-2">
                    <Select value={r.code} onChange={(e) => set(i, { code: e.target.value })} aria-label={t("type")} className="h-9">
                      {CODES.map((c) => (
                        <option key={c} value={c}>
                          {t(`codes.${c}`)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input className="h-9" value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={t("labelAuto")} maxLength={160} aria-label={t("label")} />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="date"
                      className="h-9"
                      value={r.code === "booking_money" ? bookingDate ?? "" : r.dueDate}
                      disabled={r.code === "booking_money"}
                      min={bookingDate}
                      onChange={(e) => set(i, { dueDate: e.target.value })}
                      aria-label={ts("due")}
                      aria-invalid={errors[`${i}.dueDate`] || undefined}
                    />
                  </td>
                  <td className="w-48 px-2 py-2">
                    <MoneyInput value={r.amount} onChange={(v) => set(i, { amount: v })} showWords={false} className="h-9 text-right" aria-label={ts("amount")} aria-invalid={errors[`${i}.amount`] || undefined} />
                  </td>
                  <td className="px-1 py-2">
                    <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t("removeRow")}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className={cn("font-mono tabular-nums", diff === 0 ? "text-success" : "text-danger")}>
          {t("sum", { sum: money(sum), contract: money(contract) })}
          {diff !== 0 && <span className="ml-2">({diff > 0 ? t("short", { amount: money(diff) }) : t("over", { amount: money(-diff) })})</span>}
        </p>
        {diff !== 0 && rows.length > 0 && (
          <Button size="sm" variant="ghost" onClick={fixLast}>
            {t("fixLast")}
          </Button>
        )}
      </div>
      {errors.bookingMoney && <p className="text-xs font-medium text-danger">{tv(errors.bookingMoney)}</p>}
      {errors.dates && <p className="text-xs font-medium text-danger">{tv(errors.dates)}</p>}
      <p className="text-xs text-ink-muted">{t("hint")}</p>
    </div>
  );
}
