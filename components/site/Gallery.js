"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { cn } from "@/lib/cn";
import { localizeDigits } from "@/lib/format";

const pad = (n, locale) => localizeDigits(String(n).padStart(2, "0"), locale);

/**
 * Project gallery: a drag/swipe carousel (Embla) + a full-screen viewer on the native <dialog>
 * (Esc, focus trap, arrows). `items` = [{ media? , category, seed, alt }]; items without media
 * are stock placeholders and carry the "sample image" badge.
 */
export function Gallery({ items, label, dark = false }) {
  const t = useTranslations("site.gallery");
  const locale = useLocale();
  const [viewport, embla] = useEmblaCarousel({ align: "start", loop: false, containScroll: "trimSnaps" });
  const [index, setIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 1);
  const [open, setOpen] = useState(null); // index shown in the viewer

  useEffect(() => {
    if (!embla) return undefined;
    const sync = () => {
      setIndex(embla.selectedScrollSnap());
      setCanPrev(embla.canScrollPrev());
      setCanNext(embla.canScrollNext());
    };
    sync();
    embla.on("select", sync).on("reInit", sync);
    return () => embla.off("select", sync).off("reInit", sync);
  }, [embla]);

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={viewport} className="overflow-hidden">
        <ul className="-ml-4 flex touch-pan-y">
          {items.map((it, i) => (
            <li
              key={it.media?.id ?? `${it.seed}-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={t("slide", { n: localizeDigits(i + 1, locale), total: localizeDigits(items.length, locale) })}
              className="min-w-0 shrink-0 grow-0 basis-[86%] pl-4 sm:basis-[62%] lg:basis-[48%]"
            >
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group relative block aspect-[16/10] w-full overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                aria-label={t("open", { n: localizeDigits(i + 1, locale) })}
              >
                <SmartImage
                  media={it.media}
                  category={it.category}
                  seed={it.seed}
                  alt={it.alt}
                  sampleBadge={!it.media}
                  sizes="(min-width: 1024px) 48vw, (min-width: 640px) 62vw, 86vw"
                  className="absolute inset-0"
                  imgClassName="transition-transform duration-700 ease-(--ease-out-quint) group-hover:scale-[1.02]"
                />
                <span className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-sm bg-surface/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Expand aria-hidden className="size-4" strokeWidth={1.5} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className={cn("font-mono text-xs", dark ? "text-primary-ink/80" : "text-ink-muted")} aria-live="polite">
            {pad(index + 1, locale)} <span className={dark ? "text-primary-ink/50" : "text-ink-subtle"}>/ {pad(items.length, locale)}</span>
          </p>
          <div className="flex gap-2">
            <ArrowButton dark={dark} onClick={() => embla?.scrollPrev()} disabled={!canPrev} label={t("prev")} icon={ChevronLeft} />
            <ArrowButton dark={dark} onClick={() => embla?.scrollNext()} disabled={!canNext} label={t("next")} icon={ChevronRight} />
          </div>
        </div>
      )}

      <Viewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </div>
  );
}

function ArrowButton({ onClick, disabled, label, icon: Icon, dark = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "grid size-10 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        dark ? "border-white/25 text-white hover:bg-white/10" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

function Viewer({ items, index, onIndex, onClose }) {
  const t = useTranslations("site.gallery");
  const locale = useLocale();
  const ref = useRef(null);
  const open = index != null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const step = useCallback((dir) => onIndex((i) => (i == null ? i : (i + dir + items.length) % items.length)), [items.length, onIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  // Swipe in the viewer (no carousel needed for one image at a time).
  const touch = useRef(null);
  const it = open ? items[index] : null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={t("viewer")}
      className="m-0 h-dvh max-h-dvh w-full max-w-full bg-ink p-0 text-white backdrop:bg-ink"
    >
      {it && (
        <div
          className="flex h-full flex-col"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <p className="font-mono text-xs text-white/70">
              {pad(index + 1, locale)} / {pad(items.length, locale)}
            </p>
            <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-10 place-items-center rounded-md text-white hover:bg-white/10">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <SmartImage
              key={index}
              media={it.media}
              variant="full"
              category={it.category}
              seed={it.seed}
              alt={it.alt}
              fit="contain"
              sampleBadge={!it.media}
              sizes="100vw"
              className="absolute inset-0 bg-transparent"
            />
          </div>
          {items.length > 1 && (
            <div className="flex justify-center gap-3 px-4 py-4">
              <ArrowButton dark onClick={() => step(-1)} label={t("prev")} icon={ChevronLeft} />
              <ArrowButton dark onClick={() => step(1)} label={t("next")} icon={ChevronRight} />
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
