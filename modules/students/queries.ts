import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { toDateInputValue } from "@/lib/utils";
import { currentSchoolYearId, schoolScope } from "@/lib/scope";
import {
  siblingCountOf,
  workflowStateOf,
  type StudentWorkflowStep,
} from "@/modules/students/enums";
import { dossierStandingByStudent } from "@/modules/documents/queries";
import { studentPaymentStanding } from "@/modules/treasury/queries";

/**
 * Reads for the students module.
 *
 * Confined to `context.currentSchool` throughout — the list, the profile and
 * the search all go through the same clause, which is why they live together.
 * The *year*-shaped facts (which class, what is billed) are not read here: they
 * belong to the enrolment module and are composed by the page, so a pupil's
 * screen and the class roster cannot disagree about who sits where.
 */

/** The shape the students table renders. Primitives only — it crosses to the client. */
export type StudentRow = {
  id: string;
  code: string;
  massarCode: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  gender: string;
  /** `YYYY-MM-DD` for `<input type="date">`; age is derived, never stored. */
  birthDate: string;
  status: string;
  photoUrl: string | null;
  isActive: boolean;
  familyId: string | null;
  familyName: string | null;
  /** This year's placement, already resolved — the table must not re-derive it. */
  levelName: string | null;
  className: string | null;
  classId: string | null;
};

export type StudentDetail = StudentRow & {
  birthCityId: string | null;
  /** Resolved for display; the form edits the id. */
  birthCityName: string | null;
  /** Where the family lives. Also what pre-fills the transport cascade. */
  neighbourhoodId: string | null;
  neighbourhoodName: string | null;
  nationality: string;
  nationalId: string | null;
  entryDate: string;
  exitDate: string;

  bloodType: string | null;
  allergies: string | null;
  chronicCondition: string | null;
  medications: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  insurer: string | null;
  hasDisability: boolean;
  medicalNotes: string | null;

  previousSchool: string | null;
  previousSchoolCityId: string | null;
  previousSchoolCityName: string | null;
  previousLevel: string | null;
  schoolingType: string | null;
  transferReason: string | null;

  brotherCount: number | null;
  sisterCount: number | null;
  /** Derived from the two counts — see `siblingCountOf`. Never a column. */
  siblingCount: number | null;
  birthRank: number | null;
  livesWith: string | null;
  isOrphan: boolean;

  notes: string | null;
  familyCode: string | null;
};

/**
 * Includes this year's enrolment so the list can show where a pupil sits.
 *
 * A pupil has at most one enrolment per year (see the unique on Enrollment), so
 * this is a one-element array at most, and taking `[0]` is exact rather than
 * a "first match" guess.
 */
function enrolmentInclude(schoolYearId: string | undefined) {
  return {
    where: { schoolYearId: schoolYearId ?? "__none__" },
    select: {
      id: true,
      schoolClassId: true,
      schoolClass: { select: { id: true, code: true } },
      levelOffering: {
        select: {
          level: { select: { code: true, name: true } },
          track: { select: { code: true } },
        },
      },
    },
  };
}

/** What a row needs, in one place, so the list and its page cannot drift. */
function studentRowInclude(schoolYearId: string | undefined) {
  return {
    family: { select: { id: true, name: true, code: true } },
    enrollments: enrolmentInclude(schoolYearId),
  };
}

type StudentWithRowIncludes = Prisma.StudentGetPayload<{
  include: ReturnType<typeof studentRowInclude>;
}>;

function toStudentRow(student: StudentWithRowIncludes): StudentRow {
  const enrolment = student.enrollments[0] ?? null;
  const level = enrolment?.levelOffering.level ?? null;
  const track = enrolment?.levelOffering.track ?? null;

  return {
    id: student.id,
    code: student.code,
    massarCode: student.massarCode,
    firstName: student.firstName,
    lastName: student.lastName,
    firstNameAr: student.firstNameAr,
    lastNameAr: student.lastNameAr,
    gender: student.gender,
    birthDate: toDateInputValue(student.birthDate),
    status: student.status,
    photoUrl: student.photoUrl,
    isActive: student.isActive,
    familyId: student.family?.id ?? null,
    familyName: student.family?.name ?? null,
    levelName: level
      ? track
        ? `${level.code} ${track.code}`
        : level.code
      : null,
    className: enrolment?.schoolClass?.code ?? null,
    classId: enrolment?.schoolClass?.id ?? null,
  };
}

/** Stands in for "no class yet" in the placement facet — an absent value cannot be ticked. */
export const UNPLACED = "__unplaced__";

/** How the list may be ordered. A closed set: it reaches the database directly. */
const STUDENT_ORDER = {
  name: [{ lastName: "asc" }, { firstName: "asc" }],
  nameDesc: [{ lastName: "desc" }, { firstName: "desc" }],
  code: [{ code: "asc" }],
  codeDesc: [{ code: "desc" }],
  /** Youngest first reads as "born most recently". */
  youngest: [{ birthDate: "desc" }],
  oldest: [{ birthDate: "asc" }],
  newest: [{ createdAt: "desc" }],
} as const satisfies Record<string, Prisma.StudentOrderByWithRelationInput[]>;

export type StudentSort = keyof typeof STUDENT_ORDER;

export function isStudentSort(value: string | undefined): value is StudentSort {
  return value !== undefined && value in STUDENT_ORDER;
}

export type StudentsPage = {
  rows: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type StudentsPageFilters = {
  /** Matches either name, either Arabic name, the dossier code or the code Massar. */
  search?: string;
  statuses?: string[];
  genders?: string[];
  /** Level as the table shows it — "3AP", or "1BAC SM" where there is a filière. */
  levels?: string[];
  /** Class codes, plus `UNPLACED` for the pupils with no class this year. */
  classes?: string[];
  sort?: StudentSort;
  page?: number;
};

const STUDENTS_PAGE_SIZE = 20;

const EMPTY_STUDENTS_PAGE: StudentsPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: STUDENTS_PAGE_SIZE,
  pageCount: 0,
};

/**
 * One page of the pupils list.
 *
 * ── Why the whole roll is never loaded ──────────────────────────────────────
 * The list screen used to ship every pupil to the browser and filter, sort and
 * page there. That is the right trade for one organisation's schools or roles —
 * a few hundred rows, and instant search is worth the payload. It is the wrong
 * trade here: a school's roll is the one table in the vie scolaire with no
 * ceiling, it grows every rentrée, and the payload is a row per pupil carrying
 * their placement and their dossier before anybody has typed anything.
 *
 * So the search, the facets, the order and the window all move to the database,
 * which is the only place that can see every pupil. The facets narrow the whole
 * roll rather than the twenty rows in front of the reader — a filter that did
 * the latter would answer "who is unplaced?" with "nobody on this page", which
 * is worse than not offering it.
 *
 * The level and class facets match on the codes the table displays rather than
 * on ids, because that is what the reader ticked; both are re-derived under the
 * school's own year, so a code from another tenant matches nothing.
 */
export async function listStudentsPage(
  context: AuthContext,
  filters: StudentsPageFilters = {},
): Promise<StudentsPage> {
  const schoolId = context.currentSchool?.id;
  if (!schoolId) return EMPTY_STUDENTS_PAGE;

  const schoolYearId = context.currentSchoolYear?.id;
  const search = filters.search?.trim();

  /** This year's enrolment, as a clause the facets can hang conditions off. */
  const enrolmentIs = (where: Prisma.EnrollmentWhereInput) => ({
    enrollments: { some: { schoolYearId: schoolYearId ?? "__none__", ...where } },
  });

  const classes = filters.classes ?? [];
  const namedClasses = classes.filter((code) => code !== UNPLACED);
  const wantsUnplaced = classes.includes(UNPLACED);

  const where: Prisma.StudentWhereInput = {
    schoolId,
    ...(filters.statuses?.length ? { status: { in: filters.statuses } } : {}),
    ...(filters.genders?.length ? { gender: { in: filters.genders } } : {}),
    ...(filters.levels?.length
      ? enrolmentIs({
          levelOffering: {
            OR: filters.levels.map((label) => {
              // "1BAC SM" is a level and a filière; "3AP" is a level alone.
              const [levelCode, trackCode] = label.split(" ");
              return trackCode
                ? { level: { code: levelCode }, track: { code: trackCode } }
                : { level: { code: levelCode }, trackId: null };
            }),
          },
        })
      : {}),
    ...(classes.length
      ? {
          OR: [
            ...(namedClasses.length
              ? [enrolmentIs({ schoolClass: { code: { in: namedClasses } } })]
              : []),
            // Unplaced is two different absences — enrolled with no class, and
            // not enrolled at all — and the screen means both by it.
            ...(wantsUnplaced
              ? [
                  enrolmentIs({ schoolClassId: null }),
                  { enrollments: { none: { schoolYearId: schoolYearId ?? "__none__" } } },
                ]
              : []),
          ],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { firstNameAr: { contains: search } },
            { lastNameAr: { contains: search } },
            { code: { contains: search } },
            { massarCode: { contains: search } },
          ],
        }
      : {}),
  };

  const total = await db.student.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  // Clamped rather than trusted: a page past the end is a stale link or a
  // hand-edited query string, and an empty table reads as "no pupils".
  const page = Math.min(Math.max(1, Math.trunc(filters.page ?? 1)), pageCount);

  const students = await db.student.findMany({
    where,
    orderBy: STUDENT_ORDER[filters.sort ?? "name"],
    skip: (page - 1) * STUDENTS_PAGE_SIZE,
    take: STUDENTS_PAGE_SIZE,
    include: studentRowInclude(schoolYearId),
  });

  return {
    rows: students.map(toStudentRow),
    total,
    page,
    pageSize: STUDENTS_PAGE_SIZE,
    pageCount,
  };
}

export type StudentFacetOptions = {
  /** Level labels as the table shows them, over the whole roll. */
  levels: string[];
  /** Class codes opened this year. */
  classes: string[];
};

/**
 * What the level and class facets may offer.
 *
 * Read separately from the page, and deliberately: the options used to be
 * derived from the loaded rows, which was exact only because every row was
 * loaded. With twenty in hand, deriving them there would offer the reader the
 * three classes that happen to be on this page and hide the other eleven.
 *
 * Taken from what the school actually opened this year rather than from the
 * pupils, so a class with nobody in it is still tickable — "which of my classes
 * is empty?" is a question worth being able to ask.
 */
export async function listStudentFacetOptions(
  context: AuthContext,
): Promise<StudentFacetOptions> {
  const schoolId = context.currentSchool?.id;
  const schoolYearId = context.currentSchoolYear?.id;
  if (!schoolId || !schoolYearId) return { levels: [], classes: [] };

  const [offerings, classes] = await Promise.all([
    db.levelOffering.findMany({
      // Through the year, which is where a cursus is scoped — and the year is
      // re-checked against the school rather than trusted from the context.
      where: { schoolYearId, schoolYear: { schoolId } },
      select: {
        level: { select: { code: true } },
        track: { select: { code: true } },
      },
    }),
    db.schoolClass.findMany({
      where: { schoolId, levelOffering: { schoolYearId } },
      orderBy: { code: "asc" },
      select: { code: true },
    }),
  ]);

  const levels = [
    ...new Set(
      offerings.map((offering) =>
        offering.track
          ? `${offering.level.code} ${offering.track.code}`
          : offering.level.code,
      ),
    ),
  ].sort();

  return { levels, classes: classes.map((schoolClass) => schoolClass.code) };
}

/**
 * One pupil's file. Null when out of reach — callers turn that into
 * `notFound()` rather than a forbidden state, so a pupil in another school
 * cannot be probed for.
 */
export async function findStudent(
  context: AuthContext,
  studentId: string,
): Promise<StudentDetail | null> {
  const student = await db.student.findFirst({
    where: { id: studentId, ...schoolScope(context) },
    include: {
      family: { select: { id: true, name: true, code: true } },
      birthCity: { select: { name: true } },
      // The town comes with it: "Centre-ville" alone names four different
      // places — the same reason `listNeighbourhoodChoices` labels them that way.
      neighbourhood: {
        select: { name: true, city: { select: { name: true } } },
      },
      previousSchoolCity: { select: { name: true } },
      enrollments: enrolmentInclude(context.currentSchoolYear?.id),
    },
  });

  if (!student) return null;

  const enrolment = student.enrollments[0] ?? null;
  const level = enrolment?.levelOffering.level ?? null;
  const track = enrolment?.levelOffering.track ?? null;

  return {
    id: student.id,
    code: student.code,
    massarCode: student.massarCode,
    firstName: student.firstName,
    lastName: student.lastName,
    firstNameAr: student.firstNameAr,
    lastNameAr: student.lastNameAr,
    gender: student.gender,
    birthDate: toDateInputValue(student.birthDate),
    birthCityId: student.birthCityId,
    birthCityName: student.birthCity?.name ?? null,
    neighbourhoodId: student.neighbourhoodId,
    neighbourhoodName: student.neighbourhood
      ? `${student.neighbourhood.city.name} · ${student.neighbourhood.name}`
      : null,
    nationality: student.nationality,
    nationalId: student.nationalId,
    entryDate: toDateInputValue(student.entryDate),
    exitDate: toDateInputValue(student.exitDate),

    bloodType: student.bloodType,
    allergies: student.allergies,
    chronicCondition: student.chronicCondition,
    medications: student.medications,
    doctorName: student.doctorName,
    doctorPhone: student.doctorPhone,
    insurer: student.insurer,
    hasDisability: student.hasDisability,
    medicalNotes: student.medicalNotes,

    previousSchool: student.previousSchool,
    previousSchoolCityId: student.previousSchoolCityId,
    previousSchoolCityName: student.previousSchoolCity?.name ?? null,
    previousLevel: student.previousLevel,
    schoolingType: student.schoolingType,
    transferReason: student.transferReason,

    brotherCount: student.brotherCount,
    sisterCount: student.sisterCount,
    siblingCount: siblingCountOf(student),
    birthRank: student.birthRank,
    livesWith: student.livesWith,
    isOrphan: student.isOrphan,

    notes: student.notes,
    status: student.status,
    photoUrl: student.photoUrl,
    isActive: student.isActive,
    familyId: student.family?.id ?? null,
    familyName: student.family?.name ?? null,
    familyCode: student.family?.code ?? null,
    levelName: level
      ? track
        ? `${level.code} ${track.code}`
        : level.code
      : null,
    className: enrolment?.schoolClass?.code ?? null,
    classId: enrolment?.schoolClass?.id ?? null,
  };
}

/**
 * How far a pupil's file has got, for the profile's stepper and the dashboard's
 * pipeline. Read from the rows rather than from a status column — see
 * `workflowStateOf`.
 */
export async function loadStudentWorkflow(
  context: AuthContext,
  studentId: string,
): Promise<Record<StudentWorkflowStep, boolean>> {
  const yearId = currentSchoolYearId(context);

  const student = await db.student.findFirst({
    where: { id: studentId, ...schoolScope(context) },
    select: {
      familyId: true,
      enrollments: {
        where: { schoolYearId: yearId },
        select: {
          schoolClassId: true,
          _count: { select: { fees: true } },
        },
      },
    },
  });

  const enrolment = student?.enrollments[0] ?? null;

  // Collection is the treasury's to answer — read through its own query rather
  // than summing its tables here, so the parcours and the caisse can never
  // disagree about whether a family is behind.
  const standing = await studentPaymentStanding(context, studentId);
  const dossier = await dossierStandingByStudent(context, [studentId]);

  return workflowStateOf({
    hasFamily: Boolean(student?.familyId),
    // The dossier is the documents module's to answer — read through its own
    // query rather than counting its tables here, so the parcours and the
    // dossier tab can never disagree about what is outstanding.
    hasDossier: dossier[studentId]?.isComplete ?? true,
    hasEnrolment: enrolment !== null,
    hasClass: Boolean(enrolment?.schoolClassId),
    hasFees: (enrolment?._count.fees ?? 0) > 0,
    isUpToDate: standing.isUpToDate,
  });
}

/** Pupils not yet seated in a class this year — what the roster screen offers. */
export async function listUnassignedStudents(
  context: AuthContext,
  levelOfferingId: string,
): Promise<{ id: string; enrollmentId: string; label: string }[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolYearId: currentSchoolYearId(context),
      levelOfferingId,
      schoolClassId: null,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: [{ student: { lastName: "asc" } }],
    select: {
      id: true,
      student: {
        select: { id: true, code: true, firstName: true, lastName: true },
      },
    },
  });

  return enrollments.map((enrolment) => ({
    id: enrolment.student.id,
    enrollmentId: enrolment.id,
    label: `${enrolment.student.lastName} ${enrolment.student.firstName} — ${enrolment.student.code}`,
  }));
}

/**
 * The header search. Matches a name, a matricule or a MASSAR code, and returns
 * enough to render a result row without a second query.
 *
 * SQLite's LIKE is case-insensitive for ASCII, which is what a French-language
 * name search needs; Arabic has no case, so it is unaffected. `mode: "insensitive"`
 * is deliberately not passed — the SQLite connector does not support it.
 */
export async function searchStudents(
  context: AuthContext,
  term: string,
  take = 6,
): Promise<StudentRow[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const students = await db.student.findMany({
    where: {
      ...schoolScope(context),
      OR: [
        { firstName: { contains: trimmed } },
        { lastName: { contains: trimmed } },
        { firstNameAr: { contains: trimmed } },
        { lastNameAr: { contains: trimmed } },
        { code: { contains: trimmed } },
        { massarCode: { contains: trimmed } },
      ],
    },
    orderBy: [{ lastName: "asc" }],
    take,
    include: {
      family: { select: { id: true, name: true, code: true } },
      enrollments: enrolmentInclude(context.currentSchoolYear?.id),
    },
  });

  return students.map((student) => {
    const enrolment = student.enrollments[0] ?? null;
    const level = enrolment?.levelOffering.level ?? null;
    const track = enrolment?.levelOffering.track ?? null;

    return {
      id: student.id,
      code: student.code,
      massarCode: student.massarCode,
      firstName: student.firstName,
      lastName: student.lastName,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      gender: student.gender,
      birthDate: toDateInputValue(student.birthDate),
      status: student.status,
      photoUrl: student.photoUrl,
      isActive: student.isActive,
      familyId: student.family?.id ?? null,
      familyName: student.family?.name ?? null,
      levelName: level
        ? track
          ? `${level.code} ${track.code}`
          : level.code
        : null,
      className: enrolment?.schoolClass?.code ?? null,
      classId: enrolment?.schoolClass?.id ?? null,
    };
  });
}

/**
 * The pupil body split three ways, for the ring on the vie scolaire dashboard.
 *
 * Three and not five, because that is where this app's validated categorical
 * palette stops — see components/charts/donut-chart.tsx. The three that survive
 * are the ones a school actually acts on: who is enrolled, whose file is still
 * open, and who has gone. The five raw statuses stay on `/students`, where a
 * table has room to tell TRANSFERRED from WITHDRAWN from GRADUATED.
 */
export async function countStudentsByStanding(context: AuthContext): Promise<{
  enrolled: number;
  preRegistered: number;
  left: number;
  total: number;
}> {
  const scope = schoolScope(context);

  const [enrolled, preRegistered, left, total] = await Promise.all([
    db.student.count({ where: { ...scope, status: "ENROLLED" } }),
    db.student.count({ where: { ...scope, status: "PRE_REGISTERED" } }),
    db.student.count({
      where: {
        ...scope,
        status: { in: ["TRANSFERRED", "WITHDRAWN", "GRADUATED"] },
      },
    }),
    db.student.count({ where: scope }),
  ]);

  return { enrolled, preRegistered, left, total };
}

/*
  There was a `countStudents` here too, taking the same scope and returning
  { total, enrolled, preRegistered } — three of the four figures above, from
  three more COUNTs. Its one caller asked for both, so the school-life dashboard
  ran seven counts over one table where four would do, and two independent
  queries were free to disagree about what "enrolled" meant. Callers derive the
  smaller shape from this one.
*/
