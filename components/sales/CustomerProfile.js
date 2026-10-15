"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, Plus, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { useBookings, useCustomer } from "@/lib/sales/queries";
import { PortalAccessCard } from "@/components/review/PortalAccessCard";
import { CustomerDrawer } from "./CustomerDrawer";
import { CustomerPhoto, FileList } from "./PrivateFiles";
import { Fact, StageTag, localName, useDay, useMoney } from "./parts";

/** /dashboard/customers/[id] — profile, papers and every booking of this customer. */
export function CustomerProfile() {
  const { id } = useParams();
  const t = useTranslations("sales.customers");
  const tb = useTranslations("sales.bookings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const money = useMoney();
  const day = useDay();
  const salesError = useSalesError();
  const { can } = useSession();
  const [editing, setEditing] = useState(false);
  const customer = useCustomer(id);
  const bookings = useBookings({ customerId: id, limit: 50 }, { enabled: Boolean(customer.data) });

  if (customer.isError) {
    return customer.error?.status === 404 ? (
      <EmptyState icon={UserRound} title={t("notFound")} className="mx-auto max-w-2xl" action={<Button as={Link} href="/dashboard/customers" size="sm" variant="secondary">{t("back")}</Button>} />
    ) : (
      <ErrorState title={t("loadFailed")} description={salesError(customer.error, locale)} requestId={customer.error?.requestId} requestIdLabel={tc("requestId")} className="mx-auto max-w-2xl" />
    );
  }
  if (customer.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-6xl" />;
  const c = customer.data;
  const rows = bookings.data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>

      <header className="mt-4 mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5">
          <CustomerPhoto mediaId={c.photoMediaId} className="size-20" />
          <div className="min-w-0">
            <span className="eyebrow">{c.customerNo}</span>
            <h2 className="mt-2 font-display text-4xl leading-tight">{localName(c, locale)}</h2>
            {c.nameBn && locale !== "bn" && <p className="mt-1 text-sm text-ink-muted" lang="bn">{c.nameBn}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {can("bookings:create") && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="size-4" />
              {t("edit")}
            </Button>
          )}
          {can("bookings:create") && (
            <Button as={Link} href={`/dashboard/bookings/new?customerId=${c.id}`}>
              <Plus aria-hidden className="size-4" />
              {tb("new")}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section>
            <h3 className="mb-4 text-sm font-semibold">{t("sections.contact")}</h3>
            <dl className="grid gap-5 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2">
              <Fact label={t("fields.phone")} mono>
                <a href={`tel:${c.phone}`} className="hover:underline">{formatPhone(c.phone, locale)}</a>
              </Fact>
              <Fact label={t("fields.altPhone")} mono>{c.altPhone && formatPhone(c.altPhone, locale)}</Fact>
              <Fact label={t("fields.email")}>{c.email}</Fact>
              <Fact label={t("fields.locale")}>{c.locale ? (c.locale === "bn" ? "বাংলা" : "English") : t("localeDefault")}</Fact>
              <Fact label={t("fields.presentAddress")} className="sm:col-span-2">{c.presentAddress}</Fact>
              <Fact label={t("fields.permanentAddress")} className="sm:col-span-2">{c.permanentAddress}</Fact>
              {c.foreignAddress && <Fact label={t("fields.foreignAddress")} className="sm:col-span-2">{c.foreignAddress}</Fact>}
            </dl>
          </section>

          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{t("bookingsTitle")}</h3>
            </div>
            {bookings.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong/60 px-5 py-8 text-center text-sm text-ink-muted">{t("noBookings")}</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>{tb("cols.booking")}</TH>
                    <TH>{tb("cols.unit")}</TH>
                    <TH align="right">{tb("cols.outstanding")}</TH>
                    <TH>{tb("cols.stage")}</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((b) => (
                    <TR key={b.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/bookings/${b.id}`)}>
                      <TD>
                        <span className="font-mono text-[13px]">{b.bookingNo}</span>
                        <span className="block text-[11px] text-ink-subtle">{day(b.bookingDate)}</span>
                      </TD>
                      <TD>
                        <span className="font-mono text-[13px]">{b.unitCode}</span>
                        <span className="block truncate text-[11px] text-ink-subtle">{localName(b.project, locale)}</span>
                      </TD>
                      <TD numeric>{money(b.totals?.outstanding)}</TD>
                      <TD>
                        <StageTag stage={b.stage} status={b.status} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <PortalAccessCard customerId={c.id} />
          <section>
            <h3 className="mb-4 text-sm font-semibold">{t("sections.identity")}</h3>
            <dl className="space-y-4 rounded-lg border border-line bg-surface p-5">
              <Fact label={t("fields.fatherName")}>{c.fatherName}</Fact>
              <Fact label={t("fields.motherName")}>{c.motherName}</Fact>
              {c.spouseName && <Fact label={t("fields.spouseName")}>{c.spouseName}</Fact>}
              <Fact label={t("fields.dateOfBirth")}>{c.dateOfBirth && day(c.dateOfBirth)}</Fact>
              <Fact label={t("fields.nid")} mono>{c.nid}</Fact>
              {c.passportNo && <Fact label={t("fields.passportNo")} mono>{c.passportNo}</Fact>}
              {c.tin && <Fact label={t("fields.tin")} mono>{c.tin}</Fact>}
              <Fact label={t("fields.nationality")}>{c.nationality}</Fact>
              <Fact label={t("fields.occupation")}>{[c.occupation, c.organization].filter(Boolean).join(" · ") || null}</Fact>
            </dl>
          </section>
          <section>
            <h3 className="mb-4 text-sm font-semibold">{t("sections.papers")}</h3>
            {c.documentMediaIds.length ? <FileList ids={c.documentMediaIds} /> : <p className="text-sm text-ink-muted">{t("noPapers")}</p>}
            {c.notes && <p className="mt-4 rounded-md bg-surface-2 px-4 py-3 text-sm whitespace-pre-line text-ink-muted">{c.notes}</p>}
          </section>
        </aside>
      </div>

      <CustomerDrawer open={editing} customer={c} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
    </div>
  );
}
