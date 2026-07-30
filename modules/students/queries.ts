import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import {
  workflowStateOf,
  type StudentWorkflowStep,
} from "@/modules/students/enums";

/**
 * Reads for the students module.
 *
 * Confined to `context.currentSchool` throughout — the list, the profile and
 * the search all go through the same clause, which is why they live together.
 * The *year*-shaped facts (which class, what is billed) are not read here: they
 * belong to the enrolment module and are composed by the page, so a pupil's
 * screen and the class roster cannot disagree about who sits where.
 */

function schoolScope(context: AuthContext) {
  return { schoolId: context.currentSchool?.id ?? "__none__" };
}

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
  birthPlace: string | null;
  birthPlaceAr: string | null;
  nationality: string;
  nationalId: string | null;
  entryDate: string;
  exitDate: string;
  medicalNotes: string | null;
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

export async function listStudents(
  context: AuthContext,
): Promise<StudentRow[]> {
  const students = await db.student.findMany({
    where: schoolScope(context),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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
    birthPlace: student.birthPlace,
    birthPlaceAr: student.birthPlaceAr,
    nationality: student.nationality,
    nationalId: student.nationalId,
    entryDate: toDateInputValue(student.entryDate),
    exitDate: toDateInputValue(student.exitDate),
    medicalNotes: student.medicalNotes,
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
  const yearId = context.currentSchoolYear?.id ?? "__none__";

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

  return workflowStateOf({
    hasFamily: Boolean(student?.familyId),
    hasEnrolment: enrolment !== null,
    hasClass: Boolean(enrolment?.schoolClassId),
    hasFees: (enrolment?._count.fees ?? 0) > 0,
  });
}

/** Pupils not yet seated in a class this year — what the roster screen offers. */
export async function listUnassignedStudents(
  context: AuthContext,
  levelOfferingId: string,
): Promise<{ id: string; enrollmentId: string; label: string }[]> {
  const enrollments = await db.enrollment.findMany({
    where: {
      schoolYearId: context.currentSchoolYear?.id ?? "__none__",
      levelOfferingId,
      schoolClassId: null,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: [{ student: { lastName: "asc" } }],
    select: {
      id: true,
      student: { select: { id: true, code: true, firstName: true, lastName: true } },
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

/** Live counts for the school-life dashboard, scoped like the list. */
export async function countStudents(
  context: AuthContext,
): Promise<{ total: number; enrolled: number; preRegistered: number }> {
  const scope = schoolScope(context);

  const [total, enrolled, preRegistered] = await Promise.all([
    db.student.count({ where: scope }),
    db.student.count({ where: { ...scope, status: "ENROLLED" } }),
    db.student.count({ where: { ...scope, status: "PRE_REGISTERED" } }),
  ]);

  return { total, enrolled, preRegistered };
}
