"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { SmartImage } from "@/components/media/SmartImage";
import { discardMedia, uploadMedia, useUploadError } from "@/components/media/upload";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useRouter } from "@/i18n/navigation";
import { floorLabel } from "@/components/inventory/ElevationGrid";
import { keys, useFloorPlans } from "@/components/inventory/queries";

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

function floorRange(block) {
  const lo = block?.lowestFloor ?? 0;
  const hi = block?.highestFloor ?? Math.max(lo, 10);
  const out = [];
  for (let f = lo; f <= hi; f++) out.push(f);
  return out;
}

/**
 * Pick the floors a (typical) plan covers. Click toggles; Shift+click selects a run. Floors that
 * another plan of the same building already covers are marked (allowed — e.g. a revised plan).
 */
function FloorPicker({ block, value, onChange, covered }) {
  const t = useTranslations("plans.meta");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const [anchor, setAnchor] = useState(null);
  const floors = floorRange(block);
  const set = new Set(value);

  const click = (f, shift) => {
    if (shift && anchor != null) {
      const [a, b] = anchor < f ? [anchor, f] : [f, anchor];
      const next = new Set(value);
      for (let x = a; x <= b; x++) next.add(x);
      onChange([...next].sort((x, y) => x - y));
    } else {
      onChange(set.has(f) ? value.filter((x) => x !== f) : [...value, f].sort((x, y) => x - y));
    }
    setAnchor(f);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <button type="button" className="text-accent underline-offset-4 hover:underline" onClick={() => onChange(floors.filter((f) => f > 0))}>
          {t("allUpper")}
        </button>
        <button type="button" className="text-ink-muted underline-offset-4 hover:underline" onClick={() => onChange([])}>
          {t("clear")}
        </button>
      </div>
      <div role="group" aria-label={t("floors")} className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {floors.map((f) => {
          const on = set.has(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              title={covered.has(f) ? t("coveredBy", { title: covered.get(f) }) : undefined}
              onClick={(e) => click(f, e.shiftKey)}
              className={cn(
                "relative h-9 rounded-md border font-mono text-xs transition-colors",
                on ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {floorLabel(f, locale, ti)}
              {covered.has(f) && <span aria-hidden className={cn("absolute top-1 right-1 size-1.5 rounded-full", on ? "bg-primary-ink" : "bg-accent")} />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t("floorsHint")}</p>
    </div>
  );
}

function MetaForm({ project, plan, onClose, onBusy, formId }) {
  const t = useTranslations("plans.meta");
  const te = useTranslations("errors");
  const uploadError = useUploadError();
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const input = useRef(null);
  const apartment = project.kind === "apartment";
  const buildings = project.blocks ?? [];
  const plans = useFloorPlans(project.id).data ?? [];

  const [kind, setKind] = useState(plan?.kind ?? (apartment && buildings.length ? "floor" : "master"));
  const [blockId, setBlockId] = useState(plan?.blockId ?? buildings[0]?.id ?? "");
  const [floors, setFloors] = useState(plan?.floors ?? []);
  const [title, setTitle] = useState(plan?.title ?? "");
  const [titleBn, setTitleBn] = useState(plan?.titleBn ?? "");
  const [media, setMedia] = useState(plan?.image ?? null);
  const [uploaded, setUploaded] = useState([]); // ids to discard if the form is abandoned
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const block = buildings.find((b) => b.id === blockId);
  const inRange = floors.filter((f) => floorRange(block).includes(f));
  const covered = new Map();
  for (const p of plans) {
    if (p.kind !== "floor" || p.blockId !== blockId || p.id === plan?.id) continue;
    for (const f of p.floors) if (!covered.has(f)) covered.set(f, p.title);
  }

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const m = await uploadMedia(file, { purpose: kind === "floor" ? "floor_plan" : "master_plan" });
      setMedia(m);
      setUploaded((u) => [...u, m.id]);
      setErrors((e) => ({ ...e, image: undefined }));
    } catch (err) {
      toast.error(uploadError(err));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const close = () => {
    discardMedia(uploaded);
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!title.trim()) next.title = t("titleRequired");
    if (!media) next.image = t("imageRequired");
    if (kind === "floor" && !inRange.length) next.floors = t("floorsRequired");
    setErrors(next);
    if (Object.keys(next).length) return;

    if (saving || uploading) return;
    setSaving(true);
    onBusy(true);
    try {
      const body = {
        title: title.trim(),
        titleBn: titleBn.trim() || null,
        ...(kind === "floor" && { blockId, floors: inRange }),
      };
      let saved;
      if (plan) {
        saved = await api.patch(`/floorplans/${plan.id}`, {
          ...body,
          ...(media.id !== plan.mediaId && { mediaId: media.id }),
          version: plan.version,
        });
      } else {
        saved = await api.post(`/projects/${project.id}/floorplans`, { kind, ...body, mediaId: media.id });
      }
      discardMedia(uploaded.filter((id) => id !== media.id)); // replaced uploads in this session
      qc.invalidateQueries({ queryKey: keys.floorplans(project.id) });
      qc.invalidateQueries({ queryKey: ["floorplan", saved.id] });
      toast.success(plan ? t("saved") : t("created", { title: saved.title }));
      onClose(saved);
      if (!plan) router.push(`/dashboard/projects/${project.id}/plans/${saved.id}?edit=1`);
    } catch (err) {
      const map = { STALE_VERSION: t("stale"), FLOOR_OUT_OF_RANGE: t("floorOutOfRange"), INVALID_MEDIA: t("imageRequired") };
      setErrors({ root: map[err?.code] ?? errorMessage(te, err) });
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-6" onReset={close}>
      <FormAlert>{errors.root}</FormAlert>
      {!plan && apartment && (
        <Field label={t("kind")} hint={t(kind === "floor" ? "kindFloorHint" : "kindMasterHint")}>
          <Segmented
            name="plan-kind"
            aria-label={t("kind")}
            value={kind}
            onChange={setKind}
            className="self-start"
            options={[
              { value: "floor", label: t("kinds.floor") },
              { value: "master", label: t("kinds.master") },
            ]}
          />
        </Field>
      )}
      {!plan && !apartment && <p className="text-sm text-ink-muted">{t("plotMasterNote")}</p>}

      <Field label={t("image")} error={errors.image} required>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="blueprint group relative block aspect-[16/10] w-full overflow-hidden rounded-md border border-dashed border-line-strong/70 text-left"
          >
            {media ? (
              <SmartImage media={media} variant="card" sizes="480px" fit="contain" className="size-full" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-sm text-ink-muted">
                <span className="flex flex-col items-center gap-2">
                  <ImagePlus aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
                  {t("uploadImage")}
                </span>
              </span>
            )}
          </button>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" loading={uploading} onClick={() => input.current?.click()}>
              <ImagePlus aria-hidden className="size-3.5" />
              {media ? t("replaceImage") : t("uploadImage")}
            </Button>
            <p className="text-xs text-ink-muted">{t("imageHint")}</p>
          </div>
          {plan && media && media.id !== plan.mediaId && <p className="text-xs text-warning">{t("replaceWarning")}</p>}
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("title")} error={errors.title} required>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "floor" ? "Typical floor (3–12)" : "Site plan"} />
        </Field>
        <Field label={t("titleBn")}>
          <Input value={titleBn} lang="bn" maxLength={120} onChange={(e) => setTitleBn(e.target.value)} placeholder={kind === "floor" ? "টিপিক্যাল ফ্লোর" : "সাইট প্ল্যান"} />
        </Field>
      </div>

      {kind === "floor" && (
        <>
          <Field label={t("building")}>
            <Select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {locale === "bn" && b.nameBn ? b.nameBn : b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("floors")} error={errors.floors} required>
            <FloorPicker key={blockId} block={block} value={inRange} onChange={setFloors} covered={covered} />
          </Field>
        </>
      )}
    </form>
  );
}

/** Create a plan (state = {}) or edit its title/floors/image (state = { plan }). */
export function PlanMetaDrawer({ state, project, onClose }) {
  const t = useTranslations("plans.meta");
  const tc = useTranslations("common");
  const formId = "plan-meta-form";
  const plan = state?.plan ?? null;
  const [busy, setBusy] = useState(false);
  return (
    <Drawer
      open={Boolean(state)}
      onClose={() => document.getElementById(formId)?.reset()}
      title={plan ? t("editTitle") : t("createTitle")}
      description={plan ? plan.title : t("createDescription")}
      width="md"
      footer={
        <>
          <Button variant="ghost" type="reset" form={formId}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {plan ? tc("save") : t("create")}
          </Button>
        </>
      }
    >
      {state && <MetaForm key={plan?.id ?? "new"} project={project} plan={plan} onClose={onClose} onBusy={setBusy} formId={formId} />}
    </Drawer>
  );
}
