"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { MAP_STYLE_URL } from "@/lib/public/site";
import { googleMapsUrl } from "./mapLinks";

// Worker files are copied to public/ by scripts/vendor-maplibre.mjs (predev/prebuild).
setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

/**
 * MapLibre map with square markers (vector tiles from MAP_STYLE_URL — OpenFreeMap by default,
 * no key). Loaded only through SiteMapLazy, so the ~800 KB library never ships with a page
 * until a map is actually shown. Cooperative gestures: one-finger scroll / wheel keeps scrolling
 * the page; two fingers or Ctrl+wheel moves the map.
 *
 * points: [{ id, lat, lng, title, subtitle?, href? }] — text is set with textContent (no HTML).
 */
export default function SiteMap({ points, label, className, zoom = 14 }) {
  const t = useTranslations("site.map");
  const el = useRef(null);
  // Client-only module (loaded with ssr:false), so the WebGL probe can run during the first render.
  const [failed, setFailed] = useState(() => !hasWebGL());

  useEffect(() => {
    if (failed || !el.current || !points.length) return undefined;
    let map;
    try {
      map = new MapLibreMap({
        container: el.current,
        style: MAP_STYLE_URL,
        center: [points[0].lng, points[0].lat],
        zoom,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      queueMicrotask(() => setFailed(true)); // WebGL context refused (e.g. blocked by the browser)
      return undefined;
    }
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => {
      // A failed style/tiles request leaves an empty canvas: show the fallback instead.
      if (!map.isStyleLoaded() && /style|fetch|tile/i.test(e?.error?.message ?? "")) setFailed(true);
    });

    for (const p of points) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "pp-map-marker";
      node.setAttribute("aria-label", p.title);
      const popup = new Popup({ offset: 14, closeButton: false, maxWidth: "260px" }).setDOMContent(popupNode(p, t("open")));
      new Marker({ element: node, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
    }
    if (points.length > 1) {
      const b = new LngLatBounds();
      points.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 64, maxZoom: 15, duration: 0 });
    }
    return () => map.remove();
  }, [failed, points, zoom, t]);

  if (failed) {
    const p = points[0];
    return (
      <div className={cn("blueprint grid place-items-center rounded-lg border border-line bg-surface p-6 text-center", className)}>
        <div>
          <MapPinOff aria-hidden className="mx-auto size-6 text-ink-subtle" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-ink-muted">{t("failed")}</p>
          {p && points.length === 1 && (
            <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent underline underline-offset-4">
              {t("openGoogle")}
            </a>
          )}
        </div>
      </div>
    );
  }
  return <div ref={el} role="region" aria-label={label} className={cn("overflow-hidden rounded-lg border border-line bg-surface-2", className)} />;
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function popupNode(p, openLabel) {
  const root = document.createElement("div");
  root.className = "pp-map-popup";
  const title = document.createElement("p");
  title.className = "pp-map-popup-title";
  title.textContent = p.title;
  root.append(title);
  if (p.subtitle) {
    const sub = document.createElement("p");
    sub.className = "pp-map-popup-sub";
    sub.textContent = p.subtitle;
    root.append(sub);
  }
  if (p.href) {
    const a = document.createElement("a");
    a.href = p.href;
    a.className = "pp-map-popup-link";
    a.textContent = openLabel;
    root.append(a);
  }
  return root;
}
