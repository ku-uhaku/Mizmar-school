import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { HrDashboard } from "@/modules/hr/components/hr-dashboard";
import { hrSummary, listLeave, listStaff } from "@/modules/hr/queries";

export const metadata: Metadata = { title: "Ressources humaines" };

/**
 * The RH overview.
 *
 * The month comes from the query string rather than from component state,
 * because it is what the server sums the wage bill over — a bursar who reloads
 * while preparing September must land back on September, not on today.
 */
export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.HR_VIEW)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  // Guarded rather than trusted: a crafted month would otherwise reach
  // `formatMonth` and render "Invalid Date" across the screen.
  const period = {
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };

  const [summary, staff, leave] = await Promise.all([
    hrSummary(context, period.year, period.month),
    listStaff(context),
    listLeave(context),
  ]);

  return (
    <>
      <PageHeader title={t.hr.title} description={t.hr.subtitle} />

      <HrDashboard
        summary={summary}
        staff={staff}
        pendingLeave={leave.filter((request) => request.status === "PENDING")}
        period={period}
        permissions={{
          canPayroll: context.can(PERMISSIONS.HR_PAYROLL),
          canAttendance: context.can(PERMISSIONS.HR_ATTENDANCE),
        }}
      />
    </>
  );
}
