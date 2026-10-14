"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/Checkbox";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { BiInput, ImageField } from "./Fields";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://example.com").replace(/\/$/, "");
const SOFT = { title: 60, description: 160 };

const strip = (s) => String(s ?? "").replace(/\*([^*\n]+)\*/g, "$1");
const fill = (s, company) => strip(String(s ?? "").replaceAll("{company}", company || ""));
const norm = (s) => String(s ?? "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
/** Truncate like a results page: by characters, on a word boundary, with an ellipsis. */
const cut = (s, n) => {
  const chars = [...s];
  if (chars.length <= n) return s;
  const head = chars.slice(0, n).join("");
  return `${head.slice(0, Math.max(head.lastIndexOf(" "), n - 12)).trimEnd()} …`;
};

/**
 * Page / project SEO: title, description, focus keyword (BN + EN), share image, noindex — with a
 * search-result preview and simple on-page checks. The focus keyword never reaches the site.
 *
 * Props: value (PageSeo), onChange, path (locale-less), company, fallback { title, description }
 * (what the page uses when empty), heading { en, bn } (main heading text for the keyword check),
 * withImage (projects use a generated share card).
 */
export function SeoFields({ value, onChange, path, company, fallback = {}, heading, withImage = true }) {
  const t = useTranslations("website.seo");
  const locale = useLocale();
  const [lang, setLang] = useState(locale === "en" ? "en" : "bn");
  const set = (k, v) => onChange({ ...value, [k]: v });

  const title = fill(value.title?.[lang], company) || fallback.title?.[lang] || "";
  const description = fill(value.description?.[lang], company) || fallback.description?.[lang] || "";
  const kw = norm(value.focusKeyword?.[lang]);
  const checks = kw
    ? [
        { k: "kwTitle", ok: norm(title).includes(kw) },
        { k: "kwDescription", ok: norm(description).includes(kw) },
        ...(heading ? [{ k: "kwHeading", ok: norm(fill(heading[lang], company)).includes(kw) }] : []),
        { k: "kwUrl", ok: path !== "/" && norm(path.replace(/[-/]/g, " ")).includes(kw), soft: true },
      ]
    : [];
  const lengths = [
    { k: "titleLength", ok: [...title].length >= 20 && [...title].length <= SOFT.title },
    { k: "descriptionLength", ok: [...description].length >= 70 && [...description].length <= SOFT.description },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-6">
        <BiInput label={t("title")} hint={t("titleHint")} max={120} soft={SOFT.title} value={value.title} onChange={(v) => set("title", v)} />
        <BiInput label={t("description")} hint={t("descriptionHint")} kind="ta" max={320} soft={SOFT.description} value={value.description} onChange={(v) => set("description", v)} />
        <BiInput label={t("focusKeyword")} hint={t("focusKeywordHint")} max={60} value={value.focusKeyword} onChange={(v) => set("focusKeyword", v)} />
        {withImage && (
          <ImageField
            label={t("ogImage")}
            hint={t("ogImageHint")}
            media={value.ogImage ?? null}
            onChange={(m) => onChange({ ...value, ogImageMediaId: m?.id ?? null, ogImage: m })}
          />
        )}
        <Checkbox label={t("noindex")} description={t("noindexHint")} checked={Boolean(value.noindex)} onChange={(e) => set("noindex", e.target.checked)} />
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold">{t("preview")}</p>
          <Segmented
            size="sm"
            aria-label={t("previewLanguage")}
            value={lang}
            onChange={setLang}
            options={[
              { value: "bn", label: "বাংলা" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
        {/* A neutral search-result card (not a copy of any search engine's UI). */}
        <div className="rounded-lg border border-line bg-surface p-4" lang={lang}>
          <p className="truncate text-xs text-ink-muted">
            {SITE.replace(/^https?:\/\//, "")} › {lang}
            {path === "/" ? "" : path.replaceAll("/", " › ")}
          </p>
          <p className="mt-1 text-lg leading-snug text-info">{cut(title || t("noTitle"), SOFT.title)}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{cut(description || t("noDescription"), SOFT.description)}</p>
          {value.noindex && <p className="mt-3 text-xs font-semibold text-warning">{t("hiddenFromSearch")}</p>}
        </div>
        <ul className="space-y-1.5 text-sm">
          {[...lengths, ...checks].map((c) => (
            <li key={c.k} className="flex items-start gap-2">
              {c.ok ? (
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <X aria-hidden className={cn("mt-0.5 size-4 shrink-0", c.soft ? "text-ink-subtle" : "text-warning")} />
              )}
              <span className={c.ok ? "" : "text-ink-muted"}>
                <span className="sr-only">{c.ok ? t("passed") : t("notYet")}: </span>
                {t(`checks.${c.k}`)}
              </span>
            </li>
          ))}
          {!kw && <li className="text-xs text-ink-muted">{t("addKeyword")}</li>}
        </ul>
      </aside>
    </div>
  );
}
