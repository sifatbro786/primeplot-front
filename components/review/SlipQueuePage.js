"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, FileText, Landmark } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SlipStatusTag } from "@/components/portal/parts";
import { MoneyInput, localName, useDate, useDay, useMoney } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useReviewRefresh, useSlip, useSlipQueue } from "@/lib/review/queries";
import { useBankAccounts } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { ReasonDialog, ViewChips, useReviewError } from "./parts";

const VIEWS = ["pending", "approved", "rejected", "withdrawn", "all"];

/** /dashboard/payment-slips — bank slips clients uploaded, waiting to be matched to the statement. */
export function SlipQueuePage() {
  const t = useTranslations("review.slips");
  const tc = useTranslations("common");
  const tch = useTranslations("portal.slip.channels");
  const money = useMoney();
  const day = useDay();
  const date = useDate();
  const reviewError = useReviewError();
  const [params, write] = useSearchState();
  const view = VIEWS.includes(params.get("view")) ? params.get("view") : "pending";
  const open = params.get("slip");
  const list = useSlipQueue({ status: view === "all" ? undefined : view, bookingId: params.get("bookingId") || undefined });
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <ViewChips views={VIEWS} value={view} onChange={(v) => write({ view: v === "pending" ? null : v })} label={t("viewsLabel")} labelOf={(v) => t(`views.${v}`)} />
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(list.error)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Landmark} title={t(view === "pending" ? "emptyPending" : "empty")} description={view === "pending" ? t("emptyPendingBody") : undefined} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("cols.customer")}</TH>
                <TH className="hidden md:table-cell">{t("cols.paid")}</TH>
                <TH align="right">{t("cols.amount")}</TH>
                <TH className="hidden lg:table-cell">{t("cols.sent")}</TH>
                <TH>{t("cols.status")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id} className="cursor-pointer" onClick={() => write({ slip: s.id })}>
                  <TD>
                    <button type="button" className="text-left text-sm font-medium hover:underline" onClick={(e) => (e.stopPropagation(), write({ slip: s.id }))}>
                      {s.customerName}
                    </button>
                    <span className="block font-mono text-[11px] text-ink-subtle">
                      {s.bookingNo} · {s.unitCode}
                    </span>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <span className="text-sm">{day(s.paidOn)}</span>
                    <span className="block max-w-48 truncate text-[11px] text-ink-subtle">
                      {tch.has(s.channel) ? tch(s.channel) : s.channel}
                      {s.reference ? ` · ${s.reference}` : ""}
                    </span>
                  </TD>
                  <TD numeric>{money(s.amount)}</TD>
                  <TD className="hidden text-xs whitespace-nowrap text-ink-muted lg:table-cell">{date(s.createdAt, "datetime")}</TD>
                  <TD>
                    <SlipStatusTag status={s.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
      {open && <SlipReviewDrawer id={open} onClose={() => write({ slip: null })} />}
    </div>
  );
}

/** One slip: the file next to the details; approve (optionally corrected) or reject. */
export function SlipReviewDrawer({ id, onClose }) {
  const t = useTranslations("review.slips");
  const tc = useTranslations("common");
  const reviewError = useReviewError();
  const slip = useSlip(id);
  return (
    <Drawer open onClose={onClose} title={t("drawerTitle")} description={slip.data ? `${slip.data.customerName} · ${slip.data.bookingNo}` : undefined} width="lg">
      {slip.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(slip.error)} requestId={slip.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : slip.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <SlipReview key={slip.data.id} s={slip.data} onDone={onClose} />
      )}
    </Drawer>
  );
}

function SlipFile({ file }) {
  const t = useTranslations("review.slips");
  if (!file) return <p className="rounded-md border border-dashed border-line-strong px-4 py-10 text-center text-sm text-ink-muted">{t("fileMissing")}</p>;
  const href = file.kind === "image" ? file.urls.full ?? file.urls.card : file.urls.file;
  return (
    <figure className="self-start overflow-hidden rounded-md border border-line bg-surface-2 lg:sticky lg:top-0">
      {file.kind === "image" ? (
        <a href={href} target="_blank" rel="noopener noreferrer" title={t("openFull")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- private file streamed by the API */}
          <img src={file.urls.card ?? href} alt={t("fileAlt")} className="max-h-[70vh] w-full object-contain" />
        </a>
      ) : (
        <iframe src={href} title={t("fileAlt")} className="h-[60vh] w-full bg-white" />
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-ink-muted">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <FileText aria-hidden className="size-3.5 shrink-0" />
          {file.originalName ?? t("fileAlt")}
        </span>
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline">
          <ExternalLink aria-hidden className="size-3" />
          {t("openFull")}
        </a>
      </figcaption>
    </figure>
  );
}

function SlipReview({ s, onDone }) {
  const t = useTranslations("review.slips");
  const tch = useTranslations("portal.slip.channels");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const date = useDate();
  const reviewError = useReviewError();
  const refresh = useReviewRefresh();
  const { can } = useSession();
  const banks = useBankAccounts({ active: "true" }, { enabled: can("payment_slips:verify") });
  const [amount, setAmount] = useState(poishaToTaka(s.amount));
  const [paidOn, setPaidOn] = useState(s.paidOn);
  const [bankAccountId, setBankAccountId] = useState(s.bankAccountId ?? "");
  const [reference, setReference] = useState(s.reference ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState(null);
  const pending = s.status === "pending";
  const verify = pending && can("payment_slips:verify");
  const poisha = takaToPoisha(amount);
  const corrected = poisha !== s.amount || paidOn !== s.paidOn || (bankAccountId || null) !== (s.bankAccountId ?? null) || (reference.trim() || null) !== (s.reference ?? null);

  const approve = async () => {
    if (!poisha || poisha <= 0) return setError(t("needAmount"));
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (poisha !== s.amount) body.amount = poisha;
      if (paidOn !== s.paidOn) body.date = paidOn;
      if ((bankAccountId || null) !== (s.bankAccountId ?? null)) body.bankAccountId = bankAccountId || null;
      if ((reference.trim() || null) !== (s.reference ?? null)) body.reference = reference.trim() || null;
      if (note.trim()) body.note = note.trim();
      await api.post(`/payment-slips/${s.id}/approve`, body);
      refresh("payment-slips");
      toast.success(t("approved"));
      onDone();
    } catch (err) {
      setBusy(false);
      setError(reviewError(err));
    }
  };

  const reject = async (reason) => {
    try {
      await api.post(`/payment-slips/${s.id}/reject`, { reason });
    } catch (err) {
      throw new Error(reviewError(err));
    }
    refresh("payment-slips");
    toast.success(t("rejected"));
    setRejecting(false);
    onDone();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <SlipFile file={s.file} />
      <div className="space-y-5">
        {s.warnings?.length > 0 && (
          <ul className="space-y-2">
            {s.warnings.map((w) => (
              <li key={w.code} className="flex gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5 text-xs">
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>
                  {t(`warnings.${w.code}`, { outstanding: money(s.booking?.outstanding ?? 0) })}
                  {w.slips?.length > 0 && (
                    <span className="mt-1 block space-x-2">
                      {w.slips.map((x) => (
                        <Link key={x.id} href={`/dashboard/payment-slips?view=all&slip=${x.id}`} className="font-mono text-[11px] underline">
                          {x.bookingNo} ({t(`statusShort.${x.status}`)})
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("fields.status")}</dt>
            <dd>
              <SlipStatusTag status={s.status} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("fields.booking")}</dt>
            <dd className="text-right">
              <Link href={`/dashboard/bookings/${s.bookingId}`} className="font-mono text-[13px] hover:underline">
                {s.bookingNo}
              </Link>
              <span className="block text-[11px] text-ink-muted">{t("outstanding", { amount: money(s.booking?.outstanding ?? 0) })}</span>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("fields.channel")}</dt>
            <dd>{tch.has(s.channel) ? tch(s.channel) : s.channel}</dd>
          </div>
          {s.payerBank && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t("fields.payerBank")}</dt>
              <dd className="text-right">{s.payerBank}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("fields.sent")}</dt>
            <dd>{date(s.createdAt, "datetime")}</dd>
          </div>
          {s.note && <p className="rounded-md bg-surface-2 px-3 py-2 text-xs whitespace-pre-line">{s.note}</p>}
        </dl>

        {verify ? (
          <div className="space-y-4 border-t border-line pt-5">
            <p className="text-xs text-ink-muted">{t("checkHint")}</p>
            <Field label={t("fields.amount")} hint={poisha !== s.amount ? t("clientSaid", { value: money(s.amount) }) : undefined}>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label={t("fields.paidOn")} hint={paidOn !== s.paidOn ? t("clientSaid", { value: day(s.paidOn) }) : undefined}>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            {s.channel !== "pay_order" && (
              <Field label={t("fields.account")}>
                <Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                  <option value="">{t("noAccount")}</option>
                  {(banks.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} · {a.accountNo}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t("fields.reference")}>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" maxLength={80} />
            </Field>
            <Field label={t("fields.note")} optionalLabel={t("optional")}>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
            {error && (
              <p role="alert" className="rounded-md border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={approve} loading={busy} className="flex-1">
                {corrected ? t("approveCorrected") : t("approve")}
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
                {t("reject")}
              </Button>
            </div>
            <p className="text-[11px] text-ink-muted">{t("approveNote", { amount: poisha ? money(poisha) : "—" })}</p>
          </div>
        ) : (
          <div className="space-y-2 border-t border-line pt-5 text-sm">
            <p>
              {money(s.amount)} · {day(s.paidOn)}
              {s.reference ? <span className="font-mono text-[12px]"> · {s.reference}</span> : null}
            </p>
            {s.receipt && (
              <p className="text-success">
                {t("receiptMade", { no: s.receipt.receiptNo })}
              </p>
            )}
            {s.rejectReason && <p className="text-danger">{t("rejectedBecause", { reason: s.rejectReason })}</p>}
            {s.review?.byName && <p className="text-xs text-ink-muted">{t("reviewedBy", { name: s.review.byName, date: date(s.review.at, "datetime") })}</p>}
            {pending && !can("payment_slips:verify") && <p className="text-xs text-ink-muted">{t("noVerify")}</p>}
          </div>
        )}
      </div>
      <ReasonDialog
        open={rejecting}
        title={t("rejectTitle")}
        description={t("rejectBody", { name: localName({ name: s.customerName }, locale) })}
        confirm={t("reject")}
        onClose={() => setRejecting(false)}
        onConfirm={reject}
      />
    </div>
  );
}
