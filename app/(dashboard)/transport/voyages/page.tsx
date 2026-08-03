import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/utils";
import { VoyageBoard } from "@/modules/transport/components/voyage-board";
import { listDayRuns } from "@/modules/transport/queries";
import { ensureDayRuns } from "@/modules/transport/service";

export const metadata: Metadata = { title: "Voyages" };

/**
 * The day's board.
 *
 * Generation happens on the way in rather than from a scheduler: a school opens
 * this screen every morning by definition, there is no cron in this deployment,
 * and `ensureDayRuns` is idempotent — a second visit writes nothing.
 *
 * A date in the query string is honoured so yesterday can be reviewed, and it is
 * parsed rather than trusted: it only ever narrows which day's runs are read,
 * all of them already confined to the year in context.
 */
export default async function VoyagesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const { date: requested } = await searchParams;

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }
  // Runs belong to a year. With none selected there is nothing to generate and
  // nothing to show — said plainly rather than rendered as an empty board.
  if (!context.currentSchoolYear) {
    return <EmptyState title={t.errors.noSchoolYearContext} />;
  }

  const day = parseDay(requested);

  // Only for today: back-filling a past day would invent runs nobody was ever
  // asked to make, which is the opposite of what the board is for.
  if (toDateInputValue(day) === toDateInputValue(new Date())) {
    await ensureDayRuns(context.currentSchoolYear.id, day);
  }

  const runs = await listDayRuns(context, day);

  return (
    <>
      <PageHeader
        title={t.transport.voyages}
        description={t.transport.voyagesHint}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <VoyageBoard
        runs={runs}
        canCancel={context.can(PERMISSIONS.TRANSPORT_MANAGE)}
      />
    </>
  );
}

/** Midnight of the requested day, or of today when it is absent or unreadable. */
function parseDay(value: string | undefined): Date {
  const candidate = value ? new Date(`${value}T00:00:00`) : new Date();
  const day = Number.isNaN(candidate.getTime()) ? new Date() : candidate;
  day.setHours(0, 0, 0, 0);
  return day;
}
