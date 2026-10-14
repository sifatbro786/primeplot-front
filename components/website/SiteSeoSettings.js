"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { siteKeys, useSiteSettings } from "@/lib/site/queries";
import { isHttps } from "@/lib/site/schema";
import { BiInput, ImageField } from "./Fields";

const SOCIAL = ["facebook", "instagram", "youtube", "linkedin", "tiktok", "x"];
const extractToken = (v) => /content\s*=\s*["']([^"']*)["']/i.exec(v)?.[1]?.trim() ?? v.trim();

/** Website › SEO: title template, defaults, verification, social profiles, indexing (live on save). */
export function SiteSeoSettings() {
  const t = useTranslations("website");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const q = useSiteSettings();
  if (q.isPending) return <Skeleton className="mx-auto h-[32rem] w-full max-w-4xl" />;
  if (q.isError) return <ErrorState title={t("loadFailed")} description={errorMessage(te, q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />;
  return <Form key={q.data.version} settings={q.data} />;
}

function Form({ settings }) {
  const t = useTranslations("website.siteSeo");
  const tw = useTranslations("website");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const { org } = useSession();
  const [v, setV] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const company = (locale === "bn" && org?.nameBn) || org?.name || "";

  const templateOk = (s) => !s || s.includes("%s");
  const socialOk = SOCIAL.every((n) => isHttps(v.social[n] ?? ""));
  const valid = templateOk(v.titleTemplate.en) && templateOk(v.titleTemplate.bn) && socialOk;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        version: settings.version,
        titleTemplate: v.titleTemplate,
        defaultDescription: v.defaultDescription,
        defaultOgImageMediaId: v.defaultOgImageMediaId,
        verification: { google: extractToken(v.verification.google), bing: extractToken(v.verification.bing) },
        social: Object.fromEntries(SOCIAL.map((n) => [n, v.social[n] || null])),
        indexing: v.indexing,
      };
      qc.setQueryData(siteKeys.settings, await api.patch("/site/settings", body));
      toast.success(tw("saved"));
    } catch (err) {
      setError(err?.code === "STALE_VERSION" ? tw("stale") : errorMessage(te, err));
    } finally {
      setSaving(false);
    }
  };

  const example = (lang) => (v.titleTemplate[lang] || "%s | {company}").replace("%s", t("examplePage")).replaceAll("{company}", company);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/website" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {tw("back")}
      </Link>
      <header className="mt-4 mb-8">
        <p className="eyebrow">{tw("eyebrow")}</p>
        <h2 className="mt-3 font-display text-4xl leading-tight">{t("title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t("description")}</p>
      </header>
      {error && <FormAlert>{error}</FormAlert>}

      <div className="space-y-10">
        <section className="space-y-5">
          <h3 className="text-sm font-semibold">{t("titlesHeading")}</h3>
          <BiInput label={t("titleTemplate")} hint={t("titleTemplateHint")} max={120} value={v.titleTemplate} onChange={(x) => setV({ ...v, titleTemplate: x })} />
          {(!templateOk(v.titleTemplate.en) || !templateOk(v.titleTemplate.bn)) && <p className="text-xs font-medium text-danger">{t("templateNeedsS")}</p>}
          <p className="text-xs text-ink-muted">
            {t("example")}: <span className="font-medium text-ink">{example("bn")}</span> · <span className="font-medium text-ink">{example("en")}</span>
          </p>
          <BiInput label={t("defaultDescription")} hint={t("defaultDescriptionHint")} kind="ta" max={320} soft={160} value={v.defaultDescription} onChange={(x) => setV({ ...v, defaultDescription: x })} />
          <ImageField
            label={t("defaultOgImage")}
            hint={t("defaultOgImageHint")}
            media={v.defaultOgImage}
            onChange={(m) => setV({ ...v, defaultOgImageMediaId: m?.id ?? null, defaultOgImage: m })}
          />
        </section>

        <section className="space-y-5 border-t border-line pt-8">
          <h3 className="text-sm font-semibold">{t("verificationHeading")}</h3>
          <p className="-mt-3 text-xs text-ink-muted">{t("verificationBody")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Google Search Console" hint={t("pasteTag")}>
              <Input value={v.verification.google} spellCheck={false} onChange={(e) => setV({ ...v, verification: { ...v.verification, google: e.target.value } })} />
            </Field>
            <Field label="Bing Webmaster Tools" hint={t("pasteTag")}>
              <Input value={v.verification.bing} spellCheck={false} onChange={(e) => setV({ ...v, verification: { ...v.verification, bing: e.target.value } })} />
            </Field>
          </div>
        </section>

        <section className="space-y-5 border-t border-line pt-8">
          <h3 className="text-sm font-semibold">{t("socialHeading")}</h3>
          <p className="-mt-3 text-xs text-ink-muted">{t("socialBody")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {SOCIAL.map((n) => (
              <Field key={n} label={t(`social.${n}`)} error={isHttps(v.social[n] ?? "") ? undefined : tw("invalid_url")}>
                <Input value={v.social[n] ?? ""} inputMode="url" spellCheck={false} placeholder="https://" onChange={(e) => setV({ ...v, social: { ...v.social, [n]: e.target.value.trim() } })} />
              </Field>
            ))}
          </div>
        </section>

        <section className="space-y-3 border-t border-line pt-8">
          <h3 className="text-sm font-semibold">{t("indexingHeading")}</h3>
          <Checkbox label={t("indexing")} description={t("indexingHint")} checked={v.indexing} onChange={(e) => setV({ ...v, indexing: e.target.checked })} />
          {!v.indexing && <p className="rounded-md bg-warning-bg px-3 py-2 text-xs font-medium text-warning">{t("indexingOff")}</p>}
        </section>
      </div>

      <div className="sticky bottom-0 mt-10 flex justify-end gap-2 border-t border-line bg-canvas py-4">
        <Button loading={saving} disabled={!valid} onClick={save}>
          {tw("save")}
        </Button>
      </div>
    </div>
  );
}
