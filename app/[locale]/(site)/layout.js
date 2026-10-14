import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteDock } from "@/components/site/SiteDock";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PreviewBanner } from "@/components/site/PreviewBanner";
import { getSiteOrgOrNull, getSiteSeoOrNull } from "@/lib/public/api";
import { robotsFor, titleTemplate } from "@/lib/public/seo";
import { pick } from "@/lib/public/site";

// Every public page inherits the indexing switches (NEXT_PUBLIC_ALLOW_INDEXING + the dashboard's
// site-wide switch) and the title template from Website › SEO ("%s | {company}" by default).
export async function generateMetadata() {
  const [locale, t, org, site] = await Promise.all([getLocale(), getTranslations("site"), getSiteOrgOrNull(), getSiteSeoOrNull()]);
  const name = pick(org, "name", locale) || t("brandFallback");
  const v = site?.settings?.verification ?? {};
  return {
    title: { default: name, template: titleTemplate(site, locale, name) },
    robots: robotsFor({ site }),
    openGraph: { siteName: name, locale: locale === "bn" ? "bn_BD" : "en_US" },
    ...((v.google || v.bing) && {
      verification: { ...(v.google && { google: v.google }), ...(v.bing && { other: { "msvalidate.01": v.bing } }) },
    }),
  };
}

/** Floating WhatsApp button, comparison tray and consent-gated tracking (IDs from Company settings). */
async function Dock() {
  const org = await getSiteOrgOrNull();
  return <SiteDock phone={org?.phone ?? null} ga4Id={org?.analytics?.ga4MeasurementId ?? null} pixelId={org?.analytics?.metaPixelId ?? null} />;
}

/** Public website chrome: header · page · footer · floating dock. */
export default async function SiteLayout({ children }) {
  const t = await getTranslations("site.header");
  return (
    // Warm paper page for the public site; white cards and dark/sage bands carry the colour.
    <div className="site grain flex min-h-full flex-1 flex-col bg-paper">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm text-primary-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("skip")}
      </a>
      <PreviewBanner />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <Dock />
      </Suspense>
    </div>
  );
}
