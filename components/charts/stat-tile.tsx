import Link from "next/link";
import { ArrowUpRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * The stat-tile contract: label, value, optional signed delta against a named
 * period, optional sparkline.
 *
 * The value uses the font's proportional figures, not tabular — tabular gives
 * every digit the width of a zero, which looks loose at display sizes. Tabular
 * belongs in columns that have to line up vertically.
 */
export function StatTile({
  label,
  value,
  suffix,
  detail,
  icon,
  locale,
  href,
  trend,
  delta,
  compact,
}: {
  label: string;
  value: number;
  /** Unit written after the value, e.g. "%" — without it a rate reads as a count. */
  suffix?: string;
  detail?: string;
  icon?: React.ReactNode;
  locale: Locale;
  href?: string | null;
  /** Shape only — the exact numbers live in the value and the full charts. */
  trend?: number[];
  /** Signed percentage against a named period, e.g. { value: 4.1, period: "…" } */
  delta?: { value: number; period: string; upIsGood?: boolean };
  /**
   * A smaller figure, for a band that is reference rather than the point of the
   * screen. Same contract and same tile — only the weight changes, so a
   * secondary band cannot out-shout the primary one above it.
   */
  compact?: boolean;
}) {
  const upIsGood = delta?.upIsGood ?? true;
  const isGood = delta ? delta.value >= 0 === upIsGood : true;
  const DeltaIcon = delta && delta.value >= 0 ? TrendingUpIcon : TrendingDownIcon;

  const body = (
    <Card
      className={cn(
        "h-full gap-0 transition-colors",
        compact ? "py-4" : "py-5",
        href ? "group-hover:border-primary/40" : "",
      )}
    >
      <CardContent className={compact ? "px-4" : "px-5"}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-sm">{label}</p>
          <span className="text-muted-foreground/70 shrink-0">
            {href ? (
              <ArrowUpRightIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            ) : (
              icon
            )}
          </span>
        </div>

        <div
          className={cn(
            "flex items-end justify-between gap-3",
            compact ? "mt-1.5" : "mt-2",
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold tracking-tight",
                compact ? "text-2xl" : "text-3xl",
              )}
            >
              {formatNumber(value, locale)}
              {suffix ? (
                <span
                  className={cn(
                    "text-muted-foreground ms-0.5 font-medium",
                    compact ? "text-lg" : "text-xl",
                  )}
                >
                  {suffix}
                </span>
              ) : null}
            </p>
            {delta ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs">
                <DeltaIcon
                  aria-hidden
                  className={cn(
                    "size-3.5 shrink-0",
                    isGood ? "text-success" : "text-destructive",
                  )}
                />
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    isGood ? "text-success" : "text-destructive",
                  )}
                >
                  {delta.value >= 0 ? "+" : ""}
                  {formatNumber(delta.value, locale)}%
                </span>
                <span className="text-muted-foreground truncate">
                  {delta.period}
                </span>
              </p>
            ) : detail ? (
              <p className="text-muted-foreground mt-1.5 truncate text-xs">
                {detail}
              </p>
            ) : null}
          </div>

          {trend ? (
            <Sparkline
              values={trend}
              className="text-muted-foreground/50 h-8 w-20 shrink-0"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="group rounded-xl">
      {body}
    </Link>
  ) : (
    <div className="group">{body}</div>
  );
}
