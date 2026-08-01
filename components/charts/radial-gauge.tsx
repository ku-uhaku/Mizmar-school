"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { formatNumber } from "@/lib/i18n/format";

const SIZE = 132;
const RADIUS = 52;
const THICKNESS = 14;
/** Three quarters of the circle, opening at the bottom. */
const SWEEP = 75;

/**
 * A single ratio against its limit, drawn as an arc.
 *
 * The circular cousin of `Meter`, and the choice between them is about the
 * space rather than the data: a gauge sits beside a ring and reads as one
 * family, a meter sits in a stack of rows. Neither is a two-slice pie — there
 * is one measurement here, and the unfilled arc is its remainder, not a second
 * category. So the track is a light step of the fill's own hue rather than a
 * second colour.
 *
 * `--primary` rather than a series slot: this is one measurement and carries no
 * identity, so it follows whatever accent the user picked in Appearance — the
 * same rule the single-series charts already follow.
 *
 * Open at the bottom rather than a full circle, because a full ring at 100%
 * has no start and no end and stops reading as a fill at all.
 */
export function RadialGauge({
  value,
  max = 100,
  label,
  caption,
  suffix = "%",
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  suffix?: string;
}) {
  const { locale } = useI18n();
  const ratio = max === 0 ? 0 : Math.max(0, Math.min(1, value / max));

  // `pathLength` normalises the circumference to 100, so the arc length is the
  // percentage directly and the geometry survives a radius change.
  const filled = ratio * SWEEP;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${label}: ${formatNumber(value, locale)}${suffix}`}
          // Rotated so the opening sits at the bottom, centred.
          style={{ transform: "rotate(135deg)" }}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity={0.15}
            strokeWidth={THICKNESS}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${SWEEP} ${100 - SWEEP}`}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={THICKNESS}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${filled} ${100 - filled}`}
            className="transition-[stroke-dasharray]"
          />
        </svg>

        {/* The number is always written out: the arc gives the shape at a
          glance, the text gives the value, and neither depends on the other. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">
            {formatNumber(value, locale)}
            <span className="text-base">{suffix}</span>
          </span>
        </div>
      </div>

      <span className="text-sm font-medium">{label}</span>
      {caption ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
