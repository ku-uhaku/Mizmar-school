import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  findEnrolment,
  loadEnrolmentChoices,
  loadFeeGrid,
} from "@/modules/enrolment/queries";
import { findFamily, listFamilyChoices } from "@/modules/families/queries";
import { StudentProfile } from "@/modules/students/components/student-profile";
import { StudentStatusBadge } from "@/modules/students/components/student-status-badge";
import { StudentWorkflow } from "@/modules/students/components/student-workflow";
import { findStudent, loadStudentWorkflow } from "@/modules/students/queries";
import { studentPaymentStanding } from "@/modules/treasury/queries";
import { STUDENT_WORKFLOW_STEPS } from "@/modules/students/enums";
import {
  loadClassTimetable,
  loadTimetableChoices,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Élève" };

/**
 * The pupil's file: the parcours across the top, then five tabs.
 *
 * The page is thin by the usual rule — it authorizes, then composes each
 * module's own reads. It never queries the database itself, which is what keeps
 * the fee grid here identical to the one the bursar would see anywhere else.
 */
export default async function StudentPage({
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

  // Scoped to the school in context; a pupil from elsewhere reads as absent
  // rather than forbidden, so their existence cannot be probed.
  const student = await findStudent(context, studentId);
  if (!student) notFound();

  // Money is gated separately from the pupil's file: a teacher may read a
  // child's record without learning whether their family is behind on fees.
  const canSeeMoney = context.can(PERMISSIONS.TREASURY_VIEW);

  const [workflow, enrolment, choices, families] = await Promise.all([
    loadStudentWorkflow(context, student.id),
    findEnrolment(context, student.id),
    loadEnrolmentChoices(context),
    listFamilyChoices(context),
  ]);

  // The rest depends on what the first round found: no dossier means no
  // guardians to load, no class means no week to draw.
  const [family, feeGrid, timetable, timetableChoices, standing] = await Promise.all([
    student.familyId ? findFamily(context, student.familyId) : null,
    enrolment ? loadFeeGrid(context, enrolment.id) : null,
    enrolment?.schoolClassId
      ? loadClassTimetable(context, enrolment.schoolClassId)
      : null,
    enrolment?.schoolClassId
      ? loadTimetableChoices(context, enrolment.schoolClassId)
      : null,
    canSeeMoney ? studentPaymentStanding(context, student.id) : null,
  ]);

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={student.code}
        backHref="/students"
        backLabel={t.student.title}
      >
        <StudentStatusBadge status={student.status} />
        {student.levelName ? (
          <Badge variant="secondary">{student.levelName}</Badge>
        ) : null}
        {student.className ? (
          <Badge variant="outline">{student.className}</Badge>
        ) : null}
      </PageHeader>

      <div className="mb-4">
        <StudentWorkflow
          state={workflow}
          steps={
            canSeeMoney
              ? STUDENT_WORKFLOW_STEPS
              : STUDENT_WORKFLOW_STEPS.filter((step) => step !== "PAYMENT")
          }
        />
      </div>

      <StudentProfile
        student={student}
        family={
          family
            ? {
                id: family.id,
                name: family.name,
                code: family.code,
                situation: family.situation,
                phone: family.phone,
              }
            : null
        }
        guardians={family?.guardians ?? []}
        families={families}
        enrolment={enrolment}
        offerings={choices.offerings}
        yearName={context.currentSchoolYear?.name ?? null}
        feeGrid={feeGrid}
        discounts={choices.discounts}
        timetable={timetable}
        timetableChoices={timetableChoices}
        standing={standing}
        permissions={{
          canUpdateStudent: context.can(PERMISSIONS.STUDENT_UPDATE),
          canManageFamily: context.can(PERMISSIONS.FAMILY_UPDATE),
          canCreateEnrolment: context.can(PERMISSIONS.ENROLMENT_CREATE),
          canUpdateEnrolment: context.can(PERMISSIONS.ENROLMENT_UPDATE),
          canDeleteEnrolment: context.can(PERMISSIONS.ENROLMENT_DELETE),
          canManageFees: context.can(PERMISSIONS.ENROLMENT_FEES),
          canCollect: context.can(PERMISSIONS.TREASURY_COLLECT),
        }}
      />
    </>
  );
}
