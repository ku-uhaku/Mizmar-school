"use client";

import * as React from "react";

import {
  AxisText,
  ChartTable,
  ChartTooltip,
  EndDot,
  GridLine,
  MARK,
  niceScale,
} from "@/components/charts/chart-parts";
import { useI18n } from "@/components/providers/i18n-provider";
import { useMeasure } from "@/hooks/use-measure";
import { formatNumber } from "@/lib/i18n/format";

export type TrendPoint = { label: string; value: number };

const PAD = { top: 14, right: 10, bottom: 24, left: 44 };
const HEIGHT = 220;
const TICKS = 4;

/**
 * Single-series trend over time, with a crosshair and tooltip on hover.
 *
 * One series, so there is no legend — the card title says what is plotted and a
 * one-swatch legend would only restate it. The mark takes --primary, so the
 * chart follows whatever accent the user picked in Appearance.
 *
 * `zeroBaseline` is the honest-axis switch. A series that moves within a narrow
 * band (enrolment drifting 1,180 → 1,302) is a flat line on a zero-based axis,
 * so the axis may start near the data instead — but then the area under the
 * line no longer means "magnitude from zero", and filling it would overstate
 * the change. So: zero baseline gets the wash, a cropped baseline gets a bare
 * line. Never a filled area over a cropped axis.
 */
export function TrendChart({
  points,
  unitLabel,
  tableCaption,
  periodLabel,
  zeroBaseline = false,
}: {
  points: TrendPoint[];
  /** Appended in the tooltip, e.g. "élèves". */
  unitLabel?: string;
  /** Label for the collapsed table twin. */
  tableCaption: string;
  /** Header for the table's first column, e.g. "Mois". */
  periodLabel: string;
  zeroBaseline?: boolean;
}) {
  const { locale } = useI18n();
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const values = points.map((point) => point.value);
  const scale = niceScale(Math.max(...values, 1), TICKS, {
    floor: zeroBaseline ? 0 : Math.min(...values),
  });

  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xOf = (index: number) => PAD.left + index * stepX;
  const yOf = (value: number) =>
    PAD.top +
    plotHeight * (1 - (value - scale.min) / (scale.max - scale.min));

  const coordinates = points.map((point, i) => `${xOf(i)},${yOf(point.value)}`);
  const baseY = PAD.top + plotHeight;
  const area =
    points.length > 0
      ? `M${xOf(0)},${baseY} L${coordinates.join(" L")} L${xOf(points.length - 1)},${baseY} Z`
      : "";

  // With many points, label every nth so x labels never collide.
  const labelEvery = Math.ceil(
    points.length / Math.max(1, Math.floor(plotWidth / 52)),
  );

  function pointerToIndex(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - PAD.left;
    if (stepX === 0) return 0;
    return Math.max(0, Math.min(points.length - 1, Math.round(x / stepX)));
  }

  const activePoint = active === null ? null : points[active];

  return (
    <div>
      <div ref={ref} dir="ltr" className="relative w-full">
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={tableCaption}
            onPointerMove={(event) => setActive(pointerToIndex(event))}
            onPointerLeave={() => setActive(null)}
          >
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

            {zeroBaseline ? (
              <path
                d={area}
                fill="color-mix(in oklab, var(--primary) 12%, transparent)"
              />
            ) : null}

            <polyline
              points={coordinates.join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={MARK.line}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, index) =>
              index % labelEvery === 0 || index === points.length - 1 ? (
                <AxisText key={point.label + index} x={xOf(index)} y={HEIGHT - 10}>
                  {point.label}
                </AxisText>
              ) : null,
            )}

            {/* Crosshair, under the markers so they stay on top. */}
            {active !== null && activePoint ? (
              <line
                x1={xOf(active)}
                x2={xOf(active)}
                y1={PAD.top}
                y2={baseY}
                stroke="var(--grid)"
                strokeWidth={1}
              />
            ) : null}

            {points.length > 0 ? (
              <EndDot
                cx={xOf(points.length - 1)}
                cy={yOf(points[points.length - 1].value)}
                fill="var(--primary)"
              />
            ) : null}

            {active !== null && activePoint && active !== points.length - 1 ? (
              <EndDot
                cx={xOf(active)}
                cy={yOf(activePoint.value)}
                fill="var(--primary)"
              />
            ) : null}
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}

        {active !== null && activePoint ? (
          <ChartTooltip
            x={xOf(active)}
            y={yOf(activePoint.value)}
            containerWidth={width}
          >
            <p className="text-muted-foreground">{activePoint.label}</p>
            <p className="font-medium tabular-nums">
              {formatNumber(activePoint.value, locale)}
              {unitLabel ? ` ${unitLabel}` : ""}
            </p>
          </ChartTooltip>
        ) : null}
      </div>

      <ChartTable
        caption={tableCaption}
        columns={[periodLabel, unitLabel ?? ""]}
        rows={points.map((point) => ({
          label: point.label,
          value: formatNumber(point.value, locale),
        }))}
      />
    </div>
  );
}
