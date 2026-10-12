/**
 * Plan geometry. Hotspot points are normalized 0–1 (x from the left, y from the top of the
 * image) exactly as the API stores them (API.md › Floor plans), rounded to 5 decimals.
 */
export const round5 = (n) => Math.round(n * 1e5) / 1e5;
export const clamp01 = (n) => Math.min(1, Math.max(0, n));
export const MAX_POINTS = 100;
export const MAX_HOTSPOTS = 500;

/** Area-weighted centroid (falls back to the vertex mean for degenerate shapes). */
export function centroid(points) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = points.length || 1;
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Axis-aligned rectangle from two corners → 4 points (clockwise from top-left). */
export function rectPoints([ax, ay], [bx, by]) {
  const x0 = Math.min(ax, bx);
  const x1 = Math.max(ax, bx);
  const y0 = Math.min(ay, by);
  const y1 = Math.max(ay, by);
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ].map(([x, y]) => [round5(x), round5(y)]);
}

/** Move every point by (dx, dy) but keep the whole shape inside the image. */
export function translate(points, dx, dy) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const ddx = Math.min(Math.max(dx, -Math.min(...xs)), 1 - Math.max(...xs));
  const ddy = Math.min(Math.max(dy, -Math.min(...ys)), 1 - Math.max(...ys));
  return points.map(([x, y]) => [round5(x + ddx), round5(y + ddy)]);
}

/** Polygon area in normalized units² (tiny shapes are almost always a mis-click). */
export function area(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** Next free key "h1", "h2", … (keys only need to be unique within the plan). */
export function nextKey(hotspots) {
  let n = 0;
  for (const h of hotspots) {
    const m = /^h(\d+)$/.exec(h.key);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `h${n + 1}`;
}

/** Index of the edge closest to point p (for inserting a vertex on double-click). */
export function nearestEdge(points, [px, py]) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
    const d = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** [3,4,5,7,9,10] → "3–5, 7, 9–10" (labels via `fmt`). */
export function compressFloors(floors, fmt = String) {
  const s = [...floors].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${fmt(s[i])}–${fmt(s[j])}` : fmt(s[i]));
    i = j;
  }
  return out.join(", ");
}

/** True while the user types in a text field (shortcuts must not fire); radios/checkboxes don't count. */
export function isTyping(target) {
  if (!target?.closest) return false;
  if (target.closest("textarea, select, [contenteditable='true']")) return true;
  const input = target.closest("input");
  return Boolean(input) && !["radio", "checkbox", "button", "submit", "range", "color", "file"].includes(input.type);
}
