"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { toApiError } from "@/lib/api/errors";
import { docHtmlUrl, docPdfUrl, usePortalBookingDetails, usePortalBookings } from "@/lib/portal/queries";
import { PaperHeading, localName, useDay, usePortalError } from "./parts";

/** Download a document's PDF as a file (a 503 PDF_UNAVAILABLE becomes a message, not a JSON page). */
export function useDownloadPortalPdf() {
  const t = useTranslations("portal.documents");
  const portalError = usePortalError();
  return async (doc, docLocale) => {
    const loc = docLocale ?? doc.locale;
    try {
      const res = await fetch(docPdfUrl(doc.id, loc, true), { credentials: "same-origin" });
      if (!res.ok) throw await toApiError(res);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${String(doc.number).replace(/[^A-Za-z0-9-]+/g, "_")}-${loc}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch (err) {
      toast.error(err?.code === "PDF_UNAVAILABLE" ? t("pdfUnavailable") : err?.code ? portalError(err) : t("pdfFailed"));
    }
  };
}

export function DocList({ docs, showBooking }) {
  const t = useTranslations("portal.documents");
  const ts = useTranslations("sales.documents.types");
  const day = useDay();
  const download = useDownloadPortalPdf();
  if (!docs.length) return <EmptyState icon={FileText} title={t("none")} description={t("noneBody")} className="bg-surface/60" />;
  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-surface">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-4 py-3">
          <FileText aria-hidden className="size-5 shrink-0 text-accent" strokeWidth={1.5} />
          <Link href={`/portal/documents/${d.id}`} className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium hover:underline">{ts.has(d.type) ? ts(d.type) : d.type}</span>
            <span className="block truncate font-mono text-[11px] text-ink-muted">
              {d.number} · {day(d.date)}
              {showBooking && d.unitCode ? ` · ${d.unitCode}` : ""}
            </span>
          </Link>
          <Button size="sm" variant="ghost" onClick={() => download(d)} aria-label={t("download")}>
            <Download aria-hidden className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Every booking's papers in one place (the API gives them per booking). */
function useAllDocuments() {
  const list = usePortalBookings();
  const details = usePortalBookingDetails(list.data?.map((b) => b.id));
  const pending = list.isPending || details.some((d) => d.isPending);
  const error = list.error ?? details.find((d) => d.error)?.error;
  const groups = details.filter((d) => d.data).map((d) => ({ booking: d.data, docs: d.data.documents.map((x) => ({ ...x, unitCode: d.data.unitCode })) }));
  return { pending, error, groups };
}

/** /portal/documents */
export function PortalDocumentsPage() {
  const t = useTranslations("portal.documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const portalError = usePortalError();
  const { pending, error, groups } = useAllDocuments();
  return (
    <div className="space-y-8">
      <header>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="mt-3 font-display text-[2rem] leading-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-muted">{t("intro")}</p>
      </header>
      {error ? (
        <ErrorState title={t("loadFailed")} description={portalError(error)} requestId={error.requestId} requestIdLabel={tc("requestId")} />
      ) : pending ? (
        <Skeleton className="h-64 w-full" />
      ) : groups.length === 0 ? (
        <EmptyState icon={FileText} title={t("none")} description={t("noneBody")} className="bg-surface/60" />
      ) : (
        groups.map(({ booking, docs }) => (
          <section key={booking.id}>
            <PaperHeading title={`${booking.unitCode} · ${localName(booking.project, locale)}`} action={<span className="font-mono text-[11px] text-ink-muted">{booking.bookingNo}</span>} />
            <DocList docs={docs} />
          </section>
        ))
      )}
    </div>
  );
}

/** /portal/documents/[id] — the A4 page (same HTML as the PDF) with print and PDF. */
export function PortalDocumentViewer() {
  const { id } = useParams();
  const t = useTranslations("portal.documents");
  const ts = useTranslations("sales.documents.types");
  const tc = useTranslations("common");
  const locale = useLocale();
  const day = useDay();
  const portalError = usePortalError();
  const download = useDownloadPortalPdf();
  const { pending, error, groups } = useAllDocuments();
  const frame = useRef(null);
  const [lang, setLang] = useState(null);
  const [height, setHeight] = useState(1123);
  const [loaded, setLoaded] = useState(false);

  if (error) return <ErrorState title={t("loadFailed")} description={portalError(error)} requestId={error.requestId} requestIdLabel={tc("requestId")} />;
  if (pending) return <Skeleton className="h-[40rem] w-full" />;
  const hit = groups.flatMap((g) => g.docs.map((d) => ({ d, b: g.booking }))).find((x) => x.d.id === id);
  if (!hit) {
    return (
      <EmptyState
        icon={FileText}
        title={t("notFound")}
        action={
          <Button as={Link} href="/portal/documents" size="sm" variant="secondary">
            {t("back")}
          </Button>
        }
      />
    );
  }
  const { d, b } = hit;
  const loc = lang ?? d.locale ?? locale;
  const src = docHtmlUrl(d.id, loc);

  const fit = () => {
    setLoaded(true);
    try {
      const h = frame.current?.contentDocument?.documentElement?.scrollHeight;
      if (h) setHeight(h + 8);
    } catch {
      // keep the A4 default
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

  return (
    <div>
      <Link href={`/portal/bookings/${b.id}?tab=documents`} className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("backToUnit", { unit: b.unitCode })}
      </Link>
      <header className="mt-4 mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="eyebrow">{ts.has(d.type) ? ts(d.type) : d.type}</span>
          <h1 className="mt-2 truncate font-mono text-2xl tracking-tight">{d.number}</h1>
          <p className="mt-1 text-sm text-ink-muted">{day(d.date)}</p>
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
          <Button size="sm" variant="secondary" onClick={print} disabled={!loaded} className="hidden sm:inline-flex">
            <Printer aria-hidden className="size-3.5" />
            {t("print")}
          </Button>
          <Button size="sm" onClick={() => download(d, loc)}>
            <Download aria-hidden className="size-3.5" />
            {t("download")}
          </Button>
        </div>
      </header>
      <p className="mb-4 text-xs text-ink-muted">{t("verifyNote")}</p>
      <div className="-mx-4 overflow-x-auto bg-surface-3/60 p-3 sm:mx-0 sm:rounded-md sm:p-6">
        {!loaded && <Skeleton className="mx-auto h-[60vh] w-full max-w-[210mm]" />}
        <iframe
          key={src}
          ref={frame}
          src={src}
          title={`${ts.has(d.type) ? ts(d.type) : d.type} ${d.number}`}
          onLoad={fit}
          className={loaded ? "mx-auto block w-[210mm] max-w-none bg-white shadow-[0_10px_30px_-18px_rgb(28_29_26_/_0.45)]" : "h-0 w-0"}
          style={loaded ? { height } : undefined}
        />
      </div>
    </div>
  );
}
