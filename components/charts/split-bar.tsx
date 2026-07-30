"use client";

import * as React from "react";

import { ChartLegend, MARK } from "@/components/charts/chart-parts";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatNumber } from "@/lib/i18n/format";

export type Segment = { label: string; value: number };

/** The three validated categorical slots — identity, so never accent-themed. */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

/**
 * Part-to-whole across a few categories, as one horizontal stacked bar.
 *
 * Horizontal because the category names are long. Segments are separated by a
 * 2px surface gap rather than a stroke — white doing the separating, no extra
 * ink. A legend is always rendered, and each segment's share is written under
 * the bar, so identity and value never depend on colour alone (light-mode
 * series-3 is below 3:1 against the card, which makes that relief mandatory
 * rather than optional).
 *
 * Capped at three segments: past three, the categorical palette stops clearing
 * its colour-vision gates. A fourth category folds into "Other" upstream.
 */
export function SplitBar({ segments }: { segments: Segment[] }) {
  const { locale } = useI18n();

  const shown = segments.slice(0, SERIES.length);
  const total = shown.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div
        dir="ltr"
        className="flex h-3 w-full overflow-hidden"
        role="img"
        aria-label={shown
          .map(
            (segment) =>
              `${segment.label}: ${Math.round((segment.value / total) * 100)}%`,
          )
          .join(", ")}
      >
        {shown.map((segment, index) => (
          <div
            key={segment.label}
            className="h-full first:rounded-s-full last:rounded-e-full"
            style={{
              width: `${(segment.value / total) * 100}%`,
              background: SERIES[index],
              // The gap is the separator; the last segment has no neighbour.
              marginInlineEnd: index < shown.length - 1 ? MARK.gap : 0,
            }}
          />
        ))}
      </div>

      <ChartLegend
        items={shown.map((segment, index) => ({
          label: segment.label,
          color: SERIES[index],
        }))}
      />

      <ul className="grid gap-1.5">
        {shown.map((segment, index) => (
          <li
            key={segment.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: SERIES[index] }}
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {formatNumber(segment.value, locale)}
              <span className="ms-1.5">
                ({Math.round((segment.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
