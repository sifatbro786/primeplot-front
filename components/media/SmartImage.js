"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { pickPlaceholder, placeholdersEnabled, stockLoader } from "@/lib/placeholders";

/**
 * One component for every property/project image:
 *  1. real media from the API (already WebP variants + blur) → shown as-is (no re-optimising);
 *  2. otherwise a deterministic stock placeholder for the entity (Unsplash CDN-resized);
 *  3. if that fails too (offline, photo removed) → a drafted fallback, never a broken icon.
 *
 * Props: media?, variant ('thumb'|'card'|'full'), category, seed (entity id), alt, sizes,
 *        fill (default true — parent sets the aspect ratio), fit ('cover'|'contain' — drawings
 *        and plans use contain), preload, sampleBadge (dashboard only).
 */
export function SmartImage({
  media,
  variant = "card",
  category = "apartment-exterior",
  seed = "",
  alt = "",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  fill = true,
  fit = "cover",
  preload = false,
  sampleBadge = false,
  className,
  imgClassName,
}) {
  const t = useTranslations("common");
  const [failed, setFailed] = useState(false);
  const realSrc = media?.urls?.[variant] ?? media?.urls?.full ?? media?.urls?.card;
  const stockSrc = !realSrc && placeholdersEnabled ? pickPlaceholder(category, seed) : null;
  const src = realSrc ?? stockSrc;

  return (
    // cn() has no tailwind-merge: drop our defaults when the caller positions/paints the box itself
    // (".relative" would otherwise beat a caller's "absolute inset-0" and collapse the image).
    <div
      className={cn(
        !/\b(absolute|fixed)\b/.test(className ?? "") && "relative",
        !/\bbg-/.test(className ?? "") && "bg-surface-2",
        "overflow-hidden",
        className,
      )}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt={media?.alt ?? alt}
          fill={fill}
          sizes={sizes}
          preload={preload}
          onError={() => setFailed(true)}
          className={cn(fit === "contain" ? "object-contain" : "object-cover", imgClassName)}
          {...(realSrc
            ? {
                unoptimized: true,
                ...(media?.blurDataUrl && { placeholder: "blur", blurDataURL: media.blurDataUrl }),
              }
            : { loader: stockLoader })}
        />
      ) : (
        <div className="blueprint absolute inset-0 grid place-items-center text-ink-subtle" role="img" aria-label={alt}>
          <ImageOff aria-hidden className="size-6" strokeWidth={1.25} />
        </div>
      )}
      {sampleBadge && !realSrc && (
        <span className="absolute top-2 left-2 rounded-sm bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink-muted uppercase">
          {t("sampleImage")}
        </span>
      )}
    </div>
  );
}
