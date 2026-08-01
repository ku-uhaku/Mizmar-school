"use client";

import * as React from "react";

import { ChartLegend, ChartTable, MARK } from "@/components/charts/chart-parts";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type Slice = { label: string; value: number };

/** The three validated categorical slots — identity, so never accent-themed. */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

const SIZE = 132;
const RADIUS = 52;
/** Thick enough to read a colour in, thin enough to leave the hole usable. */
const THICKNESS = 18;

/**
 * Part-to-whole as a ring, with the total in the hole.
 *
 * ── When this is the right form, and when it is not ──────────────────────────
 * A ring is for a share read *at a glance* — "most of the year is enrolled" —
 * and it is bad at everything else. It cannot compare close values (two arcs a
 * few degrees apart are indistinguishable), so anything that needs comparing
 * gets a bar instead. Two slices are not a ring either; that is a meter, or a
 * stat tile with the number.
 *
 * Capped at three segments, which is where this app's validated categorical
 * palette stops. A fourth category folds into "Other" upstream rather than
 * inventing a fourth hue — a generated colour has not cleared the colour-vision
 * gates the three have.
 *
 * The hole carries the total, which is what makes the ring worth its space over
 * a bar: the whole and its parts in one mark.
 *
 * Identity never rests on colour alone — light-mode series-3 sits at 2.82:1
 * against the card, below the 3:1 bar — so every slice is direct-labelled with
 * its share, a legend is always present, and the table view carries the values.
 */
export function DonutChart({
  slices,
  total,
  totalLabel,
  tableCaption,
  categoryLabel,
}: {
  slices: Slice[];
  /**
   * The figure in the hole. Passed rather than summed: the parts may be a
   * *subset* of the whole (three statuses of five), and computing it here would
   * quietly redefine what the ring is a share of.
   */
  total: number;
  totalLabel: string;
  tableCaption: string;
  categoryLabel: string;
}) {
  const { locale } = useI18n();
  const [active, setActive] = React.useState<number | null>(null);

  const shown = slices.slice(0, SERIES.length).filter((slice) => slice.value > 0);
  const sum = shown.reduce((running, slice) => running + slice.value, 0);

  if (sum === 0) return null;

  /*
    `pathLength` normalises the circumference to 100, so a segment's dash length
    is its percentage directly — no 2πr arithmetic, and no drift when the radius
    changes. Segments are separated by a gap the width of the surface stroke,
    which is the 2px separator rendered in the ring's own geometry.
  */
  const gap = shown.length > 1 ? (MARK.gap / (2 * Math.PI * RADIUS)) * 100 : 0;

  /*
    Each arc starts where the ones before it end. Built with a fold rather than
    a running variable: the React Compiler will not have a value reassigned
    after render, and a fold is what a cumulative offset is anyway.
  */
  const arcs = shown.reduce<
    {
      slice: Slice;
      index: number;
      share: number;
      dash: number;
      offset: number;
      color: string;
    }[]
  >((built, slice, index) => {
    const share = (slice.value / sum) * 100;
    const offset = built.reduce((total, arc) => total + arc.share, 0);

    return [
      ...built,
      {
        slice,
        index,
        share,
        // The gap is taken out of the arc's own length, so the ring's segments
        // are separated by surface rather than by a stroke.
        dash: Math.max(0, share - gap),
        offset,
        color: SERIES[index],
      },
    ];
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={tableCaption}
            className="-rotate-90"
          >
            {arcs.map((arc) => (
              <circle
                key={arc.slice.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={
                  // The hovered arc thickens outward rather than changing
                  // colour: colour is identity here and must not move.
                  active === arc.index ? THICKNESS + 4 : THICKNESS
                }
                pathLength={100}
                strokeDasharray={`${arc.dash} ${100 - arc.dash}`}
                strokeDashoffset={-arc.offset}
                className="transition-[stroke-width]"
                onMouseEnter={() => setActive(arc.index)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
          </svg>

          {/* The total, in the hole. Absolutely positioned rather than an SVG
            text node so it inherits the page's font metrics and RTL. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">
              {formatNumber(total, locale)}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {totalLabel}
            </span>
          </div>
        </div>

        {/* Direct labels: every slice states its own share, so identity and
          value never depend on the colour being told apart. */}
        <ul className="grid min-w-0 flex-1 gap-1.5">
          {arcs.map((arc) => (
            <li
              key={arc.slice.label}
              className={cn(
                "flex items-center gap-2 text-sm transition-opacity",
                active !== null && active !== arc.index && "opacity-50",
              )}
              onMouseEnter={() => setActive(arc.index)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: arc.color }}
              />
              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                {arc.slice.label}
              </span>
              <span className="tabular-nums">
                {formatNumber(arc.slice.value, locale)}
              </span>
              <span className="text-muted-foreground w-10 text-end text-xs tabular-nums">
                {formatNumber(Math.round(arc.share), locale)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ChartLegend
        className="sr-only"
        items={arcs.map((arc) => ({
          label: arc.slice.label,
          color: arc.color,
        }))}
      />

      <ChartTable
        caption={tableCaption}
        columns={[categoryLabel, totalLabel]}
        rows={arcs.map((arc) => ({
          label: arc.slice.label,
          value: formatNumber(arc.slice.value, locale),
        }))}
      />
    </div>
  );
}
