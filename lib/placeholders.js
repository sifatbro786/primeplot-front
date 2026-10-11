/**
 * Curated stock photos shown until real media is uploaded (ARCHITECTURE §7.1).
 * Unsplash/Pexels CDNs resize on the fly, so these bypass the Next image optimizer.
 * Pick is deterministic per entity id → the same project always gets the same photo.
 * Kill switch: NEXT_PUBLIC_USE_PLACEHOLDERS=false.
 * If a photo is ever removed upstream, <SmartImage> falls back to a drafted SVG — replace the
 * id here when you spot one on /dev/design.
 */
const U = (id) => `https://images.unsplash.com/${id}`;

export const PLACEHOLDERS = {
  "apartment-exterior": [
    U("photo-1545324418-cc1a3fa10c00"),
    U("photo-1460317442991-0ec209397118"),
    U("photo-1486406146926-c627a92ad1ab"),
    U("photo-1515263487990-61b07816b324"),
    U("photo-1574362848149-11496d93a7c7"),
  ],
  house: [
    U("photo-1600596542815-ffad4c1539a9"),
    U("photo-1600585154340-be6161a56a0c"),
    U("photo-1613490493576-7fde63acd811"),
    U("photo-1580587771525-78b9dba3b914"),
    U("photo-1564013799919-ab600027ffc6"),
  ],
  interior: [
    U("photo-1600607687939-ce8a6c25118c"),
    U("photo-1600566753190-17f0baa2a6c3"),
    U("photo-1502672260266-1c1ef2d93688"),
    U("photo-1493809842364-78817add7ffb"),
    U("photo-1484154218962-a197022b5858"),
  ],
  "plot-land": [
    U("photo-1500382017468-9049fed747ef"),
    U("photo-1506905925346-21bda4d32df4"),
    U("photo-1470770841072-f978cf4d019e"),
  ],
  city: [U("photo-1477959858617-67f85cf4f1df"), U("photo-1449824913935-59a10b8d2000")],
  amenity: [U("photo-1571896349842-33c89424de2d"), U("photo-1576013551627-0cc20b96c2a7")],
};

export const PLACEHOLDER_CATEGORIES = Object.keys(PLACEHOLDERS);
export const placeholdersEnabled = process.env.NEXT_PUBLIC_USE_PLACEHOLDERS !== "false";

// FNV-1a — tiny, stable across server and client (no Math.random → no hydration mismatch).
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickPlaceholder(category, seed = "") {
  const list = PLACEHOLDERS[category] ?? PLACEHOLDERS["apartment-exterior"];
  return list[hash(`${category}:${seed}`) % list.length];
}

/** next/image loader for Unsplash/Pexels CDNs (they resize + pick AVIF/WebP themselves). */
export function stockLoader({ src, width, quality }) {
  const q = quality ?? 70;
  if (src.includes("images.pexels.com")) {
    return `${src}?auto=compress&cs=tinysrgb&w=${width}`;
  }
  return `${src}?auto=format&fit=crop&w=${width}&q=${q}`;
}
