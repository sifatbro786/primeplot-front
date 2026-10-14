"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Paperclip, Trash2, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { discardMedia, uploadMedia, useUploadError } from "@/components/media/upload";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/**
 * Private customer files (photo, NID/passport scans). They stream through the API with the
 * session cookie; someone who may not see a file gets 404 — shown as "not available".
 */
const fileUrl = (id, variant) => `/api/v1/media/${id}/file?variant=${variant}`;

function useMediaMeta(id) {
  return useQuery({
    queryKey: ["media", id],
    queryFn: () => api.get(`/media/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    retry: false,
  });
}

export function CustomerPhoto({ mediaId, className }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2", className)}>
      {mediaId && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- private WebP streamed by the API
        <img src={fileUrl(mediaId, "thumb")} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <UserRound aria-hidden className="size-1/2 text-ink-subtle" strokeWidth={1.4} />
      )}
    </span>
  );
}

function FileChip({ id, onRemove }) {
  const t = useTranslations("sales.customers.files");
  const meta = useMediaMeta(id);
  const m = meta.data;
  const isImage = m?.kind === "image";
  const href = m ? fileUrl(id, isImage ? "full" : "file") : undefined;
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- private WebP streamed by the API
        <img src={fileUrl(id, "thumb")} alt="" className="size-9 rounded-sm object-cover" />
      ) : (
        <FileText aria-hidden className="size-5 text-ink-subtle" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">
        {meta.isError ? (
          <span className="text-ink-muted">{t("unavailable")}</span>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {m.originalName || t("file")}
          </a>
        ) : (
          <span className="text-ink-muted">…</span>
        )}
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="-m-1 rounded-sm p-1 text-ink-subtle hover:text-danger" aria-label={t("remove")}>
          <Trash2 aria-hidden className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export function FileList({ ids, onRemove }) {
  if (!ids?.length) return null;
  return (
    <ul className="space-y-2">
      {ids.map((id) => (
        <FileChip key={id} id={id} onRemove={onRemove ? () => onRemove(id) : undefined} />
      ))}
    </ul>
  );
}

/** Photo picker (private avatar). Newly uploaded ids are reported so the form can discard them. */
export function PhotoField({ mediaId, onChange, onUploaded }) {
  const t = useTranslations("sales.customers.files");
  const uploadError = useUploadError();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const m = await uploadMedia(file, { purpose: "avatar", visibility: "private" });
      onUploaded?.(m.id);
      onChange(m.id);
    } catch (err) {
      toast.error(uploadError(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex items-center gap-4">
      <CustomerPhoto key={mediaId ?? "none"} mediaId={mediaId} className="size-20" />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          <ImagePlus aria-hidden className="size-3.5" />
          {mediaId ? t("replacePhoto") : t("addPhoto")}
        </Button>
        {mediaId && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={t("removePhoto")}>
            <Trash2 aria-hidden className="size-3.5" />
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/** NID / passport scans and other papers (private documents, images or PDF, ≤ 10). */
export function DocumentsField({ ids, onChange, onUploaded, max = 10 }) {
  const t = useTranslations("sales.customers.files");
  const uploadError = useUploadError();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (files) => {
    const list = [...(files ?? [])].slice(0, Math.max(0, max - ids.length));
    if (!list.length) return;
    setBusy(true);
    const added = [];
    for (const file of list) {
      try {
        const m = await uploadMedia(file, { purpose: "document", visibility: "private" });
        added.push(m.id);
      } catch (err) {
        toast.error(`${file.name}: ${uploadError(err)}`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (added.length) {
      onUploaded?.(added);
      onChange([...ids, ...added]);
    }
  };
  return (
    <div className="space-y-3">
      <FileList ids={ids} onRemove={(id) => onChange(ids.filter((x) => x !== id))} />
      {ids.length < max && (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          <Paperclip aria-hidden className="size-3.5" />
          {t("addDocuments")}
        </Button>
      )}
      <p className="text-xs text-ink-muted">{t("documentsHint")}</p>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}

export { discardMedia };
