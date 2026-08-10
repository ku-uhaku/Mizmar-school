import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { schoolScope, yearScope } from "@/lib/scope";
import {
  FAMILY_VISIBLE_STATUSES,
  isPublished,
  yearAverageOf,
  type BulletinStatus,
} from "@/modules/bulletins/enums";

/**
 * Reads for the bulletins module.
 *
 * Confined to `context.currentSchool`, and — through the term — to the year in
 * context. Every figure returned here is read straight off the row and never
 * recomputed on the way out: a query that "helpfully" refreshed an average
 * would undo the one thing the table exists for.
 */

export type BulletinLineRow = {
  id: string;
  subjectId: string;
  /** Set on a component, so the screen can indent it under its matière. */
  parentSubjectId: string | null;
  subjectName: string;
  teacherName: string | null;
  coefficient: number;
  average: number | null;
  markCount: number;
  rank: number | null;
  classAverage: number | null;
  classLowest: number | null;
  classHighest: number | null;
  appreciation: string | null;
  position: number;
};

export type BulletinRow = {
  id: string;
  enrollmentId: string;
  termId: string;
  termName: string;
  termNumber: number;
  studentId: string;
  studentCode: string;
  fullName: string;
  status: string;
  isPublished: boolean;
  generalAverage: number | null;
  outOf: number;
  rank: number | null;
  classSize: number;
  classAverage: number | null;
  classLowest: number | null;
  classHighest: number | null;
  absenceCount: number;
  unjustifiedAbsenceCount: number;
  lateCount: number;
  mention: string | null;
  decision: string | null;
  councilComment: string | null;
  mainTeacherComment: string | null;
  computedAt: string;
  publishedAt: string | null;
  publishedByName: string | null;
};

/** The read shape of a bulletin row, shared so every screen agrees on it. */
const BULLETIN_SELECT = {
  id: true,
  enrollmentId: true,
  termId: true,
  term: { select: { name: true, number: true } },
  status: true,
  generalAverage: true,
  outOf: true,
  rank: true,
  classSize: true,
  classAverage: true,
  classLowest: true,
  classHighest: true,
  absenceCount: true,
  unjustifiedAbsenceCount: true,
  lateCount: true,
  mention: true,
  decision: true,
  councilComment: true,
  mainTeacherComment: true,
  computedAt: true,
  publishedAt: true,
  publishedBy: {
    select: {
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
  enrollment: {
    select: {
      student: {
        select: { id: true, code: true, firstName: true, lastName: true },
      },
    },
  },
} as const;

/** The same, plus everything a whole document needs. */
const DETAIL_SELECT = {
  ...BULLETIN_SELECT,
  schoolClass: { select: { code: true, name: true } },
  enrollment: {
    select: {
      student: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          birthDate: true,
        },
      },
      schoolYear: { select: { name: true } },
      levelOffering: { select: { level: { select: { name: true } } } },
      // Every term of this enrolment, for the running year average. Filtered
      // to the issued ones in `toDetail` rather than here: a `where` inside an
      // `as const` select carries a readonly array, which Prisma will not take.
      //
      // The pupil's own bulletin is in this list too once it has been issued,
      // which is right — a year average includes the term you are reading.
      bulletins: { select: { generalAverage: true, status: true } },
    },
  },
  lines: {
    // A plain object rather than a one-element array: under `as const` a tuple
    // is readonly, and Prisma's `orderBy` will not take a readonly array.
    orderBy: { position: "asc" },
    select: {
      id: true,
      subjectId: true,
      parentSubjectId: true,
      subjectName: true,
      teacherName: true,
      coefficient: true,
      average: true,
      markCount: true,
      rank: true,
      classAverage: true,
      classLowest: true,
      classHighest: true,
      appreciation: true,
      position: true,
    },
  },
} as const;

type BulletinRecord = Awaited<
  ReturnType<typeof db.bulletin.findMany<{ select: typeof BULLETIN_SELECT }>>
>[number];

type DetailRecord = Awaited<
  ReturnType<typeof db.bulletin.findMany<{ select: typeof DETAIL_SELECT }>>
>[number];

/**
 * One shaping function for the list and the detail alike.
 *
 * The two screens must agree about what a bulletin says — that is the whole
 * reason the shaping lives in `queries.ts` rather than in each page.
 */
function toRow(bulletin: BulletinRecord | DetailRecord): BulletinRow {
  const { student } = bulletin.enrollment;

  return {
    id: bulletin.id,
    enrollmentId: bulletin.enrollmentId,
    termId: bulletin.termId,
    termName: bulletin.term.name,
    termNumber: bulletin.term.number,
    studentId: student.id,
    studentCode: student.code,
    fullName: `${student.firstName} ${student.lastName}`,
    status: bulletin.status,
    isPublished: isPublished(bulletin.status),
    generalAverage: bulletin.generalAverage,
    outOf: bulletin.outOf,
    rank: bulletin.rank,
    classSize: bulletin.classSize,
    classAverage: bulletin.classAverage,
    classLowest: bulletin.classLowest,
    classHighest: bulletin.classHighest,
    absenceCount: bulletin.absenceCount,
    unjustifiedAbsenceCount: bulletin.unjustifiedAbsenceCount,
    lateCount: bulletin.lateCount,
    mention: bulletin.mention,
    decision: bulletin.decision,
    councilComment: bulletin.councilComment,
    mainTeacherComment: bulletin.mainTeacherComment,
    computedAt: bulletin.computedAt.toISOString(),
    publishedAt: bulletin.publishedAt?.toISOString() ?? null,
    publishedByName: bulletin.publishedBy
      ? displayName(bulletin.publishedBy)
      : null,
  };
}

// ── One bulletin ─────────────────────────────────────────────────────────────

export type BulletinDetail = BulletinRow & {
  lines: BulletinLineRow[];
  className: string | null;
  levelName: string;
  schoolYearName: string;
  birthDate: string;
  /** The mean of this pupil's issued terms. See `yearAverageOf`. */
  yearAverage: number | null;
};

function toDetail(bulletin: DetailRecord): BulletinDetail {
  const { enrollment } = bulletin;

  return {
    ...toRow(bulletin),
    lines: bulletin.lines,
    className: bulletin.schoolClass?.name ?? bulletin.schoolClass?.code ?? null,
    levelName: enrollment.levelOffering.level.name,
    schoolYearName: enrollment.schoolYear.name,
    birthDate: enrollment.student.birthDate.toISOString(),
    yearAverage: yearAverageOf(
      enrollment.bulletins.filter((sibling) =>
        FAMILY_VISIBLE_STATUSES.includes(sibling.status as BulletinStatus),
      ),
    ),
  };
}

// ── The council's table ──────────────────────────────────────────────────────

export type ClassCouncil = {
  /**
   * With their lines. A council opens pupil after pupil to read the subject
   * detail, so fetching that on demand would put a round trip between every
   * name and the next in a room where eight people are waiting.
   */
  rows: BulletinDetail[];
  /**
   * Whether this is the year's last term, and therefore the one the council
   * decides the year on. Derived from the term numbers rather than fixed at 2:
   * a primary school running trimesters decides on its third.
   */
  isFinalTerm: boolean;
  publishedCount: number;
  draftCount: number;
};

/** The class council's working table: one line per pupil, in class-list order. */
export async function loadClassCouncil(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
): Promise<ClassCouncil> {
  const [bulletins, term, lastTerm] = await Promise.all([
    db.bulletin.findMany({
      // The class and term ids come from the request; the school does not.
      where: { schoolClassId, termId, ...schoolScope(context) },
      orderBy: [
        { enrollment: { student: { lastName: "asc" } } },
        { enrollment: { student: { firstName: "asc" } } },
      ],
      select: DETAIL_SELECT,
    }),
    db.term.findFirst({
      where: { id: termId, ...yearScope(context) },
      select: { number: true },
    }),
    db.term.aggregate({ where: yearScope(context), _max: { number: true } }),
  ]);

  const rows = bulletins.map(toDetail);

  return {
    rows,
    isFinalTerm:
      term !== null &&
      lastTerm._max.number !== null &&
      term.number === lastTerm._max.number,
    publishedCount: rows.filter((row) => row.isPublished).length,
    draftCount: rows.filter((row) => !row.isPublished).length,
  };
}


/**
 * One pupil's bulletin for one term, with its lines — what the print page and
 * the pupil panel both read.
 *
 * `publishedOnly` is what a family-facing caller passes. It is a flag rather
 * than a second function because the list a parent sees and the document they
 * open must agree about what has been issued, and two `where` clauses is
 * exactly how they come to disagree.
 */
export async function findBulletin(
  context: AuthContext,
  bulletinId: string,
  options: { publishedOnly?: boolean } = {},
): Promise<BulletinDetail | null> {
  const bulletin = await db.bulletin.findFirst({
    where: {
      id: bulletinId,
      ...schoolScope(context),
      ...(options.publishedOnly
        ? { status: { in: [...FAMILY_VISIBLE_STATUSES] } }
        : {}),
    },
    select: DETAIL_SELECT,
  });

  return bulletin ? toDetail(bulletin) : null;
}

/**
 * A pupil's bulletins for their year, oldest term first.
 *
 * Read on the pupil's own file, where the question is "how has the year gone",
 * so the terms come back in the order they happened rather than newest first.
 */
export async function listPupilBulletins(
  context: AuthContext,
  enrollmentId: string,
): Promise<BulletinRow[]> {
  const bulletins = await db.bulletin.findMany({
    // The enrolment id comes from the URL; the school does not.
    where: { enrollmentId, ...schoolScope(context) },
    orderBy: [{ term: { number: "asc" } }],
    select: BULLETIN_SELECT,
  });

  return bulletins.map(toRow);
}

/**
 * Every bulletin of a class for one term, with lines — the batch print.
 *
 * One query rather than one per pupil: a class of thirty printed a document at
 * a time is thirty round trips to answer a single "print the class".
 */
export async function listClassBulletins(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
): Promise<BulletinDetail[]> {
  const bulletins = await db.bulletin.findMany({
    where: { schoolClassId, termId, ...schoolScope(context) },
    orderBy: [
      { enrollment: { student: { lastName: "asc" } } },
      { enrollment: { student: { firstName: "asc" } } },
    ],
    select: DETAIL_SELECT,
  });

  return bulletins.map(toDetail);
}

/**
 * The bulletin a pupil holds for one term, found by pupil rather than by id —
 * what the print route reached from a pupil's file needs.
 */
export async function findPupilBulletin(
  context: AuthContext,
  studentId: string,
  termId: string,
): Promise<BulletinDetail | null> {
  const bulletin = await db.bulletin.findFirst({
    where: { termId, ...schoolScope(context), enrollment: { studentId } },
    select: DETAIL_SELECT,
  });

  return bulletin ? toDetail(bulletin) : null;
}
