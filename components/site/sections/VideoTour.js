"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Click-to-load YouTube player: nothing from YouTube loads (no scripts, no cookies) until the
 * visitor presses play; then the privacy-enhanced youtube-nocookie.com player is embedded.
 */
export function VideoTour({ youtubeId, title, poster }) {
  const t = useTranslations("site.sections.video");
  const [playing, setPlaying] = useState(false);
  if (!/^[\w-]{11}$/.test(youtubeId ?? "")) return null;
  const thumb = poster?.urls?.full ?? poster?.urls?.card ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-primary-deep bg-black">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
          title={title || t("title")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 size-full" aria-label={t("play", { title: title || t("title") })}>
          <Image src={thumb} alt="" fill unoptimized sizes="(min-width: 1024px) 66vw, 100vw" className="object-cover opacity-80 transition-opacity group-hover:opacity-95" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-20 place-items-center rounded-full bg-surface/95 text-ink shadow-lg transition-transform group-hover:scale-105">
              <Play aria-hidden className="ml-1 size-8" strokeWidth={1.5} />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
