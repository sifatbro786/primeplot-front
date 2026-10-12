"use client";

import { Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/States";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { areaUnitLabel, formatBDT, formatDate, poishaToTaka, takaToPoisha } from "@/lib/format";
import { FACINGS } from "@/lib/unitStatus";
import { keys, useProject } from "@/components/inventory/queries";

/**
 * Rate card (PUT /projects/:id/pricing — full replacement). Staff type taka; the API gets
 * integer poisha. Saving re-prices every unsold unit; sold units keep their booked price.
 */
const money = (s) => s === "" || takaToPoisha(s) !== null;
const moneyPos = (s) => s === "" || (takaToPoisha(s) ?? -1) >= 0;
const p = (s) => (s === "" ? null : takaToPoisha(s));

function chargeCode(label, used) {
  let base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "charge";
  let code = base;
  for (let i = 2; used.has(code); i++) code = `${base}_${i}`;
  used.add(code);
  return code;
}

function defaultsOf(project) {
  const pr = project.pricing ?? {};
  const facingKey = project.kind === "plot" ? "perUnit" : "perSqft";
  return {
    ratePerSqft: poishaToTaka(pr.ratePerSqft),
    fromFloor: pr.floorRise?.fromFloor == null ? "" : String(pr.floorRise.fromFloor),
    perFloorPerSqft: poishaToTaka(pr.floorRise?.perFloorPerSqft),
    cornerPerSqft: poishaToTaka(pr.cornerPerSqft),
    parkingPerSlot: poishaToTaka(pr.parkingPerSlot),
    rateUnit: pr.rateUnit ?? "katha",
    rate: poishaToTaka(pr.rate),
    cornerPct: pr.cornerPremiumBps == null ? "" : String(pr.cornerPremiumBps / 100),
    roads: (pr.roadWidthPremiums ?? []).map((r) => ({ minWidthFt: String(r.minWidthFt), perUnit: poishaToTaka(r.perUnit) })),
    facings: (pr.facingPremiums ?? []).map((f) => ({ facing: f.facing, amount: poishaToTaka(f[facingKey]) })),
    charges: (pr.charges ?? []).map((c) => ({ code: c.code, label: c.label, labelBn: c.labelBn ?? "", amount: poishaToTaka(c.amount) })),
  };
}

function toPricing(v, kind) {
  const used = new Set(v.charges.map((c) => c.code).filter(Boolean));
  const charges = v.charges.map((c) => ({
    code: c.code || chargeCode(c.label, used),
    label: c.label.trim(),
    ...(c.labelBn.trim() && { labelBn: c.labelBn.trim() }),
    amount: p(c.amount) ?? 0,
  }));
  if (kind === "plot") {
    return {
      rateUnit: v.rateUnit,
      rate: p(v.rate),
      cornerPremiumBps: v.cornerPct === "" ? null : Math.round(Number(v.cornerPct) * 100),
      roadWidthPremiums: v.roads.map((r) => ({ minWidthFt: Number(r.minWidthFt), perUnit: p(r.perUnit) ?? 0 })),
      facingPremiums: v.facings.map((f) => ({ facing: f.facing, perUnit: p(f.amount) ?? 0 })),
      charges,
    };
  }
  return {
    ratePerSqft: p(v.ratePerSqft),
    floorRise: v.fromFloor !== "" && v.perFloorPerSqft !== "" ? { fromFloor: Number(v.fromFloor), perFloorPerSqft: p(v.perFloorPerSqft) } : null,
    cornerPerSqft: p(v.cornerPerSqft),
    parkingPerSlot: p(v.parkingPerSlot),
    facingPremiums: v.facings.map((f) => ({ facing: f.facing, perSqft: p(f.amount) ?? 0 })),
    charges,
  };
}

function Card({ title, description, children, action }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

const Taka = (props) => <Input inputMode="decimal" leading={<span className="text-xs">৳</span>} {...props} />;

function Editor({ project }) {
  const t = useTranslations("pricing");
  const tf = useTranslations("inventory.facing");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useSession();
  const readOnly = !can("pricing:write");
  const plot = project.kind === "plot";

  const schema = z
    .object({
      ratePerSqft: z.string().refine(moneyPos, t("errors.money")),
      fromFloor: z.string().refine((s) => s === "" || /^-?\d+$/.test(s), t("errors.floor")),
      perFloorPerSqft: z.string().refine(moneyPos, t("errors.money")),
      cornerPerSqft: z.string().refine(moneyPos, t("errors.money")),
      parkingPerSlot: z.string().refine(moneyPos, t("errors.money")),
      rateUnit: z.enum(["katha", "decimal"]),
      rate: z.string().refine(moneyPos, t("errors.money")),
      cornerPct: z.string().refine((s) => s === "" || (/^\d+(\.\d{1,2})?$/.test(s) && Number(s) <= 50), t("errors.pct")),
      roads: z.array(z.object({ minWidthFt: z.string().refine((s) => /^\d+(\.\d+)?$/.test(s) && Number(s) <= 500, t("errors.width")), perUnit: z.string().refine(money, t("errors.money")) })),
      facings: z.array(z.object({ facing: z.enum(FACINGS), amount: z.string().refine(money, t("errors.money")) })),
      charges: z.array(z.object({ code: z.string(), label: z.string().trim().min(1, t("errors.label")).max(120), labelBn: z.string().max(120), amount: z.string().refine(moneyPos, t("errors.money")) })),
    })
    .refine((v) => (v.fromFloor === "") === (v.perFloorPerSqft === ""), { path: ["perFloorPerSqft"], message: t("errors.floorRisePair") })
    .refine((v) => new Set(v.facings.map((f) => f.facing)).size === v.facings.length, { path: ["facings"], message: t("errors.dupFacing") })
    .refine((v) => new Set(v.roads.map((r) => Number(r.minWidthFt))).size === v.roads.length, { path: ["roads"], message: t("errors.dupRoad") });

  const defaults = defaultsOf(project);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });
  const roads = useFieldArray({ control, name: "roads" });
  const facings = useFieldArray({ control, name: "facings" });
  const charges = useFieldArray({ control, name: "charges" });

  const onSubmit = async (v) => {
    try {
      const res = await apiRequest(`/projects/${project.id}/pricing`, {
        method: "PUT",
        body: { version: project.version, pricing: toPricing(v, project.kind) },
      });
      qc.setQueryData(keys.project(project.id), res.data);
      qc.invalidateQueries({ queryKey: ["project-units", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      reset(defaultsOf(res.data));
      toast.success(t("saved", { n: res.meta?.repricedUnits ?? 0 }));
    } catch (err) {
      if (err?.code === "STALE_VERSION") return setError("root", { message: t("errors.stale") });
      setError("root", { message: errorMessage(te, err) });
    }
  };

  const rateUnit = useWatch({ control, name: "rateUnit" });
  const unitLabel = areaUnitLabel(plot ? rateUnit : "sqft", locale);
  const perLabel = (key) => t(key, { unit: unitLabel });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FormAlert>{errors.root?.message}</FormAlert>
      {readOnly && <p className="rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-muted">{t("readOnly")}</p>}
      <fieldset disabled={readOnly} className="min-w-0 space-y-6">
        <Card title={t("base")} description={plot ? t("baseBodyPlot") : t("baseBody")}>
          {plot ? (
            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
              <Field label={t("rateUnit")}>
                <Controller
                  control={control}
                  name="rateUnit"
                  render={({ field }) => (
                    <Segmented
                      name="rateUnit"
                      aria-label={t("rateUnit")}
                      disabled={readOnly}
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: "katha", label: t("perKatha") },
                        { value: "decimal", label: t("perDecimal") },
                      ]}
                    />
                  )}
                />
              </Field>
              <Field label={t("rate")} error={errors.rate?.message}>
                <Taka {...register("rate")} />
              </Field>
            </div>
          ) : (
            <Field label={t("ratePerSqft")} error={errors.ratePerSqft?.message} className="sm:max-w-xs">
              <Taka {...register("ratePerSqft")} />
            </Field>
          )}
        </Card>

        {!plot && (
          <Card title={t("floorRise")} description={t("floorRiseBody")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("fromFloor")} error={errors.fromFloor?.message} hint={t("fromFloorHint")}>
                <Input inputMode="numeric" {...register("fromFloor")} />
              </Field>
              <Field label={t("perFloorPerSqft")} error={errors.perFloorPerSqft?.message}>
                <Taka {...register("perFloorPerSqft")} />
              </Field>
            </div>
          </Card>
        )}

        {plot && (
          <Card
            title={t("roadWidth")}
            description={t("roadWidthBody")}
            action={
              !readOnly && (
                <Button size="sm" variant="ghost" onClick={() => roads.append({ minWidthFt: "", perUnit: "" })}>
                  <Plus aria-hidden className="size-3.5" />
                  {t("addTier")}
                </Button>
              )
            }
          >
            {roads.fields.length === 0 && <p className="text-sm text-ink-subtle">{t("noTiers")}</p>}
            {errors.roads?.root?.message && <p className="text-xs font-medium text-danger">{errors.roads.root.message}</p>}
            {roads.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label={i === 0 ? t("minWidth") : undefined} error={errors.roads?.[i]?.minWidthFt?.message}>
                  <Input inputMode="decimal" aria-label={t("minWidth")} trailing={<span className="pr-1 text-xs text-ink-subtle">{t("ft")}</span>} {...register(`roads.${i}.minWidthFt`)} />
                </Field>
                <Field label={i === 0 ? perLabel("extraPerUnit") : undefined} error={errors.roads?.[i]?.perUnit?.message}>
                  <Taka aria-label={perLabel("extraPerUnit")} {...register(`roads.${i}.perUnit`)} />
                </Field>
                {!readOnly && (
                  <Button variant="ghost" size="icon" onClick={() => roads.remove(i)} aria-label={t("remove")}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}

        <Card
          title={t("facing")}
          description={plot ? perLabel("facingBodyPlot") : t("facingBody")}
          action={
            !readOnly &&
            facings.fields.length < FACINGS.length && (
              <Button size="sm" variant="ghost" onClick={() => facings.append({ facing: FACINGS.find((x) => !facings.fields.some((f) => f.facing === x)), amount: "" })}>
                <Plus aria-hidden className="size-3.5" />
                {t("addFacing")}
              </Button>
            )
          }
        >
          {facings.fields.length === 0 && <p className="text-sm text-ink-subtle">{t("noFacing")}</p>}
          {errors.facings?.root?.message && <p className="text-xs font-medium text-danger">{errors.facings.root.message}</p>}
          {facings.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <Field label={i === 0 ? t("facingDir") : undefined}>
                <Select aria-label={t("facingDir")} {...register(`facings.${i}.facing`)}>
                  {FACINGS.map((x) => (
                    <option key={x} value={x}>
                      {tf(x)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={i === 0 ? (plot ? perLabel("extraPerUnit") : t("extraPerSqft")) : undefined} error={errors.facings?.[i]?.amount?.message}>
                <Taka aria-label={t("extraPerSqft")} {...register(`facings.${i}.amount`)} />
              </Field>
              {!readOnly && (
                <Button variant="ghost" size="icon" onClick={() => facings.remove(i)} aria-label={t("remove")}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <p className="text-xs text-ink-subtle">{t("negativeHint")}</p>
        </Card>

        <Card title={t("cornerAndParking")} description={plot ? t("cornerBodyPlot") : t("cornerBody")}>
          <div className="grid gap-5 sm:grid-cols-2">
            {plot ? (
              <Field label={t("cornerPct")} error={errors.cornerPct?.message} hint={t("cornerPctHint")}>
                <Input inputMode="decimal" trailing={<span className="pr-1 text-xs text-ink-subtle">%</span>} {...register("cornerPct")} />
              </Field>
            ) : (
              <>
                <Field label={t("cornerPerSqft")} error={errors.cornerPerSqft?.message}>
                  <Taka {...register("cornerPerSqft")} />
                </Field>
                <Field label={t("parkingPerSlot")} error={errors.parkingPerSlot?.message}>
                  <Taka {...register("parkingPerSlot")} />
                </Field>
              </>
            )}
          </div>
        </Card>

        <Card
          title={t("charges")}
          description={t("chargesBody")}
          action={
            !readOnly && (
              <Button size="sm" variant="ghost" onClick={() => charges.append({ code: "", label: "", labelBn: "", amount: "" })}>
                <Plus aria-hidden className="size-3.5" />
                {t("addCharge")}
              </Button>
            )
          }
        >
          {charges.fields.length === 0 && <p className="text-sm text-ink-subtle">{t("noCharges")}</p>}
          {charges.fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
              <Field label={i === 0 ? t("chargeLabel") : undefined} error={errors.charges?.[i]?.label?.message}>
                <Input aria-label={t("chargeLabel")} placeholder="Utility connection" {...register(`charges.${i}.label`)} />
              </Field>
              <Field label={i === 0 ? t("chargeLabelBn") : undefined}>
                <Input aria-label={t("chargeLabelBn")} lang="bn" placeholder="ইউটিলিটি সংযোগ" {...register(`charges.${i}.labelBn`)} />
              </Field>
              <Field label={i === 0 ? t("amount") : undefined} error={errors.charges?.[i]?.amount?.message}>
                <Taka aria-label={t("amount")} {...register(`charges.${i}.amount`)} />
              </Field>
              {!readOnly && (
                <Button variant="ghost" size="icon" onClick={() => charges.remove(i)} aria-label={t("remove")}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </Card>
      </fieldset>

      {!readOnly && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <span className="mr-auto text-xs text-ink-muted">
            {isDirty ? t("unsaved") : project.pricingUpdatedAt ? t("lastSaved", { at: formatDate(project.pricingUpdatedAt, locale, "datetime") }) : t("never")}
          </span>
          <Button variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
            {t("discard")}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {t("save")}
          </Button>
        </div>
      )}
      {project.inventory?.availableFrom != null && (
        <p className="text-xs text-ink-muted">{t("fromNow", { price: formatBDT(project.inventory.availableFrom, locale) })}</p>
      )}
    </form>
  );
}

export function RateCardEditor() {
  const { id } = useParams();
  const { data: project } = useProject(id);
  if (!project) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="max-w-3xl">
      <Editor key={`${project.id}:${project.version}`} project={project} />
    </div>
  );
}
