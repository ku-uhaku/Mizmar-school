"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, ScrollTextIcon } from "lucide-react";

import { useI18n, useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActivityEntryRow } from "@/modules/audit/components/activity-entry";
import { ActivityFilters } from "@/modules/audit/components/activity-filters";
import type { ActivityAction } from "@/modules/audit/enums";
import type { ActivityPage } from "@/modules/audit/queries";

/**
 * The trail, filtered and paged.
 *
 * A list rather than the app's `DataTable`: that component sorts, filters and
 * pages in the browser, which is right for a screen holding one organisation's
 * schools and wrong for the one table with no ceiling. Everything here is
 * decided on the server and read from the URL.
 */
export function ActivityFeed({
  page,
  actors,
  actions,
  filtered,
}: {
  page: ActivityPage;
  actors: { id: string; label: string }[];
  actions: ActivityAction[];
  /** Whether any filter is set — an empty screen means two different things. */
  filtered: boolean;
}) {
  const t = useT();
  const { fmt } = useI18n();

  return (
    <>
      <ActivityFilters actors={actors} actions={actions} />

      {page.entries.length === 0 ? (
        <Card className="py-0">
          <EmptyState
            icon={<ScrollTextIcon className="size-5" />}
            title={filtered ? t.audit.noMatches : t.audit.empty}
            description={filtered ? undefined : t.audit.emptyHint}
          />
        </Card>
      ) : (
        <>
          <Card className="gap-0 overflow-hidden py-0">
            {page.entries.map((entry) => (
              <ActivityEntryRow key={entry.id} entry={entry} />
            ))}
          </Card>

          <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
            <span>{fmt(t.audit.resultCount, { count: page.total })}</span>
            <Pagination page={page} />
          </div>
        </>
      )}
    </>
  );
}

function Pagination({ page }: { page: ActivityPage }) {
  const t = useT();
  const { fmt } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (page.pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums">
        {fmt(t.audit.page, { page: page.page, pages: page.pageCount })}
      </span>
      <Button
        asChild={page.page > 1}
        variant="outline"
        size="icon"
        disabled={page.page <= 1}
        aria-label={t.common.previous}
      >
        {page.page > 1 ? (
          <Link href={hrefFor(page.page - 1)}>
            <ChevronLeftIcon className="rtl:rotate-180" />
          </Link>
        ) : (
          <ChevronLeftIcon className="rtl:rotate-180" />
        )}
      </Button>
      <Button
        asChild={page.page < page.pageCount}
        variant="outline"
        size="icon"
        disabled={page.page >= page.pageCount}
        aria-label={t.common.next}
      >
        {page.page < page.pageCount ? (
          <Link href={hrefFor(page.page + 1)}>
            <ChevronRightIcon className="rtl:rotate-180" />
          </Link>
        ) : (
          <ChevronRightIcon className="rtl:rotate-180" />
        )}
      </Button>
    </div>
  );
}
