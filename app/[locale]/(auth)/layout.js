import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { SmartImage } from "@/components/media/SmartImage";
import { Link } from "@/i18n/navigation";

/** Split screen: form on drafting paper (left), architecture on a diagonal (right, lg+). */
export default async function AuthLayout({ children }) {
  const t = await getTranslations("auth.layout");
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="blueprint flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-[13px] font-semibold tracking-[0.32em]">
            PRIMEPLOT
          </Link>
          <LocaleSwitcher />
        </header>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="text-[11px] text-ink-subtle">{t("footer")}</footer>
      </div>

      <aside className="relative hidden overflow-hidden lg:block" aria-hidden>
        <SmartImage
          category="house"
          seed="auth"
          preload
          sizes="55vw"
          className="absolute inset-0 [clip-path:polygon(14%_0,100%_0,100%_100%,0_100%)]"
        />
        <div className="absolute right-10 bottom-10 max-w-sm rounded-lg border border-line bg-surface/95 p-6 backdrop-blur-sm">
          <span className="eyebrow">{t("eyebrow")}</span>
          <p className="mt-3 font-display text-2xl leading-snug">{t("quote")}</p>
        </div>
      </aside>
    </div>
  );
}
