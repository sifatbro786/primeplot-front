"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

/** The API was unreachable or answered 5xx while rendering a public page. */
export default function SiteError({ error, retry }) {
  const t = useTranslations("site.error");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="blueprint mx-auto my-16 w-full max-w-3xl rounded-lg border border-line px-6 py-20 text-center">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-4 font-display text-4xl">{t("title")}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">{t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden className="size-4" />
          {t("retry")}
        </Button>
        <Button as={Link} href="/projects" variant="secondary">
          {t("allProjects")}
        </Button>
      </div>
      {error?.digest && <p className="mt-6 font-mono text-[11px] text-ink-subtle">{error.digest}</p>}
    </div>
  );
}
