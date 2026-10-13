import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { robotsMeta } from "@/lib/public/site";

// Every public page inherits the indexing switch (NEXT_PUBLIC_ALLOW_INDEXING).
export const metadata = { robots: robotsMeta };

/** Public website chrome: header · page · footer. */
export default async function SiteLayout({ children }) {
  const t = await getTranslations("site.header");
  return (
    <>
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
    </>
  );
}
