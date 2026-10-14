"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { apiRequest } from "@/lib/api/client";
import { takaToPoisha } from "@/lib/format";
import { todayDhaka } from "@/lib/sales/money";
import { PaymentFields, checkPayment, emptyPayment, paymentBody } from "../PaymentFields";
import { MoneyInput, itemLabel, useMoney } from "../parts";
import { ErrorBox, useRun } from "./useRun";

const post = (path, body) => apiRequest(path, { method: "POST", body });

/** Event date: today by default, never in the future nor before the booking. */
function DateField({ value, onChange, booking, label }) {
  const t = useTranslations("sales.actions");
  return (
    <Field label={label ?? t("date")} hint={t("dateHint")}>
      <Input type="date" value={value} min={booking.bookingDate} max={todayDhaka()} onChange={(e) => onChange(e.target.value)} className="sm:max-w-56" />
    </Field>
  );
}

function Footer({ onClose, busy, label, variant = "primary", onSubmit, disabled }) {
  const tc = useTranslations("common");
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        {tc("cancel")}
      </Button>
      <Button variant={variant} loading={busy} disabled={disabled} onClick={onSubmit}>
        {label}
      </Button>
    </>
  );
}

/** Allot / register / handover — the sale stages (warnings never block, owner Q6). */
export function StageDialog({ kind, booking, onClose }) {
  const t = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const { busy, error, setError, run } = useRun(booking);
  const [date, setDate] = useState(todayDhaka());
  const [note, setNote] = useState("");
  const [deedNo, setDeedNo] = useState("");
  const [office, setOffice] = useState("");
  const submit = async () => {
    if (kind === "register" && !deedNo.trim()) return setError(tv("required"));
    const body = { date, ...(note.trim() && { note: note.trim() }), ...(kind === "register" && { deedNo: deedNo.trim(), ...(office.trim() && { subRegistryOffice: office.trim() }) }) };
    if (await run(() => post(`/bookings/${booking.id}/${kind}`, body), t(`${kind}.done`))) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={t(`${kind}.title`)} description={t(`${kind}.body`)} footer={<Footer onClose={onClose} busy={busy} label={t(`${kind}.confirm`)} onSubmit={submit} />}>
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        {kind === "register" && (
          <>
            <Field label={t("register.deedNo")} required>
              <Input className="font-mono text-[13px]" value={deedNo} onChange={(e) => setDeedNo(e.target.value)} maxLength={60} />
            </Field>
            <Field label={t("register.office")}>
              <Input value={office} onChange={(e) => setOffice(e.target.value)} maxLength={120} />
            </Field>
          </>
        )}
        <DateField value={date} onChange={setDate} booking={booking} />
        <Field label={t("note")}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Give a milestone / handover (or any unpaid) item its due date. */
export function CallDialog({ item, booking, onClose }) {
  const t = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const locale = useLocale();
  const money = useMoney();
  const { busy, error, setError, run } = useRun(booking);
  const [dueDate, setDueDate] = useState(item.dueDate ?? todayDhaka());
  const [note, setNote] = useState("");
  const submit = async () => {
    if (!dueDate) return setError(tv("required"));
    if (await run(() => post(`/bookings/${booking.id}/schedule/${item.id}/call`, { dueDate, ...(note.trim() && { note: note.trim() }) }), t("call.done"))) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("call.title", { item: itemLabel(item, locale) })}
      description={t("call.body", { amount: money(item.amount - (item.paid ?? 0)) })}
      footer={<Footer onClose={onClose} busy={busy} label={t("call.confirm")} onSubmit={submit} />}
    >
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Field label={t("call.dueDate")} required>
          <Input type="date" value={dueDate} min={booking.bookingDate} onChange={(e) => setDueDate(e.target.value)} className="sm:max-w-56" />
        </Field>
        <Field label={t("note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Waive an unpaid charge (delay, utility, bounce fee …). */
export function WaiveDialog({ item, booking, onClose }) {
  const t = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const locale = useLocale();
  const money = useMoney();
  const { busy, error, setError, run } = useRun(booking);
  const [reason, setReason] = useState("");
  const submit = async () => {
    if (reason.trim().length < 3) return setError(tv("reason3"));
    if (await run(() => post(`/bookings/${booking.id}/charges/${item.id}/waive`, { reason: reason.trim() }), t("waive.done"))) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("waive.title", { item: itemLabel(item, locale) })}
      description={t("waive.body", { amount: money(item.amount) })}
      footer={<Footer onClose={onClose} busy={busy} label={t("waive.confirm")} variant="danger" onSubmit={submit} />}
    >
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Field label={t("reason")} required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
    </Dialog>
  );
}

const CHARGE_KINDS = ["delay", "utility", "registration", "other"];

/** A charge outside the contract price (delay charge is manual in v1). */
export function ChargeDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions");
  const tv = useTranslations("sales.validation");
  const { busy, error, setError, run } = useRun(booking);
  const [f, setF] = useState({ kind: "delay", label: "", labelBn: "", amount: "", dueDate: todayDhaka(), note: "" });
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const submit = async () => {
    const amount = takaToPoisha(f.amount);
    if (f.label.trim().length < 2) return setError(`${t("charge.label")}: ${tv("min2")}`);
    if (!amount || amount <= 0) return setError(tv("amount"));
    if (!f.dueDate) return setError(`${t("charge.dueDate")}: ${tv("required")}`);
    const body = { kind: f.kind, label: f.label.trim(), ...(f.labelBn.trim() && { labelBn: f.labelBn.trim() }), amount, dueDate: f.dueDate, ...(f.note.trim() && { note: f.note.trim() }) };
    if (await run(() => post(`/bookings/${booking.id}/charges`, body), t("charge.done"))) onClose();
  };
  return (
    <Drawer open onClose={onClose} title={t("charge.title")} description={t("charge.body")} width="md" footer={<Footer onClose={onClose} busy={busy} label={t("charge.confirm")} onSubmit={submit} />}>
      <div className="space-y-5">
        <ErrorBox>{error}</ErrorBox>
        <Field label={t("charge.kind")} required>
          <Select value={f.kind} onChange={set("kind")}>
            {CHARGE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`chargeKinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("charge.label")} required>
            <Input value={f.label} onChange={set("label")} maxLength={160} placeholder={t("charge.labelPlaceholder")} />
          </Field>
          <Field label={t("charge.labelBn")}>
            <Input lang="bn" value={f.labelBn} onChange={set("labelBn")} maxLength={160} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("charge.amount")} required>
            <MoneyInput value={f.amount} onChange={set("amount")} />
          </Field>
          <Field label={t("charge.dueDate")} required>
            <Input type="date" value={f.dueDate} min={booking.bookingDate} onChange={set("dueDate")} />
          </Field>
        </div>
        <Field label={t("note")}>
          <Input value={f.note} onChange={set("note")} maxLength={300} />
        </Field>
      </div>
    </Drawer>
  );
}

/** Receive a cheque / PDC against a booking (cheques:manage). Receipt comes when it clears. */
export function ChequeReceiveDrawer({ booking, onClose }) {
  const t = useTranslations("sales.actions");
  const money = useMoney();
  const { busy, error, run } = useRun(booking);
  const [pay, setPay] = useState(() => ({ ...emptyPayment(), mode: "cheque" }));
  const [receivedDate, setReceivedDate] = useState(todayDhaka());
  const [errors, setErrors] = useState({});
  const outstanding = booking.totals?.outstanding ?? 0;
  const submit = async () => {
    const e = checkPayment(pay, { max: outstanding });
    setErrors(e);
    if (Object.keys(e).length) return;
    const { mode: _m, ...cheque } = paymentBody(pay);
    if (await run(() => post(`/bookings/${booking.id}/cheques`, { ...cheque, receivedDate }), t("cheque.done"))) onClose();
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title={t("cheque.title")}
      description={t("cheque.body", { amount: money(outstanding) })}
      width="md"
      footer={<Footer onClose={onClose} busy={busy} label={t("cheque.confirm")} onSubmit={submit} />}
    >
      <div className="space-y-5">
        <ErrorBox>{error}</ErrorBox>
        <PaymentFields value={pay} onChange={(v) => setPay((o) => ({ ...o, ...v }))} errors={errors} modes={["cheque"]} />
        <DateField label={t("cheque.received")} value={receivedDate} onChange={setReceivedDate} booking={booking} />
      </div>
    </Drawer>
  );
}
