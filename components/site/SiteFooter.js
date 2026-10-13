import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { Mail, MapPin, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPhone, localizeDigits } from "@/lib/format";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { pick, telHref } from "@/lib/public/site";
import { Brand } from "./Brand";
import { CookieSettingsButton } from "./CookieSettingsButton";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

async function FooterBody() {
  const [org, locale, t, year] = await Promise.all([
    getSiteOrgOrNull(),
    getLocale(),
    getTranslations("site"),
    currentYear(),
  ]);
  const name = pick(org, "name", locale) || t("brandFallback");
  const address = pick(org, "address", locale);
  const hasTracking = Boolean(org?.analytics?.ga4MeasurementId || org?.analytics?.metaPixelId);
  const licences = [
    org?.tradeLicenseNo && t("footer.tradeLicense", { no: org.tradeLicenseNo }),
    org?.rehabMemberNo && t("footer.rehab", { no: org.rehabMemberNo }),
  ].filter(Boolean);

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1.2fr] lg:px-8">
        <div>
          <Brand org={org} locale={locale} fallback={t("brandFallback")} inverted />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-primary-ink/70">{t("footer.about")}</p>
          {licences.length > 0 && (
            <ul className="mt-6 space-y-1 font-mono text-[11px] tracking-wide text-primary-ink/60">
              {licences.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label={t("footer.explore")}>
          <h2 className="text-[11px] font-semibold caps text-accent-on-dark ">{t("footer.explore")}</h2>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <Link href="/projects" className="text-primary-ink/85 hover:text-primary-ink hover:underline">
                {t("nav.projects")}
              </Link>
            </li>
            <li>
              <Link href="/projects?type=apartment" className="text-primary-ink/85 hover:text-primary-ink hover:underline">
                {t("nav.apartments")}
              </Link>
            </li>
            <li>
              <Link href="/projects?type=plot" className="text-primary-ink/85 hover:text-primary-ink hover:underline">
                {t("nav.plots")}
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-primary-ink/85 hover:text-primary-ink hover:underline">
                {t("nav.about")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-primary-ink/85 hover:text-primary-ink hover:underline">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </nav>

        <div id="contact" className="scroll-mt-24">
          <h2 className="text-[11px] font-semibold caps text-accent-on-dark ">{t("footer.contact")}</h2>
          <ul className="mt-5 space-y-4 text-sm text-primary-ink/85">
            {org?.phone && (
              <li className="flex gap-3">
                <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-on-dark" strokeWidth={1.5} />
                <a href={telHref(org.phone)} className="font-mono hover:underline">
                  {formatPhone(org.phone, locale)}
                </a>
              </li>
            )}
            {org?.email && (
              <li className="flex gap-3">
                <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-on-dark" strokeWidth={1.5} />
                <a href={`mailto:${org.email}`} className="break-all hover:underline">
                  {org.email}
                </a>
              </li>
            )}
            {address && (
              <li className="flex gap-3">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-on-dark" strokeWidth={1.5} />
                <span className="leading-relaxed">{address}</span>
              </li>
            )}
            {!org?.phone && !org?.email && !address && <li className="text-primary-ink/60">{t("footer.contactSoon")}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-ink/10">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-24 text-[11px] text-primary-ink/55 sm:px-6 lg:px-8">
          {/* pb-24: room for the floating WhatsApp button so it never covers these links */}
          <p>{t("footer.rights", { year: localizeDigits(year, locale), name })}</p>
          <nav aria-label={t("footer.legal")}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <li>
                <Link href="/privacy" className="hover:text-primary-ink hover:underline">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary-ink hover:underline">
                  {t("footer.terms")}
                </Link>
              </li>
              {hasTracking && (
                <li>
                  <CookieSettingsButton className="hover:text-primary-ink hover:underline" />
                </li>
              )}
              <li>
                <Link href="/login" className="hover:text-primary-ink hover:underline">
                  {t("footer.staffLogin")}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-primary text-primary-ink">
      <Suspense fallback={<div className="h-80" />}>
        <FooterBody />
      </Suspense>
    </footer>
  );
}
