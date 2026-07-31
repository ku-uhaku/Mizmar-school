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
import { ClassDetail } from "@/modules/classes/components/class-detail";
import { findClass } from "@/modules/classes/queries";
import { listUnassignedStudents } from "@/modules/students/queries";
import {
  loadClassTimetable,
  loadTimetableChoices,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Classe" };

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
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

  // Each module answers for its own half of the screen: who may be seated comes
  // from students, the week from timetable.
  const [candidates, timetable, timetableChoices] = await Promise.all([
    listUnassignedStudents(context, schoolClass.levelOfferingId),
    loadClassTimetable(context, schoolClass.id),
    loadTimetableChoices(context, schoolClass.id),
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
        timetable={timetable}
        timetableChoices={timetableChoices}
        permissions={{
          canRoster:
            context.can(PERMISSIONS.CLASS_ROSTER) &&
            context.can(PERMISSIONS.ENROLMENT_UPDATE),
          canAssignTeacher: context.can(PERMISSIONS.CLASS_ASSIGN_TEACHER),
          canManageTimetable: context.can(PERMISSIONS.TIMETABLE_MANAGE),
        }}
      />
    </>
  );
}
