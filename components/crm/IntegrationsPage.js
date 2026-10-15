"use client";

import { useState } from "react";
import { MessageSquareText, Plug, RefreshCw, Send, Unplug } from "lucide-react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api, apiRequest } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useCrmError } from "@/lib/crm/errors";
import { crmKeys, flatPages, useProjectOptions } from "@/lib/crm/queries";
import { formatDate, formatPhone } from "@/lib/format";
import { useLeadParam } from "@/lib/crm/url";
import { LeadDrawer } from "./LeadDrawer";
import { useNum } from "./parts";

// Mirrors SMS_PURPOSES in primeplot-back/src/modules/sms/smsMessage.model.js
const SMS_PURPOSES = ["lead_auto_reply", "reminder", "receipt", "portal", "account_setup", "password_reset", "test"];
const SMS_TONE = { sent: "success", queued: "info", failed: "danger", skipped: "neutral" };
const META_TONE = { imported: "success", duplicate: "accent", received: "info", processing: "info", failed: "danger" };

function Card({ icon: Icon, title, status, children, actions }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid size-9 place-items-center rounded-md border border-line bg-surface-2">
          <Icon aria-hidden className="size-4 text-accent" strokeWidth={1.6} />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {status}
        <div className="flex-1" />
        {actions}
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

// ── SMS ─────────────────────────────────────────────────────────────────────────

function SmsCard({ sms }) {
  const t = useTranslations("crm.integrations.sms");
  const num = useNum();
  const crmError = useCrmError();
  const qc = useQueryClient();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const month = sms.thisMonth?.byStatus ?? {};
  const sent = month.sent ?? { count: 0, segments: 0, costPoisha: 0 };

  const test = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/integrations/sms/test", { to });
      toast.success(t("testQueued"));
      setTo("");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sms-log"] }), 1500);
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={MessageSquareText} title={t("title")} status={<Tag tone={sms.live ? "success" : "warning"}>{sms.live ? t("live") : t("logOnly")}</Tag>}>
      {!sms.live && <p className="text-sm text-ink-muted">{t("logHelp")}</p>}
      <dl className="grid gap-4 sm:grid-cols-4">
        <Stat label={t("driver")} value={t(`drivers.${sms.driver}`)} />
        <Stat label={t("sender")} value={sms.senderId} />
        <Stat label={t("perSegment")} value={sms.costPerSegmentPoisha != null ? t("taka", { n: num(sms.costPerSegmentPoisha / 100) }) : null} />
        <Stat
          label={t("thisMonth")}
          value={t("monthValue", { count: num(sent.count), segments: num(sent.segments), cost: sent.costPoisha ? t("taka", { n: num(sent.costPoisha / 100) }) : "—" })}
        />
      </dl>
      {(month.failed?.count ?? 0) > 0 && <p className="text-sm text-danger">{t("failedThisMonth", { n: num(month.failed.count) })}</p>}
      <form onSubmit={test} className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
        <Field label={t("testTo")} hint={t("testHint")} className="w-64">
          <Input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={to.trim().length < 11}>
          <Send aria-hidden className="size-3.5" />
          {t("sendTest")}
        </Button>
      </form>
    </Card>
  );
}

function SmsLog({ onOpenLead }) {
  const t = useTranslations("crm.integrations.smsLog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const num = useNum();
  const crmError = useCrmError();
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["sms-log", status, purpose],
    queryFn: ({ pageParam }) => apiRequest("/integrations/sms/messages", { query: { status: status || undefined, purpose: purpose || undefined, limit: 30, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const rows = flatPages(q.data);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("status")}>
            <option value="">{t("allStatuses")}</option>
            {["sent", "queued", "failed", "skipped"].map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </Select>
          <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label={t("purpose")}>
            <option value="">{t("allPurposes")}</option>
            {SMS_PURPOSES.map((s) => (
              <option key={s} value={s}>
                {t(`purposes.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={crmError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title={t("empty")} description={t("emptyBody")} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("when")}</TH>
                <TH>{t("to")}</TH>
                <TH className="hidden md:table-cell">{t("purpose")}</TH>
                <TH className="hidden lg:table-cell">{t("message")}</TH>
                <TH align="right">{t("segments")}</TH>
                <TH>{t("status")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((m) => (
                <TR key={m.id}>
                  <TD className="text-xs whitespace-nowrap text-ink-muted">{formatDate(m.createdAt, locale, "datetime")}</TD>
                  <TD className="font-mono text-[13px] whitespace-nowrap">
                    {m.leadId ? (
                      <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => onOpenLead(m.leadId)}>
                        {formatPhone(m.to, locale)}
                      </button>
                    ) : (
                      formatPhone(m.to, locale)
                    )}
                  </TD>
                  <TD className="hidden text-sm md:table-cell">{t.has(`purposes.${m.purpose}`) ? t(`purposes.${m.purpose}`) : m.purpose}</TD>
                  <TD className="hidden max-w-72 truncate text-xs text-ink-muted lg:table-cell" title={m.body}>
                    {m.body}
                  </TD>
                  <TD numeric>{num(m.segments)}</TD>
                  <TD>
                    <Tag tone={SMS_TONE[m.status]}>{t(`statuses.${m.status}`)}</Tag>
                    {m.error && <span className="mt-1 block max-w-48 truncate text-[11px] text-danger" title={m.error.message ?? ""}>{t.has(`errors.${m.error.code}`) ? t(`errors.${m.error.code}`) : m.error.code}</span>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {q.hasNextPage && (
            <div className="mt-3 text-center">
              <Button size="sm" variant="ghost" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                {t("more")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Meta Lead Ads ───────────────────────────────────────────────────────────────

function ConnectForm({ onDone, replacing }) {
  const t = useTranslations("crm.integrations.meta");
  const crmError = useCrmError();
  const qc = useQueryClient();
  const [pageId, setPageId] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put("/integrations/meta", { pageId: pageId.trim(), accessToken: token.trim() });
      toast.success(t("connected"));
      qc.invalidateQueries({ queryKey: crmKeys.integrations });
      onDone?.();
    } catch (err) {
      const meta = err?.details?.[0]?.message;
      setError(meta && err.code !== "META_TOKEN_INVALID" ? `${crmError(err)} — ${meta}` : crmError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <FormAlert>{error}</FormAlert>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
        {["step1", "step2", "step3"].map((s) => (
          <li key={s}>{t(`steps.${s}`)}</li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label={t("pageId")} required>
          <Input inputMode="numeric" value={pageId} onChange={(e) => setPageId(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("token")} hint={t("tokenHint")} required>
          <Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {replacing && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            {t("cancel")}
          </Button>
        )}
        <Button type="submit" size="sm" loading={busy} disabled={!pageId || token.trim().length < 20}>
          {replacing ? t("replace") : t("connect")}
        </Button>
      </div>
    </form>
  );
}

function FormMappings({ connection }) {
  const t = useTranslations("crm.integrations.forms");
  const tt = useTranslations("crm.types");
  const locale = useLocale();
  const crmError = useCrmError();
  const qc = useQueryClient();
  const projects = useProjectOptions();
  const forms = useQuery({ queryKey: ["meta-forms"], queryFn: () => api.get("/integrations/meta/forms"), staleTime: 60_000 });
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);

  const current = (f) => edits[f.id] ?? { type: f.mapping?.type ?? "buyer", projectId: f.mapping?.projectId ?? "" };
  const save = async () => {
    setBusy(true);
    try {
      const mappings = (forms.data ?? [])
        .map((f) => ({ f, m: current(f) }))
        .filter(({ m }) => m.type !== "buyer" || m.projectId)
        .map(({ f, m }) => ({ formId: f.id, formName: f.name ?? null, type: m.type, projectId: m.projectId || null }));
      await api.put("/integrations/meta/forms", { version: connection.version, mappings });
      toast.success(t("saved"));
      setEdits({});
      qc.invalidateQueries({ queryKey: crmKeys.integrations });
      qc.invalidateQueries({ queryKey: ["meta-forms"] });
    } catch (err) {
      toast.error(crmError(err));
      if (err?.code === "STALE_VERSION") qc.invalidateQueries({ queryKey: crmKeys.integrations });
    } finally {
      setBusy(false);
    }
  };

  if (forms.isError) return <p className="text-sm text-danger">{crmError(forms.error)}</p>;
  if (forms.isPending) return <Skeleton className="h-24 w-full" />;
  if (!forms.data.length) return <p className="text-sm text-ink-muted">{t("none")}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{t("help")}</p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {forms.data.map((f) => {
          const m = current(f);
          return (
            <li key={f.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_150px_200px] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name ?? f.id}</p>
                <p className="font-mono text-[11px] text-ink-subtle">
                  {f.id}
                  {f.status && f.status !== "ACTIVE" ? ` · ${f.status.toLowerCase()}` : ""}
                </p>
              </div>
              <Select aria-label={t("pipeline")} value={m.type} onChange={(e) => setEdits({ ...edits, [f.id]: { ...m, type: e.target.value } })}>
                {["buyer", "landowner"].map((x) => (
                  <option key={x} value={x}>
                    {tt(x)}
                  </option>
                ))}
              </Select>
              <Select aria-label={t("project")} value={m.projectId} onChange={(e) => setEdits({ ...edits, [f.id]: { ...m, projectId: e.target.value } })} disabled={m.type !== "buyer"}>
                <option value="">{t("noProject")}</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {(locale === "bn" && p.nameBn) || p.name}
                  </option>
                ))}
              </Select>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button size="sm" loading={busy} disabled={!Object.keys(edits).length} onClick={save}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

function MetaLog({ onOpenLead }) {
  const t = useTranslations("crm.integrations.metaLog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const crmError = useCrmError();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["meta-log", status],
    queryFn: ({ pageParam }) => apiRequest("/integrations/meta/leads", { query: { status: status || undefined, limit: 30, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const rows = flatPages(q.data);
  const retry = async (id) => {
    try {
      await api.post(`/integrations/meta/leads/${id}/retry`);
      toast.success(t("retryQueued"));
      setTimeout(() => qc.invalidateQueries({ queryKey: ["meta-log"] }), 1500);
    } catch (err) {
      toast.error(crmError(err));
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{t("title")}</p>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("status")}>
          <option value="">{t("all")}</option>
          {["imported", "duplicate", "failed", "received"].map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={crmError(q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">{t("empty")}</p>
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("when")}</TH>
                <TH>{t("lead")}</TH>
                <TH className="hidden md:table-cell">{t("viaLabel")}</TH>
                <TH>{t("status")}</TH>
                <TH align="right">
                  <span className="sr-only">{t("actions")}</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD className="text-xs whitespace-nowrap text-ink-muted">{formatDate(e.metaCreatedAt ?? e.createdAt, locale, "datetime")}</TD>
                  <TD>
                    {e.leadId ? (
                      <button type="button" className="text-sm font-medium text-accent underline-offset-2 hover:underline" onClick={() => onOpenLead(e.leadId)}>
                        {e.leadName ?? t("openLead")}
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-ink-subtle">{e.leadgenId}</span>
                    )}
                  </TD>
                  <TD className="hidden text-xs text-ink-muted md:table-cell">{t(`via.${e.via}`)}</TD>
                  <TD>
                    <Tag tone={META_TONE[e.status]}>{t(`statuses.${e.status}`)}</Tag>
                    {e.error && <span className="mt-1 block max-w-56 truncate text-[11px] text-danger" title={e.error.message ?? ""}>{t.has(`errors.${e.error.code}`) ? t(`errors.${e.error.code}`) : e.error.message ?? e.error.code}</span>}
                  </TD>
                  <TD align="right">
                    {e.status === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => retry(e.id)}>
                        {t("retry")}
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {q.hasNextPage && (
            <div className="mt-3 text-center">
              <Button size="sm" variant="ghost" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                {t("more")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetaCard({ meta, onOpenLead }) {
  const t = useTranslations("crm.integrations.meta");
  const locale = useLocale();
  const num = useNum();
  const crmError = useCrmError();
  const qc = useQueryClient();
  const [replacing, setReplacing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(null);
  const c = meta.connection;

  const sync = async () => {
    setBusy("sync");
    try {
      const r = await api.post("/integrations/meta/sync");
      toast.success(r?.queued === false ? t("syncAlready") : t("syncQueued"));
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await api.delete("/integrations/meta");
      toast.success(t("disconnected"));
      qc.invalidateQueries({ queryKey: crmKeys.integrations });
      setConfirm(false);
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(null);
    }
  };

  const status = !meta.configured ? (
    <Tag>{t("notConfigured")}</Tag>
  ) : !c ? (
    <Tag tone="warning">{t("notConnected")}</Tag>
  ) : c.status === "active" ? (
    <Tag tone="success">{t("active")}</Tag>
  ) : (
    <Tag tone="danger">{t("broken")}</Tag>
  );

  return (
    <Card
      icon={Plug}
      title={t("title")}
      status={status}
      actions={
        c && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={busy === "sync"} onClick={sync}>
              <RefreshCw aria-hidden className="size-3.5" />
              {t("sync")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
              <Unplug aria-hidden className="size-3.5" />
              {t("disconnect")}
            </Button>
          </div>
        )
      }
    >
      {!meta.configured ? (
        <div className="space-y-2 text-sm text-ink-muted">
          <p>{t("configureHelp")}</p>
          <pre className="overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-ink">{"META_APP_SECRET=…\nMETA_VERIFY_TOKEN=…"}</pre>
        </div>
      ) : (
        <>
          <div className="rounded-md bg-surface-2 px-3 py-2.5 text-xs">
            <p className="text-ink-muted">{t("webhookLabel")}</p>
            <p className="mt-1 font-mono break-all text-ink">{`<API>${meta.webhookPath}`}</p>
            <p className="mt-1 text-ink-muted">{t("webhookHelp", { version: meta.graphVersion })}</p>
          </div>
          {!c || replacing ? (
            <ConnectForm replacing={Boolean(c)} onDone={() => setReplacing(false)} />
          ) : (
            <>
              {c.lastError && (
                <div role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-sm">
                  <p className="font-medium text-danger">{t.has(`errors.${c.lastError.code}`) ? t(`errors.${c.lastError.code}`) : c.lastError.code}</p>
                  {c.lastError.message && <p className="mt-1 text-xs text-ink-muted">{c.lastError.message}</p>}
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => setReplacing(true)}>
                    {t("reconnect")}
                  </Button>
                </div>
              )}
              <dl className="grid gap-4 sm:grid-cols-4">
                <Stat label={t("page")} value={<>{c.pageName ?? "—"} <span className="font-mono text-xs text-ink-subtle">{c.pageId}</span></>} />
                <Stat label={t("tokenLabel")} value={<span className="font-mono">{c.tokenHint}</span>} />
                <Stat label={t("lastLead")} value={c.lastLeadAt ? formatDate(c.lastLeadAt, locale, "datetime") : t("never")} />
                <Stat
                  label={t("lastCheck")}
                  value={c.lastReconciledAt ? `${formatDate(c.lastReconciledAt, locale, "datetime")} · ${t("checkSummary", { checked: num(c.lastReconcile?.checked ?? 0), imported: num(c.lastReconcile?.imported ?? 0) })}` : t("never")}
                />
              </dl>
              <p className="text-xs text-ink-muted">
                {t("last7", {
                  imported: num(meta.last7Days?.imported ?? 0),
                  duplicate: num(meta.last7Days?.duplicate ?? 0),
                  failed: num(meta.last7Days?.failed ?? 0),
                })}
                {!c.lastError && (
                  <button type="button" className="ml-2 font-medium text-accent hover:underline" onClick={() => setReplacing(true)}>
                    {t("replaceToken")}
                  </button>
                )}
              </p>
              <div className="border-t border-line pt-5">
                <p className="mb-3 text-sm font-semibold">{t("formsTitle")}</p>
                <FormMappings connection={c} />
              </div>
              <div className="border-t border-line pt-5">
                <MetaLog onOpenLead={onOpenLead} />
              </div>
            </>
          )}
        </>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("disconnectTitle")}
        description={t("disconnectBody", { page: c?.pageName ?? "" })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" loading={busy === "disconnect"} onClick={disconnect}>
              {t("disconnect")}
            </Button>
          </>
        }
      />
    </Card>
  );
}

/** /dashboard/integrations — Meta Lead Ads + SMS (admins), SMS delivery log (admins + managers). */
export function IntegrationsPage() {
  const t = useTranslations("crm.integrations");
  const tc = useTranslations("common");
  const { can } = useSession();
  const crmError = useCrmError();
  const drawer = useLeadParam();
  const admin = can("settings:integrations");
  const overview = useQuery({ queryKey: crmKeys.integrations, queryFn: () => api.get("/integrations"), enabled: admin });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {admin &&
        (overview.isError ? (
          <ErrorState
            title={t("loadFailed")}
            description={crmError(overview.error)}
            requestId={overview.error?.requestId}
            requestIdLabel={tc("requestId")}
            action={
              <Button size="sm" variant="secondary" onClick={() => overview.refetch()}>
                {tc("retry")}
              </Button>
            }
          />
        ) : overview.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-6">
            <MetaCard meta={overview.data.meta} onOpenLead={drawer.open} />
            <SmsCard sms={overview.data.sms} />
          </div>
        ))}
      <SmsLog onOpenLead={drawer.open} />
      <LeadDrawer leadId={drawer.leadId} onClose={drawer.close} />
    </div>
  );
}
