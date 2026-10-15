"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FileText, ImageUp, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { discardMedia, uploadMedia, useUploadError } from "@/components/media/upload";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { toast } from "@/components/ui/Toast";
import { MoneyInput } from "@/components/sales/parts";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatBDT, takaToPoisha } from "@/lib/format";
import { usePortalRefresh } from "@/lib/portal/queries";
import { todayDhaka } from "@/lib/sales/money";
import { usePortalError } from "./parts";

const CHANNELS = ["bank_transfer", "cash_deposit", "pay_order"];
const MAX_MB = 10;

/**
 * "I paid at the bank": the company's accounts to pay into, then the slip photo/PDF and the
 * details staff check against the bank statement. The file is uploaded first (private,
 * purpose payment_slip); if the drawer closes without submitting, the upload is discarded.
 */
export function SlipDrawer({ b, me, onClose }) {
  const t = useTranslations("portal.slip");
  const locale = useLocale();
  const portalError = usePortalError();
  const uploadError = useUploadError();
  const refresh = usePortalRefresh();
  const fileInput = useRef(null);
  const banks = me?.bankAccounts ?? [];
  const today = todayDhaka();

  const [channel, setChannel] = useState("bank_transfer");
  const [bankAccountId, setBankAccountId] = useState(banks.length === 1 ? banks[0].id : "");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [payerBank, setPayerBank] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null); // { id, name, preview, pdf }
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const submitted = useRef(false);
  const uploaded = useRef([]);

  // Uploaded but never submitted → delete (the purge job is the backstop). Free object URLs.
  useEffect(
    () => () => {
      if (!submitted.current) discardMedia(uploaded.current);
    },
    [],
  );
  useEffect(() => () => file?.preview && URL.revokeObjectURL(file.preview), [file]);

  const pick = async (f) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) return setErrors((e) => ({ ...e, mediaId: t("tooLarge", { mb: MAX_MB }) }));
    setUploading(true);
    setErrors((e) => ({ ...e, mediaId: undefined }));
    try {
      const m = await uploadMedia(f, { purpose: "payment_slip", visibility: "private" });
      uploaded.current.push(m.id);
      const pdf = m.mime === "application/pdf";
      setFile({ id: m.id, name: f.name, pdf, preview: pdf ? null : URL.createObjectURL(f) });
    } catch (err) {
      setErrors((e) => ({ ...e, mediaId: uploadError(err) }));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast(text);
    }
  };

  const submit = async () => {
    const poisha = takaToPoisha(amount);
    const e = {};
    if (!file) e.mediaId = t("needFile");
    if (!poisha || poisha <= 0) e.amount = t("needAmount");
    if (!paidOn) e.paidOn = t("needDate");
    else if (paidOn > today) e.paidOn = t("futureDate");
    else if (paidOn < b.bookingDate) e.paidOn = t("beforeBooking");
    if (channel !== "pay_order" && !bankAccountId) e.bankAccountId = t("needAccount");
    if (channel === "bank_transfer" && reference.trim().length < 2) e.reference = t("needReference");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.post(`/portal/bookings/${b.id}/slips`, {
        amount: poisha,
        paidOn,
        channel,
        bankAccountId: channel === "pay_order" ? null : bankAccountId,
        reference: reference.trim() || null,
        payerBank: payerBank.trim() || null,
        mediaId: file.id,
        note: note.trim() || null,
      });
      submitted.current = true;
      refresh();
      toast.success(t("sent"));
      onClose();
    } catch (err) {
      setBusy(false);
      const fields = Array.isArray(err?.details) ? Object.fromEntries(err.details.filter((d) => d?.path).map((d) => [String(d.path), d.message])) : {};
      if (err?.code === "SLIP_DATE_FUTURE") fields.paidOn = t("futureDate");
      if (err?.code === "SLIP_BEFORE_BOOKING") fields.paidOn = t("beforeBooking");
      if (err?.code === "INVALID_MEDIA" || err?.code === "SLIP_FILE_REUSED") fields.mediaId = portalError(err);
      if (Object.keys(fields).length) setErrors(fields);
      if (!fields.paidOn && !fields.mediaId) setFormError(portalError(err));
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
          <Button onClick={submit} loading={busy} disabled={uploading}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label={t("channel")}>
          <Segmented
            value={channel}
            onChange={setChannel}
            options={CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
            size="sm"
            className="w-full [&>label]:flex-1"
            aria-label={t("channel")}
          />
        </Field>

        {channel !== "pay_order" && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium">{t("paidInto")}</legend>
            {banks.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("noBanks")}</p>
            ) : (
              <ul className="space-y-2">
                {banks.map((a) => (
                  <li key={a.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-md border px-4 py-3 transition-colors",
                        bankAccountId === a.id ? "border-primary bg-accent-soft" : "border-line-strong/60 hover:border-ink-muted",
                      )}
                    >
                      <input type="radio" name="slip-bank" checked={bankAccountId === a.id} onChange={() => setBankAccountId(a.id)} className="mt-1 size-4 accent-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{a.bankName}</span>
                        <span className="block text-xs text-ink-muted">
                          {a.accountName}
                          {a.branch ? ` · ${a.branch}` : ""}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[13px] tracking-wide">{a.accountNo}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              copy(a.accountNo);
                            }}
                            className="rounded-sm p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
                            aria-label={t("copyAccount")}
                          >
                            <Copy aria-hidden className="size-3.5" />
                          </button>
                        </span>
                        {a.routingNo && <span className="block font-mono text-[11px] text-ink-muted">{t("routing", { no: a.routingNo })}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errors.bankAccountId && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                {errors.bankAccountId}
              </p>
            )}
          </fieldset>
        )}

        <Field label={t("file")} hint={t("fileHint", { mb: MAX_MB })} error={errors.mediaId} required>
          <div>
            {file ? (
              <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2">
                {file.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
                  <img src={file.preview} alt="" className="size-16 rounded-sm object-cover" />
                ) : (
                  <span className="grid size-16 place-items-center rounded-sm bg-surface">
                    <FileText aria-hidden className="size-6 text-ink-muted" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <Button size="sm" variant="ghost" loading={uploading} onClick={() => fileInput.current?.click()}>
                  <RefreshCw aria-hidden className="size-3.5" />
                  {t("replace")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface px-4 py-6 text-sm text-ink-muted hover:border-ink-muted hover:text-ink disabled:opacity-60"
              >
                <ImageUp aria-hidden className="size-6" strokeWidth={1.5} />
                {uploading ? t("uploading") : t("pickFile")}
              </button>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("amount")} error={errors.amount} required>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label={t("paidOn")} error={errors.paidOn} required>
            <Input type="date" value={paidOn} max={today} min={b.bookingDate} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
        </div>
        <Field label={channel === "pay_order" ? t("payOrderNo") : t("reference")} hint={channel === "bank_transfer" ? t("referenceHint") : undefined} error={errors.reference} required={channel === "bank_transfer"} optionalLabel={t("optional")}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} autoComplete="off" className="font-mono" />
        </Field>
        <Field label={t("payerBank")} optionalLabel={t("optional")} error={errors.payerBank}>
          <Input value={payerBank} onChange={(e) => setPayerBank(e.target.value)} maxLength={120} />
        </Field>
        <Field label={t("note")} optionalLabel={t("optional")} error={errors.note}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>

        {formError && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-bg px-3.5 py-3 text-sm text-danger">
            {formError}
          </p>
        )}
        <p className="text-xs leading-relaxed text-ink-muted">{t("after", { amount: formatBDT(b.totals?.outstanding ?? 0, locale) })}</p>
      </div>
    </Drawer>
  );
}
