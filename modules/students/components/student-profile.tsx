"use client";

import Link from "next/link";
import * as React from "react";
import { CalendarXIcon, PrinterIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { GuardianRow } from "@/modules/families/queries";
import { EnrolmentPanel } from "@/modules/enrolment/components/enrolment-panel";
import type {
  OfferingChoice,
  StartMonthChoice,
} from "@/modules/enrolment/components/enrolment-panel";
import { FeeGrid } from "@/modules/enrolment/components/fee-grid";
import type {
  EnrolmentDetail,
  FeeGrid as FeeGridData,
} from "@/modules/enrolment/queries";
import { PupilMarksPanel } from "@/modules/assessments/components/pupil-marks-panel";
import { PupilBulletins } from "@/modules/bulletins/components/pupil-bulletins";
import type { PupilMarks } from "@/modules/assessments/queries";
import type { BulletinRow } from "@/modules/bulletins/queries";
import { PupilAttendancePanel } from "@/modules/classroom/components/pupil-attendance-panel";
import { PupilRemarksPanel } from "@/modules/classroom/components/pupil-remarks-panel";
import type {
  PupilAttendance,
  PupilRemarkRow,
} from "@/modules/classroom/queries";
import { StudentForm } from "@/modules/students/components/student-form";
import { StudentFamilyPanel } from "@/modules/students/components/student-family-panel";
import { StudentSummary } from "@/modules/students/components/student-summary";
import { StudentDossierPanel } from "@/modules/documents/components/student-dossier-panel";
import type { StudentDossier } from "@/modules/documents/queries";
import { StudentWorkflow } from "@/modules/students/components/student-workflow";
import type { StudentWorkflowStep } from "@/modules/students/enums";
import type { StudentDetail } from "@/modules/students/queries";
import { StudentPaymentPanel } from "@/modules/treasury/components/student-payment-panel";
import type {
  BankOption,
  FamilyStanding,
  PayableFamily,
  PaymentsPage,
  PaymentStanding,
} from "@/modules/treasury/queries";
import {
  PAYMENT_STATE_STYLES,
  standingStateOf,
} from "@/modules/treasury/payment-state";
import { TransportPanel } from "@/modules/transport/components/transport-panel";
import type { NeighbourhoodOption } from "@/modules/geography/queries";
import type {
  NeighbourhoodChoice,
  RiderRow,
} from "@/modules/transport/queries";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import type { TimetableChoices } from "@/modules/timetable/components/timetable-grid";
import type { TimetableGrid as TimetableGridData } from "@/modules/timetable/queries";

/**
 * A pupil's whole file, in six tabs.
 *
 * Each tab is rendered by the module that owns what is in it — enrolment owns
 * the inscription and the fees, treasury owns what has been paid against them,
 * timetable owns the week, families owns the guardians. The profile only decides
 * the order, which is the order the parcours actually runs in.
 *
 * Money is two tabs, not one. *Frais* is what the year costs — a grid somebody
 * sets up once at enrolment and rarely reopens. *Paiement* is where the family
 * stands against it, which is the question asked at the desk every day. They
 * were one tab and the daily question was buried under the annual one.
 *
 * The timetable is read-only here: a pupil's week is their class's week, and
 * editing it from one child's screen would silently move a lesson for thirty
 * others.
 */
export function StudentProfile({
  student,
  family,
  guardians,
  families,
  cities,
  neighbourhoods,
  enrolment,
  offerings,
  startMonths,
  yearName,
  feeGrid,
  discounts,
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
  hasOpenSession,
  transportChoices,
  transportSubscriptions,
  workflow,
  workflowSteps,
  dossier,
  permissions,
}: {
  student: StudentDetail;
  family: {
    id: string;
    name: string;
    code: string;
    situation: string;
    phone: string | null;
  } | null;
  guardians: GuardianRow[];
  families: { id: string; label: string }[];
  /** The school's towns, for the birthplace picker on the information tab. */
  cities: { id: string; label: string }[];
  /** Its quartiers, for the address picker beside it. */
  neighbourhoods: NeighbourhoodOption[];
  enrolment: EnrolmentDetail | null;
  offerings: OfferingChoice[];
  startMonths: StartMonthChoice[];
  yearName: string | null;
  feeGrid: FeeGridData | null;
  discounts: {
    id: string;
    code: string;
    name: string;
    kind: string;
    percentBps: number | null;
    amountCentimes: number | null;
  }[];
  timetable: TimetableGridData | null;
  timetableChoices: TimetableChoices | null;
  /** Null when the viewer may not see money — see the page. */
  standing: PaymentStanding | null;
  /** The rest of the household, for the fratrie switch on the payment tab. */
  familyStanding: FamilyStanding | null;
  /** Receipts already taken against this pupil. Empty when money is hidden. */
  payments: PaymentsPage;
  /**
   * The three below all hang off the enrolment: null when the child has no
   * place this year, and there is nothing to show rather than an empty tab.
   */
  attendance: PupilAttendance | null;
  marks: PupilMarks | null;
  /** Null when the reader may not see bulletins — a separate grant from marks. */
  bulletins: BulletinRow[] | null;
  remarks: PupilRemarkRow[] | null;
  /**
   * The bus. Null when the viewer may not see transport at all — the tab is
   * absent rather than empty, like the money tabs above.
   */
  transportChoices: NeighbourhoodChoice[] | null;
  transportSubscriptions: RiderRow[];
  /** The household's payable schedule, so the till renders on the payment tab. */
  payable: PayableFamily | null;
  banks: BankOption[];
  hasOpenSession: boolean;
  workflow: Record<StudentWorkflowStep, boolean>;
  /** Narrowed by the page when the reader may not see money. */
  workflowSteps: readonly StudentWorkflowStep[];
  /** The pièces d'inscription. Null when the reader may not see the dossier. */
  dossier: StudentDossier | null;
  permissions: {
    canUpdateStudent: boolean;
    canManageFamily: boolean;
    canCreateEnrolment: boolean;
    canUpdateEnrolment: boolean;
    canDeleteEnrolment: boolean;
    canManageFees: boolean;
    canCollect: boolean;
    canCancelPayment: boolean;
    canSubscribeTransport: boolean;
    canManageDocuments: boolean;
  };
}) {
  const t = useT();
  const [tab, setTab] = React.useState("information");

  /**
   * The bus tab appears once the family has actually taken the bus.
   *
   * Transport is an *option of the inscription* — it is the switch on the
   * enrolment that decides whether it is billed at all — so offering a whole tab
   * of circuits and stops to every walker in the school put a decision in two
   * places and let a secretary seat a child on a line the family was never
   * charged for. Now the tab follows the option, and the option is asked once,
   * where the money is.
   *
   * A pupil who already has an abonnement keeps the tab whatever the flag says.
   * That combination should not arise — `syncTransportOption` sets the flag when
   * a rider is seated — but if it ever does, hiding the tab would strand a child
   * on a bus with no screen to take them off it.
   */
  const showTransport =
    transportChoices !== null &&
    ((enrolment?.usesTransport ?? false) || transportSubscriptions.length > 0);

  return (
    <>
      {/* Who, then how far along, then the file itself. The two bands are read
        in that order at the desk and are laid out in it. */}
      <div className="mb-4 space-y-3">
        <StudentSummary student={student} family={family} />

        <StudentWorkflow
          state={workflow}
          steps={workflowSteps}
          onStepSelect={(step) => setTab(TAB_FOR_STEP[step])}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="information">
            {t.student.tabInformation}
          </TabsTrigger>
          <TabsTrigger value="family">
            {t.student.tabFamily}
            {guardians.length > 0 ? (
              <Badge variant="secondary" className="ms-1.5 tabular-nums">
                {guardians.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          {/* Absent rather than empty when the reader may not see the dossier,
            like the money tabs below. */}
          {dossier ? (
            <TabsTrigger value="dossier">
              {t.document.dossier}
              {dossier.standing.missingRequired > 0 ? (
                <Badge variant="destructive" className="ms-1.5 tabular-nums">
                  {dossier.standing.missingRequired}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="enrolment">{t.student.tabEnrolment}</TabsTrigger>
          <TabsTrigger value="fees">
            {t.student.tabFees}
            {enrolment && enrolment.feeLineCount > 0 ? (
              <Badge variant="secondary" className="ms-1.5 tabular-nums">
                {enrolment.feeLineCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          {/* Absent, not disabled, when the reader may not see money: a greyed-out
            tab still tells a teacher the family is behind on something. */}
          {standing ? (
            <TabsTrigger value="payment">
              {t.student.tabPayment}
              {standing.totalLines > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "ms-1.5 size-2 rounded-full",
                    PAYMENT_STATE_STYLES[standingStateOf(standing)].bar,
                  )}
                />
              ) : null}
            </TabsTrigger>
          ) : null}
          {/* The three below all hang off the enrolment, so they appear together
            or not at all — a pupil with no place this year has no register, no
            marks and no carnet. */}
          {attendance ? (
            <TabsTrigger value="attendance">
              {t.student.tabAttendance}
              {attendance.unjustifiedAbsences > 0 ? (
                <Badge variant="destructive" className="ms-1.5 tabular-nums">
                  {attendance.unjustifiedAbsences}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          {marks ? (
            <TabsTrigger value="marks">
              {t.student.tabMarks}
              {marks.overall !== null ? (
                <Badge variant="secondary" className="ms-1.5 tabular-nums">
                  {marks.overall}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          {remarks ? (
            <TabsTrigger value="remarks">
              {t.student.tabRemarks}
              {remarks.length > 0 ? (
                <Badge variant="secondary" className="ms-1.5 tabular-nums">
                  {remarks.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          {/* Absent when the reader may not see transport, and absent again
            when the family has not taken it — see `showTransport`. */}
          {showTransport ? (
            <TabsTrigger value="transport">
              {t.transport.tabTransport}
              {transportSubscriptions.length > 0 ? (
                <Badge variant="secondary" className="ms-1.5 tabular-nums">
                  {transportSubscriptions.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="timetable">{t.student.tabTimetable}</TabsTrigger>
        </TabsList>

        <TabsContent value="information">
          <StudentForm
            student={student}
            families={families}
            cities={cities}
            neighbourhoods={neighbourhoods}
          />
        </TabsContent>

        <TabsContent value="family">
          <StudentFamilyPanel
            studentId={student.id}
            family={family}
            guardians={guardians}
            families={families}
            canManage={permissions.canManageFamily}
          />
        </TabsContent>

        {dossier ? (
          <TabsContent value="dossier">
            <StudentDossierPanel
              studentId={student.id}
              dossier={dossier}
              canManage={permissions.canManageDocuments}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="enrolment">
          <EnrolmentPanel
            studentId={student.id}
            enrolment={enrolment}
            offerings={offerings}
            startMonths={startMonths}
            yearName={yearName}
            permissions={{
              canCreate: permissions.canCreateEnrolment,
              canUpdate: permissions.canUpdateEnrolment,
              canDelete: permissions.canDeleteEnrolment,
            }}
          />
        </TabsContent>

        <TabsContent value="fees">
          {enrolment && feeGrid ? (
            <FeeGrid
              grid={feeGrid}
              enrollmentId={enrolment.id}
              discounts={discounts}
              canManage={permissions.canManageFees}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  title={t.enrolment.notEnrolled}
                  description={t.enrolment.notEnrolledHint}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {standing ? (
          <TabsContent value="payment">
            <StudentPaymentPanel
              standing={standing}
              family={familyStanding}
              familyId={student.familyId}
              canCollect={permissions.canCollect}
              canCancel={permissions.canCancelPayment}
              payments={payments}
              payable={payable}
              banks={banks}
              hasOpenSession={hasOpenSession}
            />
          </TabsContent>
        ) : null}

        {attendance ? (
          <TabsContent value="attendance">
            <PupilAttendancePanel attendance={attendance} />
          </TabsContent>
        ) : null}

        {marks ? (
          <TabsContent value="marks" className="grid gap-4">
            {/* What the school decided the term came to, above every paper
              that went into it. Two questions, in the order they are asked. */}
            {bulletins ? (
              <PupilBulletins bulletins={bulletins} studentId={student.id} />
            ) : null}
            <PupilMarksPanel marks={marks} />
          </TabsContent>
        ) : null}

        {remarks ? (
          <TabsContent value="remarks">
            <PupilRemarksPanel remarks={remarks} />
          </TabsContent>
        ) : null}

        {showTransport && transportChoices ? (
          <TabsContent value="transport">
            <TransportPanel
              enrolmentId={enrolment?.id ?? null}
              neighbourhoods={transportChoices}
              subscriptions={transportSubscriptions}
              // The address already on the pupil's file, so the cascade opens on
              // the quartier the secretary typed on the information tab rather
              // than asking for it a second time.
              defaultNeighbourhoodId={student.neighbourhoodId}
              canSubscribe={permissions.canSubscribeTransport}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="timetable">
          {timetable && timetableChoices && enrolment?.schoolClassId ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/classes/${enrolment.schoolClassId}`}>
                    {enrolment.className}
                  </Link>
                </Button>
                {/* The pupil's week *is* their class's week, so this prints the
                  class sheet rather than a per-child copy of the same grid. */}
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/print/class/${enrolment.schoolClassId}/timetable`}
                  >
                    <PrinterIcon />
                    {t.print.timetable}
                  </Link>
                </Button>
              </div>
              <TimetableGrid
                grid={timetable}
                schoolClassId={enrolment.schoolClassId}
                choices={timetableChoices}
                // Read-only on purpose — see the note above.
                canManage={false}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={<CalendarXIcon className="size-5" />}
                  title={t.student.notPlaced}
                  description={t.enrolment.classHint}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Which tab resolves each step of the parcours.
 *
 * CLASS points at the enrolment tab rather than at one of its own: a pupil is
 * seated by editing their inscription, so that is where somebody sent to "fix
 * the class" has to end up.
 */
const TAB_FOR_STEP: Record<StudentWorkflowStep, string> = {
  FILE: "information",
  FAMILY: "family",
  DOSSIER: "dossier",
  ENROLMENT: "enrolment",
  CLASS: "enrolment",
  FEES: "fees",
  PAYMENT: "payment",
};
