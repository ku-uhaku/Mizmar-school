import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/utils";
import { VoyageBoard } from "@/modules/transport/components/voyage-board";
import { listDayRuns, listMyRuns } from "@/modules/transport/queries";
import { ensureDayRuns } from "@/modules/transport/service";

export const metadata: Metadata = { title: "Voyages" };

/**
 * Le voyage: the runs the signed-in person is making today.
 *
 * ── Why this is personal and not the day's board ────────────────────────────
 * Almost everybody who opens this screen is on a bus, and what they need is the
 * one voyage that concerns them — offering a chauffeur every line of the school
 * is how the wrong register gets taken. So the default is `listMyRuns`, matched
 * through the crew link on the vehicle, and it is the same list the phone gets.
 *
 * Whoever answers for the day still has to see it. `?scope=all` widens to every
 * line, and the widening is re-derived from TRANSPORT_MANAGE here rather than
 * trusted from the query string: a driver who types it reaches their own runs,
 * exactly as if they had not.
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
  searchParams: Promise<{ date?: string; scope?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();
  const { date: requested, scope } = await searchParams;

  if (!context.can(PERMISSIONS.TRANSPORT_VIEW)) {
    return <ForbiddenState />;
  }
  // Runs belong to a year. With none selected there is nothing to generate and
  // nothing to show — said plainly rather than rendered as an empty board.
  if (!context.currentSchoolYear) {
    return <EmptyState title={t.errors.noSchoolYearContext} />;
  }

  const day = parseDay(requested);
  const canSeeEveryone = context.can(PERMISSIONS.TRANSPORT_MANAGE);
  const showAll = canSeeEveryone && scope === "all";

  // Only for today: back-filling a past day would invent runs nobody was ever
  // asked to make, which is the opposite of what the board is for.
  if (toDateInputValue(day) === toDateInputValue(new Date())) {
    await ensureDayRuns(context.currentSchoolYear.id, day);
  }

  const runs = showAll
    ? await listDayRuns(context, day)
    : await listMyRuns(context, day);

  return (
    <>
      <PageHeader
        title={t.transport.voyages}
        description={showAll ? t.transport.voyagesHint : t.transport.myVoyagesHint}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <VoyageBoard
        runs={runs}
        canCancel={context.can(PERMISSIONS.TRANSPORT_MANAGE)}
        // Everyone on this screen is looking at it as crew unless they have
        // deliberately widened it — which is what decides whether the clock
        // rules apply to the buttons. See `outOfHours` in the board.
        driverMode={!showAll}
        scope={canSeeEveryone ? (showAll ? "all" : "mine") : null}
        date={requested}
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
