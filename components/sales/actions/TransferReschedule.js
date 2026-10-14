"use client";

import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useProject } from "@/components/inventory/queries";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { todayDhaka } from "@/lib/sales/money";
import { CustomerCard, CustomerPicker } from "../CustomerPicker";
import { NomineesEditor, checkNominees, nomineesBody } from "../wizard/NomineesEditor";
import { MoneyInput, itemLabel, useMoney } from "../parts";
import { ErrorBox, useRun } from "./useRun";

/** Transfer the booking to a new holder (booked/allotted, no overdue dues, no open cheques). */
export function TransferDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions.transfer");
  const ta = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const money = useMoney();
  const project = useProject(booking.project?.id);
  const fee = project.data?.salesPolicy?.transferFee ?? 0;
  const { busy, error, setError, run } = useRun(booking);
  const [to, setTo] = useState(null);
  const [co, setCo] = useState([]);
  const [addingCo, setAddingCo] = useState(false);
  const [nominees, setNominees] = useState([]);
  const [nomErrors, setNomErrors] = useState({});
  const [waive, setWaive] = useState(false);
  const [waiveReason, setWaiveReason] = useState("");
  const [date, setDate] = useState(todayDhaka());
  const [note, setNote] = useState("");
  const exclude = [booking.customerId, to?.id, ...co.map((c) => c.id)].filter(Boolean);

  const submit = async () => {
    if (!to) return setError(tv("chooseCustomer"));
    const ne = checkNominees(nominees);
    setNomErrors(ne);
    if (Object.keys(ne).length) return;
    if (waive && waiveReason.trim().length < 3) return setError(`${t("waiveReason")}: ${tv("reason3")}`);
    const body = {
      toCustomerId: to.id,
      ...(co.length && { coApplicantIds: co.map((c) => c.id) }),
      ...(nominees.length && { nominees: nomineesBody(nominees) }),
      date,
      ...(note.trim() && { note: note.trim() }),
      ...(waive && { waiveFeeReason: waiveReason.trim() }),
    };
    if (await run(() => apiRequest(`/bookings/${booking.id}/transfer`, { method: "POST", body }), t("done", { name: to.name }))) onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title", { no: booking.bookingNo })}
      description={t("body")}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button loading={busy} onClick={submit}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <ErrorBox>{error}</ErrorBox>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("from")}</h3>
          <CustomerCard customer={booking.customer ?? { id: booking.customerId, name: booking.customerName }} />
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("to")}</h3>
          {to ? <CustomerCard customer={to} onClear={() => setTo(null)} /> : <CustomerPicker onPick={setTo} exclude={exclude} autoFocus />}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("coApplicants")}</h3>
          {co.map((c) => (
            <CustomerCard key={c.id} customer={c} onClear={() => setCo(co.filter((x) => x.id !== c.id))} />
          ))}
          {addingCo ? (
            <CustomerPicker
              exclude={exclude}
              onPick={(c) => {
                setCo([...co, c]);
                setAddingCo(false);
              }}
            />
          ) : (
            co.length < 2 && (
              <Button size="sm" variant="secondary" disabled={!to} onClick={() => setAddingCo(true)}>
                <Plus aria-hidden className="size-3.5" />
                {t("addCo")}
              </Button>
            )
          )}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("nominees")}</h3>
          <NomineesEditor value={nominees} onChange={setNominees} errors={nomErrors} />
        </section>
        <section className="space-y-4 rounded-lg border border-line p-4">
          <p className="text-sm">{fee > 0 ? t("fee", { amount: money(fee) }) : t("noFee")}</p>
          {fee > 0 && <Checkbox label={t("waive")} checked={waive} onChange={(e) => setWaive(e.target.checked)} />}
          {waive && (
            <Field label={t("waiveReason")} required>
              <Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} maxLength={300} />
            </Field>
          )}
        </section>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={ta("date")} hint={ta("dateHint")}>
            <Input type="date" value={date} min={booking.bookingDate} max={todayDhaka()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={ta("note")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        </div>
        <p className="rounded-md bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-muted">{t("effects")}</p>
      </div>
    </Drawer>
  );
}

const CODES = ["booking_money", "down_payment", "installment", "milestone", "handover"];

/** Reschedule the contract items (charges are kept). Paid items stay; the total never changes. */
export function RescheduleDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions.reschedule");
  const tcs = useTranslations("sales.customSchedule");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const { busy, error, setError, run } = useRun(booking);
  const [rows, setRows] = useState(() =>
    booking.schedule
      .filter((i) => i.code !== "charge")
      .map((i) => ({ id: i.id, code: i.code, label: itemLabel(i, locale), labelBn: i.labelBn ?? "", dueDate: i.dueDate ?? "", amount: poishaToTaka(i.amount), paid: i.paid ?? 0 })),
  );
  const [reason, setReason] = useState("");
  const contract = booking.contractTotal;
  const sum = rows.reduce((s, r) => s + (takaToPoisha(r.amount) ?? 0), 0);
  const diff = contract - sum;
  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (diff !== 0) return setError(tv("scheduleTotal"));
    const bad = rows.find((r) => (takaToPoisha(r.amount) ?? 0) < r.paid || !takaToPoisha(r.amount));
    if (bad) return setError(t("belowPaid", { item: bad.label || bad.code }));
    if (reason.trim().length < 3) return setError(tv("reason3"));
    const items = rows.map((r) => ({
      ...(r.id && { id: r.id }),
      code: r.code,
      ...(r.label.trim() && { label: r.label.trim() }),
      ...(r.labelBn.trim() && { labelBn: r.labelBn.trim() }),
      dueDate: r.code === "booking_money" ? undefined : r.dueDate || null,
      amount: takaToPoisha(r.amount),
    }));
    const body = { version: booking.version, reason: reason.trim(), items };
    if (await run(() => apiRequest(`/bookings/${booking.id}/schedule`, { method: "PUT", body }), t("done"))) onClose();
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("title", { no: booking.bookingNo })}
      description={t("body")}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button loading={busy} disabled={diff !== 0} onClick={submit}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorBox>{error}</ErrorBox>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] tracking-[0.08em] text-ink-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">{tcs("type")}</th>
                <th className="px-3 py-2 font-semibold">{tcs("label")}</th>
                <th className="px-3 py-2 font-semibold">{t("due")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("amount")}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => {
                const locked = r.paid > 0 && r.paid >= (takaToPoisha(r.amount) ?? 0);
                return (
                  <tr key={r.id ?? `new-${i}`} className={cn("align-top", locked && "bg-surface-2/60")}>
                    <td className="px-2 py-2">
                      <Select className="h-9" value={r.code} disabled={Boolean(r.id)} onChange={(e) => set(i, { code: e.target.value })} aria-label={tcs("type")}>
                        {CODES.map((c) => (
                          <option key={c} value={c}>
                            {tcs(`codes.${c}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input className="h-9" value={r.label} disabled={locked} onChange={(e) => set(i, { label: e.target.value })} maxLength={160} aria-label={tcs("label")} />
                      {r.paid > 0 && <p className="mt-1 text-[11px] text-ink-subtle">{t("paidSoFar", { amount: money(r.paid) })}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="date"
                        className="h-9"
                        value={r.code === "booking_money" ? booking.bookingDate : r.dueDate}
                        disabled={locked || r.code === "booking_money"}
                        min={booking.bookingDate}
                        onChange={(e) => set(i, { dueDate: e.target.value })}
                        aria-label={t("due")}
                      />
                    </td>
                    <td className="w-48 px-2 py-2">
                      <MoneyInput value={r.amount} onChange={(v) => set(i, { amount: v })} showWords={false} disabled={locked} className="h-9 text-right" aria-label={t("amount")} />
                    </td>
                    <td className="px-1 py-2">
                      {locked ? (
                        <span className="grid size-9 place-items-center text-ink-subtle" title={t("locked")}>
                          <Lock aria-hidden className="size-3.5" />
                        </span>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 text-danger"
                          disabled={r.paid > 0 || r.code === "booking_money"}
                          onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                          aria-label={tcs("removeRow")}
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, { code: "installment", label: "", labelBn: "", dueDate: "", amount: "", paid: 0 }])}>
            <Plus aria-hidden className="size-3.5" />
            {tcs("addRow")}
          </Button>
          <p className={cn("font-mono text-sm tabular-nums", diff === 0 ? "text-success" : "text-danger")}>
            {tcs("sum", { sum: money(sum), contract: money(contract) })}
            {diff !== 0 && <span className="ml-2">({diff > 0 ? tcs("short", { amount: money(diff) }) : tcs("over", { amount: money(-diff) })})</span>}
          </p>
        </div>
        <Field label={t("reason")} hint={t("reasonHint")} required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Drawer>
  );
}
