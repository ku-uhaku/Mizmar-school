"use client";

import Link from "next/link";
import { CalendarXIcon } from "lucide-react";

import { useT } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GuardianRow } from "@/modules/families/queries";
import { EnrolmentPanel } from "@/modules/enrolment/components/enrolment-panel";
import type { OfferingChoice } from "@/modules/enrolment/components/enrolment-panel";
import { FeeGrid } from "@/modules/enrolment/components/fee-grid";
import type {
  EnrolmentDetail,
  FeeGrid as FeeGridData,
} from "@/modules/enrolment/queries";
import { StudentForm } from "@/modules/students/components/student-form";
import { StudentFamilyPanel } from "@/modules/students/components/student-family-panel";
import type { StudentDetail } from "@/modules/students/queries";
import { StudentPaymentPanel } from "@/modules/treasury/components/student-payment-panel";
import type { PaymentStanding } from "@/modules/treasury/queries";
import { TimetableGrid } from "@/modules/timetable/components/timetable-grid";
import type { TimetableChoices } from "@/modules/timetable/components/timetable-grid";
import type { TimetableGrid as TimetableGridData } from "@/modules/timetable/queries";

/**
 * A pupil's whole file, in five tabs.
 *
 * Each tab is rendered by the module that owns what is in it — enrolment owns
 * the inscription and the fees, timetable owns the week, families owns the
 * guardians. The profile only decides the order, which is the order the parcours
 * actually runs in.
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
  enrolment,
  offerings,
  yearName,
  feeGrid,
  discounts,
  timetable,
  timetableChoices,
  standing,
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
  enrolment: EnrolmentDetail | null;
  offerings: OfferingChoice[];
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
  permissions: {
    canUpdateStudent: boolean;
    canManageFamily: boolean;
    canCreateEnrolment: boolean;
    canUpdateEnrolment: boolean;
    canDeleteEnrolment: boolean;
    canManageFees: boolean;
    canCollect: boolean;
  };
}) {
  const t = useT();

  return (
    <Tabs defaultValue="information">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="information">{t.student.tabInformation}</TabsTrigger>
        <TabsTrigger value="family">
          {t.student.tabFamily}
          {guardians.length > 0 ? (
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {guardians.length}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="enrolment">{t.student.tabEnrolment}</TabsTrigger>
        <TabsTrigger value="fees">
          {t.student.tabFees}
          {enrolment && enrolment.feeLineCount > 0 ? (
            <Badge variant="secondary" className="ms-1.5 tabular-nums">
              {enrolment.feeLineCount}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="timetable">{t.student.tabTimetable}</TabsTrigger>
      </TabsList>

      <TabsContent value="information">
        <StudentForm student={student} families={families} />
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

      <TabsContent value="enrolment">
        <EnrolmentPanel
          studentId={student.id}
          enrolment={enrolment}
          offerings={offerings}
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
          <div className="space-y-4">
            {/* What is owed sits above what is charged: the first question at
                the desk is "où en sont-ils ?", not "combien coûte l'année ?". */}
            {standing ? (
              <StudentPaymentPanel
                standing={standing}
                familyId={student.familyId}
                canCollect={permissions.canCollect}
              />
            ) : null}
            <FeeGrid
              grid={feeGrid}
              enrollmentId={enrolment.id}
              discounts={discounts}
              canManage={permissions.canManageFees}
            />
          </div>
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

      <TabsContent value="timetable">
        {timetable && timetableChoices && enrolment?.schoolClassId ? (
          <div className="space-y-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/classes/${enrolment.schoolClassId}`}>
                {enrolment.className}
              </Link>
            </Button>
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
  );
}
