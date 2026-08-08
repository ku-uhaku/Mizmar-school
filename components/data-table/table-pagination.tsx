"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/lib/i18n/format";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * The numbered pager under a table.
 *
 * One control for both kinds of table in the app. A client-side `DataTable`
 * holds its own page in React state and passes `onPage`; a server-paged screen
 * keeps it in the URL and passes `hrefFor`, so its pages are links — they
 * prefetch, they open in a new tab, and they survive a reload. Which pages are
 * drawn is `pageWindow`'s decision, in one place, so the two never disagree.
 */
export function TablePagination({
  page,
  pageCount,
  onPage,
  hrefFor,
  className,
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  /** For a table that pages in the browser. */
  onPage?: (page: number) => void;
  /** For a table that pages on the server. Takes precedence over `onPage`. */
  hrefFor?: (page: number) => string;
  className?: string;
}) {
  const t = useT();
  if (pageCount <= 1) return null;

  const slots = pageWindow(page, pageCount);

  /** A page button, as a link when the caller pages through the URL. */
  const step = (target: number, label: string, icon: React.ReactNode) => {
    const disabled = target < 1 || target > pageCount;
    if (hrefFor && !disabled) {
      return (
        <Button asChild variant="outline" size="icon-sm" aria-label={label}>
          <Link href={hrefFor(target)}>{icon}</Link>
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onPage?.(target)}
      >
        {icon}
      </Button>
    );
  };

  return (
    <nav className={cn("flex flex-wrap items-center gap-1", className)}>
      {step(
        page - 1,
        t.common.previous,
        <ChevronLeftIcon className="rtl-flip" />,
      )}

      {slots.map((slot, index) =>
        slot === "gap" ? (
          <span
            // The ellipsis is decoration; the pages either side of it are the
            // control, and a screen reader announcing "…" helps nobody.
            aria-hidden
            key={`gap-${index}`}
            className="text-muted-foreground px-1 text-sm select-none"
          >
            …
          </span>
        ) : (
          <PageButton
            key={slot}
            page={slot}
            current={slot === page}
            label={interpolate(t.common.page, { page: slot })}
            hrefFor={hrefFor}
            onPage={onPage}
          />
        ),
      )}

      {step(page + 1, t.common.next, <ChevronRightIcon className="rtl-flip" />)}
    </nav>
  );
}

function PageButton({
  page,
  current,
  label,
  hrefFor,
  onPage,
}: {
  page: number;
  current: boolean;
  label: string;
  hrefFor?: (page: number) => string;
  onPage?: (page: number) => void;
}) {
  const className = "tabular-nums";

  if (current) {
    return (
      <Button
        type="button"
        variant="default"
        size="icon-sm"
        // Not disabled: the page a reader is on should still be readable and
        // focusable, and `aria-current` is what says they are already there.
        aria-current="page"
        aria-label={label}
        className={className}
      >
        {page}
      </Button>
    );
  }

  if (hrefFor) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        className={className}
      >
        <Link href={hrefFor(page)}>{page}</Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      className={className}
      onClick={() => onPage?.(page)}
    >
      {page}
    </Button>
  );
}
