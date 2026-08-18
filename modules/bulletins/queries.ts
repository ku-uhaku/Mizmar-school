import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { isPassingScore, passMarkOf } from "@/lib/school-settings";
import { schoolScope, yearScope } from "@/lib/scope";
import { bilingual } from "@/modules/academics/labels";
// The scale's rungs and the rule for landing a mark on one belong to
// assessments, which owns AppreciationBand — read through its own query rather
// than against the table.
import { appreciationFor } from "@/modules/assessments/enums";
import { listAppreciationBands } from "@/modules/assessments/queries";
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
      username: true,
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

// ── What a class's results look like, for a dashboard ─────────────────────────

/** One rung of the school's scale, with how many of the class landed on it. */
export type BandTally = {
  label: string;
  /** The school's own colour for the rung — an ordered scale, not a palette. */
  colorHex: string | null;
  count: number;
};

export type ClassResults = {
  termId: string;
  termName: string;
  /** Bulletins computed for the class, and how many have been issued. */
  computed: number;
  published: number;
  /** The class's own spread, read off the rows rather than recomputed. */
  average: number | null;
  lowest: number | null;
  highest: number | null;
  /** The scale the averages are on — 20 in a Moroccan school, but not assumed. */
  outOf: number;
  /** Share of the marked pupils at or above the pass mark, 0–100. */
  passRate: number | null;
  passMark: number;
  bands: BandTally[];
  /**
   * The class's average per matière, heaviest coefficient first.
   *
   * Both names: the chart's axis takes the short one — eleven bilingual
   * "Mathématiques · الرياضيات" under a half-width plot collide into an
   * unreadable band — and the full one is what a tooltip or a table can afford.
   */
  bySubject: {
    subjectId: string;
    subjectName: string;
    subjectShort: string;
    average: number;
  }[];
};

/**
 * The class's results for one term: its moyenne, its spread, and where it sits.
 *
 * ── Why this reads bulletins and does not recompute ─────────────────────────
 * The moyenne a school reports *is* the bulletin. Weighting a matière by its
 * coefficient, rolling a component up into its parent, and deciding what an
 * unmarked subject does to the average are all settled once, in
 * `computeBulletins` — and they are subtle enough that a second implementation
 * would drift the first time one of them was corrected. So this reads the frozen
 * figures: every number here has already been defended to a parent.
 *
 * The cost is honest and worth stating: a class whose bulletins have not been
 * computed shows nothing rather than a provisional average nobody has approved.
 * That is the true state of a term nobody has closed, and the class council is
 * one screen away.
 *
 * `classAverage` and its two neighbours are taken off the first row rather than
 * averaged here for the same reason: `computeBulletins` wrote them across the
 * whole roster, including pupils whose bulletin is already published and
 * therefore frozen. Re-deriving from the rows returned would quietly answer a
 * different question.
 */
export async function loadClassResults(
  context: AuthContext,
  schoolClassId: string,
  /** The term to read. Null takes the one the school is in. */
  termId: string | null,
): Promise<ClassResults | null> {
  const term = termId
    ? await db.term.findFirst({
        where: { id: termId, ...yearScope(context) },
        select: { id: true, name: true },
      })
    : /*
         The term in play, else the latest that has bulletins.

         A school in the summer is in no term at all, and falling back to the
         last one with results is what keeps the tab answering a question over
         the holidays instead of going blank.
       */
      ((await db.term.findFirst({
        where: { ...yearScope(context), status: "ACTIVE" },
        orderBy: { number: "asc" },
        select: { id: true, name: true },
      })) ??
      (await db.term.findFirst({
        where: { ...yearScope(context), bulletins: { some: { schoolClassId } } },
        orderBy: { number: "desc" },
        select: { id: true, name: true },
      })));
  if (!term) return null;

  const [bulletins, bands] = await Promise.all([
    db.bulletin.findMany({
      // The class and term come from the request; the school does not.
      where: { schoolClassId, termId: term.id, ...schoolScope(context) },
      select: {
        status: true,
        generalAverage: true,
        outOf: true,
        classAverage: true,
        classLowest: true,
        classHighest: true,
        lines: {
          where: { parentSubjectId: null },
          select: {
            subjectId: true,
            coefficient: true,
            classAverage: true,
            subject: {
              select: { name: true, nameAr: true, shortName: true, code: true },
            },
          },
        },
      },
    }),
    listAppreciationBands(context),
  ]);

  const settings = context.settings;
  const outOf = bulletins[0]?.outOf ?? settings.gradingMaxScore;

  const marked = bulletins
    .map((bulletin) => bulletin.generalAverage)
    .filter((average): average is number => average !== null);

  /*
    One line per matière, from whichever bulletin carries it.

    `classAverage` on a line is the class's figure for that subject, so it is the
    same on every pupil's copy — taking the first is reading it, not sampling it.
    Components are excluded by the `where` above: they are rolled into their
    parent and counting both would draw français twice.
  */
  const bySubject = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      subjectShort: string;
      average: number;
      coefficient: number;
    }
  >();
  for (const bulletin of bulletins) {
    for (const line of bulletin.lines) {
      if (line.classAverage === null || bySubject.has(line.subjectId)) continue;
      bySubject.set(line.subjectId, {
        subjectId: line.subjectId,
        subjectName: bilingual(line.subject.name, line.subject.nameAr),
        // The short form a school writes on a grid, falling back to the code —
        // both are short by construction, unlike the name.
        subjectShort: line.subject.shortName ?? line.subject.code,
        average: line.classAverage,
        coefficient: line.coefficient,
      });
    }
  }

  return {
    termId: term.id,
    termName: term.name,
    computed: bulletins.length,
    published: bulletins.filter((bulletin) => isPublished(bulletin.status)).length,
    average: bulletins[0]?.classAverage ?? null,
    lowest: bulletins[0]?.classLowest ?? null,
    highest: bulletins[0]?.classHighest ?? null,
    outOf,
    passRate:
      marked.length === 0
        ? null
        : Math.round(
            (marked.filter((average) => isPassingScore(average, outOf, settings))
              .length /
              marked.length) *
              100,
          ),
    passMark: passMarkOf(settings),
    /*
      Every rung of the scale, including the empty ones.

      Dropping them would redraw the strip each time a class moved, and "nobody
      is below average" is exactly the fact an empty rung states. The rung a mark
      lands on is `appreciationFor`, the same function the mark sheet suggests an
      appréciation with — so the tab and the bulletin cannot disagree about what
      "Bien" means.
    */
    bands: bands.map((band) => ({
      label: band.label,
      colorHex: band.colorHex,
      count: marked.filter(
        (average) => appreciationFor(average, outOf, bands)?.id === band.id,
      ).length,
    })),
    bySubject: [...bySubject.values()]
      .sort((a, b) => b.coefficient - a.coefficient || a.subjectName.localeCompare(b.subjectName))
      .map(({ subjectId, subjectName, subjectShort, average }) => ({
        subjectId,
        subjectName,
        subjectShort,
        average,
      })),
  };
}

/** One term's frozen figure for a class, as the trend plots it. */
export type ClassTermAverage = {
  termId: string;
  termName: string;
  average: number;
  /** The scale that term was marked on — a school may change it between years. */
  outOf: number;
};

/**
 * The class's moyenne term by term, in term order.
 *
 * The companion to `loadClassResults`, and it reads the same frozen figures for
 * the same reason: `classAverage` is what `computeBulletins` wrote and what was
 * defended to a parent, so a second implementation here would eventually
 * disagree with the bulletin a family is holding.
 *
 * `classAverage` is identical on every bulletin of a term — it is the class's
 * figure, copied onto each pupil's sheet — so the first row of each term is
 * read rather than sampled, which is also why terms are deduplicated here
 * instead of averaged.
 *
 * A term with no computed bulletins simply has no point: the line then joins the
 * terms that exist rather than dropping to nought through one that was never
 * closed.
 */
export async function loadClassTermAverages(
  context: AuthContext,
  schoolClassId: string,
): Promise<ClassTermAverage[]> {
  const bulletins = await db.bulletin.findMany({
    // The class comes from the request; the school and the year do not.
    where: {
      schoolClassId,
      ...schoolScope(context),
      term: yearScope(context),
      classAverage: { not: null },
    },
    orderBy: { term: { number: "asc" } },
    select: {
      termId: true,
      classAverage: true,
      outOf: true,
      term: { select: { name: true } },
    },
  });

  const byTerm = new Map<string, ClassTermAverage>();
  for (const bulletin of bulletins) {
    if (bulletin.classAverage === null || byTerm.has(bulletin.termId)) continue;
    byTerm.set(bulletin.termId, {
      termId: bulletin.termId,
      termName: bulletin.term.name,
      average: bulletin.classAverage,
      outOf: bulletin.outOf,
    });
  }

  return [...byTerm.values()];
}
