"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { KanbanSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { STAGE_SWATCH, stageName } from "@/lib/crm/constants";
import { useCrmError } from "@/lib/crm/errors";
import { clean, crmKeys, useBoard } from "@/lib/crm/queries";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { LeadCard } from "./LeadCard";
import { useNow, useNum } from "./parts";
import { useMoveLead } from "./useMoveLead";

/** Board cache: take `lead` out of its column and put it in `stageId` right after `afterId`. */
function applyMove(board, lead, stage, afterId) {
  if (!board) return board;
  const moved = { ...lead, stageId: stage.id, stage, status: stage.kind };
  return {
    ...board,
    stages: board.stages.map((col) => {
      let leads = col.leads.filter((l) => l.id !== lead.id);
      let count = col.count - (leads.length !== col.leads.length ? 1 : 0);
      if (col.id === stage.id) {
        const i = afterId ? leads.findIndex((l) => l.id === afterId) + 1 : 0;
        leads = [...leads.slice(0, i), moved, ...leads.slice(i)];
        count += 1;
      }
      return { ...col, leads, count };
    }),
  };
}

/** Cards win over their column when the pointer is over both. */
function collision(args) {
  const hits = pointerWithin(args);
  const card = hits.find((h) => String(h.id).startsWith("card:"));
  if (card) return [card];
  return hits.length ? hits : rectIntersection(args);
}

function DraggableCard({ lead, stageId, overId, ...rest }) {
  const { setNodeRef: dragRef, listeners, attributes, isDragging } = useDraggable({ id: lead.id, data: { lead } });
  const { setNodeRef: dropRef } = useDroppable({ id: `card:${lead.id}`, data: { stageId, beforeId: lead.id } });
  return (
    <div ref={dropRef}>
      <LeadCard
        lead={lead}
        dragRef={dragRef}
        dragProps={{ ...listeners, ...attributes, role: undefined, tabIndex: 0 }}
        dragging={isDragging}
        dropBefore={overId === `card:${lead.id}` && !isDragging}
        {...rest}
      />
    </div>
  );
}

function Column({ col, children, overId, footer, dnd }) {
  const locale = useLocale();
  const t = useTranslations("crm.board");
  const num = useNum();
  const { setNodeRef: dropRef } = useDroppable({ id: `col:${col.id}`, data: { stageId: col.id }, disabled: !dnd });
  return (
    <section aria-label={stageName(col, locale)} className="flex w-full flex-col md:w-72 md:shrink-0">
      <header className="mb-2.5 flex items-center gap-2 px-1">
        <span aria-hidden className={cn("size-2.5 rounded-[1px]", STAGE_SWATCH[col.color] ?? STAGE_SWATCH.neutral)} />
        <h3 className="min-w-0 truncate text-sm font-semibold">{stageName(col, locale)}</h3>
        <span className="font-mono text-xs text-ink-subtle">{num(col.count)}</span>
        {col.kind !== "open" && <span className="ml-auto text-[10px] tracking-wide text-ink-subtle uppercase">{t(`kind.${col.kind}`)}</span>}
      </header>
      <div
        ref={dropRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2.5 rounded-lg border border-transparent bg-surface-2/70 p-2 transition-colors",
          overId === `col:${col.id}` && "border-accent/50 bg-accent-soft",
          col.kind === "lost" && "bg-surface-2/40",
        )}
      >
        {children}
        {footer}
      </div>
    </section>
  );
}

/**
 * Kanban for one pipeline. Desktop: drag cards between/within columns (optimistic; a stale
 * board snaps back and reloads). Phone: one column at a time (tabs) + each card's "Move to…".
 */
export function PipelineBoard({ query, onOpen }) {
  const t = useTranslations("crm.board");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const crmError = useCrmError();
  const now = useNow();
  const num = useNum();
  const desktop = useMediaQuery("(min-width: 768px)");
  const key = crmKeys.board(clean(query));
  const board = useBoard(query);
  const { move, dialog } = useMoveLead();
  const [active, setActive] = useState(null);
  const [overId, setOverId] = useState(null);
  const [tab, setTab] = useState(null);
  const [loadingMore, setLoadingMore] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = board.data?.stages ?? [];

  const moveTo = (lead, stage, afterId, beforeId) => {
    const snapshot = qc.getQueryData(key);
    return move(lead, stage, {
      afterId,
      beforeId,
      onOptimistic: () => qc.setQueryData(key, (b) => applyMove(b, lead, stage, afterId)),
      onRevert: () => qc.setQueryData(key, snapshot),
    });
  };

  // "Move to…" menu: top of the target column.
  const menuMove = (lead, stage) => moveTo(lead, stage, null, null);

  const onDragEnd = ({ active: a, over }) => {
    setActive(null);
    setOverId(null);
    const lead = a?.data.current?.lead;
    if (!lead || !over) return;
    const { stageId, beforeId } = over.data.current ?? {};
    const col = columns.find((c) => c.id === stageId);
    if (!col || beforeId === lead.id) return;
    const list = col.leads.filter((l) => l.id !== lead.id);
    let afterId = null;
    let before = null;
    if (beforeId) {
      const i = list.findIndex((l) => l.id === beforeId);
      before = beforeId;
      afterId = i > 0 ? list[i - 1].id : null;
    } else {
      afterId = list.at(-1)?.id ?? null;
    }
    if (lead.stageId === col.id) {
      const idx = col.leads.findIndex((l) => l.id === lead.id);
      if ((col.leads[idx - 1]?.id ?? null) === afterId && (col.leads[idx + 1]?.id ?? null) === before) return; // same place
    }
    moveTo(lead, col, afterId, before);
  };

  const loadMore = async (col) => {
    const last = col.leads.at(-1);
    if (!last) return;
    setLoadingMore(col.id);
    try {
      const res = await apiRequest(`/leads/board/stages/${col.id}`, { query: { ...clean(query), afterRank: last.rank, afterId: last.id, limit: 50 } });
      qc.setQueryData(key, (b) =>
        b && {
          ...b,
          stages: b.stages.map((c) => (c.id === col.id ? { ...c, leads: [...c.leads, ...res.data.filter((l) => !c.leads.some((x) => x.id === l.id))], hasMore: Boolean(res.meta?.hasMore) } : c)),
        },
      );
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setLoadingMore(null);
    }
  };

  if (board.isError) {
    return (
      <ErrorState
        title={t("loadFailed")}
        description={crmError(board.error)}
        requestId={board.error?.requestId}
        requestIdLabel={tc("requestId")}
        action={
          <Button size="sm" variant="secondary" onClick={() => board.refetch()}>
            {tc("retry")}
          </Button>
        }
      />
    );
  }
  if (board.isPending) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }
  if (!columns.some((c) => c.count > 0)) {
    // Still render the empty columns on desktop so people see the pipeline shape.
    if (!desktop) return <EmptyState icon={KanbanSquare} title={t("emptyTitle")} description={t("emptyBody")} />;
  }

  const allStages = columns;
  const cardProps = { stages: allStages, now, onOpen, onMove: menuMove };
  const footer = (col) =>
    col.hasMore && (
      <Button size="sm" variant="ghost" className="w-full" loading={loadingMore === col.id} onClick={() => loadMore(col)}>
        {t("loadMore")}
      </Button>
    );
  const empty = <p className="px-2 py-6 text-center text-xs text-ink-subtle">{t("columnEmpty")}</p>;

  if (!desktop) {
    const current = columns.find((c) => c.id === tab) ?? columns.find((c) => c.count > 0) ?? columns[0];
    return (
      <div>
        <div role="tablist" aria-label={t("columns")} className="-mx-4 mb-4 flex gap-1.5 scroll-x px-4 pb-1">
          {columns.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === current?.id}
              onClick={() => setTab(c.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm",
                c.id === current?.id ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted",
              )}
            >
              <span aria-hidden className={cn("size-2 rounded-[1px]", STAGE_SWATCH[c.color] ?? STAGE_SWATCH.neutral)} />
              {stageName(c, locale)}
              <span className="font-mono text-xs opacity-70">{num(c.count)}</span>
            </button>
          ))}
        </div>
        {current && (
          <Column col={current} footer={footer(current)} dnd={false}>
            {current.leads.length ? current.leads.map((l) => <LeadCard key={l.id} lead={l} {...cardProps} />) : empty}
          </Column>
        )}
        {dialog}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => setActive(e.active.data.current?.lead ?? null)}
        onDragOver={(e) => setOverId(e.over?.id ?? null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActive(null);
          setOverId(null);
        }}
        accessibility={{ screenReaderInstructions: { draggable: t("dragHelp") } }}
      >
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-6 sm:-mx-8 sm:px-8">
          {columns.map((col) => (
            <Column key={col.id} col={col} overId={overId} footer={footer(col)} dnd>
              {col.leads.length
                ? col.leads.map((l) => <DraggableCard key={l.id} lead={l} stageId={col.id} overId={overId} {...cardProps} />)
                : empty}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <LeadCard lead={active} stages={allStages} now={now} overlay /> : null}</DragOverlay>
      </DndContext>
      {dialog}
    </>
  );
}
