import type { Metadata } from "next";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { TeacherAvailability } from "@/modules/timetable/components/teacher-availability";
import { TeacherPicker } from "@/modules/timetable/components/teacher-picker";
import {
  listTeacherOptions,
  loadTeacherAvailability,
} from "@/modules/timetable/queries";

export const metadata: Metadata = { title: "Horaires des enseignants" };

/**
 * Who works when — the standing arrangement the generator plans around.
 *
 * A page of its own rather than a tab on the grid: it is set once at the
 * rentrée and revisited when a contract changes, which is a different rhythm
 * from the week-by-week editing next door. Thin by the usual rule — it
 * authorizes, calls the module's reads and renders.
 */
export default async function TeacherAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string; schedule?: string }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.TIMETABLE_VIEW)) {
    return <ForbiddenState />;
  }

  const { teacherId, schedule } = await searchParams;
  const scheduleKind = schedule === "RAMADAN" ? "RAMADAN" : "STANDARD";

  const teachers = await listTeacherOptions(context, scheduleKind);

  if (teachers.length === 0) {
    return (
      <>
        <PageHeader
          title={t.timetable.availabilityTitle}
          description={t.timetable.availabilitySubtitle}
          backHref="/timetable"
          backLabel={t.timetable.title}
        />
        <Card>
          <CardContent className="p-0">
            <EmptyState title={t.timetable.noTeachers} />
          </CardContent>
        </Card>
      </>
    );
  }

  // A teacher id from the query is only a hint: `loadTeacherAvailability` scopes
  // it to the school in context, so one from elsewhere falls back here rather
  // than showing another school's staff.
  const selected =
    teachers.find((teacher) => teacher.id === teacherId) ?? teachers[0];
  const grid = await loadTeacherAvailability(
    context,
    selected.id,
    scheduleKind,
  );

  return (
    <>
      <PageHeader
        title={t.timetable.availabilityTitle}
        description={t.timetable.availabilitySubtitle}
        backHref="/timetable"
        backLabel={t.timetable.title}
      />

      <TeacherPicker
        teachers={teachers}
        teacherId={selected.id}
        scheduleKind={scheduleKind}
      />

      {grid && grid.totalPeriods > 0 ? (
        <TeacherAvailability
          // Remounts when either changes, so the grid's state is rebuilt from
          // the new week rather than resynchronised in an effect.
          key={`${selected.id}:${scheduleKind}`}
          teacherId={selected.id}
          teacherName={selected.label}
          scheduleKind={scheduleKind}
          grid={grid}
          canManage={context.can(PERMISSIONS.TIMETABLE_MANAGE)}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={t.timetable.noSlots}
              description={t.timetable.noSlotsHint}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
