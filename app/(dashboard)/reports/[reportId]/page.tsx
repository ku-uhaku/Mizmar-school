import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { findReport } from "@/modules/reports/catalogue";
import { FavouriteButton } from "@/modules/reports/components/favourite-button";
import { ReportView } from "@/modules/reports/components/report-view";
import {
  loadFavouriteReportIds,
  loadFilterChoices,
} from "@/modules/reports/queries";
import { runReport } from "@/modules/reports/runners.server";

export const metadata: Metadata = { title: "Rapport" };

/** Blank when the filter was left on "all" — the runner treats it as absent. */
const pick = (value: string | undefined) =>
  !value || value === "__any__" ? null : value;

/**
 * One report, run against the filters in the query string.
 *
 * The dates default to the school year rather than to today: a report opened
 * with an empty range would answer "nothing", which reads as a broken screen
 * rather than as an unset filter.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { reportId } = await params;
  const query = await searchParams;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.REPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const report = findReport(reportId);
  if (!report) notFound();

  const year = context.currentSchoolYear;
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const from = query.from ?? (year ? iso(year.startDate) : iso(new Date()));
  const to = query.to ?? (year ? iso(year.endDate) : iso(new Date()));

  const reportParams = {
    from,
    to,
    levelOfferingId: pick(query.levelOfferingId),
    schoolClassId: pick(query.schoolClassId),
    cycle: pick(query.cycle),
    staffId: pick(query.staffId),
    feeTypeId: pick(query.feeTypeId),
  };

  /*
    Nothing is queried until the report is actually asked for.

    `run=1` is set by the filter bar's submit. Without it the page draws the
    filters and stops — a reporting screen that runs itself on arrival scans the
    whole year for every visitor who merely clicked the wrong link, and shows a
    table nobody chose the shape of.
  */
  const ran = query.run === "1";

  const [result, choices, favourites] = await Promise.all([
    ran ? runReport(context, report.id, reportParams) : null,
    loadFilterChoices(context),
    loadFavouriteReportIds(context),
  ]);

  // Null *after* a run means the reader lacks the data's own permission —
  // forbidden rather than an empty table, which would read as "there is
  // nothing". Not-yet-run is a different null, and shows the prompt instead.
  if (ran && !result) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title={
          t.report.reports[report.labelKey as keyof typeof t.report.reports] ??
          report.labelKey
        }
        description={
          t.report.hints[report.hintKey as keyof typeof t.report.hints] ?? ""
        }
        backHref="/reports"
        backLabel={t.report.title}
      >
        <FavouriteButton
          reportId={report.id}
          starred={favourites.has(report.id)}
        />
      </PageHeader>

      <ReportView
        report={report}
        result={result}
        choices={choices}
        params={{
          from,
          to,
          levelOfferingId: query.levelOfferingId ?? "",
          schoolClassId: query.schoolClassId ?? "",
          cycle: query.cycle ?? "",
          staffId: query.staffId ?? "",
          feeTypeId: query.feeTypeId ?? "",
        }}
      />
    </>
  );
}
