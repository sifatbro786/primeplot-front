"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { LEAD_SOURCES, LEAD_TYPES, PRESET_VIEWS, stageName } from "@/lib/crm/constants";
import { useAssignees, useProjectOptions, useStages } from "@/lib/crm/queries";
import { useDebounced } from "@/lib/hooks/useDebounced";

/** Preset views as a row of chips (owner decision: presets + URL filters, no saved views API). */
export function ViewChips({ filters, setFilters }) {
  const t = useTranslations("crm.views");
  const { can } = useSession();
  const current = filters.view ?? "all";
  const views = PRESET_VIEWS.filter((v) => !v.needs || can(v.needs));
  return (
    <div role="tablist" aria-label={t("label")} className="-mx-1 mb-4 flex gap-1.5 scroll-x px-1 pb-1">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={current === v.key}
          onClick={() => setFilters({ view: v.key === "all" ? null : v.key, assignee: null, followUp: null, slaBreached: null, status: null })}
          className={cn(
            "h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors",
            current === v.key ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
          )}
        >
          {t(v.key)}
        </button>
      ))}
    </div>
  );
}

/**
 * Filter bar shared by the leads table (`mode="table"`) and the pipeline board (`mode="board"`
 * — the board API filters by owner, project, source, tag and search only).
 */
export function LeadFilters({ filters, setFilters, mode = "table" }) {
  const t = useTranslations("crm.filters");
  const ts = useTranslations("crm.sources");
  const tt = useTranslations("crm.types");
  const locale = useLocale();
  const { can } = useSession();
  const readAll = can("leads:read_all");
  const assignees = useAssignees({ enabled: readAll });
  const projects = useProjectOptions();
  const stages = useStages(filters.type ?? "buyer");
  const [q, setQ] = useState(filters.q ?? "");
  const search = useDebounced(q.trim(), 350);

  useEffect(() => {
    if ((filters.q ?? "") !== search) setFilters({ q: search || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [search]);

  const set = (key) => (e) => setFilters({ [key]: e.target.value || null, ...(key === "type" && { stageId: null }) });
  const active = ["q", "type", "stageId", "status", "source", "assignee", "projectId", "followUp", "tag"].some((k) => filters[k]);

  return (
    <div className={cn("mb-4 grid gap-2.5", mode === "table" ? "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]" : "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]")}>
      <Input
        leading={<Search className="size-4" />}
        placeholder={t("search")}
        aria-label={t("search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        trailing={
          q && (
            <button type="button" onClick={() => setQ("")} className="rounded-sm p-1 text-ink-subtle hover:text-ink" aria-label={t("clearSearch")}>
              <X className="size-3.5" />
            </button>
          )
        }
      />
      {mode === "table" && (
        <Select value={filters.type ?? ""} onChange={set("type")} aria-label={t("type")}>
          <option value="">{t("allTypes")}</option>
          {LEAD_TYPES.map((x) => (
            <option key={x} value={x}>
              {tt(x)}
            </option>
          ))}
        </Select>
      )}
      {mode === "table" && (
        <Select value={filters.stageId ?? ""} onChange={set("stageId")} aria-label={t("stage")}>
          <option value="">{t("allStages")}</option>
          {(stages.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {stageName(s, locale)}
            </option>
          ))}
        </Select>
      )}
      <Select value={filters.source ?? ""} onChange={set("source")} aria-label={t("source")}>
        <option value="">{t("allSources")}</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {ts(s)}
          </option>
        ))}
      </Select>
      {readAll ? (
        <Select value={filters.assignee ?? ""} onChange={set("assignee")} aria-label={t("owner")}>
          <option value="">{t("anyOwner")}</option>
          <option value="me">{t("me")}</option>
          <option value="unassigned">{t("unassigned")}</option>
          {(assignees.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      ) : (
        mode === "board" && <span className="hidden lg:block" />
      )}
      <Select value={filters.projectId ?? ""} onChange={set("projectId")} aria-label={t("project")}>
        <option value="">{t("anyProject")}</option>
        {(projects.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {(locale === "bn" && p.nameBn) || p.name}
          </option>
        ))}
      </Select>
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setFilters({ q: null, type: null, stageId: null, status: null, source: null, assignee: null, projectId: null, followUp: null, tag: null, slaBreached: null });
          }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink sm:col-span-2 lg:col-span-1 lg:justify-self-start"
        >
          <X aria-hidden className="size-3.5" />
          {t("clear")}
        </button>
      )}
    </div>
  );
}
