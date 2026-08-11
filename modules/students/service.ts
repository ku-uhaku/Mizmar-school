import "server-only";

import { db } from "@/lib/db";
import {
  codePrefixOf,
  formatEntityCode,
  sequenceFromCode,
} from "@/lib/school-settings";
import { loadSchoolSettings } from "@/lib/school-settings-server";
import { deriveStudentStatus } from "@/modules/students/enums";

/**
 * Writes and invariants for the students module.
 *
 * The one that matters is `refreshStudentStatus`: `Student.status` is a
 * *derived* column, and this file is the only place allowed to set it. Every
 * write that could change a pupil's enrolments — enrolling, withdrawing,
 * deleting a year — calls it afterwards, so the column and the rows underneath
 * it cannot disagree.
 */

/** See `allocateFamilyCode` — same reasoning, same shape, same school format. */
export async function allocateStudentCode(
  schoolId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const { studentCodeFormat } = await loadSchoolSettings(schoolId);
  const prefix = codePrefixOf(studentCodeFormat, year);

  // Every code of the year, unsorted — a lexicographic top-N drops the true
  // maximum under an unpadded format. See `allocateFamilyCode` for the full note.
  const candidates = await db.student.findMany({
    where: { schoolId, code: { startsWith: prefix } },
    select: { code: true },
  });

  const highest = candidates.reduce((max, row) => {
    const sequence = sequenceFromCode(studentCodeFormat, year, row.code);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);

  return formatEntityCode(studentCodeFormat, year, highest + 1);
}

/**
 * Recomputes `Student.status` from the pupil's enrolments.
 *
 * An active enrolment beats everything: a child re-admitted after withdrawing
 * is enrolled, and the old row's status is history. With no active row, the most
 * recent enrolment says how the pupil left. With no rows at all, the file is
 * open and nothing more.
 */
export async function refreshStudentStatus(studentId: string): Promise<void> {
  /*
    Newest *year* first, not newest signature.

    "The most recent enrolment says how the pupil left" is a statement about
    which year they left in, and `enrolledOn` is only a proxy for it — the day
    the family signed. The two come apart in an ordinary case: a place granted
    in June is signed months before the year it is for, so a child pre-enrolled
    for 2025-26 in June 2025 and enrolled for 2024-25 the previous September
    ordered the *older* year first and took its status. Signing dates also tie,
    and a tie here decided the answer at random.

    The year's own start date settles both; `enrolledOn` stays as the
    tiebreaker for two enrolments of the same year, which the unique index makes
    impossible anyway.
  */
  const enrollments = await db.enrollment.findMany({
    where: { studentId },
    orderBy: [{ schoolYear: { startDate: "desc" } }, { enrolledOn: "desc" }],
    select: { status: true },
  });

  await db.student.update({
    where: { id: studentId },
    data: { status: deriveStudentStatus(enrollments) },
  });
}

/**
 * Attaches a pupil to a dossier, or detaches when `familyId` is null.
 *
 * The family is re-derived from the same school as the pupil, so a family id
 * from another school simply matches nothing rather than linking across the
 * tenant boundary.
 */
export async function attachToFamily(
  studentId: string,
  schoolId: string,
  familyId: string | null,
): Promise<boolean> {
  if (familyId !== null) {
    const family = await db.family.findFirst({
      where: { id: familyId, schoolId },
      select: { id: true },
    });
    if (!family) return false;
  }

  const updated = await db.student.updateMany({
    where: { id: studentId, schoolId },
    data: { familyId },
  });

  return updated.count > 0;
}
