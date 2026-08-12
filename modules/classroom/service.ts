import "server-only";

import { displayName } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import {
  attendanceScopeKey,
  MAX_MINUTES_LATE,
  startOfDay,
} from "@/modules/classroom/enums";
import { dedupeKeyFor } from "@/modules/notifications/enums";
import {
  dispatch,
  guardiansOfStudent,
  notify,
  staffHolding,
} from "@/modules/notifications/service";

/**
 * The register statuses a family is told about.
 *
 * EXCUSED is deliberately absent: the school has already accepted a reason for
 * that one, so the parent is the person who *supplied* it and does not need
 * telling. Notifying on it would train families to ignore the ones that matter.
 */
const NOTIFIED_STATUSES: readonly string[] = ["ABSENT", "LATE"];

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

  await dispatch("ATTENDANCE_MISSED", () =>
    tellTheFamiliesWhoWereMissed({
      schoolId: input.schoolId,
      subjectId: input.subjectId,
      day,
      scopeKey,
      marks: writable,
    }),
  );

  await dispatch("REGISTER_ABSENCES", () =>
    tellTheOfficeAboutAbsences({
      schoolId: input.schoolId,
      schoolClassId: input.schoolClassId,
      day,
      marks: writable,
      recordedById: input.teacherId,
    }),
  );

  return { ok: true, saved: writable.length };
}

/**
 * Tells the office a class has somebody missing today.
 *
 * ── One line per class per day, not per lesson ──────────────────────────────
 * This is the notification in the app most at risk of being noise, and the
 * dedupe key is what stops it. A secondary school takes six registers a day per
 * class; keyed per *register* the direction would arrive to thirty lines every
 * morning and would stop reading the bell inside a week — which would cost them
 * the paper waiting at the desk and the bus register too.
 *
 * So the key is the class and the day. The first register that records an
 * absence raises the line; the rest of that day's lessons add nothing, and
 * re-taking a register cannot repeat it. The line is a pointer — "3AP-A has
 * absences today" — and the screen behind it is the record.
 *
 * Only ABSENT counts. EXCUSED is an absence the school has already accepted a
 * reason for, and the recipients here are exactly the people who accept them
 * (`CLASSROOM_ATTENDANCE_JUSTIFY`) — telling them about their own decision is
 * the same mistake the remark notification avoids.
 */
async function tellTheOfficeAboutAbsences(input: {
  schoolId: string;
  schoolClassId: string;
  day: Date;
  marks: AttendanceMark[];
  recordedById: string;
}): Promise<void> {
  const absent = input.marks.filter((mark) => mark.status === "ABSENT");
  if (absent.length === 0) return;

  const schoolClass = await db.schoolClass.findFirst({
    where: { id: input.schoolClassId, schoolId: input.schoolId },
    select: { code: true, school: { select: { organizationId: true } } },
  });
  if (!schoolClass) return;

  const organizationId = schoolClass.school.organizationId;

  const targets = (
    await staffHolding(
      organizationId,
      input.schoolId,
      PERMISSIONS.CLASSROOM_ATTENDANCE_JUSTIFY,
    )
    // Not the person who just took the register — they know.
  ).filter((target) => target.userId !== input.recordedById);

  await notify({
    organizationId,
    schoolId: input.schoolId,
    kind: "REGISTER_ABSENCES",
    subjectId: input.schoolClassId,
    dedupeOn: input.day.toISOString(),
    params: {
      className: schoolClass.code,
      count: absent.length,
      date: input.day.toISOString(),
    },
    targets,
  });
}

/**
 * L'appel, as the family reads it.
 *
 * ── Why this is the one worth having ────────────────────────────────────────
 * Everything else in this module reaches a parent eventually — a mark on the
 * bulletin, a remark at the meeting. An absence is the one fact that is only
 * useful *today*: a parent who learns on Friday that their child was not in
 * Tuesday's lesson has lost the week in which they could have done anything
 * about it, and that is exactly the gap schools ask for this feature to close.
 *
 * ── And why marking somebody present unsends it ─────────────────────────────
 * A register is retaken. A pupil marked absent at five past, who walks in at
 * ten past and is corrected to present, must not leave a line on a phone saying
 * they missed the lesson — the school would spend the evening on the telephone
 * explaining a message it did not mean to send. So a correction away from
 * ABSENT/LATE deletes the notification, but only while it is *unread*: once a
 * parent has seen it, silently removing it would be the school editing what it
 * has already said, and the honest repair is the teacher ringing them.
 */
async function tellTheFamiliesWhoWereMissed(input: {
  schoolId: string;
  subjectId: string | null;
  day: Date;
  scopeKey: string;
  marks: AttendanceMark[];
}): Promise<void> {
  const missed = input.marks.filter((mark) => NOTIFIED_STATUSES.includes(mark.status));
  const corrected = input.marks.filter(
    (mark) => !NOTIFIED_STATUSES.includes(mark.status),
  );

  // Built through the module's own helper, never spelled out here: the delete
  // below and the write further down have to agree on the key exactly, and two
  // hand-written copies of a format string are two chances to disagree.
  const discriminator = `${input.day.toISOString()}:${input.scopeKey}`;
  const keyFor = (enrollmentId: string) =>
    dedupeKeyFor("ATTENDANCE_MISSED", enrollmentId, discriminator) ?? "";

  if (corrected.length > 0) {
    await db.notification.deleteMany({
      where: {
        dedupeKey: { in: corrected.map((mark) => keyFor(mark.enrollmentId)) },
        readAt: null,
      },
    });
  }

  if (missed.length === 0) return;

  const enrolments = await db.enrollment.findMany({
    where: { id: { in: missed.map((mark) => mark.enrollmentId) } },
    select: {
      id: true,
      studentId: true,
      student: { select: { school: { select: { organizationId: true } } } },
    },
  });

  const statusOf = new Map(
    missed.map((mark) => [mark.enrollmentId, mark.status]),
  );

  // One notify per pupil rather than one for the class: the dedupe key is the
  // pupil's own register row, and the status differs between them.
  await Promise.all(
    enrolments.map(async (enrolment) =>
      notify({
        organizationId: enrolment.student.school.organizationId,
        schoolId: input.schoolId,
        kind: "ATTENDANCE_MISSED",
        subjectId: enrolment.id,
        dedupeOn: discriminator,
        params: {
          status: statusOf.get(enrolment.id),
          date: input.day.toISOString(),
        },
        targets: await guardiansOfStudent(enrolment.studentId),
      }),
    ),
  );
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

  const remark = await db.studentRemark.create({
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
    select: { id: true },
  });

  /*
    ── Only the ones still waiting on a decision ────────────────────────────
    A remark written by a teacher is internal until the office releases it, and
    that release is a decision somebody has to make — see `setRemarkVisibility`.
    Until now the office found out by going to look, which is the same
    queue-nobody-opens gap `REQUEST_FILED` closes.

    But a remark the author *already* published — the office writing one under
    their own name, which is what `isVisibleToFamily` true means here — has no
    decision pending. Notifying on those would tell the direction about their
    own action, which is the fastest way to teach somebody to ignore a bell.
  */
  if (!input.isVisibleToFamily) {
    await dispatch("REMARK_WRITTEN", () =>
      tellTheOfficeAboutRemark(remark.id, input.schoolId, input.authorId),
    );
  }

  return { ok: true };
}

/**
 * Puts a teacher's observation in front of whoever may release it.
 *
 * Wordless about what it says, exactly as `REMARK_SHARED` is and for a related
 * reason: this one names a child and the colleague who wrote about them, and
 * the text is a judgement that belongs on the screen where it can be read in
 * full and acted on, not in a line on a lock screen.
 */
async function tellTheOfficeAboutRemark(
  remarkId: string,
  schoolId: string,
  authorId: string,
): Promise<void> {
  const remark = await db.studentRemark.findFirst({
    where: { id: remarkId, enrollment: { student: { schoolId } } },
    select: {
      id: true,
      enrollment: {
        select: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              school: { select: { organizationId: true } },
            },
          },
        },
      },
      author: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!remark) return;

  const student = remark.enrollment.student;
  const organizationId = student.school.organizationId;

  const targets = (
    await staffHolding(
      organizationId,
      schoolId,
      PERMISSIONS.CLASSROOM_REMARK_PUBLISH,
    )
    // The author is not told about their own remark, even when they hold the
    // code — an office user writing one has not created work for themselves.
  ).filter((target) => target.userId !== authorId);

  await notify({
    organizationId,
    schoolId,
    kind: "REMARK_WRITTEN",
    subjectId: remark.id,
    params: {
      child: `${student.firstName} ${student.lastName}`,
      teacher: remark.author ? displayName(remark.author) : "—",
    },
    targets,
  });
}

/**
 * Releases a teacher's observation to the family, or takes it back.
 *
 * ── Why this is a separate act from writing one ─────────────────────────────
 * A remark is written internal and stays internal: `StudentRemark
 * .isVisibleToFamily` defaults to false, and until this ran there was no way to
 * change it afterwards at all — the flag could only be chosen at creation, by
 * an author who already held the office code. So a school where teachers write
 * and the direction decides had no way to say yes: the note existed, the family
 * could not be shown it, and the only route was for the office to delete it and
 * retype it under their own name.
 *
 * This is that missing half. It is the office's decision and nobody else's,
 * which is why the action gating it requires CLASSROOM_REMARK_PUBLISH rather
 * than the writing code — the same split as justifying an absence.
 *
 * Scoped by school in the `where` rather than checked afterwards, so a crafted
 * id reaches nothing. The body is never touched: publishing is a decision about
 * a teacher's words, not a licence to change them.
 */
export async function setRemarkVisibility(
  remarkId: string,
  schoolId: string,
  isVisibleToFamily: boolean,
): Promise<{ ok: boolean }> {
  const updated = await db.studentRemark.updateMany({
    where: { id: remarkId, enrollment: { student: { schoolId } } },
    data: { isVisibleToFamily },
  });

  if (updated.count === 0) return { ok: false };

  // Only on release. Taking an observation back is the office reconsidering,
  // and a family who never saw it has nothing to be told about — while one who
  // did is not helped by a second line drawing attention to it.
  if (isVisibleToFamily) {
    await dispatch("REMARK_SHARED", () => tellTheFamily(remarkId, schoolId));
  }

  return { ok: true };
}

/**
 * Tells the household an observation has been released to them.
 *
 * Deliberately wordless about *what* it says. The remark is a teacher's account
 * of something that happened at school, sometimes an unhappy one, and a
 * notification is read on a lock screen in front of whoever is standing there.
 * The line names the child and nothing else; the words are on the screen behind
 * it, which is where a parent chooses to read them.
 */
async function tellTheFamily(
  remarkId: string,
  schoolId: string,
): Promise<void> {
  const remark = await db.studentRemark.findFirst({
    where: { id: remarkId, enrollment: { student: { schoolId } } },
    select: {
      id: true,
      enrollment: {
        select: {
          studentId: true,
          student: { select: { school: { select: { organizationId: true } } } },
        },
      },
    },
  });
  if (!remark) return;

  await notify({
    organizationId: remark.enrollment.student.school.organizationId,
    schoolId,
    kind: "REMARK_SHARED",
    subjectId: remark.id,
    targets: await guardiansOfStudent(remark.enrollment.studentId),
  });
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
