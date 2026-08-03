import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { REPORTS } from "@/modules/reports/catalogue";
import { FavouriteButton } from "@/modules/reports/components/favourite-button";
import { loadFavouriteReportIds } from "@/modules/reports/queries";
import type { ReportDef } from "@/modules/reports/types";

export const metadata: Metadata = { title: "Rapports" };

/**
 * The report index, grouped by the part of the school each one is about.
 *
 * Only the reports this reader may actually run are listed. A catalogue that
 * showed the payroll to a teacher and refused it on click would be telling them
 * what exists rather than what they may have — see the note in `catalogue.ts`
 * on why every report carries its own data's permission.
 */
export default async function ReportsPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.REPORT_VIEW)) {
    return <ForbiddenState />;
  }

  const allowed = REPORTS.filter((report) =>
    context.can(report.permission as never),
  );
  const favourites = await loadFavouriteReportIds(context);
  const sections = ["vieScolaire", "finance", "rh", "academics"] as const;

  /*
    Starred reports are shown twice on purpose: pinned at the top, and still in
    the section they belong to. Moving them out would make a section quietly
    lose a report, and somebody looking under "Finance" for the one they starred
    last week would conclude it had gone.
  */
  const starred = allowed.filter((report) => favourites.has(report.id));

  const card = (report: ReportDef) => (
    <div key={report.id} className="relative">
      <Link
        href={`/reports/${report.id}`}
        className="bg-card ring-foreground/10 hover:ring-foreground/25 block rounded-xl p-4 pe-12 ring-1 transition"
      >
        <p className="text-sm font-medium">
          {t.report.reports[report.labelKey as keyof typeof t.report.reports] ??
            report.labelKey}
        </p>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">
          {t.report.hints[report.hintKey as keyof typeof t.report.hints] ?? ""}
        </p>
      </Link>
      {/* Outside the link, not inside it: a button nested in an anchor is
        invalid, and the click would navigate rather than star. */}
      <div className="absolute end-2 top-2">
        <FavouriteButton
          reportId={report.id}
          starred={favourites.has(report.id)}
        />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title={t.report.title} description={t.report.subtitle} />

      <div className="grid gap-6">
        {starred.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t.report.favourites}
              </h2>
              <span className="text-muted-foreground/70 text-xs">
                {t.report.favouritesHint}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {starred.map(card)}
            </div>
          </section>
        ) : null}

        {sections.map((section) => {
          const inSection = allowed.filter(
            (report) => report.section === section,
          );
          if (inSection.length === 0) return null;

          return (
            <section key={section} className="grid gap-3">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t.report.sections[section]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inSection.map(card)}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
