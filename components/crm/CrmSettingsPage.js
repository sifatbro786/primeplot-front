"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { LEAD_TYPES, STAGE_COLORS, STAGE_KINDS, STAGE_SWATCH } from "@/lib/crm/constants";
import { isStale, useCrmError } from "@/lib/crm/errors";
import { crmKeys, useAssignees, useLeadSettings, useProjectOptions, useStages } from "@/lib/crm/queries";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useNum } from "./parts";

function Section({ title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr]">
      <header>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </header>
      <div className="max-w-3xl min-w-0 space-y-5">{children}</div>
    </section>
  );
}

// ── Pipeline stages ─────────────────────────────────────────────────────────────

function StagesEditor() {
  const t = useTranslations("crm.settings.stages");
  const tt = useTranslations("crm.types");
  const tc = useTranslations("common");
  const num = useNum();
  const crmError = useCrmError();
  const qc = useQueryClient();
  const [type, setType] = useState("buyer");
  const stages = useStages(type);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = rows ?? (stages.data ?? []).map((s) => ({ ...s }));
  const dirty = rows !== null;

  const update = (i, patch) => setRows(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const moveRow = (i, d) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRows(next);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.put("/leads/stages", {
        pipeline: type,
        stages: list.map((s) => ({ ...(s.id && { id: s.id }), name: s.name.trim(), nameBn: s.nameBn?.trim() || null, kind: s.kind, color: s.color })),
      });
      qc.setQueryData(crmKeys.stages(type), saved);
      qc.invalidateQueries({ queryKey: crmKeys.all });
      setRows(null);
      toast.success(t("saved"));
    } catch (err) {
      setError(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Segmented
        aria-label={t("pipeline")}
        value={type}
        onChange={(v) => {
          setType(v);
          setRows(null);
          setError(null);
        }}
        options={LEAD_TYPES.map((x) => ({ value: x, label: tt(`${x}Pipeline`) }))}
        size="sm"
      />
      <FormAlert>{error}</FormAlert>
      {stages.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ol className="space-y-2">
          {list.map((s, i) => (
            <li key={s.id ?? `new-${i}`} className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[auto_1fr_1fr_120px_auto] sm:items-center">
              <div className="flex items-center gap-1 sm:flex-col">
                <button type="button" disabled={i === 0} onClick={() => moveRow(i, -1)} className="rounded-sm p-1 text-ink-subtle hover:text-ink disabled:opacity-30" aria-label={t("up")}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" disabled={i === list.length - 1} onClick={() => moveRow(i, 1)} className="rounded-sm p-1 text-ink-subtle hover:text-ink disabled:opacity-30" aria-label={t("down")}>
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <Input aria-label={t("name")} value={s.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} placeholder={t("name")} />
              <Input aria-label={t("nameBn")} value={s.nameBn ?? ""} maxLength={60} onChange={(e) => update(i, { nameBn: e.target.value })} placeholder={t("nameBn")} lang="bn" />
              <Select aria-label={t("kind")} value={s.kind} onChange={(e) => update(i, { kind: e.target.value })} disabled={(s.count ?? 0) > 0}>
                {STAGE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2">
                <div role="radiogroup" aria-label={t("color")} className="flex gap-1">
                  {STAGE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={s.color === c}
                      aria-label={t(`colors.${c}`)}
                      onClick={() => update(i, { color: c })}
                      className={cn("size-4 rounded-[2px] ring-offset-1", STAGE_SWATCH[c], s.color === c && "ring-2 ring-primary")}
                    />
                  ))}
                </div>
                <span className="w-10 text-right font-mono text-xs text-ink-subtle" title={t("leadsInStage")}>
                  {s.count != null ? num(s.count) : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setRows(list.filter((_, j) => j !== i))}
                  disabled={(s.count ?? 0) > 0}
                  title={(s.count ?? 0) > 0 ? t("inUse") : t("remove")}
                  aria-label={t("remove")}
                  className="rounded-sm p-1.5 text-ink-subtle hover:bg-danger-bg hover:text-danger disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs leading-relaxed text-ink-muted">{t("rules")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={list.length >= 15}
          onClick={() => {
            const firstClosed = list.findIndex((s) => s.kind !== "open");
            const at = firstClosed === -1 ? list.length : firstClosed;
            setRows([...list.slice(0, at), { name: "", nameBn: "", kind: "open", color: "neutral" }, ...list.slice(at)]);
          }}
        >
          <Plus aria-hidden className="size-4" />
          {t("add")}
        </Button>
        <div className="flex-1" />
        {dirty && (
          <Button size="sm" variant="ghost" onClick={() => (setRows(null), setError(null))}>
            {tc("cancel")}
          </Button>
        )}
        <Button size="sm" disabled={!dirty || list.some((s) => !s.name.trim())} loading={busy} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

// ── Settings sections (assignment, SLA, auto-reply) ─────────────────────────────

/** PATCH one part of /leads/settings with the current version; the cache gets the new doc. */
function useSaveSettings() {
  const qc = useQueryClient();
  const crmError = useCrmError();
  const t = useTranslations("crm.settings");
  return async (version, patch) => {
    try {
      const saved = await api.patch("/leads/settings", { version, ...patch });
      qc.setQueryData(crmKeys.settings, saved);
      toast.success(t("saved"));
      return { ok: true };
    } catch (err) {
      if (isStale(err)) qc.invalidateQueries({ queryKey: crmKeys.settings });
      const field = err?.details?.[0];
      return { ok: false, message: isStale(err) ? t("stale") : crmError(err), field: field?.path, fieldMessage: field?.message };
    }
  };
}

function AssignmentSection({ settings }) {
  const t = useTranslations("crm.settings.assignment");
  const locale = useLocale();
  const projects = useProjectOptions();
  const assignees = useAssignees();
  const save = useSaveSettings();
  const [mode, setMode] = useState(settings.assignment.mode);
  const [pools, setPools] = useState(settings.assignment.projectPools);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const usedProjects = new Set(pools.map((p) => p.projectId));

  const submit = async () => {
    setBusy(true);
    const r = await save(settings.version, { assignment: { mode, projectPools: pools.filter((p) => p.projectId && p.userIds.length) } });
    setError(r.ok ? null : r.message);
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <FormAlert>{error}</FormAlert>
      <Segmented aria-label={t("mode")} value={mode} onChange={setMode} options={["round_robin", "manual"].map((m) => ({ value: m, label: t(`modes.${m}`) }))} />
      <p className="text-sm text-ink-muted">{t(`modeHelp.${mode}`)}</p>
      {mode === "round_robin" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{t("teams")}</p>
          <p className="text-sm text-ink-muted">{t("teamsHelp")}</p>
          {pools.map((pool, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    aria-label={t("project")}
                    value={pool.projectId}
                    onChange={(e) => setPools(pools.map((p, j) => (j === i ? { ...p, projectId: e.target.value } : p)))}
                    placeholder={t("pickProject")}
                  >
                    {(projects.data ?? []).map((p) => (
                      <option key={p.id} value={p.id} disabled={usedProjects.has(p.id) && p.id !== pool.projectId}>
                        {(locale === "bn" && p.nameBn) || p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button variant="ghost" size="icon" aria-label={t("removeTeam")} onClick={() => setPools(pools.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(assignees.data ?? []).map((u) => (
                  <Checkbox
                    key={u.id}
                    label={u.name}
                    checked={pool.userIds.includes(u.id)}
                    onChange={(e) =>
                      setPools(pools.map((p, j) => (j === i ? { ...p, userIds: e.target.checked ? [...p.userIds, u.id] : p.userIds.filter((x) => x !== u.id) } : p)))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setPools([...pools, { projectId: "", userIds: [] }])}>
            <Plus aria-hidden className="size-4" />
            {t("addTeam")}
          </Button>
        </div>
      )}
      <div className="flex justify-end">
        <Button size="sm" loading={busy} onClick={submit}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

const DAYS = [6, 0, 1, 2, 3, 4, 5]; // Saturday first — the Bangladesh work week

function SlaSection({ settings }) {
  const t = useTranslations("crm.settings.sla");
  const save = useSaveSettings();
  const [v, setV] = useState(settings.sla);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await save(settings.version, { sla: { ...v, firstResponseMinutes: Number(v.firstResponseMinutes) } });
    setError(r.ok ? null : r.message);
    setBusy(false);
  };
  const minutesOk = Number(v.firstResponseMinutes) >= 5 && Number(v.firstResponseMinutes) <= 1440;

  return (
    <div className="space-y-5">
      <FormAlert>{error}</FormAlert>
      <Checkbox label={t("enabled")} description={t("enabledHelp")} checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
      <fieldset disabled={!v.enabled} className="grid gap-5 disabled:opacity-50 sm:grid-cols-3">
        <Field label={t("minutes")} error={minutesOk ? undefined : t("minutesRange")}>
          <Input inputMode="numeric" value={v.firstResponseMinutes} onChange={(e) => setV({ ...v, firstResponseMinutes: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <Field label={t("officeStart")}>
          <Input type="time" value={v.officeStart} onChange={(e) => setV({ ...v, officeStart: e.target.value })} />
        </Field>
        <Field label={t("officeEnd")}>
          <Input type="time" value={v.officeEnd} onChange={(e) => setV({ ...v, officeEnd: e.target.value })} />
        </Field>
        <div className="sm:col-span-3">
          <p className="mb-2 text-xs font-medium">{t("weekend")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const off = v.weekend.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={off}
                  onClick={() => setV({ ...v, weekend: off ? v.weekend.filter((x) => x !== d) : [...v.weekend, d].slice(0, 6) })}
                  className={cn("h-8 rounded-md border px-3 text-xs font-medium", off ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:text-ink")}
                >
                  {t(`days.${d}`)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-muted">{t("weekendHelp")}</p>
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button size="sm" loading={busy} disabled={!minutesOk} onClick={submit}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

/** Live SMS length/cost of a template (POST /integrations/sms/preview). */
function SmsPreview({ text, locale }) {
  const t = useTranslations("crm.settings.autoReply");
  const num = useNum();
  const settle = useDebounced(text, 400);
  const [p, setP] = useState(null);
  useEffect(() => {
    let alive = true;
    api
      .post("/integrations/sms/preview", { text: settle, locale })
      .then((r) => alive && setP(r))
      .catch(() => alive && setP(null));
    return () => {
      alive = false;
    };
  }, [settle, locale]);
  if (!p) return null;
  const tooLong = p.segments > 6;
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5">
      <p className="text-sm whitespace-pre-line">{p.rendered}</p>
      <p className={cn("mt-2 text-xs", tooLong ? "font-semibold text-danger" : "text-ink-muted")}>
        {t("length", { chars: num(p.chars), segments: num(p.segments), encoding: t(`encoding.${p.encoding}`) })}
        {p.costPoisha != null && ` · ${t("cost", { taka: num(p.costPoisha / 100) })}`}
        {tooLong && ` · ${t("tooLong")}`}
      </p>
    </div>
  );
}

function AutoReplySection({ settings }) {
  const t = useTranslations("crm.settings.autoReply");
  const save = useSaveSettings();
  const [v, setV] = useState(settings.autoReply);
  const [error, setError] = useState(null);
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await save(settings.version, { autoReply: { enabled: v.enabled, textBn: v.textBn.trim(), textEn: v.textEn.trim() } });
    setError(r.ok ? null : r.message);
    setFieldErr(r.ok || !r.field ? {} : { [r.field.split(".").at(-1)]: r.fieldMessage });
    setBusy(false);
  };
  const insert = (field, token) => setV({ ...v, [field]: `${v[field]}${v[field].endsWith(" ") || !v[field] ? "" : " "}${token}` });

  return (
    <div className="space-y-5">
      <FormAlert>{error}</FormAlert>
      <Checkbox label={t("enabled")} description={t("enabledHelp")} checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
      {[
        ["textBn", "bn"],
        ["textEn", "en"],
      ].map(([field, locale]) => (
        <div key={field} className="space-y-2">
          <Field label={t(field)} error={fieldErr[field]}>
            <Textarea rows={3} maxLength={480} lang={locale} value={v[field]} onChange={(e) => setV({ ...v, [field]: e.target.value })} disabled={!v.enabled} />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-muted">{t("insert")}</span>
            {["{name}", "{company}"].map((tok) => (
              <button key={tok} type="button" disabled={!v.enabled} onClick={() => insert(field, tok)} className="h-6 rounded-sm border border-line bg-surface px-1.5 font-mono text-[11px] hover:border-line-strong disabled:opacity-50">
                {tok}
              </button>
            ))}
          </div>
          {v.enabled && v[field].trim().length >= 5 && <SmsPreview text={v[field]} locale={locale} />}
        </div>
      ))}
      <p className="text-xs leading-relaxed text-ink-muted">{t("rules")}</p>
      <div className="flex justify-end">
        <Button size="sm" loading={busy} disabled={v.enabled && (v.textBn.trim().length < 5 || v.textEn.trim().length < 5)} onClick={submit}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

/** /dashboard/crm-settings — pipeline stages, assignment, SLA and the auto-reply text. */
export function CrmSettingsPage() {
  const t = useTranslations("crm.settings");
  const tc = useTranslations("common");
  const crmError = useCrmError();
  const settings = useLeadSettings();
  const s = settings.data;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Section title={t("stages.title")} description={t("stages.description")}>
        <StagesEditor />
      </Section>
      {settings.isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={crmError(settings.error)}
          requestIdLabel={tc("requestId")}
          requestId={settings.error?.requestId}
          action={
            <Button size="sm" variant="secondary" onClick={() => settings.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : !s ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Section title={t("assignment.title")} description={t("assignment.description")}>
            <AssignmentSection settings={s} />
          </Section>
          <Section title={t("sla.title")} description={t("sla.description")}>
            <SlaSection settings={s} />
          </Section>
          <Section title={t("autoReply.title")} description={t("autoReply.description")}>
            <AutoReplySection settings={s} />
          </Section>
        </>
      )}
    </div>
  );
}
