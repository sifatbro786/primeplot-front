import { ALLOW_INDEXING, SITE_URL } from "@/lib/public/site";

/** /robots.txt — closed everywhere until NEXT_PUBLIC_ALLOW_INDEXING=true (live domain only). */
export default function robots() {
  if (!ALLOW_INDEXING) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const privateAreas = ["dashboard", "portal", "login", "forgot-password", "reset-password", "setup-account", "session", "dev"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", ...privateAreas.map((p) => `/*/${p}`)] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
