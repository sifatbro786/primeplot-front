import "server-only";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { pickPlaceholder, placeholdersEnabled } from "@/lib/placeholders";

/**
 * Share cards (Open Graph, 1200×630) for projects and units.
 *
 * Text is English on both locales on purpose: the image renderer (Satori) does not shape Bengali
 * conjuncts, so Bangla would print broken. Prices use "Tk" because the default font has no "৳".
 * Everything degrades instead of failing: no fonts → built-in font, no photo → type-only card.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const C = { primary: "#2d3228", deep: "#23271f", ink: "#f9f8f6", sage: "#a9ae96", paper: "#f2ede3" };

/** Font file from Google Fonts (TTF — the CSS API serves TTF to clients without a browser UA). */
async function googleFont(family, weight) {
  "use cache";
  cacheLife("max");
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
    signal: AbortSignal.timeout(4000),
  }).then((r) => (r.ok ? r.text() : ""));
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`No TTF for ${family}`);
  return new Uint8Array(await fetch(url, { signal: AbortSignal.timeout(6000) }).then((r) => r.arrayBuffer()));
}

/** Both fonts or none (mixing a custom serif with the default sans looks broken). */
async function loadFonts() {
  try {
    const [serif, sans] = await Promise.all([googleFont("Playfair Display", 500), googleFont("Plus Jakarta Sans", 500)]);
    return [
      { name: "Playfair", data: serif.buffer, weight: 500, style: "normal" },
      { name: "Jakarta", data: sans.buffer, weight: 500, style: "normal" },
    ];
  } catch {
    return [];
  }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Photo as a JPEG data URL. Our media are WebP, which the renderer can't read, so they go through
 * sharp (ships with Next.js). Only our own media URLs and the curated stock list reach this.
 */
async function photoCached(url) {
  "use cache";
  cacheLife("hours");
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const len = Number(res.headers.get("content-length") || 0);
  if (!res.ok || len > MAX_IMAGE_BYTES) throw new Error(`Cover ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Cover too large");
  const { default: sharp } = await import("sharp");
  const jpg = await sharp(buf, { limitInputPixels: 40_000_000 }).resize(560, 630, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

/** Failures aren't cached (they throw out of the cached read), so a flaky fetch is retried next time. */
async function photo(url) {
  if (!url) return null;
  try {
    return await photoCached(url);
  } catch {
    return null;
  }
}

/** Cover URL for a project/unit image, or a stock placeholder while none is uploaded. */
export function coverUrl(media, category, seed) {
  const own = media?.urls?.card ?? media?.urls?.full;
  if (own) return own;
  return placeholdersEnabled ? `${pickPlaceholder(category, seed)}?fm=jpg&fit=crop&w=600&h=680&q=70` : null;
}

export const ogPrice = (formatted) => (formatted ? formatted.replace("৳", "Tk").replace(/\s+/g, " ").trim() : null);

/**
 * @param {{ brand: string, eyebrow?: string, title: string, lines?: string[], price?: string|null, priceLabel?: string, image?: string|null }} p
 */
export async function ogCard({ brand, eyebrow, title, lines = [], price, priceLabel = "From", image }) {
  const [fonts, src] = await Promise.all([loadFonts(), photo(image)]);
  const serif = fonts.length ? "Playfair" : undefined;
  const sans = fonts.length ? "Jakarta" : undefined;
  const titleSize = title.length > 28 ? 58 : 72;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.primary, color: C.ink, fontFamily: sans }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 64px", borderRight: src ? `8px solid ${C.deep}` : "none" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: C.sage }}>{brand}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            {eyebrow && <div style={{ display: "flex", fontSize: 24, color: C.sage, marginBottom: 14 }}>{eyebrow}</div>}
            <div style={{ display: "flex", fontFamily: serif, fontSize: titleSize, lineHeight: 1.05 }}>{title}</div>
            {lines.filter(Boolean).map((l) => (
              <div key={l} style={{ display: "flex", fontSize: 26, marginTop: 14, color: "rgba(249,248,246,0.75)" }}>
                {l}
              </div>
            ))}
          </div>
          {price && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 40, paddingTop: 24, borderTop: "1px solid rgba(249,248,246,0.18)" }}>
              <span style={{ fontSize: 22, color: C.sage, marginRight: 14, textTransform: "uppercase", letterSpacing: 3 }}>{priceLabel}</span>
              <span style={{ fontFamily: serif, fontSize: 44 }}>{price}</span>
            </div>
          )}
        </div>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
          <img src={src} width={560} height={630} alt="" style={{ width: 560, height: 630, objectFit: "cover" }} />
        )}
      </div>
    ),
    { ...OG_SIZE, ...(fonts.length && { fonts }), headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
