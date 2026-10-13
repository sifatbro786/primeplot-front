"use client";

import { useTranslations } from "next-intl";
import { openConsent } from "@/lib/analytics/consent";

/** Footer link that re-opens the cookie banner (rendered only when tracking IDs are set). */
export function CookieSettingsButton({ className }) {
  const t = useTranslations("site.legal.consent");
  return (
    <button type="button" onClick={openConsent} className={className}>
      {t("settings")}
    </button>
  );
}
