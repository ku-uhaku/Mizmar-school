import type { Metadata } from "next";
import Link from "next/link";
import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { loadPupilMarks } from "@/modules/assessments/queries";
import { listPupilTeachers } from "@/modules/classes/queries";
import {
  loadPupilAttendance,
  loadPupilRemarks,
} from "@/modules/classroom/queries";
import { loadStudentDossier } from "@/modules/documents/queries";
import { findEnrolment } from "@/modules/enrolment/queries";
import { findFamily } from "@/modules/families/queries";
import { StudentDashboard } from "@/modules/students/components/student-dashboard";
import { findStudent } from "@/modules/students/queries";
import { studentPaymentStanding } from "@/modules/treasury/queries";

export const metadata: Metadata = { title: "Tableau de bord" };

/**
 * The pupil's year in charts.
 *
 * A page of its own rather than a twelfth tab: it is read rather than worked
 * in, and it is what somebody opens *before* deciding which tab they need.
 *
 * Thin by the usual rule — it authorizes, composes each module's own read, and
 * renders. Each figure is gated the same way it is on the file itself, so a
 * teacher who may not see money gets no fee ring rather than an empty one.
 */
export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.STUDENT_VIEW)) {
    return <ForbiddenState />;
  }

  const student = await findStudent(context, studentId);
  if (!student) notFound();

  const canSeeMoney = context.can(PERMISSIONS.TREASURY_VIEW);
  const canSeeDossier = context.can(PERMISSIONS.DOCUMENT_VIEW);

  // The three that hang off the enrolment are null without one — a child with
  // no place this year has no register and no échéancier to chart.
  const enrolment = await findEnrolment(context, student.id);

  const [marks, attendance, remarks, standing, dossier, family, teachers] =
    await Promise.all([
      enrolment ? loadPupilMarks(context, enrolment.id) : null,
      enrolment ? loadPupilAttendance(context, enrolment.id) : null,
      enrolment && context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW)
        ? loadPupilRemarks(context, enrolment.id)
        : null,
      canSeeMoney ? studentPaymentStanding(context, student.id) : null,
      canSeeDossier ? loadStudentDossier(context, student.id) : null,
      // The household, for the photo card's contact line — a secretary looking
      // at a pupil wants the telephone without a second click.
      student.familyId ? findFamily(context, student.familyId) : null,
      /*
        Who teaches them, through the classes module's own read.

        Three states, not two: no enrolment at all is null (the panel is
        absent, like every other enrolment-shaped card here); enrolled but not
        yet seated is an empty list, which the panel says out loud — "awaiting a
        class" is a thing somebody has to act on, and a panel that simply
        vanished would hide it.
      */
      enrolment?.schoolClassId
        ? listPupilTeachers(
            context,
            enrolment.schoolClassId,
            enrolment.classGroupId,
          )
        : enrolment
          ? []
          : null,
    ]);

  return (
    <>
      <PageHeader
        title={t.student.tabDashboard}
        description={`${student.firstName} ${student.lastName} · ${student.code}`}
        backHref={`/students/${student.id}`}
        backLabel={t.student.title}
      >
        {/* The browser's own print dialog, whose default destination is
          "Save as PDF" on every desktop — see PrintButton. */}
        <Button asChild variant="outline" size="sm">
          <Link href={`/print/student/${student.id}/dashboard`}>
            <PrinterIcon />
            {t.print.download}
          </Link>
        </Button>
      </PageHeader>

      <StudentDashboard
        student={student}
        enrolment={enrolment}
        guardians={family?.guardians ?? []}
        familyName={family?.name ?? null}
        remarks={remarks}
        marks={marks}
        attendance={attendance}
        standing={standing}
        dossier={dossier}
        teachers={teachers}
      />
    </>
  );
}
