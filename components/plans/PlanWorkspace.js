"use client";

import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, PenLine, Plus, Scan, Settings2, Trash2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatBDTCompact, formatDate, formatLand, formatNumber, formatSqftArea } from "@/lib/format";
import { SOLD_STATUSES } from "@/lib/unitStatus";
import { floorLabel } from "@/components/inventory/ElevationGrid";
import { keys, useFloorPlan, useLiveInventory, useProject } from "@/components/inventory/queries";
import { UnitDrawer } from "@/components/inventory/UnitDrawer";
import { compressFloors } from "./geometry";
import { PlanCanvas } from "./PlanCanvas";
import { PlanEditor } from "./PlanEditor";
import { PlanMetaDrawer } from "./PlanMetaDrawer";

export const ZOOMS = [1, 1.5, 2, 3];

/** Unit status → plan tone (sold statuses share one colour, cancelled reads as blocked). */
export function unitTone(unit) {
  if (!unit) return "missing";
  if (SOLD_STATUSES.includes(unit.status) && unit.status !== "booked") return "sold";
  if (unit.status === "cancelled") return "blocked";
  return unit.status;
}

function viewTone(h) {
  if (!h.target) return h.unitId || h.position || h.blockId ? "missing" : "label";
  if (h.target.type === "block") return "block";
  return unitTone(h.target.unit);
}

export function ZoomControls({ zoom, setZoom }) {
  const t = useTranslations("plans.view");
  const i = ZOOMS.indexOf(zoom);
  return (
    <div className="inline-flex items-center rounded-md border border-line-strong bg-surface">
      <button type="button" className="grid size-8 place-items-center text-ink-muted hover:text-ink disabled:opacity-40" disabled={i <= 0} onClick={() => setZoom(ZOOMS[i - 1])} aria-label={t("zoomOut")}>
        <Minus aria-hidden className="size-3.5" />
      </button>
      <button type="button" className="h-8 min-w-12 border-x border-line px-1 font-mono text-[11px] text-ink-muted hover:text-ink" onClick={() => setZoom(1)} aria-label={t("zoomFit")}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="grid size-8 place-items-center text-ink-muted hover:text-ink disabled:opacity-40" disabled={i >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[i + 1])} aria-label={t("zoomIn")}>
        <Plus aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

function Live({ state }) {
  const t = useTranslations("inventory.live");
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted" role="status">
      <span aria-hidden className={cn("size-1.5 rounded-full", state === "live" ? "bg-status-available" : state === "connecting" ? "animate-pulse bg-status-held" : "bg-status-blocked")} />
      {t(state)}
    </span>
  );
}

function UnitTip({ unit, project }) {
  const t = useTranslations("plans.view");
  const locale = useLocale();
  if (!unit) return <p className="text-ink-muted">{t("noUnitHere")}</p>;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{unit.code}</span>
        <StatusChip status={unit.status} size="sm" />
      </div>
      <p className="text-ink-muted">{project.kind === "plot" ? formatLand(unit.landArea, locale) : formatSqftArea(unit.saleableSqft, unit.saleableSqm, locale)}</p>
      {unit.listPrice != null && <p className="font-mono">{formatBDTCompact(unit.listPrice, locale)}</p>}
      {unit.hold?.until && <p className="text-ink-muted">{t("heldUntil", { name: unit.hold.byName ?? "—", at: formatDate(unit.hold.until, locale, "datetime") })}</p>}
    </div>
  );
}

function BlockTip({ block }) {
  const t = useTranslations("plans.view");
  const locale = useLocale();
  const inv = block.inventory ?? { total: 0, byStatus: {} };
  return (
    <div className="space-y-1">
      <p className="font-semibold">
        <span className="font-mono">{block.code}</span> · {locale === "bn" && block.nameBn ? block.nameBn : block.name}
      </p>
      <p className="text-ink-muted">{t("blockAvailable", { available: formatNumber(inv.byStatus?.available ?? 0, locale), total: formatNumber(inv.total, locale) })}</p>
      <p className="text-[11px] text-accent">{t("openInventory")}</p>
    </div>
  );
}

function PlanViewer({ plan, project, floor, setFloor, live, onEdit, canWrite }) {
  const t = useTranslations("plans.view");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const router = useRouter();
  const [zoom, setZoom] = useState(1);
  const [unitState, setUnitState] = useState(null);
  const shown = plan.floor ?? floor;
  const fi = plan.floors.indexOf(shown);

  const counts = {};
  for (const h of plan.hotspots) {
    if (h.target?.type !== "unit" || !h.target.unit) continue;
    const g = unitTone(h.target.unit);
    counts[g] = (counts[g] ?? 0) + 1;
  }

  const label = (h) => {
    if (h.label) return h.label;
    if (h.target?.type === "unit") return h.target.unit?.code ?? h.position ?? "";
    if (h.target?.type === "block") return h.target.block.code;
    return "";
  };
  const title = (h) => {
    const u = h.target?.type === "unit" ? h.target.unit : null;
    if (u) return `${u.code} — ${t(`status.${unitTone(u)}`)}`;
    if (h.target?.type === "block") return h.target.block.name;
    return h.label ?? t("area");
  };
  const activate = (h) => {
    if (h.target?.type === "unit" && h.target.unit) setUnitState({ unitId: h.target.unit.id });
    else if (h.target?.type === "block") router.push(`/dashboard/projects/${project.id}?block=${h.target.block.id}`);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 border-y border-line py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {plan.kind === "floor" && plan.floors.length > 1 && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-8" disabled={fi <= 0} onClick={() => setFloor(plan.floors[fi - 1])} aria-label={t("prevFloor")}>
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <Select aria-label={t("floor")} value={String(shown)} onChange={(e) => setFloor(Number(e.target.value))} className="h-8! w-36 text-xs!">
                {plan.floors.map((f) => (
                  <option key={f} value={f}>
                    {t("floorN", { floor: floorLabel(f, locale, ti) })}
                  </option>
                ))}
              </Select>
              <Button size="icon" variant="ghost" className="size-8" disabled={fi >= plan.floors.length - 1} onClick={() => setFloor(plan.floors[fi + 1])} aria-label={t("nextFloor")}>
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label={t("legend")}>
            {["available", "held", "booked", "sold", "blocked"].map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 rounded-[2px] border", LEGEND[g])} />
                {t(`status.${g}`)}
                <span className="font-mono text-ink">{formatNumber(counts[g] ?? 0, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <Live state={live} />
          <ZoomControls zoom={zoom} setZoom={setZoom} />
        </div>
      </div>

      {plan.hotspots.length === 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-muted">{t("noAreasYet")}</p>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <PenLine aria-hidden className="size-3.5" />
              {t("drawAreas")}
            </Button>
          )}
        </div>
      )}

      <div className="max-h-[78vh] overflow-auto rounded-lg border border-line bg-surface-2">
        <PlanCanvas
          image={plan.image}
          width={plan.imageWidth}
          height={plan.imageHeight}
          hotspots={plan.hotspots}
          zoom={zoom}
          toneOf={viewTone}
          labelOf={label}
          titleOf={title}
          tooltipOf={(h) =>
            h.target?.type === "block" ? <BlockTip block={h.target.block} /> : h.target?.type === "unit" ? <UnitTip unit={h.target.unit} project={project} /> : <p>{h.label ?? t("area")}</p>
          }
          onActivate={activate}
          ariaLabel={t("canvasLabel", { title: plan.title })}
        />
      </div>
      <p className="mt-2 text-xs text-ink-subtle">{t("hint")}</p>

      <UnitDrawer state={unitState} project={project} blocks={project.blocks ?? []} onClose={() => setUnitState(null)} />
    </div>
  );
}

const LEGEND = {
  available: "bg-status-available/30 border-status-available",
  held: "bg-status-held/35 border-status-held",
  booked: "bg-status-booked/35 border-status-booked",
  sold: "bg-status-sold/40 border-status-sold",
  blocked: "hatch bg-surface border-status-blocked",
};

/** One plan: live view (status colours, click a unit) and the hotspot editor. */
export function PlanWorkspace() {
  const { id, planId } = useParams();
  const params = useSearchParams();
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const { can } = useSession();
  const canWrite = can("projects:write");
  const { data: project } = useProject(id);
  const [floor, setFloor] = useState(null);
  const plan = useFloorPlan(planId, floor);
  const live = useLiveInventory(id);
  const [mode, setMode] = useState(params.get("edit") === "1" ? "edit" : "view");
  const [dirty, setDirty] = useState(false);
  const [meta, setMeta] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const back = (
    <Link href={`/dashboard/projects/${id}/plans`} className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
      <ArrowLeft aria-hidden className="size-3.5" />
      {t("allPlans")}
    </Link>
  );

  if (plan.isError) {
    return (
      <div className="space-y-4">
        {back}
        {plan.error?.status === 404 ? (
          <EmptyState icon={Scan} title={t("notFound")} />
        ) : (
          <ErrorState title={t("planLoadFailed")} description={errorMessage(te, plan.error)} requestId={plan.error?.requestId} requestIdLabel={tc("requestId")} />
        )}
      </div>
    );
  }
  if (!project || !plan.data) return <Skeleton className="h-[60vh] w-full" />;

  const p = plan.data;
  const block = project.blocks?.find((b) => b.id === p.blockId);
  const editing = mode === "edit" && canWrite;

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/floorplans/${p.id}`);
      qc.invalidateQueries({ queryKey: keys.floorplans(id) });
      qc.removeQueries({ queryKey: ["floorplan", p.id] });
      toast.success(t("deleted", { title: p.title }));
      router.replace(`/dashboard/projects/${id}/plans`);
    } catch (err) {
      toast.error(errorMessage(te, err));
      setDeleting(false);
    }
  };

  return (
    <div>
      {back}
      <header className="mt-3 mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="outline">{t(`kinds.${p.kind}`)}</Tag>
            {block && (
              <Tag>
                <span className="font-mono">{block.code}</span> {locale === "bn" && block.nameBn ? block.nameBn : block.name}
              </Tag>
            )}
          </div>
          <h3 className="mt-2 truncate font-display text-2xl leading-tight">{locale === "bn" && p.titleBn ? p.titleBn : p.title}</h3>
          {p.kind === "floor" && (
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {t("floorsShort")} {compressFloors(p.floors, (f) => floorLabel(f, locale, ti))}
            </p>
          )}
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              name="plan-mode"
              size="sm"
              aria-label={t("mode")}
              value={editing ? "edit" : "view"}
              disabled={dirty}
              onChange={setMode}
              options={[
                { value: "view", label: t("modes.view") },
                { value: "edit", label: t("modes.edit") },
              ]}
            />
            <Button size="sm" variant="ghost" disabled={dirty} onClick={() => setMeta({ plan: p })}>
              <Settings2 aria-hidden className="size-3.5" />
              {t("details")}
            </Button>
            {confirmDelete ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger-bg/60 px-2 py-1 text-xs">
                {t("confirmDelete")}
                <Button size="sm" variant="danger" loading={deleting} onClick={remove}>
                  {t("delete")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  {tc("cancel")}
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" disabled={dirty} onClick={() => setConfirmDelete(true)} aria-label={t("delete")}>
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </header>

      {editing ? (
        <PlanEditor key={`${p.id}:${p.version}`} plan={p} project={project} onDirty={setDirty} onDone={() => setMode("view")} />
      ) : (
        <PlanViewer plan={p} project={project} floor={floor} setFloor={setFloor} live={live} canWrite={canWrite} onEdit={() => setMode("edit")} />
      )}

      <PlanMetaDrawer state={meta} project={project} onClose={() => setMeta(null)} />
    </div>
  );
}
