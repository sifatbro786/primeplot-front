"use client";

import { useState } from "react";
import { Building2, Layers, Pencil, Plus, Rows3, Wand2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { errorMessage, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { SOLD_STATUSES, UNIT_STATUS_SWATCH } from "@/lib/unitStatus";
import { BlockDrawer } from "./BlockDrawer";
import { BulkDrawer } from "./BulkDrawer";
import { ElevationGrid } from "./ElevationGrid";
import { PlotGrid } from "./PlotGrid";
import { useBlockUnits, useLiveInventory, useProject } from "./queries";
import { UnitDrawer } from "./UnitDrawer";

const FILTERS = [
  { key: "all", statuses: null },
  { key: "available", statuses: ["available"] },
  { key: "held", statuses: ["held"] },
  { key: "sold", statuses: SOLD_STATUSES },
  { key: "blocked", statuses: ["blocked", "cancelled"] },
];

function LiveBadge({ state }) {
  const t = useTranslations("inventory.live");
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted" role="status">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          state === "live" ? "bg-status-available" : state === "connecting" ? "animate-pulse bg-status-held" : "bg-status-blocked",
        )}
      />
      {t(state)}
    </span>
  );
}

/** The inventory workspace: pick a building/sector, see every unit live, act on one. */
export function InventoryTab() {
  const { id } = useParams();
  const t = useTranslations("inventory");
  const tg = useTranslations("inventory.groups");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { can } = useSession();
  const { data: project } = useProject(id);
  const blocks = project?.blocks ?? [];
  const search = useSearchParams();
  const [picked, setPicked] = useState(() => search.get("block")); // plan viewer links here with ?block=
  const block = blocks.find((b) => b.id === picked) ?? blocks[0];
  const units = useBlockUnits(id, block?.id);
  const live = useLiveInventory(id);
  const [filter, setFilter] = useState("all");
  const [unitState, setUnitState] = useState(null);
  const [blockState, setBlockState] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  if (!project) return <Skeleton className="h-96 w-full" />;
  const apartment = project.kind === "apartment";
  const list = units.data ?? [];
  const highlight = FILTERS.find((f) => f.key === filter)?.statuses ?? null;
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, f.statuses ? list.filter((u) => f.statuses.includes(u.status)).length : list.length]));
  const canWrite = can("units:write");

  if (!blocks.length) {
    return (
      <>
        <EmptyState
          icon={apartment ? Building2 : Layers}
          title={t(apartment ? "noBuildings" : "noBlocks")}
          description={t(apartment ? "noBuildingsBody" : "noBlocksBody")}
          action={
            can("projects:write") && (
              <Button size="sm" onClick={() => setBlockState({})}>
                <Plus aria-hidden className="size-4" />
                {t(apartment ? "addBuilding" : "addBlock")}
              </Button>
            )
          }
        />
        <BlockDrawer state={blockState} project={project} onClose={() => setBlockState(null)} onSaved={(b) => setPicked(b.id)} />
      </>
    );
  }

  return (
    <div>
      {/* buildings / sectors */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t(apartment ? "buildings" : "blocksLabel")} className="flex flex-wrap gap-1.5">
          {blocks.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === block.id}
              onClick={() => setPicked(b.id)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                b.id === block.id ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              <span className="font-mono text-xs">{b.code}</span>
              <span className="max-w-40 truncate">{locale === "bn" && b.nameBn ? b.nameBn : b.name}</span>
            </button>
          ))}
        </div>
        {can("projects:write") && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setBlockState({ block })} aria-label={t("editBlock", { code: block.code })}>
              <Pencil aria-hidden className="size-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBlockState({})}>
              <Plus aria-hidden className="size-3.5" />
              {t(apartment ? "addBuilding" : "addBlock")}
            </Button>
          </>
        )}
      </div>

      {/* toolbar: filter + live + actions */}
      <div className="mb-4 flex flex-col gap-3 border-y border-line py-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label={t("filter")} className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                filter === f.key ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {f.statuses && (
                <span aria-hidden className={cn("size-2 rounded-[1px]", f.key === "blocked" ? "hatch bg-status-blocked" : UNIT_STATUS_SWATCH[f.statuses[0]])} />
              )}
              {tg(f.key)}
              <span className="font-mono">{formatNumber(counts[f.key], locale)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge state={live} />
          {canWrite && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
                <Wand2 aria-hidden className="size-3.5" />
                {t("generate")}
              </Button>
              <Button size="sm" onClick={() => setUnitState({ create: { blockId: block.id } })}>
                <Plus aria-hidden className="size-3.5" />
                {t(apartment ? "addUnit" : "addPlot")}
              </Button>
            </>
          )}
        </div>
      </div>

      {units.isError ? (
        <ErrorState
          title={t("unitsLoadFailed")}
          description={errorMessage(te, units.error)}
          requestId={units.error?.requestId}
          requestIdLabel={tc("requestId")}
          action={
            <Button size="sm" variant="secondary" onClick={() => units.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : units.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : list.length === 0 && !(apartment && block.highestFloor != null) ? (
        <EmptyState
          icon={Rows3}
          title={t(apartment ? "noUnits" : "noPlots")}
          description={t(apartment ? "noUnitsBody" : "noPlotsBody")}
          action={
            canWrite && (
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                <Wand2 aria-hidden className="size-4" />
                {t("generate")}
              </Button>
            )
          }
        />
      ) : apartment ? (
        <ElevationGrid
          block={block}
          units={list}
          highlight={highlight}
          onOpen={(unitId) => setUnitState({ unitId })}
          onAdd={canWrite ? (slot) => setUnitState({ create: { blockId: block.id, ...slot } }) : null}
        />
      ) : (
        <PlotGrid units={list} highlight={highlight} onOpen={(unitId) => setUnitState({ unitId })} />
      )}

      <UnitDrawer state={unitState} project={project} blocks={blocks} onClose={() => setUnitState(null)} />
      <BlockDrawer state={blockState} project={project} onClose={() => setBlockState(null)} onSaved={(b) => setPicked(b.id)} />
      {canWrite && <BulkDrawer open={bulkOpen} project={project} block={block} existing={list} onClose={() => setBulkOpen(false)} />}
    </div>
  );
}
