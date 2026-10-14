import "server-only";
import { getPageSeoOrNull, getSiteSeoOrNull } from "@/lib/public/api";
import { plain, tx } from "@/lib/public/content";
import { ALLOW_INDEXING, alternatesFor, robotsMeta } from "@/lib/public/site";

/**
 * Page metadata from the dashboard's SEO settings (B2b), falling back to the built-in title and
 * description. Precedence: page/project SEO → built-in text → site-wide default description.
 * Indexing: NEXT_PUBLIC_ALLOW_INDEXING is the master switch; the dashboard can only add noindex
 * (site-wide switch or per page) — it can never open a staging site to search engines.
 */
export const fillCompany = (s, company) => plain(String(s ?? "").replaceAll("{company}", company || "")).trim();

export function ogImagesOf(media) {
  const url = media?.urls?.full ?? media?.urls?.card;
  return url ? [{ url, width: media.width ?? undefined, height: media.height ?? undefined, alt: media.alt ?? undefined }] : undefined;
}

export function robotsFor({ site, noindex }) {
  if (!ALLOW_INDEXING || site?.settings?.indexing === false) return { index: false, follow: false };
  if (noindex) return { index: false, follow: true }; // keep link discovery, drop this page
  return robotsMeta;
}

/**
 * @param {object} o
 * @param {string} o.locale
 * @param {string} o.path       locale-less path for canonical/hreflang
 * @param {string} o.company    company name in this language
 * @param {string} o.title      built-in title (used when the page SEO has none)
 * @param {string} o.description built-in description
 * @param {object} [o.seo]      page/project SEO ({ title, description, ogImage, noindex }); omit → page `key`
 * @param {string} [o.key]      site page key to read the SEO for
 * @param {boolean} [o.absolute] title is complete (home) — no "· company" template
 * @param {object} [o.fallbackOg] OpenGraph image media when the SEO has none (e.g. project cover)
 */
export async function buildMetadata({ locale, path, company, title, description, seo, key, absolute = false, fallbackOg, openGraph = {} }) {
  const [site, pageSeo] = await Promise.all([getSiteSeoOrNull(), seo !== undefined || !key ? null : getPageSeoOrNull(key)]);
  const s = seo ?? pageSeo;
  const finalTitle = fillCompany(tx(s?.title, locale), company) || title;
  const finalDescription =
    fillCompany(tx(s?.description, locale), company) || description || fillCompany(tx(site?.settings?.defaultDescription, locale), company) || undefined;
  const images = ogImagesOf(s?.ogImage) ?? ogImagesOf(fallbackOg) ?? ogImagesOf(site?.settings?.defaultOgImage);
  return {
    title: absolute ? { absolute: finalTitle } : finalTitle,
    description: finalDescription,
    alternates: alternatesFor(locale, path),
    robots: robotsFor({ site, noindex: s?.noindex }),
    openGraph: { title: finalTitle, description: finalDescription, ...(images && { images }), ...openGraph },
    ...(images && { twitter: { card: "summary_large_image", images: images.map((i) => i.url) } }),
  };
}

/** Title template "%s | {company}" from the dashboard (must contain %s; else the default). */
export function titleTemplate(site, locale, company) {
  const raw = fillCompany(tx(site?.settings?.titleTemplate, locale), company);
  return raw.includes("%s") ? raw : `%s · ${company}`;
}

/** schema.org sameAs: the company's social profiles. */
export function sameAs(site) {
  return Object.values(site?.settings?.social ?? {}).filter((u) => typeof u === "string" && u.startsWith("https://"));
}
