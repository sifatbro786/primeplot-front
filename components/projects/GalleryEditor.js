"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { SmartImage } from "@/components/media/SmartImage";
import { discardMedia, uploadMedia, useUploadError } from "@/components/media/upload";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
import { keys, useProject } from "@/components/inventory/queries";

/**
 * Gallery + brochure (PATCH /projects/:id → galleryMediaIds ≤ 40, brochureMediaId, coverMediaId).
 * Uploads go up immediately as public media; the order/selection is saved with one PATCH.
 * Uploads abandoned with "Discard" are deleted again (the purge job is the backstop).
 */
const MAX = 40;
const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif";

function Editor({ project }) {
  const t = useTranslations("gallery");
  const te = useTranslations("errors");
  const uploadError = useUploadError();
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useSession();
  const canWrite = can("projects:write");
  const pick = useRef(null);
  const pickPdf = useRef(null);

  const initial = { gallery: project.media?.gallery ?? [], brochure: project.media?.brochure ?? null, coverId: project.coverMediaId ?? null };
  const [gallery, setGallery] = useState(initial.gallery);
  const [brochure, setBrochure] = useState(initial.brochure);
  const [coverId, setCoverId] = useState(initial.coverId);
  const [fresh, setFresh] = useState([]); // uploaded this session, not saved yet
  const [busy, setBusy] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty =
    gallery.map((m) => m.id).join() !== initial.gallery.map((m) => m.id).join() || (brochure?.id ?? null) !== (initial.brochure?.id ?? null) || coverId !== initial.coverId;

  const addFiles = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    const room = MAX - gallery.length;
    if (images.length > room) toast.error(t("tooMany", { n: formatNumber(MAX, locale) }));
    const batch = images.slice(0, Math.max(0, room));
    if (!batch.length) return;
    setBusy((b) => b + batch.length);
    // Two at a time: the server processes images with a concurrency cap of 2 as well.
    const queue = [...batch];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          const m = await uploadMedia(f, { purpose: "project_image", alt: f.name.replace(/\.[^.]+$/, "") });
          setGallery((g) => (g.length < MAX ? [...g, m] : g));
          setFresh((x) => [...x, m.id]);
        } catch (err) {
          toast.error(`${f.name}: ${uploadError(err)}`);
        } finally {
          setBusy((b) => b - 1);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };

  const addBrochure = async (file) => {
    if (!file) return;
    setPdfBusy(true);
    try {
      const m = await uploadMedia(file, { purpose: "brochure", alt: file.name });
      setBrochure(m);
      setFresh((x) => [...x, m.id]);
    } catch (err) {
      toast.error(uploadError(err));
    } finally {
      setPdfBusy(false);
      if (pickPdf.current) pickPdf.current.value = "";
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= gallery.length || from === to) return;
    const next = [...gallery];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setGallery(next);
  };

  const discard = () => {
    discardMedia(fresh);
    setFresh([]);
    setGallery(initial.gallery);
    setBrochure(initial.brochure);
    setCoverId(initial.coverId);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch(`/projects/${project.id}`, {
        version: project.version,
        galleryMediaIds: gallery.map((m) => m.id),
        brochureMediaId: brochure?.id ?? null,
        coverMediaId: coverId,
      });
      // Removed images that were uploaded in this session would be orphans — delete them now.
      const kept = new Set([...gallery.map((m) => m.id), brochure?.id, coverId].filter(Boolean));
      discardMedia(fresh.filter((id) => !kept.has(id)));
      qc.setQueryData(keys.project(project.id), updated); // full detail → the editor remounts clean
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("saved"));
    } catch (err) {
      setError(err?.code === "STALE_VERSION" ? t("stale") : err?.code === "INVALID_MEDIA" ? t("invalidMedia") : errorMessage(te, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <FormAlert>{error}</FormAlert>
      <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <header>
          <h3 className="text-sm font-semibold">{t("photos")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t("photosBody", { n: formatNumber(MAX, locale) })}</p>
          <p className="mt-3 font-mono text-xs text-ink-subtle">{t("count", { n: formatNumber(gallery.length, locale), max: formatNumber(MAX, locale) })}</p>
        </header>
        <div>
          {canWrite && (
            <div
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  setOver(true);
                }
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                if (!e.dataTransfer.files?.length) return;
                e.preventDefault();
                setOver(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "blueprint mb-5 flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
                over ? "border-primary bg-accent-soft/40" : "border-line-strong/70",
              )}
            >
              <Upload aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-ink-muted">{t("drop")}</p>
              <Button size="sm" variant="secondary" loading={busy > 0} disabled={gallery.length >= MAX} onClick={() => pick.current?.click()}>
                <ImagePlus aria-hidden className="size-3.5" />
                {t("choose")}
              </Button>
              {busy > 0 && <p className="text-xs text-ink-muted" role="status">{t("uploading", { n: formatNumber(busy, locale) })}</p>}
              <input
                ref={pick}
                type="file"
                multiple
                accept={IMAGE_TYPES}
                className="hidden"
                onChange={(e) => {
                  addFiles([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {gallery.length === 0 ? (
            <p className="rounded-md border border-line bg-surface-2 px-4 py-5 text-sm text-ink-muted">{t("empty")}</p>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {gallery.map((m, i) => (
                <li
                  key={m.id}
                  draggable={canWrite}
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => dragFrom != null && e.preventDefault()}
                  onDrop={(e) => {
                    if (dragFrom == null) return;
                    e.preventDefault();
                    move(dragFrom, i);
                    setDragFrom(null);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  className={cn("group overflow-hidden rounded-md border border-line bg-surface", dragFrom === i && "opacity-40", canWrite && "cursor-grab")}
                >
                  <div className="relative">
                    <SmartImage media={m} variant="thumb" sizes="240px" className="aspect-[4/3]" />
                    <span className="absolute top-1.5 left-1.5 rounded-sm bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] text-ink">{formatNumber(i + 1, locale)}</span>
                    {coverId === m.id && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-ink">
                        <Star aria-hidden className="size-2.5" />
                        {t("cover")}
                      </span>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                      <div className="flex">
                        <Button size="icon" variant="ghost" className="size-7" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t("moveEarlier")}>
                          <ArrowLeft aria-hidden className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" disabled={i === gallery.length - 1} onClick={() => move(i, i + 1)} aria-label={t("moveLater")}>
                          <ArrowRight aria-hidden className="size-3.5" />
                        </Button>
                      </div>
                      <div className="flex">
                        <Button size="icon" variant="ghost" className="size-7" disabled={coverId === m.id} onClick={() => setCoverId(m.id)} aria-label={t("makeCover")} title={t("makeCover")}>
                          <Star aria-hidden className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-danger"
                          onClick={() => setGallery(gallery.filter((x) => x.id !== m.id))}
                          aria-label={t("remove")}
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="grid gap-6 border-t border-line pt-10 lg:grid-cols-[240px_1fr]">
        <header>
          <h3 className="text-sm font-semibold">{t("brochure")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t("brochureBody")}</p>
        </header>
        <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-4 sm:flex-row sm:items-center">
          <FileText aria-hidden className="size-8 shrink-0 text-accent" strokeWidth={1.25} />
          <div className="min-w-0 flex-1">
            {brochure ? (
              <>
                <a href={brochure.urls?.file} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium underline-offset-4 hover:underline">
                  {brochure.originalName ?? brochure.alt ?? t("brochure")}
                </a>
                <p className="text-xs text-ink-muted">
                  {formatNumber(Math.round((brochure.bytes ?? 0) / 1024), locale)} KB · {formatDate(brochure.createdAt, locale)}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t("noBrochure")}</p>
            )}
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" loading={pdfBusy} onClick={() => pickPdf.current?.click()}>
                {brochure ? t("replacePdf") : t("uploadPdf")}
              </Button>
              {brochure && (
                <Button size="sm" variant="ghost" onClick={() => setBrochure(null)} aria-label={t("removePdf")}>
                  <Trash2 aria-hidden className="size-3.5" />
                </Button>
              )}
              <input ref={pickPdf} type="file" accept="application/pdf" className="hidden" onChange={(e) => addBrochure(e.target.files?.[0])} />
            </div>
          )}
        </div>
      </section>

      {canWrite && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <span className="mr-auto text-xs text-ink-muted">{dirty ? t("unsaved") : t("upToDate")}</span>
          <Button variant="ghost" disabled={!dirty || saving} onClick={discard}>
            {t("discard")}
          </Button>
          <Button loading={saving} disabled={!dirty || busy > 0 || pdfBusy} onClick={save}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function GalleryEditor() {
  const { id } = useParams();
  const { data: project } = useProject(id);
  if (!project) return <Skeleton className="h-96 w-full" />;
  // Remount on a new version (after save, or someone else's edit) so the form starts clean.
  return <Editor key={`${project.id}:${project.version}`} project={project} />;
}
