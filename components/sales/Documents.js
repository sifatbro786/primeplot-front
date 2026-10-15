"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Ban, Copy, Download, ExternalLink, FilePlus2, FileText, Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ReasonDialog } from "@/components/review/parts";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link, useRouter } from "@/i18n/navigation";
import { api, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { useSalesError } from "@/lib/sales/errors";
import { salesKeys, useDocument, useDocuments, useSalesRefresh } from "@/lib/sales/queries";
import { useDate, useDay } from "./parts";

const pdfUrl = (id, locale, download) => `/api/v1/documents/${id}/pdf?locale=${locale}${download ? "&download=1" : ""}`;

/** Fetch the PDF as a file (so a 503 PDF_UNAVAILABLE shows a message instead of a JSON page). */
export function useDownloadPdf() {
  const locale = useLocale();
  const salesError = useSalesError();
  const t = useTranslations("sales.documents");
  return async (doc, docLocale) => {
    const loc = docLocale ?? doc.locale;
    try {
      const res = await fetch(pdfUrl(doc.id, loc, true), { credentials: "same-origin" });
      if (!res.ok) throw await toApiError(res);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${doc.number.replace(/[^A-Za-z0-9-]+/g, "_")}-${loc}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      toast.error(err?.code ? salesError(err, locale) : t("pdfFailed"));
    }
  };
}

export function DocStatusTag({ doc }) {
  const t = useTranslations("sales.documents");
  return doc.status === "void" ? <Tag tone="danger">{t("void")}</Tag> : <Tag tone="success">{t("valid")}</Tag>;
}

/**
 * "Void" for a valid paper (admin, `documents:void`): asks why, voids it (the QR check then says
 * cancelled, with the reason) and the API issues a corrected copy from today's records when the
 * paper still applies. `onDone(result)` gets { document, reissued }.
 */
export function VoidDocumentButton({ doc, onDone, size = "sm", variant = "ghost", label = true }) {
  const t = useTranslations("sales.documents");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const { can } = useSession();
  const [open, setOpen] = useState(false);
  if (doc.status !== "valid" || !can("documents:void")) return null;
  const confirm = async (reason) => {
    try {
      const r = await api.post(`/documents/${doc.id}/void`, { reason });
      qc.invalidateQueries({ queryKey: salesKeys.documents(doc.bookingId) });
      qc.setQueryData(salesKeys.document(doc.id), r.document);
      setOpen(false);
      toast.success(r.reissued ? t("voidDoneReissued") : t("voidDone"));
      onDone?.(r);
    } catch (err) {
      throw new Error(salesError(err, locale));
    }
  };
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} aria-label={label ? undefined : t("voidAction")} title={label ? undefined : t("voidAction")}>
        <Ban aria-hidden className="size-3.5" />
        {label && t("voidAction")}
      </Button>
      <ReasonDialog
        open={open}
        title={t("voidTitle", { number: doc.number })}
        description={doc.type === "statement" ? t("voidBodyStatement") : t("voidBody")}
        confirm={t("voidConfirm")}
        hint={t("voidReasonHint")}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
      />
    </>
  );
}

/** Booking › Documents: every issued paper (receipts, letters, statements), newest first. */
export function DocumentsTab({ booking }) {
  const t = useTranslations("sales.documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const day = useDay();
  const router = useRouter();
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const { can } = useSession();
  const docs = useDocuments(booking.id);
  const download = useDownloadPdf();
  const [issuing, setIssuing] = useState(false);

  const statement = async () => {
    setIssuing(true);
    try {
      const { data } = await apiRequest(`/bookings/${booking.id}/statement`, { method: "POST" });
      refresh({ bookingId: booking.id });
      router.push(`/dashboard/documents/${data.id}`);
    } catch (err) {
      toast.error(salesError(err, locale));
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-muted">{t("intro")}</p>
        {can("documents:issue") && (
          <Button size="sm" variant="secondary" loading={issuing} onClick={statement}>
            <FilePlus2 aria-hidden className="size-3.5" />
            {t("statement")}
          </Button>
        )}
      </div>
      {docs.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(docs.error, locale)} requestId={docs.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : docs.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : docs.data.length === 0 ? (
        <EmptyState icon={FileText} title={t("none")} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t("cols.document")}</TH>
              <TH className="hidden sm:table-cell">{t("cols.date")}</TH>
              <TH>{t("cols.status")}</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {docs.data.map((d) => (
              <TR key={d.id} className={d.status === "void" ? "text-ink-muted" : undefined}>
                <TD>
                  <Link href={`/dashboard/documents/${d.id}`} className="text-sm font-medium hover:underline">
                    {t(`types.${d.type}`)}
                  </Link>
                  <span className="block font-mono text-[11px] text-ink-subtle">{d.number}</span>
                </TD>
                <TD className="hidden whitespace-nowrap sm:table-cell">{day(d.date)}</TD>
                <TD>
                  <DocStatusTag doc={d} />
                  {d.voidReason && <span className="mt-1 block max-w-48 truncate text-[11px] text-ink-subtle" title={d.voidReason}>{d.voidReason}</span>}
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <Button as={Link} href={`/dashboard/documents/${d.id}`} size="sm" variant="ghost">
                      {t("open")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => download(d)} aria-label={t("downloadPdf")}>
                      <Download aria-hidden className="size-4" />
                    </Button>
                    <VoidDocumentButton doc={d} label={false} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

/** /dashboard/documents/[id] — the A4 page from the backend (same HTML as the PDF), print & PDF. */
export function DocumentViewer() {
  const { id } = useParams();
  const t = useTranslations("sales.documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const day = useDay();
  const salesError = useSalesError();
  const doc = useDocument(id);
  const date = useDate();
  const router = useRouter();
  const download = useDownloadPdf();
  const frame = useRef(null);
  const [lang, setLang] = useState(null);
  const [height, setHeight] = useState(1123);
  const [loaded, setLoaded] = useState(false);

  if (doc.isError) {
    return doc.error?.status === 404 ? (
      <EmptyState icon={FileText} title={t("notFound")} className="mx-auto max-w-2xl" />
    ) : (
      <ErrorState title={t("loadFailed")} description={salesError(doc.error, locale)} requestId={doc.error?.requestId} requestIdLabel={tc("requestId")} className="mx-auto max-w-2xl" />
    );
  }
  if (doc.isPending) return <Skeleton className="mx-auto h-[40rem] w-full max-w-5xl" />;
  const d = doc.data;
  const loc = lang ?? d.locale;
  const src = `/api/v1/documents/${d.id}/html?locale=${loc}`;

  const fit = () => {
    setLoaded(true);
    try {
      const h = frame.current?.contentDocument?.documentElement?.scrollHeight;
      if (h) setHeight(h + 8);
    } catch {
      // Cross-origin in an unusual setup: keep the default A4 height.
    }
  };
  const print = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      window.open(src, "_blank", "noopener");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.verifyUrl);
      toast.success(t("copied"));
    } catch {
      toast(d.verifyUrl);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {d.bookingId && (
        <Link href={`/dashboard/bookings/${d.bookingId}?tab=documents`} className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />
          {t("backToBooking")}
        </Link>
      )}
      <header className="mt-4 mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">{t(`types.${d.type}`)}</span>
          <h2 className="mt-3 font-mono text-3xl tracking-tight">{d.number}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <DocStatusTag doc={d} />
            <span>{day(d.date)}</span>
            {d.issuedBy?.name && <span>· {t("issuedBy", { name: d.issuedBy.name })}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={loc}
            onChange={(v) => {
              setLoaded(false);
              setLang(v);
            }}
            options={[
              { value: "bn", label: "বাংলা" },
              { value: "en", label: "English" },
            ]}
            aria-label={t("language")}
          />
          <Button size="sm" variant="secondary" onClick={print} disabled={!loaded}>
            <Printer aria-hidden className="size-3.5" />
            {t("print")}
          </Button>
          <Button size="sm" variant="secondary" as="a" href={pdfUrl(d.id, loc)} target="_blank" rel="noopener">
            <ExternalLink aria-hidden className="size-3.5" />
            {t("openPdf")}
          </Button>
          <Button size="sm" onClick={() => download(d, loc)}>
            <Download aria-hidden className="size-3.5" />
            {t("downloadPdf")}
          </Button>
          <VoidDocumentButton doc={d} variant="secondary" onDone={(r) => r.reissued && router.push(`/dashboard/documents/${r.reissued.id}`)} />
        </div>
      </header>

      {d.status === "void" && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
          <p>
            {t("voidNote", { reason: d.voidReason ?? "—" })}
            {d.voidedBy?.name && <span className="text-ink-muted"> {t("voidedBy", { name: d.voidedBy.name, date: date(d.voidedAt) })}</span>}
          </p>
          {d.replacedBy && (
            <Button as={Link} href={`/dashboard/documents/${d.replacedBy}`} size="sm" variant="secondary">
              {t("openReplacement")}
            </Button>
          )}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-xs text-ink-muted">
        <span>{t("verifyLink")}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">{d.verifyUrl}</code>
        <Button size="sm" variant="ghost" onClick={copy}>
          <Copy aria-hidden className="size-3.5" />
          {t("copy")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface-3/60 p-3 sm:p-6">
        {!loaded && <Skeleton className="mx-auto h-[60vh] w-full max-w-[210mm]" />}
        <iframe
          key={src}
          ref={frame}
          src={src}
          title={`${t(`types.${d.type}`)} ${d.number}`}
          onLoad={fit}
          className={loaded ? "mx-auto block w-[210mm] max-w-none bg-white shadow-[0_10px_30px_-18px_rgb(28_29_26_/_0.45)]" : "h-0 w-0"}
          style={loaded ? { height } : undefined}
        />
      </div>
    </div>
  );
}
