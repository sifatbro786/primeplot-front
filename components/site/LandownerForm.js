"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Link, usePathname } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { track } from "@/lib/analytics/track";
import { LEADS_ENABLED } from "@/lib/public/site";

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;
const MIN_FILL_MS = 2500;
const RETRIES = [800, 2000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (err) => err?.status === 0 || err?.status >= 500 || err?.code === "NETWORK_ERROR";
const OWNERSHIP = ["sole", "joint", "inherited", "company", "other"];
const MUTATION = ["done", "pending", "not_started", "unknown"];
const decimal = (max) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0 && Number(v) <= max));

/**
 * Landowner / joint-venture enquiry (POST /public/leads, type "landowner"). Same spam defences
 * and quiet retries as the buyer form; it lands in the landowner pipeline in the CRM.
 */
export function LandownerForm() {
  const t = useTranslations("site.landowners.form");
  const tl = useTranslations("site.lead");
  const pathname = usePathname();
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(2, tl("errName")).max(120),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(BD_MOBILE, tl("errPhone"))),
    email: z.union([z.literal(""), z.email(tl("errEmail")).max(254)]),
    location: z.string().trim().min(3, t("errLocation")).max(300),
    areaValue: decimal(1_000_000),
    areaUnit: z.enum(["katha", "decimal"]),
    roadWidthFt: decimal(500),
    ownership: z.string(),
    mutation: z.string(),
    expectedShare: z.string().trim().max(60),
    message: z.string().trim().max(1000),
    website: z.string().max(0),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", location: "", areaValue: "", areaUnit: "katha", roadWidthFt: "", ownership: "", mutation: "", expectedShare: "", message: "", website: "" },
  });

  const onSubmit = async (v) => {
    setFailed(false);
    const elapsed = Date.now() - started.current;
    if (elapsed < MIN_FILL_MS) await sleep(MIN_FILL_MS - elapsed);
    const land = {
      location: v.location,
      ...(v.areaValue && { area: { value: Number(v.areaValue), unit: v.areaUnit } }),
      ...(v.roadWidthFt && { roadWidthFt: Number(v.roadWidthFt) }),
      ...(v.ownership && { ownership: v.ownership }),
      ...(v.mutation && { mutation: v.mutation }),
      ...(v.expectedShare && { expectedShare: v.expectedShare }),
    };
    const body = {
      type: "landowner",
      name: v.name,
      phone: v.phone,
      ...(v.email && { email: v.email }),
      ...(v.message && { message: v.message }),
      land,
      source: "website",
      page: pathname,
      hp: v.website,
      elapsedMs: Date.now() - started.current,
    };
    for (let attempt = 0; ; attempt++) {
      try {
        await api.post("/public/leads", body);
        track("generate_lead", { form: "landowner" });
        setSent(true);
        return;
      } catch (err) {
        if (!retryable(err) || attempt >= RETRIES.length) {
          setFailed(true);
          return;
        }
        await sleep(RETRIES[attempt]);
      }
    }
  };

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-success/30 bg-success-bg px-6 py-10 text-center">
        <CircleCheck aria-hidden className="mx-auto size-7 text-success" strokeWidth={1.5} />
        <p className="mt-3 font-display text-2xl">{t("sentTitle")}</p>
        <p className="mt-2 text-sm text-ink-muted">{t("sentBody")}</p>
      </div>
    );
  }

  const opt = tl("optional");
  return (
    <form onSubmit={(e) => handleSubmit(onSubmit)(e)} noValidate className="relative rounded-lg border border-line bg-surface p-5 sm:p-7">
      {!LEADS_ENABLED && (
        <div className="mb-6 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm">
          <p className="font-medium">{tl("offTitle")}</p>
          <p className="mt-1 text-ink-muted">{tl("offBody")}</p>
        </div>
      )}
      <fieldset disabled={!LEADS_ENABLED || isSubmitting} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
        <legend className="sr-only">{t("legend")}</legend>
        <p className="text-xs font-semibold tracking-wide text-accent uppercase sm:col-span-2">{t("aboutYou")}</p>
        <Field label={tl("name")} error={errors.name?.message} required>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field label={tl("phone")} error={errors.phone?.message} hint={tl("phoneHint")} required>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
        </Field>
        <Field label={tl("email")} error={errors.email?.message} optionalLabel={opt} className="sm:col-span-2">
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>

        <p className="mt-2 border-t border-line pt-5 text-xs font-semibold tracking-wide text-accent uppercase sm:col-span-2">{t("aboutLand")}</p>
        <Field label={t("location")} error={errors.location?.message} hint={t("locationHint")} required className="sm:col-span-2">
          <Input {...register("location")} />
        </Field>
        <Field label={t("area")} error={errors.areaValue && t("errNumber")} optionalLabel={opt}>
          <div className="flex gap-2">
            <Input inputMode="decimal" {...register("areaValue")} />
            <div className="w-28 shrink-0">
              <Select aria-label={t("areaUnit")} {...register("areaUnit")}>
                <option value="katha">{t("katha")}</option>
                <option value="decimal">{t("decimal")}</option>
              </Select>
            </div>
          </div>
        </Field>
        <Field label={t("road")} error={errors.roadWidthFt && t("errNumber")} optionalLabel={opt}>
          <Input inputMode="decimal" trailing={<span className="pr-1 text-xs text-ink-subtle">{t("ft")}</span>} {...register("roadWidthFt")} />
        </Field>
        <Field label={t("ownership")} optionalLabel={opt}>
          <Select {...register("ownership")}>
            <option value="">{t("choose")}</option>
            {OWNERSHIP.map((o) => (
              <option key={o} value={o}>
                {t(`ownershipOptions.${o}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("mutation")} optionalLabel={opt}>
          <Select {...register("mutation")}>
            <option value="">{t("choose")}</option>
            {MUTATION.map((o) => (
              <option key={o} value={o}>
                {t(`mutationOptions.${o}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("share")} hint={t("shareHint")} optionalLabel={opt} className="sm:col-span-2">
          <Input {...register("expectedShare")} />
        </Field>
        <Field label={tl("message")} optionalLabel={opt} className="sm:col-span-2">
          <Textarea rows={3} placeholder={t("messagePlaceholder")} {...register("message")} />
        </Field>
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" {...register("website")} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="max-w-sm text-xs text-ink-subtle">
            {tl.rich("privacy", {
              link: (chunks) => (
                <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {t("submit")}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {tl("failed")}
          </p>
        )}
      </fieldset>
    </form>
  );
}
