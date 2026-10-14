"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Eye, History, Lock, RotateCcw, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, localizeDigits } from "@/lib/format";
import { siteKeys, usePage, useRevisions } from "@/lib/site/queries";
import { DATA_DRIVEN, hasContent, PAGE_PATHS, PAGES, PINNED, stripResolved, TYPES } from "@/lib/site/schema";
import { FieldsForm } from "./Fields";
import { SeoFields } from "./SeoFields";
import { usePageFallback } from "./usePageFallback";

/**
 * Website › one page: sections (edit, show/hide, reorder, reset) + SEO. Saves a draft; Preview
 * opens the site in Draft Mode; Publish makes it live (contract: API.md › B2b).
 */
export function PageEditor({ pageKey }) {
  const t = useTranslations("website");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const q = usePage(pageKey);
  const [open, setOpen] = useState(() => new Set()); // expanded sections survive a save (editor remounts)

  if (q.isPending) return <Skeleton className="h-[32rem] w-full" />;
  if (q.isError) {
    return (
      <ErrorState
        title={t("loadFailed")}
        description={errorMessage(te, q.error)}
        requestId={q.error?.requestId}
        requestIdLabel={tc("requestId")}
        action={
          <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
            {tc("retry")}
          </Button>
        }
      />
    );
  }
  return <Editor key={q.data.version} page={q.data} open={open} setOpen={setOpen} refetch={() => q.refetch()} />;
}

const contentOf = (d) => stripResolved({ sections: d.sections.map(({ key, enabled, data }) => ({ key, enabled, data })), seo: d.seo });

function Editor({ page, open, setOpen, refetch }) {
  const t = useTranslations("website");
  const tf = useTranslations("website.fields");
  const ts = useTranslations(`website.sections`);
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const { org } = useSession();
  const fallback = usePageFallback(page.key);
  const key = page.key;
  const hasSections = Boolean(PAGES[key]);
  const pinned = PINNED[key] ?? [];

  const [draft, setDraft] = useState(() => ({ sections: page.draft.sections, seo: page.draft.seo }));
  const [tab, setTab] = useState(hasSections ? "content" : "seo");
  const [busy, setBusy] = useState(null); // "save" | "publish" | "preview" | "discard"
  const [error, setError] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const initial = JSON.stringify(contentOf(page.draft));
  const dirty = JSON.stringify(contentOf(draft)) !== initial;
  const company = (locale === "bn" && org?.nameBn) || org?.name || "";
  const T = (k) => (tf.has(k) ? tf(k) : k);

  // Unsaved edits: warn before leaving the page.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const applyServer = (saved) => {
    qc.setQueryData(siteKeys.page(key), saved);
    qc.invalidateQueries({ queryKey: siteKeys.pages });
    qc.invalidateQueries({ queryKey: siteKeys.revisions(key) });
  };

  const fail = (err) => {
    if (err?.code === "STALE_VERSION") setError({ stale: true, text: t("stale") });
    else if (err?.code === "VALIDATION_ERROR" || err?.code === "INVALID_MEDIA") setError({ text: errorMessage(te, err), details: describeDetails(err.details) });
    else setError({ text: errorMessage(te, err) });
  };

  /** Readable "Section › item 2 › field" for API error paths like sections.3.data.items.1.title.bn. */
  const describeDetails = (details = []) =>
    details.slice(0, 6).map((d) => {
      const parts = String(d.path ?? "").split(".");
      const out = [];
      if (parts[0] === "sections") {
        const s = draft.sections[Number(parts[1])];
        if (s) out.push(ts(`${key}.${s.key}.title`));
        for (let i = 3; i < parts.length; i++) {
          if (/^\d+$/.test(parts[i])) out.push(t("itemN", { n: localizeDigits(Number(parts[i]) + 1, locale) }));
          else if (parts[i] !== "en" && parts[i] !== "bn") out.push(T(parts[i]));
        }
      } else if (parts[0] === "seo") out.push(t("tabs.seo"), T(parts[1]));
      return `${out.join(" › ")}: ${d.message}`;
    });

  const save = async () => {
    const body = { version: page.version, ...contentOf(draft) };
    const saved = await api.put(`/site/pages/${key}/draft`, body);
    return saved;
  };

  const onSave = async () => {
    setBusy("save");
    setError(null);
    try {
      const saved = await save();
      toast.success(t("saved"));
      applyServer(saved);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const onPreview = async () => {
    setBusy("preview");
    setError(null);
    // Open the tab first (popup blockers allow it only inside the click), then point it at the preview.
    const win = window.open("about:blank", "_blank");
    try {
      let version = page.version;
      if (dirty) {
        const saved = await save();
        version = saved.version;
        applyServer(saved);
      }
      await api.get("/auth/me"); // refreshes the session cookie if it expired, so /api/preview sees it
      const url = `/api/preview?page=${key}&locale=${locale}&v=${version}`;
      if (win) win.location.href = url;
      // /api/preview is a route handler that sets the Draft Mode cookie — it needs a full navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      else window.location.href = url;
    } catch (err) {
      win?.close();
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    setBusy("publish");
    setError(null);
    try {
      let version = page.version;
      if (dirty) version = (await save()).version;
      const published = await api.post(`/site/pages/${key}/publish`, { version, ...(note.trim() && { note: note.trim() }) });
      toast.success(t("published"));
      setPublishOpen(false);
      setNote("");
      applyServer(published);
    } catch (err) {
      setPublishOpen(false);
      if (err?.code === "NO_CHANGES") toast.info(t("noChanges"));
      else fail(err);
    } finally {
      setBusy(null);
    }
  };

  const onDiscard = async () => {
    setBusy("discard");
    setError(null);
    try {
      if (dirty && !page.hasChanges) {
        setDraft({ sections: page.draft.sections, seo: page.draft.seo }); // only local edits → just reset
      } else {
        applyServer(await api.post(`/site/pages/${key}/discard`, { version: page.version }));
      }
      toast.success(t("discarded"));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const setSection = (i, patch) => setDraft((d) => ({ ...d, sections: d.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)) }));
  const move = (i, dir) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.sections.length || pinned.includes(d.sections[j].key) || pinned.includes(d.sections[i].key)) return d;
      const next = [...d.sections];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, sections: next };
    });
  const toggleOpen = (k) => setOpen((s) => new Set(s.has(k) ? [...s].filter((x) => x !== k) : [...s, k]));

  const status = !page.publishedAt ? (
    <Tag tone="warning">{t("neverPublished")}</Tag>
  ) : page.hasChanges || dirty ? (
    <Tag tone="warning">{t("unpublishedChanges")}</Tag>
  ) : (
    <Tag tone="success">{t("live")}</Tag>
  );

  const heading = key === "home" ? draft.sections.find((s) => s.key === "hero")?.data.title : key === "about" ? draft.sections.find((s) => s.key === "intro")?.data.title : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/website" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>

      <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight">{t(`pages.${key}`)}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            {status}
            {page.publishedAt && <span>{t("publishedBy", { date: formatDate(page.publishedAt, locale, "datetime"), name: page.publishedByName ?? "—" })}</span>}
            <span className="font-mono text-ink-subtle">{PAGE_PATHS[key]}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History aria-hidden className="size-4" />
            {t("history")}
          </Button>
          {(dirty || page.hasChanges) && page.publishedAt && (
            <Button variant="ghost" size="sm" loading={busy === "discard"} onClick={onDiscard}>
              <RotateCcw aria-hidden className="size-4" />
              {t("discard")}
            </Button>
          )}
          <Button variant="secondary" size="sm" loading={busy === "preview"} disabled={Boolean(busy)} onClick={onPreview}>
            <Eye aria-hidden className="size-4" />
            {t("preview")}
          </Button>
          <Button variant="secondary" size="sm" loading={busy === "save"} disabled={!dirty || Boolean(busy)} onClick={onSave}>
            {t("saveDraft")}
          </Button>
          <Button size="sm" loading={busy === "publish"} disabled={Boolean(busy) || (!dirty && !page.hasChanges)} onClick={() => setPublishOpen(true)}>
            {t("publish")}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mt-6">
          <FormAlert>
            <p>{error.text}</p>
            {error.details?.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {error.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {error.stale && (
              <Button size="sm" variant="secondary" className="mt-3" onClick={refetch}>
                {t("reload")}
              </Button>
            )}
          </FormAlert>
        </div>
      )}

      {hasSections && (
        <nav aria-label={t("tabsLabel")} className="mt-8 flex gap-6 border-b border-line">
          {["content", "seo"].map((k) => (
            <button
              key={k}
              type="button"
              aria-current={tab === k ? "page" : undefined}
              onClick={() => setTab(k)}
              className={cn("-mb-px border-b-2 pb-3 text-sm font-medium", tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink")}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </nav>
      )}

      {tab === "content" && hasSections && (
        <ol className="mt-6 space-y-3">
          {draft.sections.map((s, i) => {
            const isPinned = pinned.includes(s.key);
            const visible = s.enabled && hasContent(s.key, s.type, s.data);
            const isOpen = open.has(s.key);
            return (
              <li key={s.key} className={cn("rounded-lg border bg-surface", s.enabled ? "border-line" : "border-dashed border-line-strong bg-surface-2/50")}>
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
                  <button type="button" onClick={() => toggleOpen(s.key)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm py-1 text-left">
                    <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-subtle transition-transform", !isOpen && "-rotate-90")} />
                    <span className="font-mono text-[11px] text-ink-subtle">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{ts(`${key}.${s.key}.title`)}</span>
                      <span className="block truncate text-xs text-ink-muted">{ts(`${key}.${s.key}.desc`)}</span>
                    </span>
                  </button>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {isPinned && (
                      <Tag tone="outline">
                        <Lock aria-hidden className="size-3" />
                        {t("pinned")}
                      </Tag>
                    )}
                    {DATA_DRIVEN.has(s.key) && <Tag tone="info">{t("autoContent")}</Tag>}
                    {s.enabled && !visible && <Tag tone="warning">{t("emptyHidden")}</Tag>}
                    {!s.enabled && <Tag tone="neutral">{t("hidden")}</Tag>}
                  </span>
                  {!isPinned && (
                    <span className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="size-8" aria-label={t("moveUp")} disabled={i === 0 || pinned.includes(draft.sections[i - 1]?.key)} onClick={() => move(i, -1)}>
                        <ArrowUp aria-hidden className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" aria-label={t("moveDown")} disabled={i === draft.sections.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown aria-hidden className="size-4" />
                      </Button>
                      <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={s.enabled}
                          onChange={(e) => setSection(i, { enabled: e.target.checked })}
                          className="peer sr-only"
                        />
                        <span aria-hidden className="relative h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:after:translate-x-4" />
                        <span className="sr-only sm:not-sr-only">{t("show")}</span>
                      </label>
                    </span>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-line px-4 py-5 sm:px-6">
                    {DATA_DRIVEN.has(s.key) && (
                      <p className="mb-5 flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-xs text-info">
                        <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        {t(`auto.${s.key}`)}
                      </p>
                    )}
                    <FieldsForm fields={TYPES[s.type]} value={s.data} onChange={(data) => setSection(i, { data })} T={T} />
                    <div className="mt-6 flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setSection(i, { data: structuredClone(page.defaults[s.key]) })}>
                        <RotateCcw aria-hidden className="size-4" />
                        {t("resetSection")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {tab === "seo" && (
        <div className="mt-8">
          <SeoFields value={draft.seo} onChange={(seo) => setDraft((d) => ({ ...d, seo }))} path={PAGE_PATHS[key]} company={company} fallback={fallback} heading={heading} />
        </div>
      )}

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={t("publishTitle")}
        description={t("publishBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              {t("cancel")}
            </Button>
            <Button loading={busy === "publish"} onClick={onPublish}>
              {t("publishNow")}
            </Button>
          </>
        }
      >
        <Field label={t("publishNote")} hint={t("publishNoteHint")}>
          <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Dialog>

      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} page={page} onRestored={applyServer} dirty={dirty} />
    </div>
  );
}

function HistoryDrawer({ open, onClose, page, onRestored, dirty }) {
  const t = useTranslations("website");
  const te = useTranslations("errors");
  const locale = useLocale();
  const q = useRevisions(page.key, { enabled: open });
  const [busy, setBusy] = useState(null);

  const restore = async (n) => {
    if (dirty && !window.confirm(t("restoreLosesEdits"))) return;
    setBusy(n);
    try {
      onRestored(await api.post(`/site/pages/${page.key}/revisions/${n}/restore`, { version: page.version }));
      toast.success(t("restored"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(te, err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={t("history")} description={t("historyBody")} width="sm">
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !q.data?.length ? (
        <p className="py-8 text-center text-sm text-ink-muted">{t("noHistory")}</p>
      ) : (
        <ol className="divide-y divide-line">
          {q.data.map((r, i) => (
            <li key={r.n} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t("versionN", { n: localizeDigits(r.n, locale) })}
                  {i === 0 && (
                    <Tag tone="success" className="ml-2">
                      {t("live")}
                    </Tag>
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatDate(r.publishedAt, locale, "datetime")} · {r.publishedByName ?? "—"}
                </p>
                {r.note && <p className="mt-1 text-xs">{r.note}</p>}
              </div>
              <Button size="sm" variant="secondary" loading={busy === r.n} onClick={() => restore(r.n)}>
                {t("restore")}
              </Button>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
