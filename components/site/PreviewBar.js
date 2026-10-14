"use client";

import { useTranslations } from "next-intl";

export function PreviewBar() {
  const t = useTranslations("site.preview");
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-warning bg-warning-bg px-4 py-2 text-center text-sm font-medium text-ink">
      <span>{t("banner")}</span>
      <form action="/api/preview/exit" method="post">
        <button type="submit" className="underline underline-offset-2 hover:no-underline">
          {t("exit")}
        </button>
      </form>
    </div>
  );
}
