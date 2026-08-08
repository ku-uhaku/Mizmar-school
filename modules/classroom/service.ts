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
 *
 * ── `actsForSchool`, and why it is not a hole ────────────────────────────────
 * Anything a teacher may do, the office may do too — a director covering an
 * absent colleague still has to take the register, and telling them to go and
 * assign themselves to the class first is ceremony that ends with a fake
 * assignment left behind. So each write takes `actsForSchool`, decided in the
 * action from the *office-side* permission of its pair
 * (`classroom.attendanceJustify`, `classroom.remarkPublish`) — codes whose doc
 * comments already say they are an office decision and not a teacher's.
 *
 * It relaxes *which roster*, never *which school*: with it set, the class is
 * re-derived from `schoolId` instead of from an assignment, and `schoolId` is
 * always the working context, never the request. A user without the office code
 * is confined to their own classes exactly as before.
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
    schoolId: string;
    schoolClassId: string;
    subjectId: string | null;
    timeSlotId: string | null;
    date: Date;
    marks: AttendanceMark[];
    /** See the note at the top of this file. */
    actsForSchool: boolean;
  },
): Promise<SaveRegisterResult> {
  const day = startOfDay(input.date);

  let classGroupId: string | null = null;

  if (input.actsForSchool) {
    // The school is the authority instead of the assignment — but it *is* an
    // authority: a class in another school still reaches nothing.
    const schoolClass = await db.schoolClass.findFirst({
      where: { id: input.schoolClassId, schoolId: input.schoolId },
      select: { id: true },
    });
    if (!schoolClass) return { ok: false, reason: "not-teaching" };
    // Whole class, not a half: somebody standing in has no group of their own,
    // and guessing one would silently leave half the register unmarked.
    classGroupId = null;
  } else {
    // The assignment is the authority: no assignment, no register.
    const assignment = await db.teachingAssignment.findFirst({
      where: {
        teacherId: input.teacherId,
        schoolClassId: input.schoolClassId,
        schoolClass: { schoolId: input.schoolId },
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      },
      select: { classGroupId: true },
    });
    if (!assignment) return { ok: false, reason: "not-teaching" };
    classGroupId = assignment.classGroupId;
  }

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
      ...(classGroupId ? { classGroupId } : {}),
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
  schoolId: string;
  /** See the note at the top of this file. */
  actsForSchool: boolean;
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
        schoolId: input.schoolId,
        // The office writes about any pupil of the school; a teacher only about
        // the ones they teach.
        ...(input.actsForSchool
          ? {}
          : { assignments: { some: { teacherId: input.authorId } } }),
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
  /**
   * What the row says now. Taken from the caller's own scoped lookup rather
   * than re-read here, and load-bearing: the status this writes depends on it.
   */
  currentStatus: string,
  isJustified: boolean,
  reason: string | null,
): Promise<void> {
  await db.studentAttendance.update({
    where: { id: attendanceId },
    data: {
      isJustified,
      /*
        Promoting a plain absence to an excused one keeps the two consistent;
        withdrawing the justification puts it back.

        A retard keeps its own status. This used to rewrite every row it touched
        as EXCUSED or ABSENT, which turned a justified late into an absence — and
        a school counts lates by accumulation, so erasing one erases the third
        retard that was about to be written home about. The pupil's file has
        always counted unjustified lates separately; the write simply did not
        know about them.
      */
      ...(currentStatus === "LATE"
        ? {}
        : { status: isJustified ? "EXCUSED" : "ABSENT" }),
      ...(reason !== null ? { reason } : {}),
    },
  });
}
