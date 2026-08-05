import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { currentSchoolId, yearScope } from "@/lib/scope";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";

/**
 * Reads for the classes module.
 *
 * Confined to `context.currentSchoolYear` throughout — a class belongs to one
 * year, and its roster is the set of enrolments seated in it, so reading either
 * outside the selected year would show last year's cohort.
 */

/**
 * How many pupils a class actually holds.
 *
 * Only enrolments that still hold a place: a child who transferred out in
 * November keeps their `Enrollment` row seated in the class — that is the point
 * of the row — but they are not occupying a chair in December. Counting them
 * put the vie scolaire occupancy gauge above 100% for a school with any
 * turnover at all, and made this module's roll disagree with
 * `loadEnrolmentStats`, which has always counted ACTIVE and PENDING only.
 *
 * The roster on the class detail screen is deliberately *not* filtered this way
 * — it shows the year's whole history with a status against each name.
 */
function seated() {
  return {
    select: {
      enrollments: { where: { status: { in: [...LIVE_ENROLMENT_STATUSES] } } },
    },
  };
}

export type ClassRow = {
  id: string;
  code: string;
  name: string | null;
  section: string | null;
  levelLabel: string;
  levelName: string;
  capacity: number | null;
  enrolled: number;
  mainTeacherName: string | null;
  roomCode: string | null;
  groupCount: number;
  assignmentCount: number;
  timetableCount: number;
  isActive: boolean;
};

export type RosterEntry = {
  enrollmentId: string;
  studentId: string;
  code: string;
  firstName: string;
  lastName: string;
  gender: string;
  /** `YYYY-MM-DD`; age is derived, never stored. */
  birthDate: string;
  photoUrl: string | null;
  status: string;
  classGroupId: string | null;
  groupLabel: string | null;
  isRepeating: boolean;
};

export type AssignmentRow = {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classGroupId: string | null;
  groupLabel: string | null;
  weeklyMinutes: number | null;
  isPrimary: boolean;
};

export type ClassDetail = ClassRow & {
  levelOfferingId: string;
  groups: {
    id: string;
    code: string;
    label: string;
    capacity: number | null;
  }[];
  roster: RosterEntry[];
  assignments: AssignmentRow[];
};

const levelLabelOf = (offering: {
  level: { code: string };
  track: { code: string } | null;
}) =>
  offering.track
    ? `${offering.level.code} ${offering.track.code}`
    : offering.level.code;

export async function listClasses(context: AuthContext): Promise<ClassRow[]> {
  const classes = await db.schoolClass.findMany({
    where: { levelOffering: yearScope(context) },
    orderBy: [
      { levelOffering: { level: { gradeYear: "asc" } } },
      { code: "asc" },
    ],
    include: {
      levelOffering: {
        select: {
          level: { select: { code: true, name: true } },
          track: { select: { code: true } },
        },
      },
      mainTeacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      room: { select: { code: true } },
      _count: {
        select: {
          groups: true,
          assignments: true,
          timetableEntries: true,
          ...seated().select,
        },
      },
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    section: schoolClass.section,
    levelLabel: levelLabelOf(schoolClass.levelOffering),
    levelName: schoolClass.levelOffering.level.name,
    capacity: schoolClass.capacity,
    enrolled: schoolClass._count.enrollments,
    mainTeacherName: schoolClass.mainTeacher
      ? displayName(schoolClass.mainTeacher)
      : null,
    roomCode: schoolClass.room?.code ?? null,
    groupCount: schoolClass._count.groups,
    assignmentCount: schoolClass._count.assignments,
    timetableCount: schoolClass._count.timetableEntries,
    isActive: schoolClass.isActive,
  }));
}

/**
 * One class with its roster and its staffing. Null when out of reach — callers
 * turn that into `notFound()`.
 */
export async function findClass(
  context: AuthContext,
  schoolClassId: string,
): Promise<ClassDetail | null> {
  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
    },
    include: {
      levelOffering: {
        select: {
          id: true,
          level: { select: { code: true, name: true } },
          track: { select: { code: true } },
        },
      },
      mainTeacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      room: { select: { code: true } },
      groups: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, capacity: true },
      },
      enrollments: {
        orderBy: [
          { student: { lastName: "asc" } },
          { student: { firstName: "asc" } },
        ],
        select: {
          id: true,
          status: true,
          isRepeating: true,
          classGroupId: true,
          classGroup: { select: { code: true, name: true } },
          student: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              gender: true,
              birthDate: true,
              photoUrl: true,
            },
          },
        },
      },
      assignments: {
        orderBy: [{ subject: { code: "asc" } }],
        select: {
          id: true,
          subjectId: true,
          teacherId: true,
          classGroupId: true,
          weeklyMinutes: true,
          isPrimary: true,
          subject: { select: { code: true, name: true } },
          teacher: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          classGroup: { select: { code: true, name: true } },
        },
      },
      _count: {
        select: {
          groups: true,
          assignments: true,
          timetableEntries: true,
          ...seated().select,
        },
      },
    },
  });

  if (!schoolClass) return null;

  return {
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    section: schoolClass.section,
    levelOfferingId: schoolClass.levelOffering.id,
    levelLabel: levelLabelOf(schoolClass.levelOffering),
    levelName: schoolClass.levelOffering.level.name,
    capacity: schoolClass.capacity,
    enrolled: schoolClass._count.enrollments,
    mainTeacherName: schoolClass.mainTeacher
      ? displayName(schoolClass.mainTeacher)
      : null,
    roomCode: schoolClass.room?.code ?? null,
    groupCount: schoolClass._count.groups,
    assignmentCount: schoolClass._count.assignments,
    timetableCount: schoolClass._count.timetableEntries,
    isActive: schoolClass.isActive,
    groups: schoolClass.groups.map((group) => ({
      id: group.id,
      code: group.code,
      label: group.name ?? group.code,
      capacity: group.capacity,
    })),
    roster: schoolClass.enrollments.map((enrolment) => ({
      enrollmentId: enrolment.id,
      studentId: enrolment.student.id,
      code: enrolment.student.code,
      firstName: enrolment.student.firstName,
      lastName: enrolment.student.lastName,
      gender: enrolment.student.gender,
      birthDate: toDateInputValue(enrolment.student.birthDate),
      photoUrl: enrolment.student.photoUrl,
      status: enrolment.status,
      classGroupId: enrolment.classGroupId,
      groupLabel: enrolment.classGroup
        ? (enrolment.classGroup.name ?? enrolment.classGroup.code)
        : null,
      isRepeating: enrolment.isRepeating,
    })),
    assignments: schoolClass.assignments.map((assignment) => ({
      id: assignment.id,
      subjectId: assignment.subjectId,
      subjectCode: assignment.subject.code,
      subjectName: assignment.subject.name,
      teacherId: assignment.teacherId,
      teacherName: displayName(assignment.teacher),
      classGroupId: assignment.classGroupId,
      groupLabel: assignment.classGroup
        ? (assignment.classGroup.name ?? assignment.classGroup.code)
        : null,
      weeklyMinutes: assignment.weeklyMinutes,
      isPrimary: assignment.isPrimary,
    })),
  };
}

/** One of a pupil's teachers, as their file lists them. */
export type PupilTeacherRow = {
  assignmentId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  /** Set only for a subject split by group — "the other half's teacher". */
  groupLabel: string | null;
  /** Answerable for the marks when a subject is co-taught. */
  isPrimary: boolean;
  weeklyMinutes: number | null;
};

/**
 * Who teaches one pupil, this year.
 *
 * ── Why the group matters ───────────────────────────────────────────────────
 * An assignment with no `classGroupId` covers the whole class; one with a group
 * covers that half only. A pupil in group A is taught by the whole-class
 * teachers *and* by group A's — and must not be shown group B's, which is a
 * different person taking a different room at the same hour. Filtering on
 * "null or mine" is the whole of that rule.
 *
 * Lives here rather than in the students module because `TeachingAssignment` is
 * this module's table: a pupil's screen reads it through this function, and the
 * year and school scoping stay in one place.
 */
export async function listPupilTeachers(
  context: AuthContext,
  schoolClassId: string,
  classGroupId: string | null,
): Promise<PupilTeacherRow[]> {
  const assignments = await db.teachingAssignment.findMany({
    where: {
      schoolClassId,
      // The class id reaches this from a pupil's enrolment, so it is re-derived
      // against the working school and year rather than trusted.
      schoolClass: {
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
      },
      OR: [
        { classGroupId: null },
        ...(classGroupId ? [{ classGroupId }] : []),
      ],
    },
    orderBy: [{ subject: { code: "asc" } }, { isPrimary: "desc" }],
    select: {
      id: true,
      subjectId: true,
      classGroupId: true,
      weeklyMinutes: true,
      isPrimary: true,
      subject: { select: { code: true, name: true } },
      teacher: {
        select: {
          id: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      classGroup: { select: { code: true, name: true } },
    },
  });

  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    subjectId: assignment.subjectId,
    subjectName: assignment.subject.name,
    subjectCode: assignment.subject.code,
    teacherId: assignment.teacher.id,
    teacherName: displayName(assignment.teacher),
    teacherEmail: assignment.teacher.email,
    groupLabel: assignment.classGroup
      ? (assignment.classGroup.name ?? assignment.classGroup.code)
      : null,
    isPrimary: assignment.isPrimary,
    weeklyMinutes: assignment.weeklyMinutes,
  }));
}

/** Live figures for the school-life dashboard: how full each class is. */
export async function loadClassFill(
  context: AuthContext,
): Promise<
  { id: string; code: string; enrolled: number; capacity: number | null }[]
> {
  const classes = await db.schoolClass.findMany({
    where: { levelOffering: yearScope(context), isActive: true },
    orderBy: [
      { levelOffering: { level: { gradeYear: "asc" } } },
      { code: "asc" },
    ],
    select: {
      id: true,
      code: true,
      capacity: true,
      _count: seated(),
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    capacity: schoolClass.capacity,
    enrolled: schoolClass._count.enrollments,
  }));
}

/** Matches a class code for the header search. */
export async function searchClasses(
  context: AuthContext,
  term: string,
  take = 4,
): Promise<
  { id: string; code: string; levelLabel: string; enrolled: number }[]
> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const classes = await db.schoolClass.findMany({
    where: {
      levelOffering: yearScope(context),
      OR: [{ code: { contains: trimmed } }, { name: { contains: trimmed } }],
    },
    orderBy: { code: "asc" },
    take,
    select: {
      id: true,
      code: true,
      levelOffering: {
        select: {
          level: { select: { code: true } },
          track: { select: { code: true } },
        },
      },
      _count: seated(),
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    levelLabel: levelLabelOf(schoolClass.levelOffering),
    enrolled: schoolClass._count.enrollments,
  }));
}
