"use client";

import { useTransition } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const LABELS = { bn: "বাং", en: "EN" };

/** "বাং | EN" — swaps the locale prefix, keeps the page; next-intl remembers it in pp_locale. */
export function LocaleSwitcher({ className }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className={cn("inline-flex items-center text-xs font-medium", className)} aria-busy={pending || undefined}>
      {Object.entries(LABELS).map(([code, label], i) => (
        <span key={code} className="inline-flex items-center">
          {i > 0 && <span aria-hidden className="mx-1.5 h-3 w-px bg-line-strong/50" />}
          <button
            type="button"
            lang={code}
            aria-pressed={locale === code}
            disabled={pending}
            onClick={() => start(() => router.replace({ pathname, params }, { locale: code }))}
            className={cn(
              "rounded-sm px-1 py-0.5 tracking-wide transition-colors",
              locale === code ? "text-ink" : "text-ink-subtle hover:text-ink",
            )}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
