"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, MessageCircle, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { usePathname } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LEADS_ENABLED, telHref, whatsappHref } from "@/lib/public/site";

// BD mobile: 01XXXXXXXXX with an optional +88 / 88 prefix (the API normalizes to E.164).
const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;
const MIN_FILL_MS = 2500; // humans don't finish a form in under 2.5 s
const RETRIES = [800, 2000]; // the API may be waking up (cold start) or briefly unreachable

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (err) => err?.status === 0 || err?.status >= 500 || err?.code === "NETWORK_ERROR";

/**
 * Website enquiry form. Spam: a hidden honeypot field + a minimum fill time (both checked again
 * by the API). Network/5xx errors are retried quietly and the typed values are never lost.
 * Until the Leads module ships (B3) the submit is switched off (`LEADS_ENABLED`) and the form
 * points to phone/WhatsApp instead — owner decision 2026-10-13.
 */
export function LeadForm({ projects = [], defaultProject = "", phone, compact = false }) {
  const t = useTranslations("site.lead");
  const pathname = usePathname();
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now(); // when the form became usable (for the minimum fill time)
  }, []);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const schema = z.object({
    name: z.string().trim().min(2, t("errName")).max(120),
    phone: z
      .string()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(BD_MOBILE, t("errPhone"))),
    email: z.union([z.literal(""), z.email(t("errEmail")).max(254)]),
    project: z.string().max(120),
    message: z.string().trim().max(1000),
    website: z.string().max(0), // honeypot: real people never see or fill it
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", project: defaultProject, message: "", website: "" },
  });

  const onSubmit = async (v) => {
    setFailed(false);
    const elapsedMs = Date.now() - started.current;
    if (elapsedMs < MIN_FILL_MS) await sleep(MIN_FILL_MS - elapsedMs);
    const body = {
      name: v.name,
      phone: v.phone,
      ...(v.email && { email: v.email }),
      ...(v.project && { projectSlug: v.project }),
      ...(v.message && { message: v.message }),
      source: "website",
      page: pathname,
      hp: v.website,
      elapsedMs: Date.now() - started.current,
    };
    for (let attempt = 0; ; attempt++) {
      try {
        await api.post("/public/leads", body);
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

  return (
    <form onSubmit={(e) => handleSubmit(onSubmit)(e)} noValidate className="rounded-lg border border-line bg-surface p-5 sm:p-7">
      {!LEADS_ENABLED && (
        <div className="mb-6 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm">
          <p className="font-medium">{t("offTitle")}</p>
          <p className="mt-1 text-ink-muted">{t("offBody")}</p>
          {phone && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={telHref(phone)} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-ink hover:bg-primary-hover">
                <Phone aria-hidden className="size-3.5" />
                {t("call")}
              </a>
              <a
                href={whatsappHref(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-xs font-medium hover:bg-surface-2"
              >
                <MessageCircle aria-hidden className="size-3.5" />
                {t("whatsapp")}
              </a>
            </div>
          )}
        </div>
      )}

      <fieldset disabled={!LEADS_ENABLED || isSubmitting} className={cn("grid gap-4 disabled:opacity-60", !compact && "sm:grid-cols-2")}>
        <legend className="sr-only">{t("legend")}</legend>
        <Field label={t("name")} error={errors.name?.message} required>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field label={t("phone")} error={errors.phone?.message} hint={t("phoneHint")} required>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
        </Field>
        <Field label={t("email")} error={errors.email?.message} optionalLabel={t("optional")}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </Field>
        {projects.length > 0 && (
          <Field label={t("project")} optionalLabel={t("optional")}>
            <Select {...register("project")}>
              <option value="">{t("anyProject")}</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("message")} optionalLabel={t("optional")} className={cn(!compact && "sm:col-span-2")}>
          <Textarea rows={4} placeholder={t("messagePlaceholder")} {...register("message")} />
        </Field>
        {/* honeypot — off-screen, not focusable, ignored by assistive tech */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" {...register("website")} />
          </label>
        </div>
        <div className={cn("flex flex-wrap items-center justify-between gap-3", !compact && "sm:col-span-2")}>
          <p className="max-w-sm text-xs text-ink-subtle">{t("privacy")}</p>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {t("submit")}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {t("failed")}
          </p>
        )}
      </fieldset>
    </form>
  );
}
