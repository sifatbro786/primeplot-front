"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const SiteMap = dynamic(() => import("./SiteMap"), {
  ssr: false,
  loading: () => <div className="blueprint h-full w-full animate-pulse rounded-lg border border-line bg-surface-2" />,
});

/** Mounts the map only when its box scrolls near the viewport (keeps maplibre off first load). */
export function SiteMapLazy({ className, ...props }) {
  const box = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = box.current;
    if (!node || visible) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "300px" });
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);
  return (
    <div ref={box} className={cn("relative", className)}>
      {visible ? (
        <SiteMap {...props} className="absolute inset-0" />
      ) : (
        <div className="blueprint absolute inset-0 rounded-lg border border-line bg-surface-2" />
      )}
    </div>
  );
}
