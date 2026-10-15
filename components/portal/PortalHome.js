"use client";

import { AlertTriangle, ArrowRight, Building2, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format";
import { usePortalBookings, usePortalDues, usePortalMe } from "@/lib/portal/queries";
import { DeedCard, PaperHeading, itemLabel, localName, useDay, useMoney, usePortalError } from "./parts";

/** /portal — "my units": one deed folder per booking, overdue warning on top. */
export function PortalHome() {
  const t = useTranslations("portal.home");
  const tc = useTranslations("common");
  const tb = useTranslations("portal.booking");
  const locale = useLocale();
  const money = useMoney();
  const day = useDay();
  const portalError = usePortalError();
  const { user } = useSession();
  const me = usePortalMe();
  const bookings = usePortalBookings();
  const dues = usePortalDues(30);

  const first = (me.data?.profile && (locale === "bn" && me.data.profile.nameBn ? me.data.profile.nameBn : me.data.profile.name)) || user?.name || "";
  const overdue = dues.data?.totals?.overdue ?? 0;
  const soon = (dues.data?.items ?? []).filter((i) => i.status !== "overdue").slice(0, 3);
  const company = me.data?.company;

  return (
    <div className="space-y-10">
      <header>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="mt-3 font-display text-[2rem] leading-tight sm:text-4xl">{t("welcome", { name: first.split(" ")[0] })}</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-muted">{t("intro")}</p>
      </header>

      {overdue > 0 && (
        <section role="alert" className="flex gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-4">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-danger">{t("overdueTitle", { amount: money(overdue) })}</p>
            <p className="mt-1 text-sm text-ink-muted">{t("overdueBody")}</p>
            <Button as={Link} href="/portal/payments" size="sm" variant="danger" className="mt-3">
              {t("overdueAction")}
            </Button>
          </div>
        </section>
      )}

      <section>
        <PaperHeading title={t("unitsTitle")} />
        {bookings.isError ? (
          <ErrorState title={t("loadFailed")} description={portalError(bookings.error)} requestId={bookings.error?.requestId} requestIdLabel={tc("requestId")} />
        ) : bookings.isPending ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : bookings.data.length === 0 ? (
          <EmptyState icon={Building2} title={t("emptyTitle")} description={t("emptyBody")} className="bg-surface/60" />
        ) : (
          <ul className="grid gap-5 lg:grid-cols-2">
            {bookings.data.map((b) => (
              <li key={b.id}>
                <DeedCard b={b} as={Link} href={`/portal/bookings/${b.id}`} className="group transition-transform duration-200 ease-(--ease-out-quint) hover:-translate-y-0.5">
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-primary-ink/15 pt-4 text-sm">
                    <span className="min-w-0 truncate text-primary-ink/80">
                      {b.status === "cancelled"
                        ? t("viewRecord")
                        : b.totals?.overdue > 0
                          ? tb("overdueLine", { amount: money(b.totals.overdue) })
                          : b.totals?.nextDue
                          ? t("nextDue", { amount: money(b.totals.nextDue.amount), date: day(b.totals.nextDue.dueDate) })
                          : b.totals?.outstanding > 0
                            ? t("noDateDue")
                            : t("allPaid")}
                    </span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-accent-on-dark transition-transform group-hover:translate-x-0.5" />
                  </div>
                </DeedCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {soon.length > 0 && (
        <section>
          <PaperHeading
            title={t("soonTitle")}
            action={
              <Link href="/portal/payments" className="text-xs font-medium text-accent hover:underline">
                {t("seeAll")}
              </Link>
            }
          />
          <ul className="divide-y divide-ink/10 rounded-md border border-line bg-surface">
            {soon.map((i) => (
              <li key={`${i.bookingId}:${i.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{itemLabel(i, locale)}</p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {i.unitCode} · {localName(i.project, locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm tabular-nums">{money(i.remaining ?? i.amount)}</p>
                  <p className="text-[11px] text-ink-muted">{day(i.dueDate)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {company && (company.phone || company.email) && (
        <section className="flex flex-col gap-3 rounded-md border border-dashed border-ink/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{t("helpTitle", { company: localName(company, locale) })}</p>
            <p className="text-xs text-ink-muted">{t("helpBody")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {company.phone && (
              <Button as="a" href={`tel:${company.phone}`} size="sm" variant="secondary">
                <Phone aria-hidden className="size-3.5" />
                <span className="font-mono">{formatPhone(company.phone, locale)}</span>
              </Button>
            )}
            {company.email && (
              <Button as="a" href={`mailto:${company.email}`} size="sm" variant="ghost">
                {company.email}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
