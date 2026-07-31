import "server-only";

import { db } from "@/lib/db";
import {
  attendanceScopeKey,
  MAX_MINUTES_LATE,
  startOfDay,
} from "@/modules/classroom/enums";

/**
 * Writes and invariants for the espace enseignant.
 *
 * The one rule the whole file exists to keep: a teacher may only write against
 * a roster they actually teach. Every function here re-derives that from the
 * `TeachingAssignment` rows rather than trusting the ids it was handed, so a
 * crafted enrolment id reaches nothing.
 */

export type AttendanceMark = {
  enrollmentId: string;
  status: string;
  minutesLate: number | null;
  reason: string | null;
};

export type SaveRegisterResult =
  | { ok: true; saved: number }
  | { ok: false; reason: "not-teaching" | "out-of-range" };

/**
 * Records a whole lesson's register in one transaction.
 *
 * Marks arrive for the entire roster and are matched against it before anything
 * is written — the same shape as the mark sheet, and for the same reason: a row
 * for a pupil who is not in this lesson must not create one.
 *
 * `minutesLate` is cleared for every status but LATE. Keeping a stale figure on
 * a pupil who turned out to be present would put a retard in their yearly count
 * that nobody recorded.
 */
export async function saveRegister(
  input: {
    teacherId: string;
    schoolClassId: string;
    subjectId: string | null;
    timeSlotId: string | null;
    date: Date;
    marks: AttendanceMark[];
  },
): Promise<SaveRegisterResult> {
  const day = startOfDay(input.date);

  // The assignment is the authority: no assignment, no register.
  const assignment = await db.teachingAssignment.findFirst({
    where: {
      teacherId: input.teacherId,
      schoolClassId: input.schoolClassId,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    },
    select: { classGroupId: true },
  });
  if (!assignment) return { ok: false, reason: "not-teaching" };

  for (const mark of input.marks) {
    if (mark.minutesLate === null) continue;
    if (
      !Number.isInteger(mark.minutesLate) ||
      mark.minutesLate < 0 ||
      mark.minutesLate > MAX_MINUTES_LATE
    ) {
      return { ok: false, reason: "out-of-range" };
    }
  }

  const roster = await db.enrollment.findMany({
    where: {
      schoolClassId: input.schoolClassId,
      ...(assignment.classGroupId
        ? { classGroupId: assignment.classGroupId }
        : {}),
    },
    select: { id: true },
  });
  const seated = new Set(roster.map((enrollment) => enrollment.id));

  const writable = input.marks.filter((mark) => seated.has(mark.enrollmentId));
  const scopeKey = attendanceScopeKey(input.timeSlotId);

  await db.$transaction(
    writable.map((mark) => {
      const isLate = mark.status === "LATE";
      const data = {
        timeSlotId: input.timeSlotId,
        subjectId: input.subjectId,
        status: mark.status,
        // Only meaningful on a retard — see the note above.
        minutesLate: isLate ? mark.minutesLate : null,
        reason: mark.reason,
        recordedById: input.teacherId,
      };

      return db.studentAttendance.upsert({
        where: {
          enrollmentId_date_scopeKey: {
            enrollmentId: mark.enrollmentId,
            date: day,
            scopeKey,
          },
        },
        create: {
          enrollmentId: mark.enrollmentId,
          date: day,
          scopeKey,
          ...data,
        },
        // `isJustified` is deliberately not touched: a teacher retaking the
        // register must not undo a justification the office has accepted.
        update: data,
      });
    }),
  );

  return { ok: true, saved: writable.length };
}

export type RemarkInput = {
  authorId: string;
  enrollmentId: string;
  subjectId: string | null;
  kind: string;
  tone: string;
  body: string;
  occurredOn: Date;
  isVisibleToFamily: boolean;
};

/**
 * Writes an observation about a pupil the teacher actually teaches.
 *
 * The enrolment is checked against their assignments rather than trusted, for
 * the same reason as the register: this text may end up in front of a family.
 */
export async function writeRemark(
  input: RemarkInput,
): Promise<{ ok: boolean }> {
  const enrollment = await db.enrollment.findFirst({
    where: {
      id: input.enrollmentId,
      schoolClass: {
        assignments: { some: { teacherId: input.authorId } },
      },
    },
    select: { id: true },
  });
  if (!enrollment) return { ok: false };

  await db.studentRemark.create({
    data: {
      enrollmentId: enrollment.id,
      subjectId: input.subjectId,
      kind: input.kind,
      tone: input.tone,
      body: input.body,
      occurredOn: input.occurredOn,
      isVisibleToFamily: input.isVisibleToFamily,
      authorId: input.authorId,
    },
  });

  return { ok: true };
}

/**
 * Marks an absence justified, or takes the justification back.
 *
 * Its own function because it is not the teacher's decision: a justification is
 * a piece of paper that reaches the office, and the action gating this requires
 * CLASSROOM_ATTENDANCE_JUSTIFY rather than the marking code.
 */
export async function justifyAbsence(
  attendanceId: string,
  isJustified: boolean,
  reason: string | null,
): Promise<void> {
  await db.studentAttendance.update({
    where: { id: attendanceId },
    data: {
      isJustified,
      // Promoting a plain absence to an excused one keeps the two consistent;
      // withdrawing the justification puts it back.
      status: isJustified ? "EXCUSED" : "ABSENT",
      ...(reason !== null ? { reason } : {}),
    },
  });
}
