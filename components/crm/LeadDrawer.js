"use client";

import { useState } from "react";
import { Ellipsis, Merge, MessageCircle, Phone, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { stageName, telLink, whatsappLink } from "@/lib/crm/constants";
import { isStale, useCrmError } from "@/lib/crm/errors";
import { flatPages, useAssignees, useCrmRefresh, useLead, useLeadList, useStages } from "@/lib/crm/queries";
import { formatBDT, formatDate, formatLand, formatPhone } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { leadSchema, leadToValues, LeadFields, valuesToBody } from "./LeadFields";
import { LeadTasks } from "./LeadTasks";
import { Composer, Timeline } from "./LeadTimeline";
import { SlaChip, SourceLabel, useNow, useNum } from "./parts";
import { useMoveLead } from "./useMoveLead";

const TABS = ["activity", "tasks", "details"];
const EDIT_FORM = "lead-edit";

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children || "—"}</dd>
    </div>
  );
}

/** Read-only summary + edit form (Details tab). */
function Details({ lead }) {
  const t = useTranslations("crm.details");
  const tf = useTranslations("crm.form");
  const tv = useTranslations("crm.validation");
  const ts = useTranslations("crm.sources");
  const tl = useTranslations("crm.lostReasons");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { can } = useSession();
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const [editing, setEditing] = useState(false);
  const form = useForm({ resolver: zodResolver(leadSchema(tv)), defaultValues: leadToValues(lead) });

  const save = async (v) => {
    try {
      await api.patch(`/leads/${lead.id}`, { version: lead.version, ...valuesToBody(v, "edit") });
      toast.success(t("saved"));
      refresh(lead.id);
      setEditing(false);
    } catch (err) {
      if (err?.code === "INVALID_PHONE") form.setError(err.details?.[0]?.path === "altPhone" ? "altPhone" : "phone", { message: tv("phone") });
      else form.setError("root", { message: isStale(err) ? t("stale") : crmError(err) });
      if (isStale(err)) refresh(lead.id);
    }
  };

  if (editing) {
    return (
      <form id={EDIT_FORM} onSubmit={form.handleSubmit(save)} noValidate className="space-y-5">
        <FormAlert>{form.formState.errors.root?.message}</FormAlert>
        <LeadFields form={form} mode="edit" />
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-line bg-surface px-6 py-3">
          <Button variant="ghost" onClick={() => (form.reset(leadToValues(lead)), setEditing(false))}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {tc("save")}
          </Button>
        </div>
      </form>
    );
  }

  const i = lead.interest ?? {};
  const project = i.project;
  return (
    <div className="space-y-6">
      {can("leads:write") && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => (form.reset(leadToValues(lead)), setEditing(true))}>
            {t("edit")}
          </Button>
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label={tf("phone")}>
          <span className="font-mono">{formatPhone(lead.phone, locale)}</span>
        </Fact>
        <Fact label={tf("altPhone")}>{lead.altPhone && <span className="font-mono">{formatPhone(lead.altPhone, locale)}</span>}</Fact>
        <Fact label={tf("email")}>{lead.email}</Fact>
        <Fact label={tf("source")}>
          {ts(lead.source)}
          {lead.sourceDetail?.referrer && ` · ${lead.sourceDetail.referrer}`}
        </Fact>
        {lead.type === "buyer" ? (
          <>
            <Fact label={tf("project")}>{project && ((locale === "bn" && project.nameBn) || project.name)}</Fact>
            <Fact label={t("unit")}>{i.unitCode && <span className="font-mono">{i.unitCode}</span>}</Fact>
            <Fact label={tf("bedrooms")}>{i.bedrooms != null && String(i.bedrooms)}</Fact>
            <Fact label={t("budget")}>
              {(i.budgetMin != null || i.budgetMax != null) && `${i.budgetMin != null ? formatBDT(i.budgetMin, locale) : "…"} – ${i.budgetMax != null ? formatBDT(i.budgetMax, locale) : "…"}`}
            </Fact>
          </>
        ) : (
          <>
            <Fact label={tf("landLocation")}>{lead.land?.location}</Fact>
            <Fact label={tf("landArea")}>{lead.land?.area && formatLand(lead.land.area, locale)}</Fact>
            <Fact label={tf("roadWidth")}>{lead.land?.roadWidthFt != null && `${lead.land.roadWidthFt} ${tf("ft")}`}</Fact>
            <Fact label={tf("ownership")}>{lead.land?.ownership && tf(`ownershipOptions.${lead.land.ownership}`)}</Fact>
            <Fact label={tf("mutation")}>{lead.land?.mutation && tf(`mutationOptions.${lead.land.mutation}`)}</Fact>
            <Fact label={tf("expectedShare")}>{lead.land?.expectedShare}</Fact>
          </>
        )}
        <Fact label={tf("tags")}>
          {lead.tags?.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {lead.tags.map((x) => (
                <Tag key={x} tone="accent">
                  {x}
                </Tag>
              ))}
            </span>
          )}
        </Fact>
        <Fact label={t("created")}>{formatDate(lead.createdAt, locale, "datetime")}</Fact>
        {(lead.sourceDetail?.campaign || lead.sourceDetail?.medium || lead.sourceDetail?.formName) && (
          <Fact label={t("campaign")}>{[lead.sourceDetail.formName, lead.sourceDetail.campaign, lead.sourceDetail.medium].filter(Boolean).join(" · ")}</Fact>
        )}
        {lead.sourceDetail?.page && (
          <Fact label={t("page")}>
            <span className="font-mono text-xs">{lead.sourceDetail.page}</span>
          </Fact>
        )}
        <Fact label={t("firstResponse")}>{lead.firstResponseAt ? formatDate(lead.firstResponseAt, locale, "datetime") : t("noResponse")}</Fact>
      </dl>
      {lead.message && (
        <div>
          <p className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{t("message")}</p>
          <p className="mt-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-sm whitespace-pre-line">{lead.message}</p>
        </div>
      )}
      {lead.status === "lost" && (
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm">
          {t("lostBecause", { reason: lead.lostReason ? tl(lead.lostReason) : "—" })}
          {lead.lostNote && <span className="mt-1 block text-ink-muted">{lead.lostNote}</span>}
        </p>
      )}
    </div>
  );
}

/** Merge another lead (same type) into this one: pick it by name/phone search. */
function MergeDialog({ lead, open, onClose, onMerged }) {
  const t = useTranslations("crm.merge");
  const tc = useTranslations("common");
  const locale = useLocale();
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = useDebounced(q.trim(), 300);
  const results = useLeadList({ q: search, type: lead.type, status: "open" }, { enabled: open && search.length >= 2 });
  const options = flatPages(results.data).filter((l) => l.id !== lead.id);

  const run = async () => {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/merge`, { sourceId: pick.id });
      toast.success(t("done", { name: pick.name }));
      refresh(lead.id);
      onMerged();
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title")}
      description={t("description", { name: lead.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button disabled={!pick} loading={busy} onClick={run}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <Input leading={<Search className="size-4" />} placeholder={t("search")} aria-label={t("search")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {options.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => setPick(l)}
              aria-pressed={pick?.id === l.id}
              className={cn("w-full rounded-md border px-3 py-2 text-left", pick?.id === l.id ? "border-primary bg-accent-soft" : "border-line hover:bg-surface-2")}
            >
              <span className="block text-sm font-medium">{l.name}</span>
              <span className="font-mono text-xs text-ink-muted">{formatPhone(l.phone, locale)}</span>
            </button>
          </li>
        ))}
        {search.length >= 2 && !results.isPending && options.length === 0 && <li className="py-3 text-center text-sm text-ink-muted">{t("none")}</li>}
      </ul>
      {pick && <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t("explain", { source: pick.name, target: lead.name })}</p>}
    </Dialog>
  );
}

function LeadBody({ leadId, onClose }) {
  const t = useTranslations("crm.drawer");
  const tt = useTranslations("crm.types");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { can, user } = useSession();
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const now = useNow();
  const num = useNum();
  const q = useLead(leadId);
  const lead = q.data;
  const stages = useStages(lead?.type ?? "buyer");
  const canAssign = can("leads:assign");
  const assignees = useAssignees({ enabled: canAssign });
  const { move, dialog } = useMoveLead();
  const [tab, setTab] = useState("activity");
  const [preset, setPreset] = useState(null);
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (q.isError) {
    return (
      <ErrorState
        title={q.error?.status === 404 ? t("notFound") : t("loadFailed")}
        description={q.error?.status === 404 ? t("notFoundBody") : crmError(q.error)}
        requestId={q.error?.requestId}
        requestIdLabel={tc("requestId")}
      />
    );
  }
  if (!lead) return <Skeleton className="h-96 w-full" />;

  const canWrite = can("leads:write");
  const stageList = stages.data ?? [];

  const assign = async (value) => {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/assign`, { version: lead.version, assigneeId: value || null });
      toast.success(t("assigned"));
      refresh(lead.id);
    } catch (err) {
      toast.error(isStale(err) ? t("stale") : crmError(err));
      refresh(lead.id);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/leads/${lead.id}`);
      toast.success(t("deleted"));
      refresh();
      onClose();
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };

  const contact = (type) => {
    setTab("activity");
    setPreset({ type, nonce: Date.now() });
  };

  return (
    <div>
      {/* identity */}
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={lead.type === "landowner" ? "info" : "neutral"}>{tt(lead.type)}</Tag>
        <SourceLabel source={lead.source} className="text-xs" />
        {lead.enquiryCount > 1 && <Tag>{t("enquiries", { n: num(lead.enquiryCount) })}</Tag>}
        <SlaChip lead={lead} now={now} />
        {lead.slaEscalatedAt && !lead.firstResponseAt && <Tag tone="danger">{t("escalated")}</Tag>}
      </div>

      {/* contact */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button as="a" href={telLink(lead.phone)} size="sm" onClick={() => contact("call")}>
          <Phone aria-hidden className="size-3.5" />
          {t("call")}
        </Button>
        <Button as="a" href={whatsappLink(lead.phone)} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" onClick={() => contact("whatsapp")}>
          <MessageCircle aria-hidden className="size-3.5" />
          {t("whatsapp")}
        </Button>
        <span className="self-center font-mono text-sm text-ink-muted">{formatPhone(lead.phone, locale)}</span>
        <div className="flex-1" />
        {canAssign && canWrite && (
          <Menu
            trigger={(p) => (
              <Button size="sm" variant="ghost" {...p} aria-label={t("more")}>
                <Ellipsis className="size-4" />
              </Button>
            )}
            items={[
              { key: "merge", label: t("merge"), icon: <Merge aria-hidden className="size-4 text-ink-muted" />, onSelect: () => setMerging(true) },
              { key: "delete", label: t("delete"), danger: true, icon: <Trash2 aria-hidden className="size-4" />, onSelect: () => setDeleting(true) },
            ]}
          />
        )}
      </div>

      {/* stage + owner */}
      <div className="mt-5 grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
        <Field label={t("stage")}>
          <Select
            value={lead.stageId}
            disabled={!canWrite || !stageList.length}
            onChange={(e) => {
              const s = stageList.find((x) => x.id === e.target.value);
              if (s) move(lead, s);
            }}
          >
            {stageList.map((s) => (
              <option key={s.id} value={s.id}>
                {stageName(s, locale)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("owner")}>
          {canAssign ? (
            <Select value={lead.assigneeId ?? ""} disabled={busy} onChange={(e) => assign(e.target.value)}>
              <option value="">{t("unassigned")}</option>
              {(assignees.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user?.id ? ` (${t("you")})` : ""}
                </option>
              ))}
            </Select>
          ) : (
            <p className="flex h-10 items-center text-sm">{lead.assigneeName ?? t("unassigned")}</p>
          )}
        </Field>
      </div>

      {/* tabs */}
      <div role="tablist" aria-label={t("sections")} className="mt-6 flex gap-5 border-b border-line">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={cn("-mb-px border-b-2 pb-2.5 text-sm font-medium", tab === x ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {t(`tabs.${x}`)}
          </button>
        ))}
      </div>
      <div className="pt-5" role="tabpanel">
        {tab === "activity" && (
          <div className="space-y-6">
            {canWrite && <Composer lead={lead} preset={preset} />}
            <Timeline leadId={lead.id} stages={stageList} />
          </div>
        )}
        {tab === "tasks" && <LeadTasks lead={lead} now={now} />}
        {tab === "details" && <Details key={lead.version} lead={lead} />}
      </div>

      {dialog}
      <MergeDialog lead={lead} open={merging} onClose={() => setMerging(false)} onMerged={() => setMerging(false)} />
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t("deleteTitle")}
        description={t("deleteBody", { name: lead.name })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              {t("delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}

/** Lead detail side sheet — opened by `?lead=<id>` from the table, board, tasks and the bell. */
export function LeadDrawer({ leadId, onClose }) {
  const t = useTranslations("crm.drawer");
  const q = useLead(leadId);
  return (
    <Drawer open={Boolean(leadId)} onClose={onClose} title={q.data?.name ?? t("title")} width="lg">
      {leadId && <LeadBody key={leadId} leadId={leadId} onClose={onClose} />}
    </Drawer>
  );
}
