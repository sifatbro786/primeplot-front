"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { areaUnitLabel, poishaToTaka, takaToPoisha } from "@/lib/format";
import { FACINGS, SOLD_STATUSES } from "@/lib/unitStatus";

/** Fields the API locks once a unit is sold (unit.service › LOCKED_WHEN_SOLD). */
const LOCKED_WHEN_SOLD = ["blockId", "floor", "position", "saleableSqft", "landArea", "parkingSlots", "facing", "isCorner", "roadWidthFt", "rateOverride", "priceAdjustment"];

const str = (v) => (v == null ? "" : String(v));
const num = (s) => (s === "" || s == null ? null : Number(s));
const decimals = (s, dp) => s === "" || new RegExp(`^\\d+(\\.\\d{1,${dp}})?$`).test(s);
const int = (s, min, max) => s === "" || (/^-?\d+$/.test(s) && Number(s) >= min && Number(s) <= max);

function initialValues(unit, kind, preset) {
  const u = unit ?? {};
  return {
    blockId: u.blockId ?? preset?.blockId ?? "",
    code: str(u.code),
    // apartment
    floor: str(u.floor ?? preset?.floor),
    position: str(u.position ?? preset?.position),
    typeLabel: str(u.typeLabel),
    bedrooms: str(u.bedrooms),
    bathrooms: str(u.bathrooms),
    balconies: str(u.balconies),
    saleableSqft: str(u.saleableSqft),
    carpetSqft: str(u.carpetSqft),
    parkingSlots: str(u.parkingSlots ?? 0),
    // plot
    plotNo: str(u.plotNo),
    road: str(u.road ?? preset?.road),
    roadWidthFt: str(u.roadWidthFt),
    landValue: str(u.landArea?.value),
    landUnit: u.landArea?.unit ?? "katha",
    frontFt: str(u.dimensions?.frontFt),
    backFt: str(u.dimensions?.backFt),
    leftFt: str(u.dimensions?.leftFt),
    rightFt: str(u.dimensions?.rightFt),
    // both
    facing: u.facing ?? "",
    isCorner: Boolean(u.isCorner),
    rateOverride: poishaToTaka(u.rateOverride),
    adjustment: poishaToTaka(u.priceAdjustment?.amount),
    adjustmentNote: str(u.priceAdjustment?.note),
    kind,
  };
}

/** Form values → API body (only `fields` that are listed; null clears). */
function toBody(v, kind, fields) {
  const all = {
    blockId: v.blockId,
    code: v.code.trim() || undefined,
    facing: v.facing || null,
    isCorner: v.isCorner,
    rateOverride: takaToPoisha(v.rateOverride),
    priceAdjustment: takaToPoisha(v.adjustment) ? { amount: takaToPoisha(v.adjustment), ...(v.adjustmentNote.trim() && { note: v.adjustmentNote.trim() }) } : null,
  };
  if (kind === "apartment") {
    Object.assign(all, {
      floor: num(v.floor),
      position: v.position.trim().toUpperCase() || null,
      typeLabel: v.typeLabel.trim() || null,
      bedrooms: num(v.bedrooms),
      bathrooms: num(v.bathrooms),
      balconies: num(v.balconies),
      saleableSqft: num(v.saleableSqft),
      carpetSqft: num(v.carpetSqft),
      parkingSlots: num(v.parkingSlots) ?? 0,
    });
  } else {
    const dims = { frontFt: num(v.frontFt), backFt: num(v.backFt), leftFt: num(v.leftFt), rightFt: num(v.rightFt) };
    Object.assign(all, {
      plotNo: v.plotNo.trim() || null,
      road: v.road.trim() || null,
      roadWidthFt: num(v.roadWidthFt),
      landArea: v.landValue ? { value: Number(v.landValue), unit: v.landUnit } : null,
      dimensions: Object.values(dims).some((x) => x != null) ? dims : null,
    });
  }
  return Object.fromEntries(fields.filter((f) => all[f] !== undefined).map((f) => [f, all[f]]));
}

// form field → API field (for dirty tracking)
const FIELD_OF = {
  landValue: "landArea",
  landUnit: "landArea",
  frontFt: "dimensions",
  backFt: "dimensions",
  leftFt: "dimensions",
  rightFt: "dimensions",
  adjustment: "priceAdjustment",
  adjustmentNote: "priceAdjustment",
};

/**
 * Create or edit one unit. `unit` = existing (edit) or null (create); `preset` pre-fills
 * block/floor/position when opened from an empty grid slot.
 */
export function UnitForm({ formId, project, blocks, unit, preset, onSaved, onBusy }) {
  const t = useTranslations("inventory.form");
  const tf = useTranslations("inventory.facing");
  const te = useTranslations("errors");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const { can } = useSession();
  const kind = project.kind;
  const canPrice = can("pricing:write");
  const sold = unit && SOLD_STATUSES.includes(unit.status);
  const locked = (f) => Boolean(sold && LOCKED_WHEN_SOLD.includes(f));

  const schema = z
    .object({
      blockId: z.string().min(1, t("required")),
      code: z.string().max(40),
      floor: z.string().refine((s) => kind !== "apartment" || (s !== "" && int(s, -5, 200)), t("floorInvalid")),
      position: z.string().regex(/^[A-Za-z0-9]{0,10}$/, t("positionInvalid")),
      typeLabel: z.string().max(60),
      bedrooms: z.string().refine((s) => int(s, 0, 20), t("countInvalid")),
      bathrooms: z.string().refine((s) => int(s, 0, 20), t("countInvalid")),
      balconies: z.string().refine((s) => int(s, 0, 20), t("countInvalid")),
      saleableSqft: z.string().refine((s) => decimals(s, 2), t("areaInvalid2")),
      carpetSqft: z.string().refine((s) => decimals(s, 2), t("areaInvalid2")),
      parkingSlots: z.string().refine((s) => int(s, 0, 10), t("countInvalid")),
      plotNo: z.string().max(20),
      road: z.string().max(60),
      roadWidthFt: z.string().refine((s) => decimals(s, 2), t("numberInvalid")),
      landValue: z.string().refine((s) => decimals(s, 4) && (s === "" || Number(s) > 0), t("areaInvalid4")),
      landUnit: z.enum(["katha", "decimal"]),
      frontFt: z.string().refine((s) => decimals(s, 2), t("numberInvalid")),
      backFt: z.string().refine((s) => decimals(s, 2), t("numberInvalid")),
      leftFt: z.string().refine((s) => decimals(s, 2), t("numberInvalid")),
      rightFt: z.string().refine((s) => decimals(s, 2), t("numberInvalid")),
      facing: z.string(),
      isCorner: z.boolean(),
      rateOverride: z.string().refine((s) => s === "" || (takaToPoisha(s) ?? -1) >= 0, t("moneyInvalid")),
      adjustment: z.string().refine((s) => s === "" || takaToPoisha(s) !== null, t("moneyInvalid")),
      adjustmentNote: z.string().max(200),
      kind: z.string(),
    })
    .refine((v) => kind !== "plot" || v.code.trim() || v.plotNo.trim(), { path: ["plotNo"], message: t("plotNoOrCode") })
    .refine((v) => kind !== "apartment" || v.code.trim() || v.position.trim(), { path: ["position"], message: t("positionOrCode") });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields },
  } = useForm({ resolver: zodResolver(schema), defaultValues: initialValues(unit, kind, preset) });

  const onSubmit = async (v) => {
    onBusy?.(true);
    try {
      let saved;
      if (unit) {
        const changed = [...new Set(Object.keys(dirtyFields).map((f) => FIELD_OF[f] ?? f))].filter((f) => f !== "kind");
        if (!changed.length) return onSaved(unit);
        saved = await api.patch(`/units/${unit.id}`, { version: unit.version, ...toBody(v, kind, changed) });
      } else {
        const fields = Object.keys(toBody(v, kind, Object.keys(v).map((f) => FIELD_OF[f] ?? f)));
        const body = toBody(v, kind, fields.filter((f) => canPrice || !["rateOverride", "priceAdjustment"].includes(f)));
        // drop empty optionals on create so the API applies its defaults
        for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
        saved = await api.post(`/projects/${project.id}/units`, body);
      }
      onSaved(saved);
    } catch (err) {
      const map = { DUPLICATE: ["code", t("codeTaken")], FLOOR_OUT_OF_RANGE: ["floor", t("floorOutOfRange")] };
      if (map[err?.code]) return setError(map[err.code][0], { message: map[err.code][1] });
      if (err?.code === "STALE_VERSION") return setError("root", { message: ti("errors.STALE_VERSION") });
      if (err?.code === "UNIT_LOCKED") return setError("root", { message: ti("errors.UNIT_LOCKED") });
      const fe = err?.fieldErrors ?? {};
      if (fe.code) return setError("code", { message: t("codeOrFields") });
      setError("root", { message: errorMessage(te, err) });
    } finally {
      onBusy?.(false);
    }
  };

  const num2 = { inputMode: "decimal", autoComplete: "off" };
  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert>{errors.root?.message}</FormAlert>
      {sold && <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">{t("soldNote")}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={kind === "plot" ? t("sector") : t("building")} error={errors.blockId?.message} required>
          <Select disabled={locked("blockId")} {...register("blockId")}>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("code")} error={errors.code?.message} hint={t(kind === "plot" ? "codeHintPlot" : "codeHint")}>
          <Input className="font-mono text-[13px]" autoComplete="off" spellCheck={false} {...register("code")} />
        </Field>
      </div>

      {kind === "apartment" ? (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t("floor")} error={errors.floor?.message} required hint={t("floorHint")}>
              <Input inputMode="numeric" disabled={locked("floor")} {...register("floor")} />
            </Field>
            <Field label={t("position")} error={errors.position?.message} hint={t("positionHint")}>
              <Input className="font-mono uppercase" maxLength={10} disabled={locked("position")} {...register("position")} />
            </Field>
            <Field label={t("typeLabel")} error={errors.typeLabel?.message}>
              <Input placeholder="Type A" {...register("typeLabel")} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-5">
            <Field label={t("bedrooms")} error={errors.bedrooms?.message}>
              <Input inputMode="numeric" {...register("bedrooms")} />
            </Field>
            <Field label={t("bathrooms")} error={errors.bathrooms?.message}>
              <Input inputMode="numeric" {...register("bathrooms")} />
            </Field>
            <Field label={t("balconies")} error={errors.balconies?.message}>
              <Input inputMode="numeric" {...register("balconies")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t("saleableSqft")} error={errors.saleableSqft?.message} hint={t("saleableHint")}>
              <Input {...num2} disabled={locked("saleableSqft")} trailing={<span className="pr-1 text-xs text-ink-subtle">{areaUnitLabel("sqft", locale)}</span>} {...register("saleableSqft")} />
            </Field>
            <Field label={t("carpetSqft")} error={errors.carpetSqft?.message}>
              <Input {...num2} trailing={<span className="pr-1 text-xs text-ink-subtle">{areaUnitLabel("sqft", locale)}</span>} {...register("carpetSqft")} />
            </Field>
            <Field label={t("parkingSlots")} error={errors.parkingSlots?.message}>
              <Input inputMode="numeric" disabled={locked("parkingSlots")} {...register("parkingSlots")} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t("plotNo")} error={errors.plotNo?.message}>
              <Input className="font-mono" {...register("plotNo")} />
            </Field>
            <Field label={t("road")} error={errors.road?.message}>
              <Input placeholder="Road 5" {...register("road")} />
            </Field>
            <Field label={t("roadWidthFt")} error={errors.roadWidthFt?.message}>
              <Input {...num2} disabled={locked("roadWidthFt")} trailing={<span className="pr-1 text-xs text-ink-subtle">{t("ft")}</span>} {...register("roadWidthFt")} />
            </Field>
          </div>
          <Field label={t("landArea")} error={errors.landValue?.message} hint={t("landHint")}>
            <div className="flex gap-2">
              <Input {...num2} disabled={locked("landArea")} className="flex-1" {...register("landValue")} />
              <Controller
                control={control}
                name="landUnit"
                render={({ field }) => (
                  <Segmented
                    name="landUnit"
                    aria-label={t("landUnit")}
                    disabled={locked("landArea")}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "katha", label: areaUnitLabel("katha", locale) },
                      { value: "decimal", label: areaUnitLabel("decimal", locale) },
                    ]}
                  />
                )}
              />
            </div>
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium">{t("dimensions")}</legend>
            <div className="grid grid-cols-4 gap-2">
              {["frontFt", "backFt", "leftFt", "rightFt"].map((f) => (
                <Field key={f} error={errors[f]?.message}>
                  <Input {...num2} aria-label={t(f)} placeholder={t(f)} {...register(f)} />
                </Field>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
        <Field label={t("facing")}>
          <Select disabled={locked("facing")} {...register("facing")}>
            <option value="">{t("facingNone")}</option>
            {FACINGS.map((f) => (
              <option key={f} value={f}>
                {tf(f)}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox label={t(kind === "plot" ? "cornerPlot" : "cornerUnit")} disabled={locked("isCorner")} {...register("isCorner")} className="pb-2.5" />
      </div>

      {canPrice && (
        <fieldset className="space-y-5 border-t border-line pt-5">
          <legend className="sr-only">{t("priceSection")}</legend>
          <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{t("priceSection")}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t(kind === "plot" ? "rateOverridePlot" : "rateOverride")} error={errors.rateOverride?.message} hint={t("rateOverrideHint")}>
              <Input {...num2} disabled={locked("rateOverride")} leading={<span className="text-xs">৳</span>} {...register("rateOverride")} />
            </Field>
            <Field label={t("adjustment")} error={errors.adjustment?.message} hint={t("adjustmentHint")}>
              <Input inputMode="text" disabled={locked("priceAdjustment")} leading={<span className="text-xs">৳</span>} {...register("adjustment")} />
            </Field>
          </div>
          <Field label={t("adjustmentNote")} error={errors.adjustmentNote?.message}>
            <Input disabled={locked("priceAdjustment")} {...register("adjustmentNote")} />
          </Field>
        </fieldset>
      )}
    </form>
  );
}
