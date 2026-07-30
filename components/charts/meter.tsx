"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { formatNumber } from "@/lib/i18n/format";

/**
 * A single ratio against its limit — a filled track, not a two-slice pie.
 *
 * The unfilled track is a light step of the fill's own hue rather than a
 * neutral grey, so the whole bar reads as one measurement. The number is always
 * written out beside it: the bar gives the shape at a glance, the text gives
 * the value, and neither depends on the other.
 */
export function Meter({
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
  const ratio = Math.max(0, Math.min(1, value / max));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {formatNumber(value, locale)}
          {suffix}
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        dir="ltr"
        className="h-2 w-full overflow-hidden rounded-full"
        style={{
          background: "color-mix(in oklab, var(--primary) 16%, transparent)",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, background: "var(--primary)" }}
        />
      </div>

      {caption ? (
        <p className="text-muted-foreground text-xs">{caption}</p>
      ) : null}
    </div>
  );
}
