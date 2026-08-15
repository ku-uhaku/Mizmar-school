import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrinterIcon } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { loadClassPapers } from "@/modules/assessments/queries";
import { ClassDetail } from "@/modules/classes/components/class-detail";
import { findClass, loadTeachingGrid } from "@/modules/classes/queries";
import { listUnassignedStudents } from "@/modules/students/queries";
import {
  loadClassTimetable,
  loadTimetableChoices,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Classe" };

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { classId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASS_VIEW)) {
    return <ForbiddenState />;
  }

  // Scoped to the school and year in context; a class from elsewhere reads as
  // absent rather than forbidden.
  const schoolClass = await findClass(context, classId);
  if (!schoolClass) notFound();

  /*
    The two paper tabs filter through the URL, exactly as the vie scolaire's own
    review screens do — the read is capped, so filtering in the browser would
    filter the newest page and quietly hide the rest. Each tab's parameters
    carry their own prefix (`c_` for contrôles, `d_` for devoirs) so the two
    lists on one page cannot move each other's filters.
  */
  const query = await searchParams;
  const one = (key: string): string => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const paperFilters = (prefix: string) => ({
    search: one(`${prefix}q`),
    teacherId: one(`${prefix}teacher`),
    // Fixed by the route: the class picker is not offered on these tabs.
    schoolClassId: "",
    subjectId: one(`${prefix}subject`),
    termId: one(`${prefix}term`),
    stage: one(`${prefix}stage`),
  });

  const canSeePapers = context.can(PERMISSIONS.ASSESSMENT_VIEW);
  const controlFilters = paperFilters("c_");
  const devoirFilters = paperFilters("d_");

  // Each module answers for its own half of the screen: who may be seated comes
  // from students, the week from timetable, the papers from assessments.
  const [
    candidates,
    teachingGrid,
    timetable,
    timetableChoices,
    controls,
    devoirs,
  ] = await Promise.all([
    listUnassignedStudents(context, schoolClass.levelOfferingId),
    // The class's programme with whoever answers for each subject.
    loadTeachingGrid(context, classId),
    loadClassTimetable(context, schoolClass.id),
    loadTimetableChoices(context, schoolClass.id),
    canSeePapers
      ? loadClassPapers(context, classId, "CONTROLE", controlFilters)
      : null,
    canSeePapers
      ? loadClassPapers(context, classId, "DEVOIR", devoirFilters)
      : null,
  ]);

  return (
    <>
      <PageHeader
        title={schoolClass.code}
        description={`${schoolClass.levelLabel} — ${schoolClass.levelName}`}
        backHref="/classes"
        backLabel={t.schoolClass.title}
      >
        <Badge variant="secondary" className="tabular-nums">
          {schoolClass.capacity === null
            ? schoolClass.enrolled
            : interpolate(t.schoolClass.fill, {
                enrolled: schoolClass.enrolled,
                capacity: schoolClass.capacity,
              })}
        </Badge>
        <Button asChild variant="outline" size="sm">
          <Link href={`/print/class/${schoolClass.id}`}>
            <PrinterIcon />
            {t.print.classList}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/timetable?classId=${schoolClass.id}`}>
            {t.schoolClass.openTimetable}
          </Link>
        </Button>
      </PageHeader>

      <ClassDetail
        schoolClass={schoolClass}
        candidates={candidates}
        teachingGrid={teachingGrid}
        timetable={timetable}
        timetableChoices={timetableChoices}
        controls={controls}
        devoirs={devoirs}
        permissions={{
          canRoster:
            context.can(PERMISSIONS.CLASS_ROSTER) &&
            context.can(PERMISSIONS.ENROLMENT_UPDATE),
          canAssignTeacher: context.can(PERMISSIONS.CLASS_ASSIGN_TEACHER),
          canManageTimetable: context.can(PERMISSIONS.TIMETABLE_MANAGE),
          canValidatePapers: context.can(PERMISSIONS.ASSESSMENT_PUBLISH),
          // Moving a paper in or out of the average is a weighting decision, so
          // it sits on the same code that decides what gets set at all.
          canReweighPapers: context.can(PERMISSIONS.ASSESSMENT_MANAGE),
        }}
      />
    </>
  );
}
