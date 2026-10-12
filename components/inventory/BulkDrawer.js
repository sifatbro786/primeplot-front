"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { areaUnitLabel, formatNumber } from "@/lib/format";
import { FACINGS } from "@/lib/unitStatus";
import { keys } from "./queries";

const MAX = 500;
const isInt = (s) => /^-?\d+$/.test(String(s).trim());
const dec = (s, dp) => s === "" || new RegExp(`^\\d+(\\.\\d{1,${dp}})?$`).test(s);
const n = (s) => (s === "" ? undefined : Number(s));

function parsePositions(s) {
  return [...new Set(s.split(/[\s,]+/).map((p) => p.trim().toUpperCase()).filter(Boolean))];
}

/** Apartment generator: floors × positions, one template per position. */
function useApartmentPlan({ block, existing, from, to, positions, templates, skipExisting }) {
  return useMemo(() => {
    if (!isInt(from) || !isInt(to) || Number(from) > Number(to)) return { error: "floors", units: [] };
    const pos = parsePositions(positions);
    if (!pos.length || pos.some((p) => !/^[A-Z0-9]{1,10}$/.test(p))) return { error: "positions", units: [] };
    const taken = new Set(existing.map((u) => `${u.floor}|${u.position}`));
    const units = [];
    let skipped = 0;
    for (let f = Number(from); f <= Number(to); f++) {
      for (const p of pos) {
        if (skipExisting && taken.has(`${f}|${p}`)) {
          skipped++;
          continue;
        }
        const tpl = templates[p] ?? {};
        units.push({
          blockId: block.id,
          floor: f,
          position: p,
          ...(tpl.typeLabel && { typeLabel: tpl.typeLabel }),
          ...(n(tpl.bedrooms) !== undefined && { bedrooms: n(tpl.bedrooms) }),
          ...(n(tpl.bathrooms) !== undefined && { bathrooms: n(tpl.bathrooms) }),
          ...(n(tpl.saleableSqft) !== undefined && { saleableSqft: n(tpl.saleableSqft) }),
          ...(tpl.facing && { facing: tpl.facing }),
          code: `${block.code}-${f}${p}`,
        });
      }
    }
    return { units, skipped, pos };
  }, [block, existing, from, to, positions, templates, skipExisting]);
}

function ApartmentGenerator({ block, existing, onPlan }) {
  const t = useTranslations("inventory.bulk");
  const tf = useTranslations("inventory.facing");
  const locale = useLocale();
  const [from, setFrom] = useState(String(Math.max(block.lowestFloor ?? 1, 1)));
  const [to, setTo] = useState(String(block.highestFloor ?? 10));
  const [positions, setPositions] = useState("A, B, C, D");
  const [templates, setTemplates] = useState({});
  const [skipExisting, setSkipExisting] = useState(true);
  const plan = useApartmentPlan({ block, existing, from, to, positions, templates, skipExisting });
  const bad = Object.values(templates).some((tp) => !dec(tp.saleableSqft ?? "", 2) || ["bedrooms", "bathrooms"].some((k) => tp[k] && !isInt(tp[k])));
  const reported = useMemo(() => (bad ? { ...plan, error: "template" } : plan), [plan, bad]);
  useEffect(() => onPlan(reported), [reported, onPlan]);

  const setTpl = (p, k, v) => setTemplates((s) => ({ ...s, [p]: { ...(s[p] ?? {}), [k]: v } }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <Field label={t("fromFloor")} error={plan.error === "floors" ? t("floorsInvalid") : undefined}>
          <Input inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("toFloor")}>
          <Input inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Field label={t("positions")} hint={t("positionsHint")} error={plan.error === "positions" ? t("positionsInvalid") : undefined}>
        <Input className="font-mono uppercase" value={positions} onChange={(e) => setPositions(e.target.value)} />
      </Field>

      {plan.pos?.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium">{t("templates")}</legend>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-left text-[10px] tracking-wider text-ink-muted uppercase">
                <tr>
                  <th className="px-2 py-2 font-semibold">{t("pos")}</th>
                  <th className="px-2 py-2 font-semibold">{t("type")}</th>
                  <th className="px-2 py-2 font-semibold">{t("beds")}</th>
                  <th className="px-2 py-2 font-semibold">{t("baths")}</th>
                  <th className="px-2 py-2 font-semibold">{areaUnitLabel("sqft", locale)}</th>
                  <th className="px-2 py-2 font-semibold">{t("facing")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plan.pos.map((p) => (
                  <tr key={p}>
                    <td className="px-2 py-1.5 font-mono font-medium">{p}</td>
                    <td className="px-1 py-1">
                      <Input className="h-8 text-xs" aria-label={`${t("type")} ${p}`} placeholder={`Type ${p}`} value={templates[p]?.typeLabel ?? ""} onChange={(e) => setTpl(p, "typeLabel", e.target.value)} />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <Input className="h-8 text-xs" inputMode="numeric" aria-label={`${t("beds")} ${p}`} value={templates[p]?.bedrooms ?? ""} onChange={(e) => setTpl(p, "bedrooms", e.target.value)} />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <Input className="h-8 text-xs" inputMode="numeric" aria-label={`${t("baths")} ${p}`} value={templates[p]?.bathrooms ?? ""} onChange={(e) => setTpl(p, "bathrooms", e.target.value)} />
                    </td>
                    <td className="w-24 px-1 py-1">
                      <Input className="h-8 text-xs" inputMode="decimal" aria-label={`${t("sqft")} ${p}`} value={templates[p]?.saleableSqft ?? ""} onChange={(e) => setTpl(p, "saleableSqft", e.target.value)} />
                    </td>
                    <td className="w-32 px-1 py-1">
                      <Select className="h-8 text-xs" aria-label={`${t("facing")} ${p}`} value={templates[p]?.facing ?? ""} onChange={(e) => setTpl(p, "facing", e.target.value)}>
                        <option value="">—</option>
                        {FACINGS.map((f) => (
                          <option key={f} value={f}>
                            {tf(f)}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.error === "template" && <p className="mt-1.5 text-xs font-medium text-danger">{t("templateInvalid")}</p>}
        </fieldset>
      )}
      <Checkbox label={t("skipExisting")} checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
    </div>
  );
}

function PlotGenerator({ block, existing, onPlan }) {
  const t = useTranslations("inventory.bulk");
  const locale = useLocale();
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("20");
  const [road, setRoad] = useState("");
  const [width, setWidth] = useState("");
  const [area, setArea] = useState("");
  const [unit, setUnit] = useState("katha");
  const [skipExisting, setSkipExisting] = useState(true);

  const plan = useMemo(() => {
    if (!/^\d+$/.test(from) || !/^\d+$/.test(to) || Number(from) > Number(to)) return { error: "range", units: [] };
    if (!dec(width, 2)) return { error: "width", units: [] };
    if (!dec(area, 4) || (area !== "" && Number(area) <= 0)) return { error: "area", units: [] };
    const taken = new Set(existing.map((u) => String(u.plotNo)));
    const units = [];
    let skipped = 0;
    for (let i = Number(from); i <= Number(to); i++) {
      if (skipExisting && taken.has(String(i))) {
        skipped++;
        continue;
      }
      units.push({
        blockId: block.id,
        plotNo: String(i),
        code: `${block.code}-${i}`,
        ...(road.trim() && { road: road.trim() }),
        ...(width !== "" && { roadWidthFt: Number(width) }),
        ...(area !== "" && { landArea: { value: Number(area), unit } }),
      });
    }
    return { units, skipped };
  }, [block, existing, from, to, road, width, area, unit, skipExisting]);
  useEffect(() => onPlan(plan), [plan, onPlan]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <Field label={t("fromPlot")} error={plan.error === "range" ? t("rangeInvalid") : undefined}>
          <Input inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("toPlot")}>
          <Input inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Field label={t("road")}>
          <Input placeholder="Road 5" value={road} onChange={(e) => setRoad(e.target.value)} />
        </Field>
        <Field label={t("roadWidth")} error={plan.error === "width" ? t("numberInvalid") : undefined}>
          <Input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} />
        </Field>
      </div>
      <Field label={t("landArea")} hint={t("landHint")} error={plan.error === "area" ? t("areaInvalid") : undefined}>
        <div className="flex gap-2">
          <Input inputMode="decimal" className="flex-1" value={area} onChange={(e) => setArea(e.target.value)} />
          <Segmented
            name="bulkUnit"
            aria-label={t("landArea")}
            value={unit}
            onChange={setUnit}
            options={[
              { value: "katha", label: areaUnitLabel("katha", locale) },
              { value: "decimal", label: areaUnitLabel("decimal", locale) },
            ]}
          />
        </div>
      </Field>
      <Checkbox label={t("skipExistingPlots")} checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
    </div>
  );
}

/** Generate many units in one go (API: POST /projects/:id/units/bulk, all-or-nothing per call). */
export function BulkDrawer({ open, project, block, existing, onClose }) {
  const t = useTranslations("inventory.bulk");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const [plan, setPlan] = useState({ units: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const count = plan.units?.length ?? 0;
  const tooMany = count > MAX;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest(`/projects/${project.id}/units/bulk`, { method: "POST", body: { units: plan.units } });
      toast.success(t("created", { n: formatNumber(res.meta?.created ?? count, locale) }));
      await qc.invalidateQueries({ queryKey: keys.units(project.id, block.id) });
      qc.invalidateQueries({ queryKey: keys.project(project.id) });
      onClose();
    } catch (err) {
      const detail = Array.isArray(err?.details) ? err.details[0] : null;
      setError(err?.code === "DUPLICATE" || detail?.message?.startsWith("Duplicate") ? t("duplicate") : errorMessage(te, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={t("title", { block: block?.name ?? "" })}
      description={t("description")}
      footer={
        <>
          <p className="mr-auto self-center text-xs text-ink-muted">
            {plan.error
              ? t("fix")
              : t("summary", { n: formatNumber(count, locale), skipped: formatNumber(plan.skipped ?? 0, locale) })}
            {count > 0 && !plan.error && (
              <span className="ml-2 font-mono text-ink">
                {plan.units[0].code} … {plan.units.at(-1).code}
              </span>
            )}
          </p>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!count || Boolean(plan.error) || tooMany}>
            {t("generate", { n: formatNumber(count, locale) })}
          </Button>
        </>
      }
    >
      {open && block && (
        <div className="space-y-5">
          <FormAlert>{error ?? (tooMany ? t("tooMany", { max: MAX }) : null)}</FormAlert>
          {project.kind === "apartment" ? (
            <ApartmentGenerator block={block} existing={existing} onPlan={setPlan} />
          ) : (
            <PlotGenerator block={block} existing={existing} onPlan={setPlan} />
          )}
          <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">{t("note")}</p>
        </div>
      )}
    </Drawer>
  );
}
