"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage, ME_KEY } from "@/lib/auth/session";

const ORG_KEY = ["org"];
const TEXT_FIELDS = ["name", "nameBn", "legalName", "email", "phone", "address", "addressBn", "website", "tradeLicenseNo", "rehabMemberNo"];

function Section({ title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr]">
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </header>
      <div className="max-w-2xl space-y-5">{children}</div>
    </section>
  );
}

/** Logo: upload → public media (WebP, metadata stripped) → id saved with the form. */
function LogoField({ mediaId, onChange }) {
  const t = useTranslations("settings.logo");
  const te = useTranslations("errors");
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const media = useQuery({
    queryKey: ["media", mediaId],
    queryFn: () => api.get(`/media/${mediaId}`),
    enabled: Boolean(mediaId),
    staleTime: Infinity,
  });

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "logo");
    form.append("visibility", "public");
    setUploading(true);
    try {
      const m = await api.upload("/media", form);
      onChange(m.id);
    } catch (err) {
      const code = err?.code;
      toast.error(["UNSUPPORTED_MEDIA_TYPE", "FILE_TOO_LARGE", "INVALID_IMAGE"].includes(code) ? t(`errors.${code}`) : errorMessage(te, err));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const src = media.data?.urls?.card ?? media.data?.urls?.thumb;
  return (
    <div className="flex items-center gap-5">
      <div className="blueprint grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- already-optimised WebP from our media API */}
        {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain p-2" /> : <ImagePlus aria-hidden className="size-6 text-ink-subtle" strokeWidth={1.4} />}
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={uploading} onClick={() => input.current?.click()}>
            {mediaId ? t("replace") : t("upload")}
          </Button>
          {mediaId && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={t("remove")}>
              <Trash2 aria-hidden className="size-3.5" />
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-muted">{t("hint")}</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function OrgForm({ org }) {
  const t = useTranslations("settings");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1))),
  );

  const opt = (max) => z.string().trim().max(max);
  const schema = z.object({
    name: z.string().trim().min(2, tv("min", { n: 2 })).max(160),
    nameBn: opt(160),
    legalName: opt(200),
    email: z.union([z.literal(""), z.string().trim().pipe(z.email(tv("email")))]),
    phone: opt(20),
    address: opt(500),
    addressBn: opt(500),
    website: z.union([z.literal(""), z.string().trim().pipe(z.url({ protocol: /^https?$/, error: t("errors.website") }))]),
    tradeLicenseNo: opt(60),
    rehabMemberNo: opt(60),
    logoMediaId: z.string().nullable(),
    defaultLocale: z.enum(["bn", "en"]),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  });

  const defaults = {
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, org[k] ?? ""])),
    logoMediaId: org.logoMediaId ?? null,
    defaultLocale: org.settings?.defaultLocale ?? "bn",
    fiscalYearStartMonth: org.settings?.fiscalYearStartMonth ?? 7,
  };

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });

  const onSubmit = async (v) => {
    const patch = {};
    for (const k of TEXT_FIELDS) if (dirtyFields[k]) patch[k] = k === "name" ? v[k] : v[k] || null;
    if (dirtyFields.logoMediaId) patch.logoMediaId = v.logoMediaId;
    const settings = {};
    if (dirtyFields.defaultLocale) settings.defaultLocale = v.defaultLocale;
    if (dirtyFields.fiscalYearStartMonth) settings.fiscalYearStartMonth = v.fiscalYearStartMonth;
    if (Object.keys(settings).length) patch.settings = settings;
    try {
      const updated = await api.patch("/org", patch);
      qc.setQueryData(ORG_KEY, (old) => ({ ...old, ...updated }));
      qc.invalidateQueries({ queryKey: ME_KEY });
      reset({
        ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, updated[k] ?? ""])),
        logoMediaId: updated.logoMediaId ?? null,
        defaultLocale: updated.settings?.defaultLocale ?? "bn",
        fiscalYearStartMonth: updated.settings?.fiscalYearStartMonth ?? 7,
      });
      toast.success(t("saved"));
    } catch (err) {
      if (err?.code === "INVALID_PHONE") return setError("phone", { message: t("errors.phone") });
      if (err?.code === "VALIDATION_ERROR" && Object.keys(err.fieldErrors).length) {
        for (const [path, message] of Object.entries(err.fieldErrors)) setError(path.split(".").at(-1), { message });
        return;
      }
      setError("root", { message: errorMessage(te, err) });
    }
  };

  const logoMediaId = useWatch({ control, name: "logoMediaId" });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormAlert>{errors.root?.message}</FormAlert>

      <Section title={t("identity.title")} description={t("identity.description")}>
        <Field label={t("logo.label")}>
          <LogoField mediaId={logoMediaId} onChange={(id) => setValue("logoMediaId", id, { shouldDirty: true })} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.name")} error={errors.name?.message} required>
            <Input {...register("name")} />
          </Field>
          <Field label={t("fields.nameBn")} error={errors.nameBn?.message}>
            <Input lang="bn" {...register("nameBn")} />
          </Field>
        </div>
        <Field label={t("fields.legalName")} hint={t("hints.legalName")} error={errors.legalName?.message}>
          <Input {...register("legalName")} />
        </Field>
      </Section>

      <Section title={t("contact.title")} description={t("contact.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.phone")} error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
          </Field>
          <Field label={t("fields.email")} error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
        </div>
        <Field label={t("fields.website")} error={errors.website?.message}>
          <Input type="url" placeholder="https://" {...register("website")} />
        </Field>
        <Field label={t("fields.address")} error={errors.address?.message}>
          <Textarea rows={2} {...register("address")} />
        </Field>
        <Field label={t("fields.addressBn")} error={errors.addressBn?.message}>
          <Textarea rows={2} lang="bn" {...register("addressBn")} />
        </Field>
      </Section>

      <Section title={t("legal.title")} description={t("legal.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.tradeLicenseNo")} error={errors.tradeLicenseNo?.message}>
            <Input className="font-mono" {...register("tradeLicenseNo")} />
          </Field>
          <Field label={t("fields.rehabMemberNo")} error={errors.rehabMemberNo?.message}>
            <Input className="font-mono" {...register("rehabMemberNo")} />
          </Field>
        </div>
      </Section>

      <Section title={t("preferences.title")} description={t("preferences.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.defaultLocale")} hint={t("hints.defaultLocale")}>
            <Select {...register("defaultLocale")}>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label={t("fields.fiscalYearStartMonth")} hint={t("hints.fiscalYear")}>
            <Select {...register("fiscalYearStartMonth")}>
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
        {isDirty && <span className="mr-auto text-xs text-ink-muted">{t("unsaved")}</span>}
        <Button variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
          {t("discard")}
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const org = useQuery({ queryKey: ORG_KEY, queryFn: () => api.get("/org") });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {org.isError ? (
        <ErrorState title={t("loadFailed")} description={errorMessage(te, org.error)} requestId={org.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : org.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <OrgForm key={org.dataUpdatedAt} org={org.data} />
      )}
    </div>
  );
}
