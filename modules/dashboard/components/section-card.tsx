"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { useLocale } from "@/components/providers/i18n-provider";
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
  detail: string;
  /** Rendered as a warning badge, and only when there is something to warn about. */
  attention?: string;
}) {
  const locale = useLocale();

  return (
    <Link href={href} className="group">
      <Card className="hover:border-primary/40 h-full gap-0 py-5 transition-colors">
        <CardContent className="flex h-full flex-col px-5">
          <div className="flex items-start gap-3">
            <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
                {description}
              </p>
            </div>
            <ArrowRightIcon className="text-muted-foreground/60 rtl-flip mt-1 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-semibold">
                {formatNumber(value, locale)}
                {suffix ? (
                  <span className="text-muted-foreground text-base font-normal">
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
              <span
                className={cn(
                  "text-muted-foreground text-xs",
                  attention ? "" : "pb-0.5",
                )}
              >
                {detail}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/** Rule-and-label divider between the bands of the dashboard. */
export function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
        {label}
      </h2>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
