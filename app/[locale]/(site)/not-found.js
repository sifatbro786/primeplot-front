import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export default async function SiteNotFound() {
  const t = await getTranslations("site.notFound");
  return (
    <div className="blueprint mx-auto my-16 w-full max-w-3xl rounded-lg border border-line px-6 py-20 text-center">
      <p className="eyebrow font-mono">404</p>
      <h1 className="mt-4 font-display text-4xl">{t("title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">{t("body")}</p>
      <Button as={Link} href="/projects" className="mt-8">
        {t("cta")}
      </Button>
    </div>
  );
}
