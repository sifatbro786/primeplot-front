"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { localizeDigits } from "@/lib/format";

/** Thumbnails of a construction update + a full-screen viewer (native <dialog>: Esc, focus trap). */
export function PhotoStrip({ photos, caption }) {
  const t = useTranslations("site.gallery");
  const locale = useLocale();
  const dialog = useRef(null);
  const [i, setI] = useState(0);
  if (!photos?.length) return null;
  const open = (n) => {
    setI(n);
    dialog.current?.showModal();
  };
  const go = (d) => setI((n) => (n + d + photos.length) % photos.length);
  const shown = photos.slice(0, 4);
  const current = photos[i];

  return (
    <>
      <ul className="mt-5 grid grid-cols-4 gap-2 sm:max-w-xl">
        {shown.map((p, n) => (
          <li key={p.media?.id ?? n}>
            <button
              type="button"
              onClick={() => open(n)}
              className="relative block aspect-square w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-label={t("open", { n: localizeDigits(n + 1, locale) })}
            >
              <SmartImage media={p.media} alt={p.caption || caption} variant="thumb" sizes="140px" className="absolute inset-0" />
              {n === 3 && photos.length > 4 && (
                <span className="absolute inset-0 grid place-items-center bg-ink/55 font-mono text-sm text-white">+{localizeDigits(photos.length - 4, locale)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        className="m-auto h-[min(90svh,52rem)] w-[min(96vw,80rem)] max-w-none overflow-hidden rounded-lg bg-ink p-0 text-white backdrop:bg-ink/85"
      >
        <div className="relative flex h-full flex-col">
          <div className="relative flex-1">
            {current && <SmartImage media={current.media} alt={current.caption || caption} variant="full" fit="contain" sizes="96vw" className="absolute inset-0 bg-ink" />}
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <p className="min-w-0 truncate">{current?.caption || caption}</p>
            <p className="shrink-0 font-mono text-xs text-white/70">
              {localizeDigits(i + 1, locale)} / {localizeDigits(photos.length, locale)}
            </p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={t("close")} className="absolute top-3 right-3 grid size-10 place-items-center rounded-md bg-ink/70 hover:bg-ink">
            <X aria-hidden className="size-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t("prev")} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-md bg-ink/70 hover:bg-ink">
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label={t("next")} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-md bg-ink/70 hover:bg-ink">
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
