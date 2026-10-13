"use client";

import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { fromDhakaInput, REMIND_OPTIONS, TASK_TYPES, toDhakaInput } from "@/lib/crm/constants";
import { isStale, useCrmError } from "@/lib/crm/errors";
import { useAssignees, useCrmRefresh, useLeadTasks } from "@/lib/crm/queries";
import { formatDate } from "@/lib/format";
import { Avatar } from "./parts";

/** One task row: tick to complete, menu-less cancel. Shared with "My tasks". */
export function TaskRow({ task, now, showLead, onOpenLead }) {
  const t = useTranslations("crm.tasks");
  const locale = useLocale();
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const [busy, setBusy] = useState(false);
  const overdue = task.status === "open" && new Date(task.dueAt).getTime() < now;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/leads/tasks/${task.id}`, { version: task.version, status });
      if (status === "done") toast.success(t("doneToast"));
      refresh(task.leadId);
    } catch (err) {
      toast.error(isStale(err) ? t("stale") : crmError(err));
      refresh(task.leadId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("flex items-start gap-3 py-3", task.status !== "open" && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
        checked={task.status === "done"}
        disabled={busy || task.status === "cancelled"}
        onChange={() => setStatus(task.status === "done" ? "open" : "done")}
        aria-label={t("complete", { title: task.title })}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", task.status === "done" && "line-through")}>{task.title}</p>
        <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 text-xs", overdue ? "font-semibold text-danger" : "text-ink-muted")}>
          <span>
            {t(`types.${task.type}`)} · {overdue ? t("overdue") : ""} {formatDate(task.dueAt, locale, "datetime")}
          </span>
          {showLead && task.leadName && (
            <button type="button" onClick={() => onOpenLead?.(task.leadId)} className="font-medium text-accent underline-offset-2 hover:underline">
              {task.leadName}
            </button>
          )}
        </p>
      </div>
      {task.assigneeName && <Avatar name={task.assigneeName} size="sm" />}
      {task.status === "open" && (
        <Button size="sm" variant="ghost" className="-my-1 text-xs text-ink-muted" disabled={busy} onClick={() => setStatus("cancelled")}>
          {t("cancel")}
        </Button>
      )}
    </li>
  );
}

function TaskForm({ lead, onDone }) {
  const t = useTranslations("crm.tasks");
  const tc = useTranslations("common");
  const { can } = useSession();
  const canAssign = can("leads:assign");
  const assignees = useAssignees({ enabled: canAssign });
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("call");
  const [due, setDue] = useState(() => toDhakaInput(Date.now() + 2 * 3_600_000));
  const [remind, setRemind] = useState("15");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (title.trim().length < 2 || !due) return;
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/tasks`, {
        title: title.trim(),
        type,
        dueAt: fromDhakaInput(due),
        remindMinutesBefore: remind === "none" ? null : Number(remind),
        ...(owner && { assigneeId: owner }),
      });
      toast.success(t("added"));
      refresh(lead.id);
      onDone();
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-surface-2/50 p-3">
      <Field label={t("title")} required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t("titlePlaceholder")} autoFocus />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("type")}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TASK_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`types.${x}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("due")} required>
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label={t("remind")}>
          <Select value={remind} onChange={(e) => setRemind(e.target.value)}>
            {REMIND_OPTIONS.map((m) => (
              <option key={m} value={String(m)}>
                {t(`remindOptions.${m}`)}
              </option>
            ))}
            <option value="none">{t("remindOptions.none")}</option>
          </Select>
        </Field>
        {canAssign && (
          <Field label={t("owner")}>
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">{t("ownerDefault")}</option>
              {(assignees.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button size="sm" type="submit" loading={busy} disabled={title.trim().length < 2 || !due}>
          {t("add")}
        </Button>
      </div>
    </form>
  );
}

/** Tasks of one lead (drawer tab). Closed leads can't take new tasks (API: LEAD_CLOSED). */
export function LeadTasks({ lead, now }) {
  const t = useTranslations("crm.tasks");
  const { can } = useSession();
  const tasks = useLeadTasks(lead.id);
  const [showDone, setShowDone] = useState(false);
  const done = useLeadTasks(lead.id, "done", { enabled: showDone });
  const [adding, setAdding] = useState(false);
  const open = tasks.data ?? [];

  return (
    <div>
      {can("leads:write") && lead.status === "open" && (
        <div className="mb-4">
          {adding ? (
            <TaskForm lead={lead} onDone={() => setAdding(false)} />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" />
              {t("new")}
            </Button>
          )}
        </div>
      )}
      {tasks.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : open.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CalendarClock aria-hidden className="size-6 text-ink-subtle" strokeWidth={1.4} />
          <p className="mt-2 text-sm text-ink-muted">{t("none")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} now={now} />
          ))}
        </ul>
      )}
      <details className="mt-4" onToggle={(e) => setShowDone(e.currentTarget.open)}>
        <summary className="cursor-pointer text-xs font-medium text-ink-muted">{t("showDone")}</summary>
        {done.isPending && showDone ? (
          <Skeleton className="mt-2 h-12 w-full" />
        ) : (done.data ?? []).length ? (
          <ul className="mt-1 divide-y divide-line">
            {done.data.map((task) => (
              <TaskRow key={task.id} task={task} now={now} />
            ))}
          </ul>
        ) : (
          showDone && <p className="mt-2 text-xs text-ink-subtle">{t("noneDone")}</p>
        )}
      </details>
    </div>
  );
}
