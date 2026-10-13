import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { pick, robotsMeta } from "@/lib/public/site";

// Every public page inherits the indexing switch (NEXT_PUBLIC_ALLOW_INDEXING) and is titled
// "<page> · <developer's name>" (not the product name).
export async function generateMetadata() {
  const [locale, t, org] = await Promise.all([getLocale(), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || t("brandFallback");
  return {
    title: { default: name, template: `%s · ${name}` },
    robots: robotsMeta,
    openGraph: { siteName: name, locale: locale === "bn" ? "bn_BD" : "en_US" },
  };
}

/** Public website chrome: header · page · footer. */
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
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
