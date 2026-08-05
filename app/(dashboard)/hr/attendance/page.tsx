import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { toDateInputValue } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { AttendanceRegister } from "@/modules/hr/components/attendance-register";
import { startOfDay } from "@/modules/hr/enums";
import { listRegister } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Pointage" };

/**
 * The day comes from the query string rather than from component state: it is
 * what the server reads to build the register, so a reload has to land back on
 * the day being marked rather than on today.
 */
export default async function HrAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  const { date } = await searchParams;
  const now = new Date();
  const requested = date ? new Date(date) : now;
  const day = Number.isNaN(requested.getTime())
    ? startOfDay(now)
    : startOfDay(requested);

  const register = await listRegister(context, day);

  return (
    <>
      <PageHeader
        title={t.hr.attendance}
        description={t.hr.attendanceHint}
        backHref="/hr"
        backLabel={t.hr.title}
      />

      {/* The day is read in local time. `startOfDay` returns local midnight, so
          `toISOString()` reported the *previous* day everywhere ahead of UTC —
          the picker showed one day, the register below it another, and the
          marks the screen posted landed on the wrong one. */}
      <AttendanceRegister
        entries={register}
        date={toDateInputValue(day)}
        canMark={context.can(PERMISSIONS.HR_ATTENDANCE)}
      />
    </>
  );
}
