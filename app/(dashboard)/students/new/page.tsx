import type { Metadata } from "next";
import { CalendarRangeIcon } from "lucide-react";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { listFamilyChoices } from "@/modules/families/queries";
import {
  listCityChoices,
  listNeighbourhoodChoices,
} from "@/modules/geography/queries";
import { loadEnrolmentChoices } from "@/modules/enrolment/queries";
import { EnrolWizard } from "@/modules/students/components/enrol-wizard";

export const metadata: Metadata = { title: "Nouvel élève" };

/**
 * The wizard registers a place for the year in the same submit, so it needs a
 * school year in context — unlike the full fiche at `/students/[studentId]`,
 * which edits identity alone and has no such dependency.
 */
export default async function NewStudentPage() {
  const context = await requireAuth();
  const t = await getDictionary();

  if (
    !context.can(PERMISSIONS.STUDENT_CREATE) ||
    !context.can(PERMISSIONS.ENROLMENT_CREATE)
  ) {
    return <ForbiddenState />;
  }

  if (!context.currentSchoolYear) {
    return (
      <>
        <PageHeader
          title={t.student.newStudent}
          backHref="/students"
          backLabel={t.student.title}
        />
        <div className="rounded-xl border">
          <EmptyState
            icon={<CalendarRangeIcon className="size-5" />}
            title={t.context.noYearSelected}
            description={t.errors.noSchoolYearContext}
          />
        </div>
      </>
    );
  }

  // Cross-module reads through each owner's own queries — never a raw db call.
  const [families, cities, neighbourhoods, enrolmentChoices] =
    await Promise.all([
      listFamilyChoices(context),
      listCityChoices(context),
      listNeighbourhoodChoices(context),
      loadEnrolmentChoices(context),
    ]);

  return (
    <>
      <PageHeader
        title={t.student.newStudent}
        description={t.student.identityHint}
        backHref="/students"
        backLabel={t.student.title}
      />

      <EnrolWizard
        families={families}
        cities={cities}
        neighbourhoods={neighbourhoods}
        offerings={enrolmentChoices.offerings}
        yearLabel={context.currentSchoolYear.name}
      />
    </>
  );
}
