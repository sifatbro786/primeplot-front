"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api/client";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { todayDhaka } from "@/lib/sales/money";
import { useAccountSettings, useBankAccounts } from "@/lib/sales/queries";
import { ErrorBox, useRun } from "./actions/useRun";
import { MoneyInput, useDay, useMoney } from "./parts";

const TONE = { received: "info", deposited: "accent", cleared: "success", bounced: "danger", returned: "outline" };

export function ChequeStatusTag({ status }) {
  const t = useTranslations("sales.receipts.chequeStatus");
  return <Tag tone={TONE[status] ?? "neutral"}>{t(status)}</Tag>;
}

/** Which actions a cheque in this state allows (API.md › Cheques). */
export function chequeActions(c) {
  switch (c.status) {
    case "received":
      return ["deposit", "clear", "return"];
    case "deposited":
      return ["clear", "bounce"];
    case "bounced":
      return ["deposit", "return"];
    default:
      return [];
  }
}

/** Deposit / clear / bounce / return one cheque (cheques:manage). */
export function ChequeActionDialog({ cheque, action, onClose }) {
  const t = useTranslations("sales.cheques");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const money = useMoney();
  const day = useDay();
  const { busy, error, setError, run } = useRun({ id: cheque.bookingId });
  const banks = useBankAccounts({ active: "true" });
  const settings = useAccountSettings();
  const [date, setDate] = useState(todayDhaka());
  const [bankAccountId, setBank] = useState(cheque.depositBankAccount?.id ?? "");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState(null);
  const [note, setNote] = useState("");
  const feeValue = fee ?? poishaToTaka(settings.data?.chequeBounceFee ?? 0);
  const needsBank = action === "deposit" || (action === "clear" && cheque.status !== "deposited");

  const submit = async () => {
    if (needsBank && !bankAccountId) return setError(t("needBank"));
    if (["bounce", "return"].includes(action) && reason.trim().length < 3) return setError(tv("reason3"));
    let body;
    if (action === "deposit") body = { bankAccountId, date, ...(note.trim() && { note: note.trim() }) };
    if (action === "clear") body = { date, ...(needsBank && { bankAccountId }), ...(note.trim() && { note: note.trim() }) };
    if (action === "bounce") {
      const f = feeValue.trim() === "" ? 0 : takaToPoisha(feeValue);
      if (f == null || f < 0) return setError(tv("amount"));
      body = { reason: reason.trim(), date, fee: f };
    }
    if (action === "return") body = { reason: reason.trim() };
    const r = await run(() => apiRequest(`/cheques/${cheque.id}/${action}`, { method: "POST", body }));
    if (!r) return;
    toast.success(action === "clear" && r.data?.receipt ? t("clearedReceipt", { no: r.data.receipt.receiptNo }) : t(`${action}.done`, { no: cheque.chequeNo }));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(`${action}.title`, { no: cheque.chequeNo })}
      description={`${cheque.bank} · ${money(cheque.amount)} · ${day(cheque.chequeDate)} · ${cheque.bookingNo ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button variant={["bounce", "return"].includes(action) ? "danger" : "primary"} loading={busy} onClick={submit}>
            {t(`${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        {action === "clear" && <p className="text-sm text-ink-muted">{t("clear.body")}</p>}
        {needsBank && (
          <Field label={t("bankAccount")} required>
            <Select value={bankAccountId} onChange={(e) => setBank(e.target.value)} placeholder={t("chooseBank")}>
              {(banks.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.accountNo}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {["bounce", "return"].includes(action) && (
          <Field label={t("reason")} required>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={action === "bounce" ? t("bounce.placeholder") : undefined} />
          </Field>
        )}
        {action === "bounce" && (
          <Field label={t("bounce.fee")} hint={t("bounce.feeHint")}>
            <MoneyInput value={feeValue} onChange={setFee} />
          </Field>
        )}
        {action !== "return" && (
          <Field label={t("date")}>
            <Input type="date" value={date} max={todayDhaka()} onChange={(e) => setDate(e.target.value)} className="sm:max-w-56" />
          </Field>
        )}
        {["deposit", "clear"].includes(action) && (
          <Field label={t("note")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
