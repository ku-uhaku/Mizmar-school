import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/utils";
import { currentSchoolId, yearScope } from "@/lib/scope";
import { resolveProgrammeRows } from "@/modules/academics/enums";
import {
  bilingual,
  cycleChoiceLabel,
  levelChoiceLabel,
  levelNameLabel,
} from "@/modules/academics/labels";
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
  /** The Ministry short form — "3AP", "1BAC SM". The badge, and what the
   *  level filter matches on, so it must not change with the language. */
  levelLabel: string;
  levelName: string;
  /** Both names and the code, as every niveau is written — see
   *  modules/academics/labels.ts. The filter's label, and searchable. */
  levelOptionLabel: string;
  /** Both names without the code, for the cell that already badges the code. */
  levelNameLabel: string;
  /** The cycle the level belongs to, in both languages. */
  cycleName: string;
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

/** What the level column and the level filter need beyond the short code. */
const levelNamingOf = (offering: {
  level: {
    code: string;
    name: string;
    nameAr: string | null;
    educationLevel: { name: string; nameAr: string | null };
  };
  track: { name: string; nameAr: string | null } | null;
}) => ({
  levelOptionLabel: levelChoiceLabel(offering.level, offering.track),
  levelNameLabel: levelNameLabel(offering.level, offering.track),
  cycleName: cycleChoiceLabel(offering.level.educationLevel),
});

export async function listClasses(context: AuthContext): Promise<ClassRow[]> {
  const classes = await db.schoolClass.findMany({
    where: { levelOffering: yearScope(context) },
    // Cycle before year, so the levels the filter groups stay contiguous.
    orderBy: [
      { levelOffering: { level: { educationLevel: { position: "asc" } } } },
      { levelOffering: { level: { gradeYear: "asc" } } },
      { code: "asc" },
    ],
    include: {
      levelOffering: {
        select: {
          level: {
            select: {
              code: true,
              name: true,
              nameAr: true,
              educationLevel: { select: { name: true, nameAr: true } },
            },
          },
          track: { select: { code: true, name: true, nameAr: true } },
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
    ...levelNamingOf(schoolClass.levelOffering),
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
          level: {
            select: {
              code: true,
              name: true,
              nameAr: true,
              educationLevel: { select: { name: true, nameAr: true } },
            },
          },
          track: { select: { code: true, name: true, nameAr: true } },
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
    ...levelNamingOf(schoolClass.levelOffering),
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
      OR: [{ classGroupId: null }, ...(classGroupId ? [{ classGroupId }] : [])],
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

export type TeacherDutyRow = {
  id: string;
  schoolClassId: string;
  classCode: string;
  levelLabel: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** Null when the assignment covers the whole class rather than one group. */
  groupLabel: string | null;
  weeklyMinutes: number | null;
  isPrimary: boolean;
  /** Pupils seated in the class — the group's own count is not kept here. */
  enrolled: number;
};

/**
 * What one teacher teaches this year: the classes, the subjects and the load.
 *
 * Takes a **user** id rather than a staff id, because `TeachingAssignment`
 * points at the account and not at the employment record — see the note on
 * `TeachingAssignment.teacherId`. The employee file is what joins the two, so
 * this stays a plain read over the classes module's own table and the RH module
 * calls it with `Staff.userId`.
 *
 * Scoped by the year in context, like every other read here: last year's
 * timetable is not this teacher's service.
 */
export async function listTeacherDuties(
  context: AuthContext,
  teacherUserId: string,
): Promise<TeacherDutyRow[]> {
  const assignments = await db.teachingAssignment.findMany({
    where: {
      teacherId: teacherUserId,
      schoolClass: { levelOffering: yearScope(context) },
    },
    orderBy: [{ schoolClass: { code: "asc" } }, { subject: { code: "asc" } }],
    select: {
      id: true,
      weeklyMinutes: true,
      isPrimary: true,
      subject: { select: { id: true, code: true, name: true } },
      classGroup: { select: { code: true, name: true } },
      schoolClass: {
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
      },
    },
  });

  return assignments.map((assignment) => ({
    id: assignment.id,
    schoolClassId: assignment.schoolClass.id,
    classCode: assignment.schoolClass.code,
    levelLabel: levelLabelOf(assignment.schoolClass.levelOffering),
    subjectId: assignment.subject.id,
    subjectCode: assignment.subject.code,
    subjectName: assignment.subject.name,
    groupLabel: assignment.classGroup
      ? (assignment.classGroup.name ?? assignment.classGroup.code)
      : null,
    weeklyMinutes: assignment.weeklyMinutes,
    isPrimary: assignment.isPrimary,
    enrolled: assignment.schoolClass._count.enrollments,
  }));
}

// ── Who teaches what, read off the programme ─────────────────────────────────

export type TeachingGridRow = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** The matière in both languages — what the grid prints. */
  subjectLabel: string;
  /** What the programme says the class owes this subject each week. */
  weeklyMinutes: number | null;
  /**
   * The components this matière is marked in — القراءة, الإملاء and the rest.
   *
   * Shown under the row for context and given no picker of their own: they are
   * taught by whoever teaches the matière. Empty for a subject with no
   * components, which is most of them.
   */
  components: { id: string; code: string; label: string }[];
  /** Null when the post is vacant, which is the whole point of the grid. */
  teacherId: string | null;
  teacherName: string | null;
  /** The row being edited, when one exists — what a clear deletes. */
  assignmentId: string | null;
};

/**
 * The class's programme, with whoever currently answers for each subject.
 *
 * ── Why this is driven by the programme and not by the assignments ──────────
 * The list of assignments answers "who has been given something", which is the
 * question nobody is asking. A head of studies opening this screen in September
 * wants the opposite: *what is still unstaffed*. A subject with no teacher is
 * invisible on a list of assignments and is exactly the hole that surfaces
 * three weeks later as a contrôle that could not be generated — see the
 * `unstaffed` refusal in `generateAssessments`, which exists because the paper
 * would otherwise be written with a null teacher and never marked.
 *
 * So every marked subject of the level gets a row whether or not anybody holds
 * it, and a vacancy is a visible blank rather than an absence.
 *
 * ── One picker per matière, not per component ───────────────────────────────
 * A row is a subject *as taught*: "Karim teaches Arabic to 1AP-A". The
 * components it is marked in — القراءة, الإملاء, التعبير الكتابي — are the same
 * lesson by the same teacher, and `generateAssessments` already says so, since
 * it resolves a component's teacher by falling back to its parent's assignment.
 * Offering a picker per component would invite four answers to a question with
 * one, and three of them would be the ones the fallback then ignores.
 *
 * So components are listed under their matière and hold no picker.
 *
 * Only the primary whole-class holder is resolved here. A co-taught subject or
 * one split across groups keeps its extra rows, which the dialog still manages —
 * this grid is the one answer per subject that mark entry and report cards read.
 */
export async function loadTeachingGrid(
  context: AuthContext,
  schoolClassId: string,
): Promise<TeachingGridRow[]> {
  const schoolClass = await db.schoolClass.findFirst({
    // The id comes from the URL; the school and year come from the session.
    where: {
      id: schoolClassId,
      schoolId: currentSchoolId(context),
      levelOffering: yearScope(context),
    },
    select: {
      id: true,
      levelOffering: {
        select: {
          trackId: true,
          level: {
            select: {
              subjects: {
                select: {
                  subjectId: true,
                  trackId: true,
                  weeklyMinutes: true,
                  position: true,
                  subject: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      nameAr: true,
                      parentId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!schoolClass) return [];

  // A track-specific row wins over the level-wide one, through the same
  // resolver the programme screen and the mark sheet use — done by hand here it
  // would be a last-write-wins loop over an unordered query.
  const programme = resolveProgrammeRows(
    schoolClass.levelOffering.level.subjects,
    schoolClass.levelOffering.trackId,
  );

  const assignments = await db.teachingAssignment.findMany({
    where: {
      schoolClassId: schoolClass.id,
      isPrimary: true,
      // The whole class's holder, not a group's — see the note above.
      classGroupId: null,
    },
    select: {
      id: true,
      subjectId: true,
      teacherId: true,
      teacher: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const holderOf = new Map(
    assignments.map((assignment) => [assignment.subjectId, assignment]),
  );

  // The components, grouped under whichever matière they belong to, so each
  // assignable row can carry its own without a second pass per row.
  const componentsOf = new Map<string, { id: string; code: string; label: string }[]>();
  for (const row of programme) {
    const parentId = row.subject.parentId;
    if (parentId === null) continue;

    componentsOf.set(parentId, [
      ...(componentsOf.get(parentId) ?? []),
      {
        id: row.subject.id,
        code: row.subject.code,
        label: bilingual(row.subject.name, row.subject.nameAr),
      },
    ]);
  }

  return programme
    .filter((row) => row.subject.parentId === null)
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const held = holderOf.get(row.subjectId);
      return {
        subjectId: row.subject.id,
        subjectCode: row.subject.code,
        subjectName: row.subject.name,
        subjectLabel: bilingual(row.subject.name, row.subject.nameAr),
        weeklyMinutes: row.weeklyMinutes,
        components: componentsOf.get(row.subject.id) ?? [],
        teacherId: held?.teacherId ?? null,
        teacherName: held?.teacher ? displayName(held.teacher) : null,
        assignmentId: held?.id ?? null,
      };
    });
}
