import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartPieIcon, PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { defaultDateWithin } from "@/lib/school-year";
import {
  findEnrolment,
  loadEnrolmentChoices,
  loadFeeGrid,
} from "@/modules/enrolment/queries";
import { findFamily, listFamilyChoices } from "@/modules/families/queries";
import {
  listCityChoices,
  listNeighbourhoodChoices,
} from "@/modules/geography/queries";
import { StudentProfile } from "@/modules/students/components/student-profile";
import { StudentStatusBadge } from "@/modules/students/components/student-status-badge";
import { loadPupilMarks } from "@/modules/assessments/queries";
import { listPupilBulletins } from "@/modules/bulletins/queries";
import {
  loadPupilAttendance,
  loadPupilRemarks,
} from "@/modules/classroom/queries";
import { findStudent, loadStudentWorkflow } from "@/modules/students/queries";
import { loadStudentDossier } from "@/modules/documents/queries";
import {
  loadTransportChoices,
  studentTransport,
} from "@/modules/transport/queries";
import {
  asSinglePaymentsPage,
  familyPaymentStanding,
  findOpenSession,
  findPayableFamily,
  listBanks,
  listStudentPayments,
  studentPaymentStanding,
} from "@/modules/treasury/queries";
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
  // The dossier is gated on its own code, like money and transport: a reader
  // without it gets no tab rather than an empty one.
  const canSeeDossier = context.can(PERMISSIONS.DOCUMENT_VIEW);

  const [
    workflow,
    enrolment,
    choices,
    families,
    cities,
    neighbourhoods,
    dossier,
  ] = await Promise.all([
      loadStudentWorkflow(context, student.id),
      findEnrolment(context, student.id),
      loadEnrolmentChoices(context),
      listFamilyChoices(context),
      // The pupil's own towns are kept in the list even if deactivated, so
      // merging two spellings never blanks a birthplace on the next save.
      listCityChoices(context, [
        student.birthCityId,
        student.previousSchoolCityId,
      ]),
      // Same rule for their quartier — a merged one must not blank the address.
      listNeighbourhoodChoices(context, [student.neighbourhoodId]),
      canSeeDossier ? loadStudentDossier(context, student.id) : null,
    ]);

  // The rest depends on what the first round found: no dossier means no
  // guardians to load, no class means no week to draw, and the fratrie's
  // standing is only worth summing when there is a dossier and a reader
  // allowed to see money.
  // Three separate grants, because the school treats them as three separate
  // things: a secretary may read the register without reading what a teacher
  // wrote about a child, and marks are a third decision again. The codes
  // already existed for the espace enseignant — see modules/classroom.
  const canSeeAttendance = context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW);
  const canSeeRemarks = context.can(PERMISSIONS.CLASSROOM_REMARK_VIEW);
  const canSeeMarks = context.can(PERMISSIONS.ASSESSMENT_VIEW);
  // A fourth grant, not folded into the marks one: a bulletin carries the
  // council's decision and the rank in the class, which is more than "how did
  // they do in the last contrôle" — see modules/bulletins/permissions.ts.
  const canSeeBulletins = context.can(PERMISSIONS.BULLETIN_VIEW);
  const canCollect = context.can(PERMISSIONS.TREASURY_COLLECT);
  // Gated on its own: a teacher may read a pupil's file without learning which
  // bus they take or what the family pays for it.
  const canSeeTransport = context.can(PERMISSIONS.TRANSPORT_VIEW);

  const [
    family,
    feeGrid,
    timetable,
    timetableChoices,
    standing,
    familyStanding,
    payments,
    attendance,
    marks,
    bulletins,
    remarks,
    payable,
    banks,
    openSession,
    transportChoices,
    transportSubscriptions,
  ] = await Promise.all([
    student.familyId ? findFamily(context, student.familyId) : null,
    enrolment ? loadFeeGrid(context, enrolment.id) : null,
    enrolment?.schoolClassId
      ? loadClassTimetable(context, enrolment.schoolClassId)
      : null,
    enrolment?.schoolClassId
      ? loadTimetableChoices(context, enrolment.schoolClassId)
      : null,
    canSeeMoney ? studentPaymentStanding(context, student.id) : null,
    canSeeMoney && student.familyId
      ? familyPaymentStanding(context, student.id, student.familyId)
      : null,
    // Gated with the rest of the money: the receipts say what a family paid and
    // when, which is exactly what TREASURY_VIEW exists to withhold.
    // Dressed as a page because the receipts table is server-paged on /caisse;
    // a pupil's own receipts are bounded, so they all arrive at once.
    canSeeMoney
      ? listStudentPayments(context, student.id).then(asSinglePaymentsPage)
      : asSinglePaymentsPage([]),
    // All three hang off the enrolment — no place this year, nothing to show.
    enrolment && canSeeAttendance
      ? loadPupilAttendance(context, enrolment.id)
      : null,
    enrolment && canSeeMarks ? loadPupilMarks(context, enrolment.id) : null,
    enrolment && canSeeBulletins
      ? listPupilBulletins(context, enrolment.id)
      : null,
    enrolment && canSeeRemarks ? loadPupilRemarks(context, enrolment.id) : null,
    // The till on the payment tab. Only for a reader who may actually collect,
    // and only when there is a household to bill.
    canCollect && student.familyId
      ? findPayableFamily(context, student.familyId)
      : null,
    canCollect ? listBanks(context) : [],
    canCollect ? findOpenSession(context) : null,
    // The Quartier → Circuit → Horaire cascade, pre-nested so the panel
    // narrows it in memory — see loadTransportChoices.
    canSeeTransport ? loadTransportChoices(context) : null,
    canSeeTransport ? studentTransport(context, student.id) : [],
  ]);

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={student.code}
        backHref="/students"
        backLabel={t.student.title}
        avatar={
          <Avatar className="size-12 border">
            {student.photoUrl ? (
              <AvatarImage src={student.photoUrl} alt="" />
            ) : null}
            <AvatarFallback>
              {`${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        }
        meta={
          <>
            {/* Status keeps its own colours — it means something. The level and
              the class say *where* the child sits, which is exactly what the
              section hue is for. */}
            <StudentStatusBadge status={student.status} />
            {student.levelName ? (
              <Badge variant="section">{student.levelName}</Badge>
            ) : null}
            {student.className ? (
              <Badge variant="section">{student.className}</Badge>
            ) : null}
          </>
        }
      >
        {/* The overview sits on its own page rather than as a tab: it is read
          rather than worked in, and a chart squeezed between eleven tabs is a
          chart nobody looks at. */}
        <Button asChild size="sm">
          <Link href={`/students/${student.id}/dashboard`}>
            <ChartPieIcon />
            {t.student.tabDashboard}
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm">
          <Link href={`/print/student/${student.id}/attestation`}>
            <PrinterIcon />
            {t.print.attestation}
          </Link>
        </Button>
        {canSeeMoney ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/print/student/${student.id}/echeancier`}>
              <PrinterIcon />
              {t.print.schedule}
            </Link>
          </Button>
        ) : null}
      </PageHeader>

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
        cities={cities}
        neighbourhoods={neighbourhoods}
        enrolment={enrolment}
        offerings={choices.offerings}
        startMonths={choices.optionStartMonths}
        subscribableCharges={choices.subscribableCharges}
        yearName={context.currentSchoolYear?.name ?? null}
        feeGrid={feeGrid}
        discounts={choices.discounts}
        timetable={timetable}
        timetableChoices={timetableChoices}
        standing={standing}
        attendance={attendance}
        marks={marks}
        bulletins={bulletins}
        remarks={remarks}
        defaultRemarkDate={defaultDateWithin(context.currentSchoolYear)}
        payable={payable}
        banks={banks}
        hasOpenSession={openSession !== null}
        transportChoices={transportChoices}
        transportSubscriptions={transportSubscriptions}
        familyStanding={familyStanding}
        payments={payments}
        workflow={workflow}
        dossier={dossier}
        // Whether a family is behind on its payments is money: a teacher who
        // may view a pupil has no business reading it off their parcours.
        workflowSteps={
          canSeeMoney
            ? STUDENT_WORKFLOW_STEPS
            : STUDENT_WORKFLOW_STEPS.filter((step) => step !== "PAYMENT")
        }
        permissions={{
          canUpdateStudent: context.can(PERMISSIONS.STUDENT_UPDATE),
          canManageFamily: context.can(PERMISSIONS.FAMILY_UPDATE),
          canManageFamilyPortal: context.can(PERMISSIONS.FAMILY_PORTAL),
          canCreateEnrolment: context.can(PERMISSIONS.ENROLMENT_CREATE),
          canUpdateEnrolment: context.can(PERMISSIONS.ENROLMENT_UPDATE),
          canDeleteEnrolment: context.can(PERMISSIONS.ENROLMENT_DELETE),
          canManageFees: context.can(PERMISSIONS.ENROLMENT_FEES),
          canCollect: context.can(PERMISSIONS.TREASURY_COLLECT),
          canCancelPayment: context.can(PERMISSIONS.TREASURY_CANCEL),
          canSubscribeTransport: context.can(PERMISSIONS.TRANSPORT_SUBSCRIBE),
          canManageDocuments: context.can(PERMISSIONS.DOCUMENT_MANAGE),
          canWriteRemark: context.can(PERMISSIONS.CLASSROOM_REMARK_WRITE),
          canPublishRemark: context.can(PERMISSIONS.CLASSROOM_REMARK_PUBLISH),
        }}
      />
    </>
  );
}
