"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Quiet scroll reveal for the public site (GSAP is used on the public site only — ARCHITECTURE
 * §7). Children marked `data-reveal` rise 16px and fade in once as they enter the viewport.
 * Content is fully visible without JS, and nothing moves with prefers-reduced-motion.
 */
export function Reveal({ as: Tag = "div", className, children, ...props }) {
  const root = useRef(null);
  useEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      for (const el of root.current.querySelectorAll("[data-reveal]")) {
        gsap.from(el, {
          y: 16,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      }
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <Tag ref={root} className={className} {...props}>
      {children}
    </Tag>
  );
}
