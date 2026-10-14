"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, HardHat, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { keys, useProject } from "@/components/inventory/queries";
import { SmartImage } from "@/components/media/SmartImage";
import { uploadMedia, useUploadError } from "@/components/media/upload";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { formatDate, formatNumber, localizeDigits } from "@/lib/format";
import { siteKeys, useProjectUpdates } from "@/lib/site/queries";
import { BiInput } from "./Fields";

export const MILESTONES = ["site_preparation", "piling", "foundation", "basement", "structure", "roof", "brickwork", "finishing", "handover"];
const MAX_PHOTOS = 20;
const today = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10); // Dhaka

/** Project › Construction: progress posts with % , milestone and photos (contract: API.md › B2b). */
export function ConstructionEditor() {
  const { id } = useParams();
  const t = useTranslations("construction");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { can } = useSession();
  const canWrite = can("projects:write");
  const project = useProject(id);
  const q = useProjectUpdates(id);
  const [editing, setEditing] = useState(null); // null | "new" | update
  const [deleting, setDeleting] = useState(null);
  const qc = useQueryClient();
  const items = q.data?.pages.flatMap((p) => p.data ?? []) ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: siteKeys.updates(id) });
    qc.invalidateQueries({ queryKey: keys.project(id) });
  };

  const remove = async () => {
    try {
      await api.delete(`/construction-updates/${deleting.id}`);
      toast.success(t("deleted"));
      refresh();
    } catch (err) {
      toast.error(errorMessage(te, err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-ink-muted">{t("intro")}</p>
        {canWrite && (
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Button>
        )}
      </div>

      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={errorMessage(te, q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : q.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={HardHat} title={t("empty")} description={t("emptyBody")} />
      ) : (
        <ol className="space-y-3">
          {items.map((u) => {
            const title = (locale === "bn" ? u.title.bn || u.title.en : u.title.en || u.title.bn) || "—";
            return (
              <li key={u.id} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-32">
                  {u.photos[0]?.media ? (
                    <SmartImage media={u.photos[0].media} variant="thumb" alt="" sizes="128px" className="absolute inset-0" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-ink-subtle">
                      <HardHat aria-hidden className="size-6" strokeWidth={1.25} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <time dateTime={u.date}>{formatDate(u.date, locale, "long")}</time>
                    {u.published ? <Tag tone="success">{t("published")}</Tag> : <Tag tone="outline">{t("draft")}</Tag>}
                    {u.milestone && <Tag tone="neutral">{t(`milestones.${u.milestone}`)}</Tag>}
                    {u.block && <span>{locale === "bn" && u.block.nameBn ? u.block.nameBn : u.block.name}</span>}
                  </p>
                  <p className="mt-1.5 truncate text-base font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {u.percent != null && t("percentDone", { n: formatNumber(u.percent, locale) })}
                    {u.percent != null && u.photos.length > 0 && " · "}
                    {u.photos.length > 0 && t("photosN", { n: formatNumber(u.photos.length, locale) })}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>
                      <Pencil aria-hidden className="size-4" />
                      {t("edit")}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 text-danger" aria-label={t("delete")} onClick={() => setDeleting(u)}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {t("loadMore")}
          </Button>
        </div>
      )}

      {editing && (
        <UpdateDrawer
          key={editing === "new" ? "new" : `${editing.id}-${editing.version}`}
          projectId={id}
          blocks={project.data?.blocks ?? []}
          update={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" onClick={remove}>
              {t("delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}

function UpdateDrawer({ projectId, blocks, update, onClose, onSaved }) {
  const t = useTranslations("construction");
  const te = useTranslations("errors");
  const locale = useLocale();
  const uploadError = useUploadError();
  const input = useRef(null);
  const [v, setV] = useState(() => ({
    date: update?.date ?? today(),
    title: update?.title ?? { en: "", bn: "" },
    body: update?.body ?? { en: "", bn: "" },
    percent: update?.percent ?? "",
    milestone: update?.milestone ?? "",
    blockId: update?.blockId ?? "",
    photos: update?.photos?.map((p) => ({ mediaId: p.mediaId, media: p.media, caption: p.caption })) ?? [],
    published: update?.published ?? false,
  }));
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pct = v.percent === "" ? null : Number(v.percent);
  const valid = (v.title.en.trim() || v.title.bn.trim()) && v.date && v.date <= today() && (pct === null || (Number.isInteger(pct) && pct >= 0 && pct <= 100));

  const addFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX_PHOTOS - v.photos.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const m = await uploadMedia(f, { purpose: "project_image", alt: f.name.replace(/\.[^.]+$/, "") });
        setV((x) => ({ ...x, photos: [...x.photos, { mediaId: m.id, media: m, caption: { en: "", bn: "" } }].slice(0, MAX_PHOTOS) }));
      } catch (err) {
        toast.error(`${f.name}: ${uploadError(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  };
  const movePhoto = (i, d) =>
    setV((x) => {
      const j = i + d;
      if (j < 0 || j >= x.photos.length) return x;
      const photos = [...x.photos];
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { ...x, photos };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    const body = {
      date: v.date,
      title: v.title,
      body: v.body,
      percent: pct,
      milestone: v.milestone || null,
      blockId: v.blockId || null,
      photos: v.photos.map((p) => ({ mediaId: p.mediaId, caption: p.caption })),
      published: v.published,
    };
    try {
      if (update) await api.patch(`/construction-updates/${update.id}`, { version: update.version, ...body });
      else await api.post(`/projects/${projectId}/updates`, body);
      toast.success(t(update ? "updated" : "created"));
      onSaved();
    } catch (err) {
      setError(err?.code === "STALE_VERSION" ? t("stale") : errorMessage(te, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={t(update ? "editTitle" : "newTitle")}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Checkbox label={t("publishNow")} checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button loading={saving} disabled={!valid || uploading > 0} onClick={save}>
              {t("save")}
            </Button>
          </div>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("date")} required error={v.date > today() ? t("futureDate") : undefined}>
            <Input type="date" max={today()} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          </Field>
          <Field label={t("percent")} hint={t("percentHint")} error={pct !== null && !(Number.isInteger(pct) && pct >= 0 && pct <= 100) ? t("percentInvalid") : undefined}>
            <Input type="number" min={0} max={100} step={1} inputMode="numeric" value={v.percent} onChange={(e) => setV({ ...v, percent: e.target.value })} trailing={<span className="pr-1 text-xs text-ink-subtle">%</span>} />
          </Field>
          <Field label={t("milestone")}>
            <Select value={v.milestone} onChange={(e) => setV({ ...v, milestone: e.target.value })}>
              <option value="">{t("noMilestone")}</option>
              {MILESTONES.map((m) => (
                <option key={m} value={m}>
                  {t(`milestones.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {blocks.length > 0 && (
          <Field label={t("block")} className="max-w-xs">
            <Select value={v.blockId} onChange={(e) => setV({ ...v, blockId: e.target.value })}>
              <option value="">{t("wholeProject")}</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "bn" && b.nameBn ? b.nameBn : b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <BiInput label={t("titleField")} required max={160} value={v.title} onChange={(x) => setV({ ...v, title: x })} />
        <BiInput label={t("bodyField")} kind="ta" max={3000} value={v.body} onChange={(x) => setV({ ...v, body: x })} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">
              {t("photos")} <span className="font-normal text-ink-subtle">({formatNumber(v.photos.length, locale)}/{formatNumber(MAX_PHOTOS, locale)})</span>
            </p>
            <Button size="sm" variant="secondary" loading={uploading > 0} disabled={v.photos.length >= MAX_PHOTOS} onClick={() => input.current?.click()}>
              <ImagePlus aria-hidden className="size-4" />
              {t("addPhotos")}
            </Button>
            <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => addFiles(e.target.files ?? [])} />
          </div>
          {v.photos.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">{t("noPhotos")}</p>
          ) : (
            <ol className="space-y-2">
              {v.photos.map((p, i) => (
                <li key={p.mediaId} className="flex items-start gap-3 rounded-md border border-line p-2">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                    {p.media && <SmartImage media={p.media} variant="thumb" alt="" sizes="80px" className="absolute inset-0" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 font-mono text-[11px] text-ink-subtle">{localizeDigits(i + 1, locale)}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <Input aria-label={`${t("caption")} (বাংলা)`} lang="bn" placeholder={`${t("caption")} — বাংলা`} maxLength={200} value={p.caption.bn} onChange={(e) => setV((x) => ({ ...x, photos: x.photos.map((q, n) => (n === i ? { ...q, caption: { ...q.caption, bn: e.target.value } } : q)) }))} />
                      <Input aria-label={`${t("caption")} (English)`} lang="en" placeholder={`${t("caption")} — English`} maxLength={200} value={p.caption.en} onChange={(e) => setV((x) => ({ ...x, photos: x.photos.map((q, n) => (n === i ? { ...q, caption: { ...q.caption, en: e.target.value } } : q)) }))} />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <Button size="icon" variant="ghost" className="size-7" aria-label={t("moveEarlier")} disabled={i === 0} onClick={() => movePhoto(i, -1)}>
                      <ArrowLeft aria-hidden className="size-3.5 rotate-90" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={t("moveLater")} disabled={i === v.photos.length - 1} onClick={() => movePhoto(i, 1)}>
                      <ArrowRight aria-hidden className="size-3.5 rotate-90" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-danger" aria-label={t("removePhoto")} onClick={() => setV((x) => ({ ...x, photos: x.photos.filter((_, n) => n !== i) }))}>
                      <Trash2 aria-hidden className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Drawer>
  );
}
