import "server-only";

import type { AuthContext } from "@/lib/dal";
import { displayName } from "@/lib/dal";
import { db } from "@/lib/db";
import { schoolScope } from "@/lib/scope";
import { loadClassTermMarks } from "@/modules/assessments/queries";
import { resolveProgramme } from "@/modules/assessments/service";
import { loadClassTermAttendance } from "@/modules/classroom/queries";
import {
  acceptsRecompute,
  rankValues,
  spreadOf,
  weightedAverage,
  type WeightedEntry,
} from "@/modules/bulletins/enums";
import {
  dispatch,
  guardiansOfStudent,
  notify,
} from "@/modules/notifications/service";

/**
 * Writes and invariants for the bulletins module.
 *
 * Everything here serves one function — `computeClassBulletins` — and the two
 * rules it exists to keep:
 *
 *   1. A DRAFT bulletin's *figures* are the machine's and may be recomputed at
 *      will; its *words* are a person's and are never touched.
 *   2. A PUBLISHED bulletin is not recomputed at all. It is a document that has
 *      left the building.
 */

/** Statuses whose pupils get a bulletin. A place held is a place reported on. */
const ROSTER_STATUSES = ["ACTIVE", "COMPLETED"] as const;

export type ComputeResult =
  | {
      ok: false;
      reason: "not-found" | "term-mismatch" | "no-roster" | "no-programme";
    }
  | {
      ok: true;
      /** Bulletins written or refreshed. */
      computed: number;
      /** Left alone because they had already been published. */
      skipped: number;
    };

/**
 * Works out — and freezes — every pupil's bulletin for one class and one term.
 *
 * ── The shape of the arithmetic ─────────────────────────────────────────────
 * Three nested weightings, each using the weight declared for its own scope:
 *
 *   a paper      weighs by `Assessment.coefficient` inside its subject
 *   a component  weighs by `LevelSubject.coefficient` inside its matière
 *   a matière    weighs by `LevelSubject.coefficient` in the general average
 *
 * Only matières enter the general average. A component's coefficient never
 * does — see the note on LevelSubject, and the one on BulletinLine.
 *
 * A matière that is marked *both* directly and through its components pools
 * both: each component contributes its own average at its programme
 * coefficient, and each direct paper contributes its mark at its paper
 * coefficient. That is not a compromise between two schemes, it is what the
 * school's own numbers already say — a component declared at coefficient 2
 * counts twice what a paper at coefficient 1 does, whichever way the work was
 * set. The ordinary case is that only one of the two exists.
 *
 * ── Why the whole class is computed at once ─────────────────────────────────
 * A rank and a class average are facts about the cohort, not about a pupil, so
 * there is no such thing as computing one bulletin. Pupils whose bulletin is
 * already published still count toward both — the class is the class — they are
 * simply not written to. Ranking only the unpublished ones would silently
 * promote everybody left.
 */
export async function computeClassBulletins(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
): Promise<ComputeResult> {
  const schoolClass = await db.schoolClass.findFirst({
    // The class id comes from the request; the school comes from the session.
    where: { id: schoolClassId, ...schoolScope(context) },
    select: { id: true, levelOffering: { select: { schoolYearId: true } } },
  });
  if (!schoolClass) return { ok: false, reason: "not-found" };

  const term = await db.term.findUnique({
    where: { id: termId },
    select: { id: true, schoolYearId: true, startDate: true, endDate: true },
  });
  if (!term) return { ok: false, reason: "not-found" };

  // A term of another year would produce a bulletin covering a period the class
  // did not exist for — and, because the unique key is (enrolment, term), would
  // quietly overwrite a real one.
  if (term.schoolYearId !== schoolClass.levelOffering.schoolYearId) {
    return { ok: false, reason: "term-mismatch" };
  }

  const roster = await db.enrollment.findMany({
    where: {
      schoolClassId: schoolClass.id,
      schoolYearId: term.schoolYearId,
      status: { in: [...ROSTER_STATUSES] },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    select: {
      id: true,
      bulletins: {
        where: { termId: term.id },
        select: { id: true, status: true },
      },
    },
  });
  if (roster.length === 0) return { ok: false, reason: "no-roster" };

  // Both halves come back — a bulletin prints the matière and the components it
  // is computed from. See `resolveProgramme`.
  const programme = await resolveProgramme(schoolClass.id);
  // Distinct from an empty roster, and the distinction is the whole value of
  // the message: "no pupils in this class" sends somebody to the roster, and
  // the real problem is that the level has no marked subject declared.
  if (programme.length === 0) return { ok: false, reason: "no-programme" };

  const [marks, attendance, teacherOf] = await Promise.all([
    loadClassTermMarks(context, schoolClass.id, term.id),
    loadClassTermAttendance(context, schoolClass.id, term.startDate, term.endDate),
    loadTeacherNames(schoolClass.id),
  ]);

  const outOf = context.settings.gradingMaxScore;

  // ── Per pupil, per subject ─────────────────────────────────────────────────

  const marksOf = groupMarks(marks);
  const componentsOf = new Map<string, typeof programme>();
  for (const entry of programme) {
    if (entry.parentSubjectId === null) continue;
    const held = componentsOf.get(entry.parentSubjectId) ?? [];
    held.push(entry);
    componentsOf.set(entry.parentSubjectId, held);
  }

  /** enrolment id → subject id → the figure and how many marks made it. */
  const results = new Map<string, Map<string, SubjectResult>>();

  for (const enrolment of roster) {
    const bySubject = new Map<string, SubjectResult>();

    // Components first: a matière's own figure is built out of theirs, so they
    // have to be settled before it is reached.
    for (const entry of programme) {
      if (entry.parentSubjectId === null) continue;
      bySubject.set(
        entry.subjectId,
        directResult(marksOf.get(key(enrolment.id, entry.subjectId))),
      );
    }

    for (const entry of programme) {
      if (entry.parentSubjectId !== null) continue;

      const own = marksOf.get(key(enrolment.id, entry.subjectId)) ?? [];
      const contributions: WeightedEntry[] = own.map((mark) => ({
        value: mark.value,
        weight: mark.coefficient,
      }));
      let markCount = own.length;

      for (const component of componentsOf.get(entry.subjectId) ?? []) {
        const result = bySubject.get(component.subjectId);
        if (!result || result.average === null) continue;
        contributions.push({
          value: result.average,
          weight: component.coefficient,
        });
        markCount += result.markCount;
      }

      bySubject.set(entry.subjectId, {
        average: weightedAverage(contributions),
        markCount,
      });
    }

    results.set(enrolment.id, bySubject);
  }

  // ── General averages, ranks and the class's own spread ─────────────────────

  const topLevel = programme.filter((entry) => entry.parentSubjectId === null);

  const generalAverages = roster.map((enrolment) => {
    const bySubject = results.get(enrolment.id);
    return weightedAverage(
      topLevel
        .map((entry) => ({
          value: bySubject?.get(entry.subjectId)?.average ?? null,
          weight: entry.coefficient,
        }))
        .filter((entry): entry is WeightedEntry => entry.value !== null),
    );
  });

  const generalRanks = rankValues(generalAverages);
  const generalSpread = spreadOf(generalAverages);

  /** subject id → the rank and spread of that subject across the class. */
  const subjectStats = new Map<
    string,
    { ranks: (number | null)[]; spread: ReturnType<typeof spreadOf> }
  >();
  for (const entry of programme) {
    const column = roster.map(
      (enrolment) => results.get(enrolment.id)?.get(entry.subjectId)?.average ?? null,
    );
    subjectStats.set(entry.subjectId, {
      ranks: rankValues(column),
      spread: spreadOf(column),
    });
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  const computedAt = new Date();
  let computed = 0;
  let skipped = 0;

  for (const [index, enrolment] of roster.entries()) {
    const existing = enrolment.bulletins[0] ?? null;

    // Rule 2: a published bulletin is a document, not a view. It counted toward
    // the ranks above and is written to by nothing here.
    if (existing && !acceptsRecompute(existing.status)) {
      skipped += 1;
      continue;
    }

    const tally = attendance.get(enrolment.id);

    const figures = {
      schoolId: context.currentSchool?.id ?? "",
      schoolClassId: schoolClass.id,
      generalAverage: generalAverages[index],
      outOf,
      rank: generalRanks[index],
      classSize: roster.length,
      classAverage: generalSpread.average,
      classLowest: generalSpread.lowest,
      classHighest: generalSpread.highest,
      absenceCount: tally?.absenceCount ?? 0,
      unjustifiedAbsenceCount: tally?.unjustifiedAbsenceCount ?? 0,
      lateCount: tally?.lateCount ?? 0,
      computedAt,
    };

    // Rule 1: `mention`, `decision` and the two comments are absent from both
    // halves of this upsert on purpose. They are what people wrote, and a
    // recomputation must leave them exactly as they were.
    const bulletin = await db.bulletin.upsert({
      where: {
        enrollmentId_termId: { enrollmentId: enrolment.id, termId: term.id },
      },
      create: {
        enrollmentId: enrolment.id,
        termId: term.id,
        status: "DRAFT",
        ...figures,
      },
      update: figures,
      select: { id: true },
    });

    /*
      ── Which subjects this pupil's bulletin actually carries ────────────────
      Every matière of the programme, marked or not: a subject silently missing
      from a report card is the failure `resolveProgramme` warns about, and a
      blank line is the honest way to say "not marked this term".

      Components are different, and carried only when they were actually marked.
      The programme holds the matière *and* its parts, and the ordinary Moroccan
      primary case marks just one of the two: 1AP sits one contrôle on
      اللغة العربية, not four on its components. Printing those four as dashes
      fills over half the page with rows asserting an absence of marks in work
      nobody set separately — and unlike a matière, a component nobody marked is
      not a gap in the report card, because its matière is right above it
      carrying the mark.
    */
    const printed = programme.filter(
      (entry) =>
        entry.parentSubjectId === null ||
        (results.get(enrolment.id)?.get(entry.subjectId)?.markCount ?? 0) > 0,
    );

    for (const [position, entry] of printed.entries()) {
      const result = results.get(enrolment.id)?.get(entry.subjectId);
      const stats = subjectStats.get(entry.subjectId);

      const line = {
        parentSubjectId: entry.parentSubjectId,
        // Copied, not joined — see the note on BulletinLine.
        subjectName: entry.subjectName,
        teacherName: teacherOf.get(entry.subjectId) ?? null,
        coefficient: entry.coefficient,
        average: result?.average ?? null,
        markCount: result?.markCount ?? 0,
        rank: stats?.ranks[index] ?? null,
        classAverage: stats?.spread.average ?? null,
        classLowest: stats?.spread.lowest ?? null,
        classHighest: stats?.spread.highest ?? null,
        position,
      };

      // `appreciation` is likewise absent from both halves — rule 1 again.
      await db.bulletinLine.upsert({
        where: {
          bulletinId_subjectId: {
            bulletinId: bulletin.id,
            subjectId: entry.subjectId,
          },
        },
        create: { bulletinId: bulletin.id, subjectId: entry.subjectId, ...line },
        update: line,
      });
    }

    // A subject dropped from the programme — or a component whose only mark was
    // deleted — would otherwise stay on the bulletin at its old figure, because
    // the loop above only ever writes the subjects it means to carry.
    await db.bulletinLine.deleteMany({
      where: {
        bulletinId: bulletin.id,
        subjectId: { notIn: printed.map((entry) => entry.subjectId) },
      },
    });

    computed += 1;
  }

  return { ok: true, computed, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────

type SubjectResult = { average: number | null; markCount: number };

function key(enrollmentId: string, subjectId: string): string {
  return `${enrollmentId}:${subjectId}`;
}

function groupMarks(
  marks: readonly { enrollmentId: string; subjectId: string; value: number; coefficient: number }[],
) {
  const grouped = new Map<string, { value: number; coefficient: number }[]>();
  for (const mark of marks) {
    const bucket = grouped.get(key(mark.enrollmentId, mark.subjectId)) ?? [];
    bucket.push({ value: mark.value, coefficient: mark.coefficient });
    grouped.set(key(mark.enrollmentId, mark.subjectId), bucket);
  }
  return grouped;
}

/** A subject's figure from its own papers alone — what a component always is. */
function directResult(
  marks: readonly { value: number; coefficient: number }[] | undefined,
): SubjectResult {
  if (!marks || marks.length === 0) return { average: null, markCount: 0 };
  return {
    average: weightedAverage(
      marks.map((mark) => ({ value: mark.value, weight: mark.coefficient })),
    ),
    markCount: marks.length,
  };
}

/**
 * Who teaches each subject to this class, for the name printed on the line.
 *
 * `TeachingAssignment` rather than the timetable, which is the split that table
 * exists for: the assignment answers "who is answerable for Maths in 2BAC-SM-B",
 * and a report card is one of the three things its own note names as reading it.
 *
 * Where a subject is split between groups there is a teacher per group and no
 * single name to print, so the primary one wins and the rest are dropped — a
 * bulletin naming two teachers for one line would be read as a mistake.
 */
async function loadTeacherNames(
  schoolClassId: string,
): Promise<Map<string, string>> {
  const assignments = await db.teachingAssignment.findMany({
    where: { schoolClassId },
    orderBy: [{ isPrimary: "desc" }],
    select: {
      subjectId: true,
      teacher: { select: { username: true, profile: true } },
    },
  });

  const names = new Map<string, string>();
  for (const assignment of assignments) {
    if (names.has(assignment.subjectId)) continue;
    names.set(assignment.subjectId, displayName(assignment.teacher));
  }
  return names;
}

// ── Publication ──────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: false; reason: "not-found" }
  | { ok: true; changed: number };

/**
 * Releases — or withdraws — a class's bulletins for one term.
 *
 * Done in bulk because that is the act: a council sits, agrees the term, and
 * the bulletins go out together. Releasing them one at a time would let a class
 * be half-issued, which is a state nobody means to create and one a parent
 * discovers by asking a neighbour.
 *
 * Withdrawing clears the publication stamp rather than keeping it as history.
 * The audit trail already records who published and who withdrew, with times;
 * a `publishedAt` left on a DRAFT would be a second, worse record of it that
 * the print header would read as an issue date.
 */
export async function setClassPublication(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
  publish: boolean,
): Promise<PublishResult> {
  const schoolClass = await db.schoolClass.findFirst({
    where: { id: schoolClassId, ...schoolScope(context) },
    select: { id: true },
  });
  if (!schoolClass) return { ok: false, reason: "not-found" };

  const result = await db.bulletin.updateMany({
    where: {
      schoolClassId: schoolClass.id,
      termId,
      ...schoolScope(context),
      status: publish ? "DRAFT" : "PUBLISHED",
    },
    data: publish
      ? {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedById: context.user.id,
        }
      : { status: "DRAFT", publishedAt: null, publishedById: null },
  });

  if (publish && result.count > 0) {
    await dispatch("BULLETIN_PUBLISHED", () =>
      tellTheFamilies(context, schoolClass.id, termId),
    );
  }

  return { ok: true, changed: result.count };
}

/**
 * One line per family whose child's bulletin has just been released.
 *
 * Written per bulletin rather than per class, so `subjectId` names the document
 * this reader may actually open and the dedupe key is that document's id — a
 * class republished after a correction tells only the families whose bulletin
 * was in DRAFT at the time, which is exactly who the `updateMany` above moved.
 *
 * Only on publish. Taking a bulletin back is not news a family should be sent:
 * it is the school admitting a mistake to itself, and the document simply stops
 * being there.
 */
async function tellTheFamilies(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
): Promise<void> {
  const bulletins = await db.bulletin.findMany({
    where: { schoolClassId, termId, status: "PUBLISHED" },
    select: {
      id: true,
      schoolId: true,
      enrollment: { select: { studentId: true } },
      term: { select: { name: true } },
    },
  });

  await Promise.all(
    bulletins.map(async (bulletin) =>
      notify({
        organizationId: context.organization.id,
        schoolId: bulletin.schoolId,
        kind: "BULLETIN_PUBLISHED",
        subjectId: bulletin.id,
        params: { term: bulletin.term.name },
        targets: await guardiansOfStudent(bulletin.enrollment.studentId),
      }),
    ),
  );
}

// ── What people write ────────────────────────────────────────────────────────

export type WriteResult =
  | { ok: false; reason: "not-found" | "published" }
  | { ok: true };

/**
 * A teacher's line about one pupil in one subject.
 *
 * Refused once the bulletin is published, for the same reason the figures are:
 * the family is holding a copy. The line is found through its bulletin so the
 * school scope is applied to the row that carries it — `BulletinLine` has no
 * `schoolId` of its own, and giving it one would be a second answer to a
 * question the bulletin already answers.
 */
export async function saveAppreciation(
  context: AuthContext,
  lineId: string,
  appreciation: string | null,
): Promise<WriteResult> {
  const line = await db.bulletinLine.findFirst({
    where: { id: lineId, bulletin: schoolScope(context) },
    select: { id: true, bulletin: { select: { status: true } } },
  });
  if (!line) return { ok: false, reason: "not-found" };
  if (!acceptsRecompute(line.bulletin.status)) {
    return { ok: false, reason: "published" };
  }

  await db.bulletinLine.update({
    where: { id: line.id },
    data: { appreciation },
  });
  return { ok: true };
}

export type CouncilInput = {
  mention: string | null;
  decision: string | null;
  councilComment: string | null;
  mainTeacherComment: string | null;
};

/** The council's decision on one pupil's term. */
export async function saveCouncilDecision(
  context: AuthContext,
  bulletinId: string,
  input: CouncilInput,
): Promise<WriteResult> {
  const bulletin = await db.bulletin.findFirst({
    where: { id: bulletinId, ...schoolScope(context) },
    select: { id: true, status: true },
  });
  if (!bulletin) return { ok: false, reason: "not-found" };
  if (!acceptsRecompute(bulletin.status)) {
    return { ok: false, reason: "published" };
  }

  await db.bulletin.update({ where: { id: bulletin.id }, data: input });
  return { ok: true };
}
