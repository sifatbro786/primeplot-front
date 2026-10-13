"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { area, centroid, clamp01, isTyping, MAX_POINTS, nearestEdge, rectPoints, round5, translate } from "./geometry";

/**
 * The plan image with its hotspots as one SVG (image + shapes share the image's pixel space, so
 * zooming is just a wider box). Two modes:
 *  - view: shapes coloured by live unit status; hover/focus shows `tooltipOf(h)`, click/Enter
 *    calls `onActivate(h)`.
 *  - edit: `tool` = select (move shapes, drag corners, double-click an edge to add a corner,
 *    Alt/right-click a corner to remove it) | polygon (click corners; click the first corner,
 *    double-click or Enter to finish; Backspace undoes a corner; Esc cancels) | rect (drag).
 */

// Literal class strings — Tailwind only generates classes it can see in source.
export const TONES = {
  available: "fill-status-available/30 stroke-status-available hover:fill-status-available/50",
  held: "fill-status-held/35 stroke-status-held hover:fill-status-held/55",
  booked: "fill-status-booked/35 stroke-status-booked hover:fill-status-booked/55",
  sold: "fill-status-sold/40 stroke-status-sold hover:fill-status-sold/60",
  blocked: "stroke-status-blocked",
  missing: "fill-surface/50 stroke-ink-subtle hover:fill-surface/70",
  label: "fill-ink/5 stroke-ink-subtle hover:fill-ink/10",
  block: "fill-accent/20 stroke-accent hover:fill-accent/35",
  linked: "fill-primary/15 stroke-primary hover:fill-primary/25",
  unlinked: "fill-warning/15 stroke-warning hover:fill-warning/25",
};
const DASHED = new Set(["missing", "label", "unlinked"]);
const MIN_AREA = 0.00002; // ~ a 4×4 px box on a 1000 px plan: almost always a mis-click

export function PlanCanvas({
  image,
  width,
  height,
  hotspots,
  mode = "view",
  zoom = 1,
  toneOf,
  labelOf,
  titleOf,
  tooltipOf,
  onActivate,
  // edit
  tool = "select",
  selectedKey = null,
  onSelect,
  onCreate,
  onBeginChange,
  onPointsChange,
  ariaLabel,
}) {
  const W = width || 1000;
  const H = height || Math.round((W * 10) / 16);
  const svgRef = useRef(null);
  const [k, setK] = useState(1); // image px per screen px (keeps handles/labels a constant size)
  const [hover, setHover] = useState(null);
  const [drawing, setDrawing] = useState([]); // polygon in progress (normalized)
  const [cursor, setCursor] = useState(null); // rubber band end
  const [rect, setRect] = useState(null); // { a, b } while dragging a rectangle
  const drag = useRef(null);
  const edit = mode === "edit";

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setK(W / Math.max(1, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  // Leaving the drawing tool drops a half-drawn shape.
  const [prevTool, setPrevTool] = useState(tool);
  if (prevTool !== tool) {
    setPrevTool(tool);
    setDrawing([]);
    setRect(null);
    setCursor(null);
  }

  const toNorm = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [round5(clamp01(p.x / W)), round5(clamp01(p.y / H))];
  };
  const nearPx = (a, b, px) => Math.hypot((a[0] - b[0]) * W, (a[1] - b[1]) * H) <= px * k;

  const finishPolygon = (pts = drawing) => {
    if (pts.length >= 3 && area(pts) >= MIN_AREA) onCreate?.(pts);
    setDrawing([]);
    setCursor(null);
  };

  // Keyboard for the drawing tool (ignored while typing in the side panel).
  useEffect(() => {
    if (!edit || tool !== "polygon") return undefined;
    const onKey = (e) => {
      if (isTyping(e.target)) return;
      if (e.key === "Escape") {
        setDrawing([]);
        setCursor(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (drawing.length >= 3 && area(drawing) >= MIN_AREA) onCreate?.(drawing);
        setDrawing([]);
        setCursor(null);
      } else if (e.key === "Backspace" && drawing.length) {
        e.preventDefault();
        setDrawing(drawing.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, tool, onCreate, drawing]);

  // ── pointer handling (edit mode) ──
  const onSvgDown = (e) => {
    if (!edit || e.button === 2) return;
    const p = toNorm(e);
    if (tool === "polygon") {
      if (drawing.length >= 3 && nearPx(p, drawing[0], 9)) return finishPolygon();
      if (drawing.length && nearPx(p, drawing.at(-1), 3)) return; // second click of a double-click
      if (drawing.length >= MAX_POINTS) return;
      setDrawing([...drawing, p]);
      return;
    }
    if (tool === "rect") {
      svgRef.current.setPointerCapture(e.pointerId);
      setRect({ a: p, b: p });
      return;
    }
    onSelect?.(null); // select tool, empty space
  };

  const startShapeDrag = (e, h) => {
    if (!edit || tool !== "select" || e.button === 2) return;
    e.stopPropagation();
    onSelect?.(h.key);
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { type: "move", key: h.key, from: toNorm(e), orig: h.points, began: false };
  };

  const startVertexDrag = (e, h, i) => {
    e.stopPropagation();
    if (e.altKey || e.button === 2) {
      e.preventDefault();
      if (h.points.length > 3) {
        onBeginChange?.();
        onPointsChange?.(h.key, h.points.filter((_, j) => j !== i));
      }
      return;
    }
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { type: "vertex", key: h.key, index: i, orig: h.points, began: false };
  };

  const onSvgMove = (e) => {
    if (!edit) return;
    if (tool === "polygon" && drawing.length) setCursor(toNorm(e));
    if (rect) setRect((r) => ({ ...r, b: toNorm(e) }));
    const d = drag.current;
    if (!d) return;
    const p = toNorm(e);
    if (!d.began) {
      onBeginChange?.();
      d.began = true;
    }
    if (d.type === "move") onPointsChange?.(d.key, translate(d.orig, p[0] - d.from[0], p[1] - d.from[1]));
    else onPointsChange?.(d.key, d.orig.map((q, j) => (j === d.index ? p : q)));
  };

  const onSvgUp = () => {
    if (rect) {
      const pts = rectPoints(rect.a, rect.b);
      setRect(null);
      if (area(pts) >= MIN_AREA) onCreate?.(pts);
    }
    drag.current = null;
  };

  const onShapeDoubleClick = (e, h) => {
    if (!edit || tool !== "select" || h.points.length >= MAX_POINTS) return;
    e.stopPropagation();
    const p = toNorm(e);
    const i = nearestEdge(h.points, p);
    onBeginChange?.();
    onPointsChange?.(h.key, [...h.points.slice(0, i + 1), p, ...h.points.slice(i + 1)]);
  };

  const pts = (points) => points.map(([x, y]) => `${x * W},${y * H}`).join(" ");
  const hovered = hover && hotspots.find((h) => h.key === hover);
  const selected = edit && selectedKey ? hotspots.find((h) => h.key === selectedKey) : null;
  const preview = rect ? rectPoints(rect.a, rect.b) : null;

  return (
    <div className="relative mx-auto" style={{ width: `${zoom * 100}%`, aspectRatio: `${W} / ${H}` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "block h-full w-full select-none",
          // Editing owns every touch; viewing keeps native pinch-zoom/scroll (public site, phones).
          edit && "touch-none",
          edit && tool !== "select" && "cursor-crosshair",
        )}
        onPointerDown={onSvgDown}
        onPointerMove={onSvgMove}
        onPointerUp={onSvgUp}
        onPointerCancel={onSvgUp}
        onDoubleClick={() => edit && tool === "polygon" && finishPolygon()}
        onContextMenu={(e) => edit && e.preventDefault()}
      >
        <defs>
          <pattern id="pp-plan-hatch" patternUnits="userSpaceOnUse" width={8 * k} height={8 * k} patternTransform="rotate(45)">
            <rect width={8 * k} height={8 * k} className="fill-surface/60" />
            <line x1="0" y1="0" x2="0" y2={8 * k} strokeWidth={3 * k} className="stroke-status-blocked/60" />
          </pattern>
        </defs>
        {image?.urls?.full || image?.urls?.card ? (
          <image href={image.urls.full ?? image.urls.card} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
        ) : (
          <rect width={W} height={H} className="fill-surface-2" />
        )}

        {hotspots.map((h) => {
          const tone = toneOf(h);
          const isSel = selected?.key === h.key;
          const interactive = !edit || tool === "select";
          const title = titleOf?.(h);
          return (
            <polygon
              key={h.key}
              points={pts(h.points)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={isSel ? 2.5 : 1.5}
              strokeDasharray={DASHED.has(tone) ? "5 4" : undefined}
              strokeLinejoin="round"
              fill={tone === "blocked" ? "url(#pp-plan-hatch)" : undefined}
              className={cn(
                "transition-[fill] duration-150 outline-none",
                TONES[tone],
                isSel && "stroke-primary",
                interactive ? "cursor-pointer" : "pointer-events-none",
                !edit && "focus-visible:stroke-ink",
              )}
              tabIndex={!edit ? 0 : undefined}
              role={!edit ? "button" : undefined}
              aria-label={!edit ? title : undefined}
              onPointerEnter={() => setHover(h.key)}
              onPointerLeave={() => setHover((x) => (x === h.key ? null : x))}
              onFocus={() => setHover(h.key)}
              onBlur={() => setHover((x) => (x === h.key ? null : x))}
              onClick={() => !edit && onActivate?.(h)}
              onKeyDown={(e) => {
                if (!edit && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onActivate?.(h);
                }
              }}
              onPointerDown={(e) => edit && startShapeDrag(e, h)}
              onDoubleClick={(e) => onShapeDoubleClick(e, h)}
            />
          );
        })}

        {/* labels on top of every shape */}
        {hotspots.map((h) => {
          const text = labelOf?.(h);
          if (!text) return null;
          const [cx, cy] = centroid(h.points);
          return (
            <text
              key={`t-${h.key}`}
              x={cx * W}
              y={cy * H}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12 * k}
              strokeWidth={3 * k}
              paintOrder="stroke"
              className="pointer-events-none fill-ink stroke-surface font-mono font-medium"
            >
              {text}
            </text>
          );
        })}

        {/* selected shape: corner handles */}
        {selected &&
          tool === "select" &&
          selected.points.map(([x, y], i) => (
            <circle
              key={`v-${i}`}
              cx={x * W}
              cy={y * H}
              r={5 * k}
              strokeWidth={1.5 * k}
              className="cursor-move fill-surface stroke-primary hover:fill-primary"
              onPointerDown={(e) => startVertexDrag(e, selected, i)}
            />
          ))}

        {/* in-progress polygon */}
        {drawing.length > 0 && (
          <g className="pointer-events-none">
            <polyline
              points={pts(cursor ? [...drawing, cursor] : drawing)}
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              className="fill-primary/10 stroke-primary"
            />
            {drawing.map(([x, y], i) => (
              <circle
                key={`d-${i}`}
                cx={x * W}
                cy={y * H}
                r={(i === 0 && drawing.length >= 3 ? 7 : 4) * k}
                strokeWidth={1.5 * k}
                className={i === 0 ? "fill-primary stroke-surface" : "fill-surface stroke-primary"}
              />
            ))}
          </g>
        )}
        {preview && (
          <polygon
            points={pts(preview)}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            className="pointer-events-none fill-primary/10 stroke-primary"
          />
        )}
      </svg>

      {!edit && hovered && tooltipOf && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm"
          style={{ left: `${centroid(hovered.points)[0] * 100}%`, top: `${centroid(hovered.points)[1] * 100}%` }}
        >
          {tooltipOf(hovered)}
        </div>
      )}
    </div>
  );
}
