"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/States";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { areaUnitLabel, formatLand } from "@/lib/format";
import { keys, useProject } from "@/components/inventory/queries";
import { STAGES } from "./StageTag";

export const AMENITIES = [
  "lift",
  "generator",
  "substation",
  "car_parking",
  "rooftop_garden",
  "community_hall",
  "gym",
  "swimming_pool",
  "prayer_room",
  "kids_play_area",
  "cctv",
  "security",
  "fire_safety",
  "intercom",
  "solar",
  "gas_connection",
];
const AUTHORITIES = ["RAJUK", "CDA", "KDA", "RDA", "other"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEXT = ["name", "nameBn", "slug", "tagline", "taglineBn", "description", "descriptionBn"];
const LOC = ["address", "addressBn", "area", "areaBn", "city", "district"];

function Section({ title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[240px_1fr]">
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </header>
      <div className="max-w-2xl space-y-5">{children}</div>
    </section>
  );
}

/** Cover photo: upload → public WebP media; the id is saved with the form. */
function CoverField({ project, mediaId, onChange, disabled }) {
  const t = useTranslations("projects.cover");
  const te = useTranslations("errors");
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const fetched = useQuery({
    queryKey: ["media", mediaId],
    queryFn: () => api.get(`/media/${mediaId}`),
    enabled: Boolean(mediaId) && mediaId !== project.coverMediaId,
    staleTime: Infinity,
  });
  const media = mediaId ? (mediaId === project.coverMediaId ? project.media?.cover : fetched.data) : null;

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "project_image");
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

  return (
    <div className="grid gap-4 sm:grid-cols-[260px_1fr] sm:items-end">
      <SmartImage
        media={media}
        variant="card"
        category={project.kind === "plot" ? "plot-land" : "apartment-exterior"}
        seed={project.id}
        sampleBadge
        sizes="260px"
        className="aspect-[16/10] rounded-md border border-line"
      />
      <div className="space-y-2">
        {!disabled && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={uploading} onClick={() => input.current?.click()}>
              <ImagePlus aria-hidden className="size-3.5" />
              {mediaId ? t("replace") : t("upload")}
            </Button>
            {mediaId && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={t("remove")}>
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-ink-muted">{t("hint")}</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function defaultsOf(p) {
  return {
    ...Object.fromEntries(TEXT.map((k) => [k, p[k] ?? ""])),
    ...Object.fromEntries(LOC.map((k) => [k, p.location?.[k] ?? ""])),
    lat: p.location?.lat == null ? "" : String(p.location.lat),
    lng: p.location?.lng == null ? "" : String(p.location.lng),
    stage: p.stage,
    published: p.published,
    featured: p.featured,
    publicPricing: p.publicPricing,
    landValue: p.landArea ? String(p.landArea.value) : "",
    landUnit: p.landArea?.unit ?? "katha",
    authority: p.approval?.authority ?? "",
    approvalNo: p.approval?.number ?? "",
    handoverAt: p.handoverAt ? new Date(p.handoverAt).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) : "",
    amenities: p.amenities ?? [],
    coverMediaId: p.coverMediaId ?? null,
  };
}

function DetailsForm({ project }) {
  const t = useTranslations("projects");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const ta = useTranslations("projects.amenities");
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useSession();
  const readOnly = !can("projects:write");

  const coord = (min, max) => z.string().refine((s) => s === "" || (/^-?\d+(\.\d+)?$/.test(s) && Number(s) >= min && Number(s) <= max), t("errors.coord"));
  const schema = z
    .object({
      name: z.string().trim().min(2, tv("min", { n: 2 })).max(160),
      nameBn: z.string().trim().max(160),
      slug: z.string().trim().toLowerCase().regex(SLUG_RE, t("errors.slug")),
      tagline: z.string().trim().max(200),
      taglineBn: z.string().trim().max(200),
      description: z.string().trim().max(10_000),
      descriptionBn: z.string().trim().max(10_000),
      ...Object.fromEntries(LOC.map((k) => [k, z.string().trim().max(k.startsWith("address") ? 300 : 100)])),
      lat: coord(-90, 90),
      lng: coord(-180, 180),
      stage: z.enum(STAGES),
      published: z.boolean(),
      featured: z.boolean(),
      publicPricing: z.boolean(),
      landValue: z.string().refine((s) => s === "" || (/^\d+(\.\d{1,4})?$/.test(s) && Number(s) > 0), t("errors.land")),
      landUnit: z.enum(["katha", "decimal"]),
      authority: z.string(),
      approvalNo: z.string().trim().max(80),
      handoverAt: z.string(),
      amenities: z.array(z.string()),
      coverMediaId: z.string().nullable(),
    })
    .refine((v) => (v.lat === "") === (v.lng === ""), { path: ["lng"], message: t("errors.latLng") });

  const defaults = defaultsOf(project);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const [coverMediaId, landValue, landUnit] = useWatch({ control, name: ["coverMediaId", "landValue", "landUnit"] });

  const onSubmit = async (v) => {
    const patch = {};
    for (const k of TEXT) if (dirtyFields[k]) patch[k] = ["name", "slug"].includes(k) ? v[k] : v[k] || null;
    for (const k of ["stage", "published", "featured", "publicPricing", "amenities", "coverMediaId"]) if (dirtyFields[k]) patch[k] = v[k];
    if (LOC.some((k) => dirtyFields[k]) || dirtyFields.lat || dirtyFields.lng) {
      patch.location = Object.fromEntries(LOC.map((k) => [k, v[k] || null]));
      patch.location.lat = v.lat === "" ? null : Number(v.lat);
      patch.location.lng = v.lng === "" ? null : Number(v.lng);
    }
    if (dirtyFields.landValue || dirtyFields.landUnit) patch.landArea = v.landValue ? { value: Number(v.landValue), unit: v.landUnit } : null;
    if (dirtyFields.authority || dirtyFields.approvalNo) {
      patch.approval = v.authority || v.approvalNo ? { authority: v.authority || null, number: v.approvalNo || null } : null;
    }
    if (dirtyFields.handoverAt) patch.handoverAt = v.handoverAt || null;
    try {
      const updated = await api.patch(`/projects/${project.id}`, { version: project.version, ...patch });
      qc.setQueryData(keys.project(project.id), updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      reset(defaultsOf(updated));
      toast.success(t("saved"));
    } catch (err) {
      if (err?.code === "DUPLICATE") return setError("slug", { message: t("errors.slugTaken") });
      if (err?.code === "STALE_VERSION") return setError("root", { message: t("errors.stale") });
      if (err?.code === "INVALID_MEDIA") return setError("root", { message: t("errors.media") });
      setError("root", { message: errorMessage(te, err) });
    }
  };

  const landPreview =
    /^\d+(\.\d{1,4})?$/.test(landValue) && Number(landValue) > 0
      ? formatLand(
          {
            value: Number(landValue),
            unit: landUnit,
            katha: landUnit === "katha" ? Number(landValue) : Math.round(Number(landValue) * 0.605 * 1e4) / 1e4,
            decimal: landUnit === "decimal" ? Number(landValue) : Math.round((Number(landValue) / 0.605) * 1e4) / 1e4,
          },
          locale,
        )
      : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={readOnly} className="min-w-0">
        <FormAlert>{errors.root?.message}</FormAlert>

        <Section title={t("sections.identity")} description={t("sections.identityBody")}>
          <Field label={t("fields.cover")}>
            <CoverField project={project} mediaId={coverMediaId} disabled={readOnly} onChange={(id) => setValue("coverMediaId", id, { shouldDirty: true })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("fields.name")} error={errors.name?.message} required>
              <Input {...register("name")} />
            </Field>
            <Field label={t("fields.nameBn")} error={errors.nameBn?.message}>
              <Input lang="bn" {...register("nameBn")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("fields.slug")} error={errors.slug?.message} hint={t("hints.slugLive")}>
              <Input className="font-mono text-[13px]" spellCheck={false} {...register("slug")} />
            </Field>
            <Field label={t("fields.stage")}>
              <Select {...register("stage")}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {t(`stages.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title={t("sections.story")} description={t("sections.storyBody")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("fields.tagline")} error={errors.tagline?.message}>
              <Input {...register("tagline")} />
            </Field>
            <Field label={t("fields.taglineBn")} error={errors.taglineBn?.message}>
              <Input lang="bn" {...register("taglineBn")} />
            </Field>
          </div>
          <Field label={t("fields.description")} error={errors.description?.message}>
            <Textarea rows={5} {...register("description")} />
          </Field>
          <Field label={t("fields.descriptionBn")} error={errors.descriptionBn?.message}>
            <Textarea rows={5} lang="bn" {...register("descriptionBn")} />
          </Field>
        </Section>

        <Section title={t("sections.location")} description={t("sections.locationBody")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("fields.area")}>
              <Input {...register("area")} />
            </Field>
            <Field label={t("fields.areaBn")}>
              <Input lang="bn" {...register("areaBn")} />
            </Field>
            <Field label={t("fields.city")}>
              <Input {...register("city")} />
            </Field>
            <Field label={t("fields.district")}>
              <Input {...register("district")} />
            </Field>
          </div>
          <Field label={t("fields.address")}>
            <Textarea rows={2} {...register("address")} />
          </Field>
          <Field label={t("fields.addressBn")}>
            <Textarea rows={2} lang="bn" {...register("addressBn")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("fields.lat")} error={errors.lat?.message} hint={t("hints.coords")}>
              <Input inputMode="decimal" className="font-mono text-[13px]" placeholder="23.8103" {...register("lat")} />
            </Field>
            <Field label={t("fields.lng")} error={errors.lng?.message}>
              <Input inputMode="decimal" className="font-mono text-[13px]" placeholder="90.4125" {...register("lng")} />
            </Field>
          </div>
        </Section>

        <Section title={t("sections.land")} description={t("sections.landBody")}>
          <Field label={t("fields.landArea")} error={errors.landValue?.message} hint={landPreview ?? t("hints.land")}>
            <div className="flex gap-2">
              <Input inputMode="decimal" className="flex-1" {...register("landValue")} />
              <Controller
                control={control}
                name="landUnit"
                render={({ field }) => (
                  <Segmented
                    name="projectLandUnit"
                    aria-label={t("fields.landUnit")}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={readOnly}
                    options={[
                      { value: "katha", label: areaUnitLabel("katha", locale) },
                      { value: "decimal", label: areaUnitLabel("decimal", locale) },
                    ]}
                  />
                )}
              />
            </div>
          </Field>
          <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
            <Field label={t("fields.authority")}>
              <Select {...register("authority")}>
                <option value="">—</option>
                {AUTHORITIES.map((a) => (
                  <option key={a} value={a}>
                    {a === "other" ? t("authorityOther") : a}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fields.approvalNo")} error={errors.approvalNo?.message}>
              <Input className="font-mono text-[13px]" {...register("approvalNo")} />
            </Field>
          </div>
          <Field label={t("fields.handoverAt")} className="sm:max-w-60">
            <Input type="date" {...register("handoverAt")} />
          </Field>
        </Section>

        <Section title={t("sections.website")} description={t("sections.websiteBody")}>
          <Checkbox label={t("fields.published")} description={t("hints.published")} {...register("published")} />
          <Checkbox label={t("fields.featured")} description={t("hints.featured")} {...register("featured")} />
          <Checkbox label={t("fields.publicPricing")} description={t("hints.publicPricing")} {...register("publicPricing")} />
          <fieldset>
            <legend className="mb-3 text-xs font-medium">{t("fields.amenities")}</legend>
            <Controller
              control={control}
              name="amenities"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {AMENITIES.map((a) => (
                    <Checkbox
                      key={a}
                      label={ta(a)}
                      checked={field.value.includes(a)}
                      onChange={(e) => field.onChange(e.target.checked ? [...field.value, a] : field.value.filter((x) => x !== a))}
                    />
                  ))}
                </div>
              )}
            />
          </fieldset>
        </Section>
      </fieldset>

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
          {isDirty && <span className="mr-auto text-xs text-ink-muted">{t("unsaved")}</span>}
          <Button variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
            {t("discard")}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {t("save")}
          </Button>
        </div>
      )}
    </form>
  );
}

export function ProjectDetailsForm() {
  const { id } = useParams();
  const { data: project } = useProject(id);
  if (!project) return <Skeleton className="h-96 w-full" />;
  // Remount only when the record itself changes (inventory refetches keep the same version).
  return <DetailsForm key={`${project.id}:${project.version}`} project={project} />;
}
