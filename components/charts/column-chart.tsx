"use client";

import * as React from "react";

import {
  AxisText,
  BarPath,
  ChartTable,
  ChartTooltip,
  GridLine,
  MARK,
  niceScale,
} from "@/components/charts/chart-parts";
import { useI18n } from "@/components/providers/i18n-provider";
import { useMeasure } from "@/hooks/use-measure";
import { formatNumber } from "@/lib/i18n/format";

export type Column = { label: string; value: number };

const PAD = { top: 22, right: 6, bottom: 26, left: 44 };
const HEIGHT = 220;
const TICKS = 4;

/**
 * Magnitude across a handful of categories.
 *
 * One hue for every column, not a colour per category: the columns are being
 * compared, not identified, and a value-ramp here would double-encode bar
 * length as hue while burning the only free channel. Bars always grow from
 * zero — unlike a line, a bar's *length* is the value, so a cropped axis would
 * misstate it.
 *
 * Only the tallest column is direct-labelled; the axis and the tooltip carry
 * the rest, which is what keeps the labelling readable rather than a wall of
 * numbers.
 */
export function ColumnChart({
  columns,
  unitLabel,
  tableCaption,
  categoryLabel,
}: {
  columns: Column[];
  unitLabel?: string;
  tableCaption: string;
  categoryLabel: string;
}) {
  const { locale } = useI18n();
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const scale = niceScale(Math.max(...columns.map((c) => c.value), 1), TICKS);
  const band = columns.length > 0 ? plotWidth / columns.length : 0;
  const barWidth = Math.min(MARK.maxBar, band * 0.5);

  const yOf = (value: number) =>
    PAD.top + plotHeight * (1 - (value - scale.min) / (scale.max - scale.min));
  const centreOf = (index: number) => PAD.left + band * (index + 0.5);

  const peak = columns.reduce(
    (best, column, index) => (column.value > columns[best].value ? index : best),
    0,
  );

  return (
    <div>
      <div ref={ref} dir="ltr" className="relative w-full">
        {width > 0 ? (
          <svg width={width} height={HEIGHT} role="img" aria-label={tableCaption}>
            {Array.from({ length: scale.ticks + 1 }, (_, i) => {
              const value = scale.min + scale.step * i;
              const y = yOf(value);
              return (
                <g key={i}>
                  <GridLine y={y} from={PAD.left} to={width - PAD.right} />
                  <AxisText x={PAD.left - 8} y={y} anchor="end">
                    {formatNumber(value, locale)}
                  </AxisText>
                </g>
              );
            })}

            {columns.map((column, index) => {
              const y = yOf(column.value);
              const height = PAD.top + plotHeight - y;

              return (
                <g
                  key={column.label}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                >
                  {/* Full-band hit area — the bar alone is a thin target. */}
                  <rect
                    x={PAD.left + band * index}
                    y={PAD.top}
                    width={band}
                    height={plotHeight}
                    fill="transparent"
                  />
                  <BarPath
                    x={centreOf(index) - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={height}
                    direction="up"
                    fill="var(--primary)"
                  />
                  {index === peak ? (
                    <text
                      x={centreOf(index)}
                      y={y - 9}
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-medium tabular-nums"
                    >
                      {formatNumber(column.value, locale)}
                    </text>
                  ) : null}
                  <AxisText x={centreOf(index)} y={HEIGHT - 11}>
                    {column.label}
                  </AxisText>
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}

        {active !== null ? (
          <ChartTooltip
            x={centreOf(active)}
            y={yOf(columns[active].value)}
            containerWidth={width}
          >
            <p className="text-muted-foreground">{columns[active].label}</p>
            <p className="font-medium tabular-nums">
              {formatNumber(columns[active].value, locale)}
              {unitLabel ? ` ${unitLabel}` : ""}
            </p>
          </ChartTooltip>
        ) : null}
      </div>

      <ChartTable
        caption={tableCaption}
        columns={[categoryLabel, unitLabel ?? ""]}
        rows={columns.map((column) => ({
          label: column.label,
          value: formatNumber(column.value, locale),
        }))}
      />
    </div>
  );
}
