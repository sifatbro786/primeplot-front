"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useCrmError } from "@/lib/crm/errors";
import { flatPages, useTaskCounts, useTaskList } from "@/lib/crm/queries";
import { useLeadParam } from "@/lib/crm/url";
import { LeadDrawer } from "./LeadDrawer";
import { TaskRow } from "./LeadTasks";
import { useNow, useNum } from "./parts";

const DUE = ["overdue", "today", "upcoming", "all"];

/** /dashboard/tasks — "My tasks": follow-ups due, overdue first. Managers can switch to everyone's. */
export function TasksPage() {
  const t = useTranslations("crm.myTasks");
  const tc = useTranslations("common");
  const { can } = useSession();
  const crmError = useCrmError();
  const now = useNow();
  const num = useNum();
  const drawer = useLeadParam();
  const counts = useTaskCounts();
  const [due, setDue] = useState("today");
  const [scope, setScope] = useState("mine");
  const list = useTaskList({ due, scope, status: "open" });
  const rows = flatPages(list.data);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        {["overdue", "today"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDue(k)}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              due === k ? "border-primary bg-surface" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className={cn("block font-display text-3xl leading-none", k === "overdue" && (counts.data?.overdue ?? 0) > 0 && "text-danger")}>
              {num(counts.data?.[k] ?? 0)}
            </span>
            <span className="mt-1.5 block text-xs text-ink-muted">{t(`count.${k}`)}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented aria-label={t("due")} size="sm" value={due} onChange={setDue} options={DUE.map((d) => ({ value: d, label: t(`dueOptions.${d}`) }))} />
        {can("leads:read_all") && (
          <Segmented aria-label={t("scope")} size="sm" value={scope} onChange={setScope} options={["mine", "all"].map((s) => ({ value: s, label: t(`scopeOptions.${s}`) }))} />
        )}
      </div>

      {list.isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={crmError(list.error)}
          requestId={list.error?.requestId}
          requestIdLabel={tc("requestId")}
          action={
            <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ListChecks} title={t(`empty.${due}`)} description={t("emptyBody")} />
      ) : (
        <div className="rounded-lg border border-line bg-surface px-4">
          <ul className="divide-y divide-line">
            {rows.map((task) => (
              <TaskRow key={task.id} task={task} now={now} showLead onOpenLead={drawer.open} />
            ))}
          </ul>
          {list.hasNextPage && (
            <div className="border-t border-line py-3 text-center">
              <Button size="sm" variant="ghost" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {t("more")}
              </Button>
            </div>
          )}
        </div>
      )}

      <LeadDrawer leadId={drawer.leadId} onClose={drawer.close} />
    </div>
  );
}
