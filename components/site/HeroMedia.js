"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Background video for the home hero. The poster is always rendered first (server HTML, LCP);
 * the <video> is only added after mount, and never when the visitor asked for less motion or
 * less data (prefers-reduced-motion, Save-Data, 2G). Muted + playsInline so mobile autoplays.
 * A pause button is always offered (WCAG 2.2.2 — moving content longer than 5 s).
 */
function allowVideo() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  const c = navigator.connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "")) return false;
  return true;
}

export function HeroMedia({ sources, poster, className }) {
  const t = useTranslations("site.home");
  const ref = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    if (!allowVideo()) return undefined;
    const id = requestAnimationFrame(() => setEnabled(true)); // after first paint: poster wins LCP
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className={cn("absolute inset-0 bg-primary", className)}>
      {poster && !posterFailed && (
        // eslint-disable-next-line @next/next/no-img-element -- remote poster, sized by CSS; the video replaces it
        <img src={poster} alt="" fetchPriority="high" onError={() => setPosterFailed(true)} className="absolute inset-0 size-full object-cover" />
      )}
      {enabled && (
        <video
          ref={ref}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          aria-hidden
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-700", playing ? "opacity-100" : "opacity-0")}
        >
          {sources.map((src) => (
            <source key={src} src={src} type="video/mp4" />
          ))}
        </video>
      )}
      {enabled && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("pauseVideo") : t("playVideo")}
          className="absolute right-4 bottom-4 z-10 grid size-9 place-items-center rounded-md border border-white/30 bg-ink/40 text-white backdrop-blur-[2px] transition-colors hover:bg-ink/60 sm:right-6 sm:bottom-6"
        >
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
      )}
    </div>
  );
}
