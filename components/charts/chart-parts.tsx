"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The small shared pieces every chart in this folder is assembled from.
 *
 * Mark sizes here are fixed on purpose and match the house data-viz spec: 2px
 * lines, ≥8px markers, ≤24px bars with a 4px rounded data-end, hairline grid,
 * and a 2px surface gap/ring wherever marks touch. Charts vary the data, never
 * these numbers.
 */

export const MARK = {
  /** Line stroke width. */
  line: 2,
  /** Marker radius — 8px diameter is the minimum comfortable hit target. */
  dot: 4,
  /** Bars never fill their band; the leftover is deliberate air. */
  maxBar: 24,
  /** Rounded data-end; the baseline end stays square. */
  radius: 4,
  /** Surface-coloured gap between touching marks, and ring around dots. */
  gap: 2,
} as const;

/**
 * Recessive hairline gridline. Solid, never dashed — dashing reads as
 * "threshold" or "projection" when it is only a grid. Spans the plot area
 * only, so it never runs underneath the axis labels.
 */
export function GridLine({
  y,
  from,
  to,
}: {
  y: number;
  from: number;
  to: number;
}) {
  return (
    <line
      x1={from}
      x2={to}
      y1={y}
      y2={y}
      stroke="var(--grid)"
      strokeWidth={1}
      shapeRendering="crispEdges"
    />
  );
}

/**
 * A bar with its data-end rounded and its baseline end square, drawn as a path
 * so the two ends can differ. `up` bars grow from the bottom, `right` bars from
 * the inline start.
 */
export function BarPath({
  x,
  y,
  width,
  height,
  direction,
  fill,
  radius = MARK.radius,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: "up" | "right";
  fill: string;
  radius?: number;
}) {
  if (width <= 0 || height <= 0) return null;

  // Never round more than half the short side, or the corners overlap.
  const r =
    direction === "up"
      ? Math.min(radius, width / 2, height)
      : Math.min(radius, height / 2, width);

  const d =
    direction === "up"
      ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
      : `M${x},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} L${x},${y + height} Z`;

  return <path d={d} fill={fill} />;
}

/**
 * End-of-line marker. The surface-coloured ring is what keeps it legible where
 * it crosses the line or another dot — never a border in the data colour.
 */
export function EndDot({
  cx,
  cy,
  fill,
}: {
  cx: number;
  cy: number;
  fill: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={MARK.dot + MARK.gap} fill="var(--card)" />
      <circle cx={cx} cy={cy} r={MARK.dot} fill={fill} />
    </>
  );
}

/** Axis tick text. Always a text token — never the series colour. */
export function AxisText({
  x,
  y,
  anchor = "middle",
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  children: React.ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className="fill-muted-foreground text-[11px] tabular-nums"
      dominantBaseline="middle"
    >
      {children}
    </text>
  );
}

/**
 * Hover tooltip. Positioned in HTML above the SVG rather than inside it, so it
 * can use real text styling and is never clipped by the plot area.
 */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: React.ReactNode;
}) {
  // Flip to the other side near the inline end so it never runs off the card.
  const flip = x > containerWidth - 120;

  return (
    <div
      role="tooltip"
      className="bg-popover text-popover-foreground pointer-events-none absolute z-20 rounded-md border px-2.5 py-1.5 text-xs shadow-md"
      style={{
        left: x,
        top: y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}

/** Legend — always present for two or more series. */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * An axis scale whose ticks land on round numbers.
 *
 * It picks the *step* first and multiplies up, rather than rounding the maximum
 * and dividing: rounding the top gives clean bounds but ugly ticks (1,500 over
 * four ticks is 375, 750, 1,125), while choosing the step guarantees every tick
 * is round and keeps the headroom tight.
 */
export function niceScale(
  maxValue: number,
  preferredTicks: number,
  { floor = 0 }: { floor?: number } = {},
): { min: number; max: number; step: number; ticks: number } {
  const span = Math.max(maxValue - floor, 1);
  const rough = span / preferredTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step =
    (normalised <= 1
      ? 1
      : normalised <= 1.5
        ? 1.5
        : normalised <= 2
          ? 2
          : normalised <= 2.5
            ? 2.5
            : normalised <= 5
              ? 5
              : 10) * magnitude;

  // Snapping the floor down to a round number can push the top tick below the
  // data — the axis would then crop the very peak it exists to show. Add ticks
  // until the range covers the maximum rather than trusting the preferred count.
  const min = Math.floor(floor / step) * step;
  const ticks = Math.max(preferredTicks, Math.ceil((maxValue - min) / step));

  return { min, max: min + step * ticks, step, ticks };
}

/**
 * The table twin every chart ships with.
 *
 * A tooltip may enhance a chart but must never be the only way to read a value:
 * hover excludes keyboard and touch users, and an axis only ever gives an
 * approximate reading. Collapsed by default so it costs no space until wanted.
 */
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: { label: string; value: string }[];
}) {
  return (
    <details className="group mt-3">
      <summary className="text-muted-foreground hover:text-foreground marker:content-none inline-flex cursor-pointer list-none items-center gap-1 text-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none rounded-sm">
        <span className="transition-transform group-open:rotate-90">›</span>
        {caption}
      </summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-2.5 py-1.5 text-start font-medium">
                {columns[0]}
              </th>
              <th className="px-2.5 py-1.5 text-end font-medium">
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <td className="px-2.5 py-1.5">{row.label}</td>
                <td className="px-2.5 py-1.5 text-end tabular-nums">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
