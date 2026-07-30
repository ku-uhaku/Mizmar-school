"use client";

import { MARK } from "@/components/charts/chart-parts";

/**
 * The trend half of a stat tile: a bare 2px line, no axes, no labels.
 *
 * It carries shape only — "rising", "flat", "dipped in March" — so it is drawn
 * in a de-emphasised tone and the exact values live in the tile's value and in
 * the full chart below. A fixed viewBox is fine here precisely because there is
 * no text to distort, and `vector-effect` keeps the stroke at 2px through the
 * scale.
 */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      // Inset by the stroke so the extremes are not clipped by the viewBox.
      const y = 22 - ((value - min) / span) * 20 + 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={MARK.line}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
