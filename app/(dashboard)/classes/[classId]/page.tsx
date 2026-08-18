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
import { defaultDateWithin } from "@/lib/school-year";
import {
  listAssessableClasses,
  listAssessmentTypes,
  listDevoirTargets,
  listTerms,
  loadClassPapers,
  loadProgrammesByClass,
} from "@/modules/assessments/queries";
import { ClassDetail } from "@/modules/classes/components/class-detail";
import {
  loadClassResults,
  loadClassTermAverages,
} from "@/modules/bulletins/queries";
import { listRemarks, loadClassAttendance } from "@/modules/classroom/queries";
import {
  findClass,
  loadClassOverview,
  loadTeachingGrid,
} from "@/modules/classes/queries";
import { listUnassignedStudents } from "@/modules/students/queries";
import {
  loadClassTimetable,
  loadTimetableChoices,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Classe" };

/** How much of the carnet the overview shows before sending the reader on. */
const CLASS_REMARKS_SHOWN = 8;

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

  /*
    The two create buttons on the paper tabs, and what they need.

    Loaded only for whoever may actually set something — the same pair
    `createDevoirAction` gates on, plus ASSESSMENT_MANAGE for the generator. A
    reader who may look at papers and not set them gets no options at all rather
    than a button that comes back refused.
  */
  const canGenerate = context.can(PERMISSIONS.ASSESSMENT_MANAGE);
  const canSetPapers =
    canGenerate || context.can(PERMISSIONS.ASSESSMENT_GRADE);

  // The overview's two other panels are gated on their own codes: a moyenne is a
  // mark, and the carnet is a colleague's note. `listRemarks` narrows further by
  // itself — a teacher sees their own, the office sees the school's.
  const canSeeMarks = context.can(PERMISSIONS.BULLETIN_VIEW);
  const canSeeRemarks = context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW);
  // The register is its own code again: a teacher who marks their own class is
  // not thereby allowed the whole class's year of absences.
  const canSeeAttendance = context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW);

  // Each module answers for its own half of the screen: who may be seated comes
  // from students, the week from timetable, the papers from assessments.
  const [
    overview,
    candidates,
    teachingGrid,
    timetable,
    timetableChoices,
    controls,
    devoirs,
    levelClasses,
    terms,
    controlTypes,
    devoirTypes,
    devoirTargets,
    results,
    termAverages,
    attendance,
    remarks,
  ] = await Promise.all([
    // This class and the niveau it sits at — the first tab.
    loadClassOverview(context, classId),
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
    // This niveau's classes only: the generator here offers "this class" or
    // "its niveau", so the school's whole list would be a picker for a decision
    // this screen is not making.
    canGenerate
      ? listAssessableClasses(context, {
          levelOfferingId: schoolClass.levelOfferingId,
        })
      : [],
    canSetPapers ? listTerms(context) : [],
    canGenerate ? listAssessmentTypes(context) : [],
    canSetPapers
      ? listAssessmentTypes(context, { teacherCreatableOnly: true })
      : [],
    // Narrowed to this class's own subject pairs — a devoir is one piece of work
    // for one class.
    canSetPapers
      ? listDevoirTargets(context, { schoolClassId: classId })
      : [],
    // The term in play, decided by the query rather than the page — see
    // `loadClassResults`.
    canSeeMarks ? loadClassResults(context, classId, null) : null,
    // The same frozen figures, term by term — the shape the single term above
    // cannot show.
    canSeeMarks ? loadClassTermAverages(context, classId) : [],
    canSeeAttendance ? loadClassAttendance(context, classId) : null,
    canSeeRemarks ? listRemarks(context, { schoolClassId: classId }) : [],
  ]);

  // The programmes the generator ticks from, for the classes it may reach.
  const programmes = canGenerate
    ? await loadProgrammesByClass(
        context,
        levelClasses.map((option) => option.id),
      )
    : {};

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
        overview={overview}
        results={results}
        termAverages={termAverages}
        attendance={attendance}
        // Capped here rather than in the query: the tab is a way in to the
        // carnet, not a second copy of the review screen.
        remarks={remarks.slice(0, CLASS_REMARKS_SHOWN)}
        candidates={candidates}
        teachingGrid={teachingGrid}
        timetable={timetable}
        timetableChoices={timetableChoices}
        controls={controls}
        devoirs={devoirs}
        paperCreation={
          canSetPapers
            ? {
                levelClasses,
                terms,
                // The term the school is in, so the commonest case needs no
                // pick. Null leaves the dialog's own default standing.
                defaultTermId:
                  terms.find((term) => term.status === "ACTIVE")?.id ?? null,
                // Today falls outside the school year for two months a year, and
                // a paper dated then belongs to no term — see lib/school-year.ts.
                defaultDate: defaultDateWithin(context.currentSchoolYear),
                programmes,
                controlTypes,
                devoirTypes,
                devoirTargets,
              }
            : null
        }
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
          canGeneratePapers: canGenerate,
        }}
      />
    </>
  );
}
