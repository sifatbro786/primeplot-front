"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { STAGES } from "./StageTag";

const FORM_ID = "project-create";

/** Same rule as the API (project.service › slugify) — shown as a preview. */
export function slugify(name = "") {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function CreateForm({ onDone, onBusy }) {
  const t = useTranslations("projects");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const router = useRouter();

  const schema = z.object({
    name: z.string().trim().min(2, tv("min", { n: 2 })).max(160),
    nameBn: z.string().trim().max(160),
    kind: z.enum(["apartment", "plot"]),
    slug: z.union([z.literal(""), z.string().trim().toLowerCase().regex(SLUG_RE, t("errors.slug"))]),
    stage: z.enum(STAGES),
    area: z.string().trim().max(100),
    city: z.string().trim().max(80),
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nameBn: "", kind: "apartment", slug: "", stage: "upcoming", area: "", city: "Dhaka" },
  });
  const [name, slug] = useWatch({ control, name: ["name", "slug"] });
  const autoSlug = slugify(name);

  const onSubmit = async (v) => {
    const finalSlug = v.slug || autoSlug;
    if (!finalSlug) return setError("slug", { message: t("errors.slugRequired") });
    onBusy(true);
    try {
      const p = await api.post("/projects", {
        name: v.name,
        kind: v.kind,
        stage: v.stage,
        slug: finalSlug,
        ...(v.nameBn && { nameBn: v.nameBn }),
        location: { ...(v.area && { area: v.area }), ...(v.city && { city: v.city }) },
      });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("created", { name: p.name }));
      onDone();
      router.push(`/dashboard/projects/${p.id}`);
    } catch (err) {
      if (err?.code === "DUPLICATE") return setError("slug", { message: t("errors.slugTaken") });
      const fe = err?.fieldErrors ?? {};
      if (fe.slug) return setError("slug", { message: t("errors.slugRequired") });
      setError("root", { message: errorMessage(te, err) });
    } finally {
      onBusy(false);
    }
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert>{errors.root?.message}</FormAlert>
      <Field label={t("fields.kind")} hint={t("hints.kind")}>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented
              name="kind"
              aria-label={t("fields.kind")}
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "apartment", label: t("kinds.apartment") },
                { value: "plot", label: t("kinds.plot") },
              ]}
            />
          )}
        />
      </Field>
      <Field label={t("fields.name")} error={errors.name?.message} required>
        <Input autoComplete="off" placeholder="Lake View Residency" {...register("name")} />
      </Field>
      <Field label={t("fields.nameBn")} error={errors.nameBn?.message}>
        <Input autoComplete="off" lang="bn" placeholder="লেক ভিউ রেসিডেন্সি" {...register("nameBn")} />
      </Field>
      <Field
        label={t("fields.slug")}
        error={errors.slug?.message}
        hint={slug ? t("hints.slug") : autoSlug ? t("hints.slugAuto", { slug: autoSlug }) : t("hints.slugNeeded")}
      >
        <Input autoComplete="off" spellCheck={false} placeholder={autoSlug || "lake-view-residency"} className="font-mono text-[13px]" {...register("slug")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("fields.area")}>
          <Input placeholder="Bashundhara R/A" {...register("area")} />
        </Field>
        <Field label={t("fields.city")}>
          <Input {...register("city")} />
        </Field>
      </div>
      <Field label={t("fields.stage")}>
        <Select {...register("stage")}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`stages.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">{t("createNote")}</p>
    </form>
  );
}

export function ProjectCreateDrawer({ open, onClose }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("createTitle")}
      description={t("createDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {t("create")}
          </Button>
        </>
      }
    >
      {open && <CreateForm onDone={onClose} onBusy={setBusy} />}
    </Drawer>
  );
}
