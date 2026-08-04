import type { Metadata } from "next";

import { EmptyState } from "@/components/shell/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ForbiddenState } from "@/components/shell/states";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { clampToSchoolYear } from "@/lib/school-year";
import { toDateInputValue } from "@/lib/utils";
import { LessonPicker } from "@/modules/classroom/components/lesson-picker";
import { RegisterSheet } from "@/modules/classroom/components/register-sheet";
import { lessonAt, startOfDay } from "@/modules/classroom/enums";
import {
  findRegister,
  listMyLessons,
  listMyTeaching,
} from "@/modules/classroom/queries";

export const metadata: Metadata = { title: "Appel" };

/**
 * Taking one lesson's register.
 *
 * The class, subject, day and period all travel in the query string: the roster
 * is a permission-scoped server read, so keeping the choice in the address means
 * a reload lands on the same register. All four are only ever *hints* —
 * `findRegister` resolves them against the teacher's own assignments, so one
 * from elsewhere simply comes back null.
 */
export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    class?: string;
    subject?: string;
    slot?: string;
    date?: string;
  }>;
}) {
  const context = await requireAuth();
  const t = await getDictionary();

  if (!context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_VIEW)) {
    return <ForbiddenState />;
  }

  const params = await searchParams;
  const now = new Date();
  // A date the user asked for is honoured as typed; only the *default* is
  // clamped into the year, so the register never opens on a day in August that
  // the school year does not contain. See lib/school-year.ts.
  const defaultDay = clampToSchoolYear(now, context.currentSchoolYear);
  const requested = params.date ? new Date(params.date) : defaultDay;
  const day = Number.isNaN(requested.getTime())
    ? startOfDay(defaultDay)
    : startOfDay(requested);

  const [teaching, lessons] = await Promise.all([
    listMyTeaching(context),
    listMyLessons(context, day),
  ]);

  // Nothing chosen yet, so the clock chooses: the teacher is standing in front
  // of a class and means that one. A click — the "prendre l'appel" links on
  // /teacher, or the picker below — travels in the query string and always
  // wins, which is why this is skipped the moment `class` is present.
  //
  // On another day there is no "now" to read, so it asks the same question at
  // midnight, which answers with that day's first lesson.
  const chosen = params.class
    ? null
    : lessonAt(lessons, day.getTime() === startOfDay(now).getTime() ? now : day);

  // Only when the timetable offers nothing at all — a teacher with no lessons
  // that day — does it fall back to the first class they teach, so the screen
  // is never empty for somebody who has simply not chosen yet.
  const fallback = teaching[0] ?? null;
  const schoolClassId =
    params.class ?? chosen?.schoolClassId ?? fallback?.schoolClassId ?? null;
  const subjectId =
    params.subject ?? chosen?.subjectId ?? fallback?.subjectId ?? null;
  // The period comes with the lesson: defaulting to the whole day would mark a
  // pupil present for a morning the teacher only had them for one hour of.
  const timeSlotId = params.slot ?? chosen?.timeSlotId ?? null;

  const register = schoolClassId
    ? await findRegister(context, {
        schoolClassId,
        subjectId,
        timeSlotId,
        date: day,
      })
    : null;

  return (
    <>
      <PageHeader
        title={t.classroom.attendance}
        description={t.classroom.pickLessonHint}
        backHref="/teacher"
        backLabel={t.classroom.title}
      />

      {teaching.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={t.classroom.noClasses}
              description={t.classroom.noClassesHint}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <LessonPicker
            teaching={teaching}
            lessons={lessons}
            selected={{
              schoolClassId,
              subjectId,
              timeSlotId,
              date: toDateInputValue(day),
            }}
          />

          {register ? (
            <RegisterSheet
              register={register}
              canMark={context.can(PERMISSIONS.CLASSROOM_ATTENDANCE_MARK)}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  title={t.classroom.notYourClass}
                  description={t.classroom.pickLessonHint}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
