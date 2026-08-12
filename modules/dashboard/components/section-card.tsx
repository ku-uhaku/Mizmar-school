"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { useLocale } from "@/components/providers/i18n-provider";
import { sectionForPath } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/**
 * One of the four working sections, on the main dashboard.
 *
 * Bigger than a stat tile and smaller than a dashboard: it carries the section's
 * headline figure, what the section is for, and — the reason it exists — the one
 * thing inside it that is waiting on somebody. A section with nothing pending
 * shows no badge at all rather than a green "0", so the eye goes straight to the
 * cards that do.
 *
 * ── The colour is the section's own ─────────────────────────────────────────
 * Each card binds `--section` from its own `href`, so vie scolaire comes out
 * blue, la caisse teal, logistique orange and RH violet — the same hues the
 * sidebar and every page header in that section already wear. It is derived
 * rather than passed: a card whose href changes takes its new section's colour
 * with it, and there is no second list of "which card is which colour" to fall
 * out of step with `lib/nav.ts`.
 *
 * Kept to a tint and a border. These four cards sit side by side, so four
 * saturated panels would read as a colour chart rather than as a way in — and
 * the figure on each has to stay the thing you see first.
 */
export function SectionCard({
  href,
  title,
  description,
  icon,
  value,
  valueLabel,
  suffix,
  detail,
  attention,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  value: number;
  valueLabel: string;
  /** Unit written after the figure, e.g. " MAD" — without it money reads as a count. */
  suffix?: string;
  /**
   * The second figure. Absent when the reader holds the section but not the
   * code behind this particular number — the line is then dropped rather than
   * reading "0", which would be a claim about the school they have not earned.
   */
  detail?: string;
  /** Rendered as a warning badge, and only when there is something to warn about. */
  attention?: string;
}) {
  const locale = useLocale();
  const section = sectionForPath(href);

  return (
    <Link href={href} className="group" data-section={section ?? undefined}>
      <Card className="border-section/25 bg-section/10 hover:border-section/55 hover:bg-section/[0.16] h-full gap-0 py-5 transition-colors">
        <CardContent className="flex h-full flex-col px-5">
          <div className="flex items-start gap-3">
            <span className="bg-section/12 text-section flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-section/20">
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                {description}
              </p>
            </div>
            <ArrowRightIcon className="text-section/70 rtl-flip mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              {/* Larger than the administration tiles below it on purpose: the
                working sections are what the page is for, and equal figures
                across both bands would leave the reader no entry point. */}
              <p className="text-3xl font-semibold tracking-tight">
                {formatNumber(value, locale)}
                {suffix ? (
                  <span className="text-muted-foreground text-lg font-normal">
                    {suffix}
                  </span>
                ) : null}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {valueLabel}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              {attention ? (
                <Badge variant="destructive">{attention}</Badge>
              ) : null}
              {detail ? (
                <span
                  className={cn(
                    "text-muted-foreground text-xs",
                    attention ? "" : "pb-0.5",
                  )}
                >
                  {detail}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
