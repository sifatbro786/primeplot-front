"use client";

import { useLocale, useMessages } from "next-intl";
import { useSession } from "@/lib/auth/session";

/** Messages namespace holding each page's built-in title/description (what the site uses when SEO is empty). */
const NS = { home: "home", about: "about", projects: "list", contact: "contactPage", landowners: "landowners", compare: "compare" };

/**
 * Built-in title/description per language for the SEO preview. The dashboard only has the
 * current locale's messages, so the other language shows its own SEO text or stays empty.
 */
export function usePageFallback(key) {
  const locale = useLocale();
  const messages = useMessages();
  const { org } = useSession();
  const site = messages?.site?.[NS[key]] ?? {};
  const name = (locale === "bn" && org?.nameBn) || org?.name || "";
  const fill = (s) => String(s ?? "").replaceAll("{name}", name);
  const title = site.metaTitle ? (key === "home" ? `${name} — ${site.metaTitle}` : `${site.metaTitle} | ${name}`) : "";
  return {
    title: { [locale]: fill(title) },
    description: { [locale]: fill(site.metaDescription) },
  };
}
