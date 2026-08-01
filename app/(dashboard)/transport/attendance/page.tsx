import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { startOfDay } from "@/modules/hr/enums";
import { BusRegister } from "@/modules/transport/components/bus-register";
import { listBusRuns, loadBusRegister } from "@/modules/transport/queries";

export const metadata: Metadata = { title: "Appel du bus" };

/**
 * L'appel du bus.
 *
 * The run and the day come from the query string rather than component state:
 * the server builds the register from them, so a reload — or a driver's phone
 * waking up mid-round — has to land back on the run being called.
 *
 * `run` is `routeId:scheduleId`, with an empty second half for a line that
 * declares no horaire. Neither id is trusted: `loadBusRegister` re-derives both
 * against the year in context and returns null if the pair does not check out.
 */
export default async function TransportAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; date?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)) {
    return <ForbiddenState />;
  }

  const { run, date } = await searchParams;

  const now = new Date();
  const requested = date ? new Date(date) : now;
  const day = Number.isNaN(requested.getTime())
    ? startOfDay(now)
    : startOfDay(requested);

  const runs = await listBusRuns(context);

  // Default to the first run of the day, so a driver opening the screen is one
  // tap from marking rather than two.
  const [routeId, scheduleId] = run
    ? [run.split(":")[0] ?? "", run.split(":")[1] ?? ""]
    : [runs[0]?.routeId ?? "", runs[0]?.scheduleId ?? ""];

  const entries = routeId
    ? await loadBusRegister(context, {
        routeId,
        scheduleId: scheduleId || null,
        date: day,
      })
    : null;

  return (
    <>
      <PageHeader
        title={t.transport.attendanceTitle}
        description={t.transport.attendanceSubtitle}
        backHref="/transport"
        backLabel={t.transport.title}
      />

      <BusRegister
        runs={runs}
        entries={entries}
        routeId={routeId || null}
        scheduleId={scheduleId || null}
        date={day.toISOString().slice(0, 10)}
        canMark={context.can(PERMISSIONS.TRANSPORT_ATTENDANCE)}
      />
    </>
  );
}
