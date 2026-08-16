"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/components/providers/i18n-provider";
import { DEFAULT_PERIOD, PERIODS, parsePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

/**
 * Day / week / month / year, as a segmented control over the figures beside it.
 *
 * It lives in the query string rather than in React state because the window it
 * narrows is decided on the server — the same reasoning as the caisse's table
 * filters. That also makes the choice shareable and survivable: a director who
 * bookmarks the month's takings gets the month back.
 *
 * Segmented rather than a `Select`: there are four options, they are ordered,
 * and the reader compares them — a dropdown would hide three quarters of the
 * choice behind a click and read as a form field rather than as a view switch.
 *
 * Domain-free, so it belongs here and not in a module: it knows about a period
 * and a URL and nothing about money or pupils.
 */
export function PeriodFilter({
  param = "period",
  className,
}: {
  /**
   * The query-string key. Defaulted, but nameable so two independent sets of
   * figures on one screen can each keep their own window — see the note on the
   * caisse's `r*` filter keys.
   */
  param?: string;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const active = parsePeriod(searchParams.get(param) ?? undefined);

  const select = (period: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // The default is what a bare URL already means, so it is left out rather
    // than written — a link to "today" should look like a link to the page.
    if (period === DEFAULT_PERIOD) params.delete(param);
    else params.set(param, period);

    const query = params.toString();
    startTransition(() => {
      // Nothing above the control moves, so holding the scroll position stops
      // the page jumping to the top every time a figure is re-read.
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label={t.period.label}
      className={cn(
        "bg-muted/60 inline-flex items-center gap-0.5 rounded-lg border p-0.5 transition-opacity",
        pending && "opacity-60",
        className,
      )}
    >
      {PERIODS.map((period) => {
        const selected = period === active;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={selected}
            onClick={() => select(period)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              selected
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.period.names[period]}
          </button>
        );
      })}
    </div>
  );
}
