"use client";

import { useWatch } from "react-hook-form";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LAND_OWNERSHIP, MANUAL_SOURCES, LEAD_SOURCES, MUTATION_STATUS } from "@/lib/crm/constants";
import { useProjectOptions } from "@/lib/crm/queries";
import { poishaToTaka, takaToPoisha } from "@/lib/format";

const PHONE = /^[+০-৯0-9][০-৯0-9\s\-().]{5,28}$/;
const TAG = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,29}$/u;

/** Form schema for manual entry and edits (the API re-checks everything). */
export function leadSchema(tv) {
  const money = z
    .string()
    .trim()
    .refine((v) => v === "" || takaToPoisha(v) !== null, tv("money"));
  const num = (max) =>
    z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= max), tv("number"));
  return z
    .object({
      type: z.enum(["buyer", "landowner"]),
      name: z.string().trim().min(2, tv("min", { n: 2 })).max(120),
      phone: z.string().trim().regex(PHONE, tv("phone")),
      altPhone: z.string().trim().refine((v) => v === "" || PHONE.test(v), tv("phone")),
      email: z.union([z.literal(""), z.string().trim().pipe(z.email(tv("email")).max(254))]),
      source: z.enum(LEAD_SOURCES),
      referrer: z.string().trim().max(200),
      projectId: z.string(),
      bedrooms: num(20),
      budgetMin: money,
      budgetMax: money,
      landLocation: z.string().trim().max(300),
      landValue: num(1_000_000),
      landUnit: z.enum(["katha", "decimal"]),
      roadWidthFt: num(500),
      ownership: z.string(),
      mutation: z.string(),
      expectedShare: z.string().trim().max(60),
      message: z.string().trim().max(2000),
      tags: z
        .string()
        .refine((v) => splitTags(v).length <= 20 && splitTags(v).every((x) => TAG.test(x)), tv("tags")),
      assignee: z.string(),
    })
    .refine((v) => {
      const a = takaToPoisha(v.budgetMin);
      const b = takaToPoisha(v.budgetMax);
      return a == null || b == null || a <= b;
    }, { path: ["budgetMax"], message: tv("budgetOrder") });
}

export const splitTags = (v) =>
  [...new Set(String(v ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))];

const orNull = (v) => (v === "" || v == null ? null : v);
const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

export const EMPTY_LEAD = {
  type: "buyer",
  name: "",
  phone: "",
  altPhone: "",
  email: "",
  source: "manual",
  referrer: "",
  projectId: "",
  bedrooms: "",
  budgetMin: "",
  budgetMax: "",
  landLocation: "",
  landValue: "",
  landUnit: "katha",
  roadWidthFt: "",
  ownership: "",
  mutation: "",
  expectedShare: "",
  message: "",
  tags: "",
  assignee: "auto",
};

/** A lead from the API → form values. */
export function leadToValues(l) {
  return {
    ...EMPTY_LEAD,
    type: l.type,
    name: l.name,
    phone: l.phone,
    altPhone: l.altPhone ?? "",
    email: l.email ?? "",
    source: l.source,
    referrer: l.sourceDetail?.referrer ?? "",
    projectId: l.interest?.projectId ?? "",
    bedrooms: l.interest?.bedrooms != null ? String(l.interest.bedrooms) : "",
    budgetMin: poishaToTaka(l.interest?.budgetMin),
    budgetMax: poishaToTaka(l.interest?.budgetMax),
    landLocation: l.land?.location ?? "",
    landValue: l.land?.area?.value != null ? String(l.land.area.value) : "",
    landUnit: l.land?.area?.unit ?? "katha",
    roadWidthFt: l.land?.roadWidthFt != null ? String(l.land.roadWidthFt) : "",
    ownership: l.land?.ownership ?? "",
    mutation: l.land?.mutation ?? "",
    expectedShare: l.land?.expectedShare ?? "",
    tags: (l.tags ?? []).join(", "),
  };
}

/** Form values → API body. `mode` = "create" | "edit" (edit sends nulls to clear fields). */
export function valuesToBody(v, mode) {
  const body = {
    name: v.name.trim(),
    phone: v.phone.trim(),
    altPhone: orNull(v.altPhone.trim()),
    email: orNull(v.email.trim()),
    source: v.source,
    tags: splitTags(v.tags),
  };
  if (v.source === "referral" || v.referrer) body.sourceDetail = { referrer: orNull(v.referrer.trim()) };
  if (v.type === "buyer") {
    body.interest = {
      projectId: orNull(v.projectId),
      bedrooms: numOrNull(v.bedrooms),
      budgetMin: takaToPoisha(v.budgetMin),
      budgetMax: takaToPoisha(v.budgetMax),
    };
  } else {
    body.land = {
      location: orNull(v.landLocation.trim()),
      area: v.landValue ? { value: Number(v.landValue), unit: v.landUnit } : null,
      roadWidthFt: numOrNull(v.roadWidthFt),
      ownership: orNull(v.ownership),
      mutation: orNull(v.mutation),
      expectedShare: orNull(v.expectedShare.trim()),
    };
  }
  if (mode === "create") {
    body.type = v.type;
    if (v.message.trim()) body.message = v.message.trim();
    if (v.assignee === "none") body.assigneeId = null;
    else if (v.assignee && v.assignee !== "auto") body.assigneeId = v.assignee;
    for (const k of ["altPhone", "email"]) if (body[k] == null) delete body[k];
  }
  return body;
}

/** The field set shared by "New lead" and the drawer's Details tab. */
export function LeadFields({ form, mode, assignees }) {
  const t = useTranslations("crm.form");
  const ts = useTranslations("crm.sources");
  const tc = useTranslations("common");
  const locale = useLocale();
  const projects = useProjectOptions();
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const type = useWatch({ control, name: "type" });
  const source = useWatch({ control, name: "source" });
  const opt = tc("optional");
  const sources = mode === "create" ? MANUAL_SOURCES : LEAD_SOURCES;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} error={errors.name?.message} required className="sm:col-span-2">
          <Input autoComplete="off" {...register("name")} />
        </Field>
        <Field label={t("phone")} error={errors.phone?.message} hint={mode === "create" ? t("phoneHint") : undefined} required>
          <Input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
        </Field>
        <Field label={t("altPhone")} error={errors.altPhone?.message} optionalLabel={opt}>
          <Input type="tel" inputMode="tel" {...register("altPhone")} />
        </Field>
        <Field label={t("email")} error={errors.email?.message} optionalLabel={opt}>
          <Input type="email" {...register("email")} />
        </Field>
        <Field label={t("source")}>
          <Select {...register("source")}>
            {sources.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
        </Field>
        {source === "referral" && (
          <Field label={t("referrer")} optionalLabel={opt} className="sm:col-span-2">
            <Input {...register("referrer")} />
          </Field>
        )}
      </div>

      {type === "buyer" ? (
        <fieldset className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("interest")}</legend>
          <Field label={t("project")} optionalLabel={opt} className="sm:col-span-2">
            <Select {...register("projectId")}>
              <option value="">{t("noProject")}</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {(locale === "bn" && p.nameBn) || p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("bedrooms")} error={errors.bedrooms?.message} optionalLabel={opt}>
            <Input inputMode="numeric" {...register("bedrooms")} />
          </Field>
          <div className="hidden sm:block" />
          <Field label={t("budgetMin")} error={errors.budgetMin?.message} optionalLabel={opt}>
            <Input inputMode="decimal" leading={<span className="text-xs">৳</span>} {...register("budgetMin")} />
          </Field>
          <Field label={t("budgetMax")} error={errors.budgetMax?.message} optionalLabel={opt}>
            <Input inputMode="decimal" leading={<span className="text-xs">৳</span>} {...register("budgetMax")} />
          </Field>
        </fieldset>
      ) : (
        <fieldset className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("land")}</legend>
          <Field label={t("landLocation")} optionalLabel={opt} className="sm:col-span-2">
            <Input {...register("landLocation")} />
          </Field>
          <Field label={t("landArea")} error={errors.landValue?.message} optionalLabel={opt}>
            <div className="flex gap-2">
              <Input inputMode="decimal" {...register("landValue")} />
              <div className="w-32 shrink-0">
                <Select aria-label={t("landUnit")} {...register("landUnit")}>
                  <option value="katha">{t("katha")}</option>
                  <option value="decimal">{t("decimal")}</option>
                </Select>
              </div>
            </div>
          </Field>
          <Field label={t("roadWidth")} error={errors.roadWidthFt?.message} optionalLabel={opt}>
            <Input inputMode="decimal" trailing={<span className="pr-1 text-xs text-ink-subtle">{t("ft")}</span>} {...register("roadWidthFt")} />
          </Field>
          <Field label={t("ownership")} optionalLabel={opt}>
            <Select {...register("ownership")}>
              <option value="">—</option>
              {LAND_OWNERSHIP.map((o) => (
                <option key={o} value={o}>
                  {t(`ownershipOptions.${o}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("mutation")} optionalLabel={opt}>
            <Select {...register("mutation")}>
              <option value="">—</option>
              {MUTATION_STATUS.map((o) => (
                <option key={o} value={o}>
                  {t(`mutationOptions.${o}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("expectedShare")} hint={t("expectedShareHint")} optionalLabel={opt} className="sm:col-span-2">
            <Input {...register("expectedShare")} />
          </Field>
        </fieldset>
      )}

      <div className="grid gap-5 border-t border-line pt-5">
        {mode === "create" && (
          <Field label={t("message")} optionalLabel={opt}>
            <Textarea rows={3} {...register("message")} />
          </Field>
        )}
        <Field label={t("tags")} hint={t("tagsHint")} error={errors.tags?.message} optionalLabel={opt}>
          <Input {...register("tags")} />
        </Field>
        {mode === "create" && assignees && (
          <Field label={t("owner")} hint={t("ownerHint")}>
            <Select {...register("assignee")}>
              <option value="auto">{t("ownerAuto")}</option>
              <option value="none">{t("ownerNone")}</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </div>
  );
}
