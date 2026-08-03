import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { VoyageBoard } from "@/modules/transport/components/voyage-board";
import { listMyRuns } from "@/modules/transport/queries";
import { ensureDayRuns } from "@/modules/transport/service";

export const metadata: Metadata = { title: "Mes voyages" };

/**
 * The driver's screen: today, this bus, one button.
 *
 * Gated on TRANSPORT_ATTENDANCE — the code the module already describes as the
 * driver's and the accompagnateur's — rather than on TRANSPORT_VIEW, so a
 * chauffeur's role grants exactly this and not the fleet, the lines or what a
 * family pays.
 *
 * What they see is decided by `listMyRuns`, which matches through
 * `Vehicle.driver.userId`. An account driving nothing gets an empty list, never
 * the whole board: this screen must not become a way to read the fleet.
 */
export default async function MyVoyagePage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
    return <ForbiddenState />;
  }
  // Runs belong to a year. With none selected there is nothing to generate and
  // nothing to show — said plainly rather than rendered as an empty board.
  if (!context.currentSchoolYear) {
    return <EmptyState title={t.errors.noSchoolYearContext} />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // The driver may well open the app before anyone in the office does, so the
  // day's runs are generated here too. Idempotent — see `ensureDayRuns`.
  await ensureDayRuns(context.currentSchoolYear.id, today);

  const runs = await listMyRuns(context, today);

  return (
    <>
      <PageHeader
        title={t.transport.myVoyages}
        description={t.transport.myVoyagesHint}
      />

      {/* Cancelling is deliberately not offered here: a breakdown is reported,
          and whoever answers for the day decides whether the run is struck off. */}
      <VoyageBoard runs={runs} canCancel={false} driverMode />
    </>
  );
}
