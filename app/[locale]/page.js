import { getTranslations } from "next-intl/server";
import SystemStatus from "@/components/dev/SystemStatus";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

// Temporary page — replaced by the public home page in F2.
export default async function Home() {
  const t = await getTranslations("meta");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-24">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Phase 0 · Foundation</span>
        <LocaleSwitcher />
      </div>
      <h1 className="mt-6 font-display text-5xl">{t("title")}</h1>
      <p className="mt-3 text-ink-muted">{t("description")}</p>

      <section className="mt-12">
        <h2 className="mb-3 text-sm font-medium text-ink-muted">System check</h2>
        <SystemStatus />
      </section>

      {process.env.NODE_ENV !== "production" && (
        <Link href="/dev/design" className="mt-10 inline-block text-sm text-accent underline underline-offset-4">
          /dev/design →
        </Link>
      )}
    </main>
  );
}
