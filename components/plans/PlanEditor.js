"use client";

import { useEffect, useState } from "react";
import { Copy, MousePointer2, PenTool, Redo2, Square, Trash2, Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { keys, useAllUnits, useBlockUnits } from "@/components/inventory/queries";
import { isTyping, MAX_HOTSPOTS, nextKey, round5, translate } from "./geometry";
import { PlanCanvas } from "./PlanCanvas";
import { ZoomControls } from "./PlanWorkspace";

const clean = (h) => ({
  key: h.key,
  label: h.label ?? "",
  unitId: h.unitId ?? null,
  position: h.position ?? null,
  blockId: h.blockId ?? null,
  points: h.points,
});
const targetKind = (h) => (h.unitId ? "unit" : h.position ? "position" : h.blockId ? "block" : "none");
const TOOLS = [
  { key: "select", icon: MousePointer2, shortcut: "V" },
  { key: "polygon", icon: PenTool, shortcut: "P" },
  { key: "rect", icon: Square, shortcut: "R" },
];
const byCode = (a, b) => a.localeCompare(b, "en", { numeric: true });

/**
 * Hotspot editor. Draw areas over the plan and link each one to what it shows:
 *  floor plans → a position (resolved per floor: one typical plan serves every floor) or a fixed unit;
 *  master plans → a plot/unit or a whole building/sector. An area with no link is a label (lift, park…).
 * Local history (undo/redo) until Save, which replaces the plan's whole hotspot list (PATCH + version).
 */
export function PlanEditor({ plan, project, onDirty, onDone }) {
  const t = useTranslations("plans.editor");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const floorPlan = plan.kind === "floor";

  const blockUnits = useBlockUnits(project.id, floorPlan ? plan.blockId : null);
  const allUnits = useAllUnits(project.id, { enabled: !floorPlan });
  const candidates = floorPlan
    ? (blockUnits.data ?? []).filter((u) => plan.floors.includes(u.floor))
    : (allUnits.data ?? []);
  const unitById = new Map(candidates.map((u) => [u.id, u]));
  for (const h of plan.hotspots) if (h.target?.unit && !unitById.has(h.target.unit.id)) unitById.set(h.target.unit.id, h.target.unit);
  const positions = [...new Set(candidates.map((u) => u.position).filter(Boolean))].sort(byCode);
  const blocks = project.blocks ?? [];
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const [baseline, setBaseline] = useState(() => plan.hotspots.map(clean));
  const [hist, setHist] = useState(() => ({ past: [], present: plan.hotspots.map(clean), future: [] }));
  const list = hist.present;
  const [selectedKey, setSelectedKey] = useState(null);
  const [tool, setTool] = useState(plan.hotspots.length ? "select" : "rect");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pendingKind, setPendingKind] = useState({});
  const selected = list.find((h) => h.key === selectedKey) ?? null;
  const dirty = JSON.stringify(list) !== JSON.stringify(baseline);

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ── history ──
  const commit = (next) => setHist((h) => ({ past: [...h.past, h.present].slice(-100), present: next, future: [] }));
  const begin = () => setHist((h) => ({ ...h, past: [...h.past, h.present].slice(-100), future: [] }));
  const live = (next) => setHist((h) => ({ ...h, present: next }));
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const update = (key, patch) => commit(list.map((h) => (h.key === key ? { ...h, ...patch } : h)));

  const used = {
    position: new Set(list.map((h) => h.position).filter(Boolean)),
    unit: new Set(list.map((h) => h.unitId).filter(Boolean)),
    block: new Set(list.map((h) => h.blockId).filter(Boolean)),
  };
  const freePositions = positions.filter((p) => !used.position.has(p));
  const freeUnits = floorPlan ? [] : candidates.filter((u) => !used.unit.has(u.id));
  const freeBlocks = floorPlan ? [] : blocks.filter((b) => !used.block.has(b.id));

  const create = (points) => {
    if (list.length >= MAX_HOTSPOTS) return toast.error(t("tooMany", { n: formatNumber(MAX_HOTSPOTS, locale) }));
    const h = { key: nextKey(list), label: "", unitId: null, position: floorPlan ? (freePositions[0] ?? null) : null, blockId: null, points };
    commit([...list, h]);
    setSelectedKey(h.key);
  };
  const remove = (key) => {
    commit(list.filter((h) => h.key !== key));
    setSelectedKey(null);
  };
  const duplicate = (key) => {
    const src = list.find((h) => h.key === key);
    if (!src || list.length >= MAX_HOTSPOTS) return;
    const h = { ...src, key: nextKey(list), unitId: null, position: null, blockId: null, points: translate(src.points, 0.02, 0.02) };
    commit([...list, h]);
    setSelectedKey(h.key);
  };
  const setTarget = (key, kind, value) =>
    update(key, { unitId: kind === "unit" ? value || null : null, position: kind === "position" ? value || null : null, blockId: kind === "block" ? value || null : null });

  // Keyboard shortcuts (not while typing).
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selectedKey) {
        e.preventDefault();
        duplicate(selectedKey);
      } else if (!mod && (e.key === "Delete" || (e.key === "Backspace" && tool === "select")) && selectedKey) {
        e.preventDefault();
        remove(selectedKey);
      } else if (!mod && e.key === "Escape" && tool === "select") {
        setSelectedKey(null);
      } else if (!mod && !e.altKey) {
        const next = TOOLS.find((x) => x.shortcut.toLowerCase() === e.key.toLowerCase());
        if (next) setTool(next.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── display ──
  const unitCode = (id) => unitById.get(id)?.code;
  const shortLabel = (h) => h.label || h.position || unitCode(h.unitId) || blockById.get(h.blockId)?.code || "";
  const tone = (h) => (targetKind(h) !== "none" ? "linked" : h.label ? "label" : "unlinked");
  const unlinked = list.filter((h) => targetKind(h) === "none" && !h.label).length;
  const dupCount = list.length - new Set(list.map((h) => (h.position && `p:${h.position}`) || (h.unitId && `u:${h.unitId}`) || (h.blockId && `b:${h.blockId}`) || h.key)).size;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const hotspots = list.map((h) => ({
        key: h.key,
        ...(h.label.trim() && { label: h.label.trim() }),
        ...(h.unitId && { unitId: h.unitId }),
        ...(h.position && { position: h.position }),
        ...(h.blockId && { blockId: h.blockId }),
        points: h.points.map(([x, y]) => [round5(x), round5(y)]),
      }));
      await api.patch(`/floorplans/${plan.id}`, { version: plan.version, hotspots });
      setBaseline(list);
      qc.invalidateQueries({ queryKey: ["floorplan", plan.id] });
      qc.invalidateQueries({ queryKey: keys.floorplans(project.id) });
      toast.success(t("saved", { n: hotspots.length, count: formatNumber(hotspots.length, locale) }));
    } catch (err) {
      if (err?.code === "STALE_VERSION") setError({ stale: true, message: t("stale") });
      else if (err?.code === "INVALID_HOTSPOT_TARGET") setError({ message: t("badTargets", { keys: (err.details ?? []).map((d) => d.path).join(", ") }) });
      else setError({ message: errorMessage(te, err) });
    } finally {
      setSaving(false);
    }
  };

  const kindOptions = floorPlan
    ? [
        { value: "position", label: t("link.position") },
        { value: "unit", label: t("link.unit") },
        { value: "none", label: t("link.none") },
      ]
    : [
        { value: "unit", label: t(project.kind === "plot" ? "link.plot" : "link.unit") },
        { value: "block", label: t(project.kind === "plot" ? "link.sector" : "link.building") },
        { value: "none", label: t("link.none") },
      ];
  // A kind picked before its value is chosen (e.g. "Unit" → then pick from the list).
  const kindOf = (h) => (targetKind(h) !== "none" ? targetKind(h) : (pendingKind[h.key] ?? "none"));
  const chooseKind = (key, kind) => {
    setPendingKind((m) => ({ ...m, [key]: kind }));
    const first = kind === "position" ? freePositions[0] : kind === "block" ? freeBlocks[0]?.id : null;
    setTarget(key, kind, first ?? null);
  };
  const tk = selected ? kindOf(selected) : "none";
  const unitOptions = (selectedUnitId) => {
    const groups = new Map();
    for (const u of [...candidates].sort((a, b) => byCode(a.code, b.code))) {
      if (!groups.has(u.blockId)) groups.set(u.blockId, []);
      groups.get(u.blockId).push(u);
    }
    return [...groups].map(([bid, us]) => (
      <optgroup key={bid} label={blockById.get(bid)?.name ?? "—"}>
        {us.map((u) => (
          <option key={u.id} value={u.id}>
            {u.code}
            {used.unit.has(u.id) && u.id !== selectedUnitId ? ` · ${t("usedMark")}` : ""}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <div className="space-y-4">
      {error && (
        <FormAlert>
          <span className="flex flex-wrap items-center justify-between gap-3">
            {error.message}
            {error.stale && (
              <Button size="sm" variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ["floorplan", plan.id] })}>
                {t("reload")}
              </Button>
            )}
          </span>
        </FormAlert>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <div role="radiogroup" aria-label={t("tools")} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
          {TOOLS.map(({ key, icon: Icon, shortcut }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={tool === key}
              title={`${t(`tool.${key}`)} (${shortcut})`}
              onClick={() => setTool(key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-medium",
                tool === key ? "bg-primary text-primary-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              <span className="hidden sm:inline">{t(`tool.${key}`)}</span>
            </button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <Button size="icon" variant="ghost" className="size-8" disabled={!hist.past.length} onClick={undo} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`}>
          <Undo2 aria-hidden className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" className="size-8" disabled={!hist.future.length} onClick={redo} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`}>
          <Redo2 aria-hidden className="size-4" />
        </Button>
        <p className="ml-1 hidden min-w-0 flex-1 truncate text-xs text-ink-muted md:block">{t(`help.${tool}`)}</p>
        <div className="ml-auto">
          <ZoomControls zoom={zoom} setZoom={setZoom} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="max-h-[78vh] overflow-auto rounded-lg border border-line bg-surface-2">
            <PlanCanvas
              mode="edit"
              image={plan.image}
              width={plan.imageWidth}
              height={plan.imageHeight}
              hotspots={list}
              zoom={zoom}
              tool={tool}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onCreate={create}
              onBeginChange={begin}
              onPointsChange={(key, points) => live(list.map((h) => (h.key === key ? { ...h, points } : h)))}
              toneOf={tone}
              labelOf={shortLabel}
              ariaLabel={t("canvasLabel")}
            />
          </div>
          <p className="mt-2 text-xs text-ink-subtle md:hidden">{t(`help.${tool}`)}</p>
        </div>

        {/* side panel */}
        <aside className="space-y-5">
          <section className="rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h4 className="text-sm font-semibold">{selected ? t("areaTitle", { name: shortLabel(selected) || selected.key }) : t("noSelection")}</h4>
              {selected && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => duplicate(selected.key)} aria-label={t("duplicate")} title={`${t("duplicate")} (Ctrl+D)`}>
                    <Copy aria-hidden className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-danger" onClick={() => remove(selected.key)} aria-label={t("deleteArea")} title={`${t("deleteArea")} (Del)`}>
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </div>
              )}
            </header>
            {selected ? (
              <div className="space-y-4 px-4 py-4">
                <Field label={t("linkTo")}>
                  <Segmented key={selected.key} name={`link-${selected.key}`} size="sm" aria-label={t("linkTo")} value={tk} onChange={(k) => chooseKind(selected.key, k)} options={kindOptions} className="flex w-full [&>label]:flex-1" />
                </Field>
                {tk === "position" && (
                  <Field label={t("position")} hint={t("positionHint")}>
                    <Select value={selected.position ?? ""} onChange={(e) => setTarget(selected.key, "position", e.target.value)} placeholder={t("pick")}>
                      {positions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                          {used.position.has(p) && p !== selected.position ? ` · ${t("usedMark")}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {tk === "unit" && (
                  <Field label={t(project.kind === "plot" ? "plot" : "unit")} hint={floorPlan ? t("fixedUnitHint") : undefined}>
                    <Select value={selected.unitId ?? ""} onChange={(e) => setTarget(selected.key, "unit", e.target.value)} placeholder={t("pick")}>
                      {unitOptions(selected.unitId)}
                    </Select>
                  </Field>
                )}
                {tk === "block" && (
                  <Field label={t(project.kind === "plot" ? "sector" : "building")}>
                    <Select value={selected.blockId ?? ""} onChange={(e) => setTarget(selected.key, "block", e.target.value)} placeholder={t("pick")}>
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} · {locale === "bn" && b.nameBn ? b.nameBn : b.name}
                          {used.block.has(b.id) && b.id !== selected.blockId ? ` · ${t("usedMark")}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label={t("label")} hint={tk === "none" ? t("labelHintNone") : t("labelHint")}>
                  <Input value={selected.label} maxLength={60} onChange={(e) => live(list.map((h) => (h.key === selected.key ? { ...h, label: e.target.value } : h)))} onFocus={begin} placeholder={tk === "none" ? t("labelPlaceholder") : ""} />
                </Field>
                <p className="font-mono text-[11px] text-ink-subtle">{t("corners", { n: formatNumber(selected.points.length, locale) })}</p>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm leading-relaxed text-ink-muted">{t(list.length ? "selectHint" : "startHint")}</p>
            )}
          </section>

          {(freePositions.length > 0 || freeUnits.length > 0 || freeBlocks.length > 0) && (
            <section className="rounded-lg border border-line bg-surface px-4 py-3">
              <h4 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("notOnPlan")}</h4>
              <p className="mt-1 mb-3 text-xs text-ink-muted">{t(selected ? "notOnPlanAssign" : "notOnPlanBody")}</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {freePositions.map((p) => (
                  <button key={p} type="button" disabled={!selected} onClick={() => setTarget(selected.key, "position", p)} className="h-7 rounded-sm border border-warning/40 bg-warning-bg px-2 font-mono text-xs text-ink enabled:hover:border-warning disabled:cursor-default">
                    {p}
                  </button>
                ))}
                {freeUnits.slice(0, 120).map((u) => (
                  <button key={u.id} type="button" disabled={!selected} onClick={() => setTarget(selected.key, "unit", u.id)} className="h-7 rounded-sm border border-warning/40 bg-warning-bg px-2 font-mono text-xs text-ink enabled:hover:border-warning disabled:cursor-default">
                    {u.code}
                  </button>
                ))}
                {freeUnits.length > 120 && <span className="self-center text-xs text-ink-muted">+{formatNumber(freeUnits.length - 120, locale)}</span>}
                {freeBlocks.map((b) => (
                  <button key={b.id} type="button" disabled={!selected} onClick={() => setTarget(selected.key, "block", b.id)} className="h-7 rounded-sm border border-line-strong bg-surface-2 px-2 text-xs text-ink enabled:hover:border-ink-muted disabled:cursor-default">
                    <span className="font-mono">{b.code}</span> {b.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-line bg-surface">
            <h4 className="border-b border-line px-4 py-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("areasList", { n: formatNumber(list.length, locale) })}</h4>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-subtle">{t("noAreas")}</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                {list.map((h) => (
                  <li key={h.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setTool("select");
                        setSelectedKey(h.key);
                      }}
                      aria-current={h.key === selectedKey || undefined}
                      className={cn("flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-canvas", h.key === selectedKey && "bg-accent-soft/60")}
                    >
                      <span className="truncate font-mono text-xs">{shortLabel(h) || "—"}</span>
                      <span className={cn("text-[11px]", tone(h) === "unlinked" ? "text-warning" : "text-ink-subtle")}>{t(`kindShort.${targetKind(h)}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* save bar */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <span className="mr-auto text-xs text-ink-muted">
          {dirty ? t("unsaved") : t("allSaved")}
          {unlinked > 0 && <span className="ml-3 text-warning">{t("unlinkedWarn", { n: unlinked, count: formatNumber(unlinked, locale) })}</span>}
          {dupCount > 0 && <span className="ml-3 text-warning">{t("dupWarn", { n: dupCount, count: formatNumber(dupCount, locale) })}</span>}
        </span>
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => commit(baseline)}>
          {t("discard")}
        </Button>
        {!dirty && (
          <Button variant="secondary" onClick={onDone}>
            {t("done")}
          </Button>
        )}
        <Button loading={saving} disabled={!dirty} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
