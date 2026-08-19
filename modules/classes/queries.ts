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
          username: true,
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
          username: true,
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
              username: true,
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
  /** For the mailto in the pupil's file. Null when the school holds no address
   *  for this teacher — see User.email. */
  teacherEmail: string | null;
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
          username: true,
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
          username: true,
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

// ── The class's own dashboard ─────────────────────────────────────────────────

/** One line of the level's programme, as the overview prints it. */
export type ProgrammeLine = {
  subjectId: string;
  subjectLabel: string;
  /** The short form a school writes on a grid — what a chart axis can hold. */
  subjectShort: string;
  /** Null where the school has declared the subject but not its hours. */
  weeklyMinutes: number | null;
  coefficient: number;
  /** Who holds it in *this* class. Null is a gap, and drawn as one. */
  teacherName: string | null;
};

/** A sister class: the others opened at the same niveau this year. */
export type SisterClass = {
  id: string;
  code: string;
  /** The filière, where the niveau streams into them. Null where it does not. */
  trackLabel: string | null;
  enrolled: number;
  capacity: number | null;
  /** True for the class being looked at, so the row can be marked. */
  isCurrent: boolean;
  /**
   * True where the class sits at the *same offering* — the same niveau and the
   * same filière — and therefore follows the same programme.
   *
   * The distinction is not decoration: it is exactly the set a niveau-wide round
   * of contrôles is generated for (`levelOfferingId`, see
   * `generateAssessmentsAction`). 2BAC has five classes and five filières, so
   * "every class of the niveau" and "every class this round reaches" are
   * different lists, and a panel that showed one while the button beside it acted
   * on the other would be inviting a mistake.
   */
  sharesProgramme: boolean;
};

export type ClassOverview = {
  /** ── This class ── */
  enrolled: number;
  capacity: number | null;
  girls: number;
  boys: number;
  repeating: number;
  /** Whole years, derived from the birth dates — never stored. Null on an
   *  empty class, where a mean would be a division by zero. */
  averageAge: number | null;
  groupCount: number;
  /** Subjects on the programme, and how many have somebody answering for them. */
  subjectCount: number;
  staffedCount: number;
  /** Periods on the week's grid, against what the programme asks for. */
  placedPeriods: number;
  programmeMinutes: number;
  /**
   * How long one period rings for, so placed periods and declared minutes can be
   * compared at all. From the school's own settings, like everything else that
   * turns hours into periods.
   */
  periodMinutes: number;
  programme: ProgrammeLine[];

  /** ── The niveau this class sits at ── */
  levelLabel: string;
  levelNameLabel: string;
  cycleName: string;
  /** What the school planned to seat at this niveau, across every class. */
  plannedCapacity: number | null;
  sisters: SisterClass[];
  levelEnrolled: number;
  levelCapacity: number | null;
};

/**
 * The figures the class's first tab opens on: this class, and the niveau it
 * belongs to.
 *
 * ── Why the niveau is on a class's screen at all ────────────────────────────
 * Almost nothing a head of studies asks about a class is answerable by the class
 * alone. "Is 3AP-A full?" means *compared with 3AP-B*; "is it staffed?" means
 * against the programme the niveau declares, not against whatever assignments
 * happen to exist; "why is the timetable short?" means against the hours the
 * niveau asks for. Every one of those was two screens away, so the answer was
 * usually guessed.
 *
 * So the tab is deliberately two panels and not one, and the second is the
 * niveau: its programme with this class's holder beside each line, and its other
 * classes with their fill beside this one's.
 *
 * ── What is derived and what is counted ─────────────────────────────────────
 * The roll counts only enrolments still holding a place (`seated`), the same
 * rule the list and the occupancy gauge use — a child who left in November keeps
 * their row and is not in a chair. The age is derived from the birth dates, as
 * everywhere else in this app. Nothing here is stored.
 */
export async function loadClassOverview(
  context: AuthContext,
  schoolClassId: string,
): Promise<ClassOverview | null> {
  const schoolClass = await db.schoolClass.findFirst({
    // Scoped like `findClass`: a class from another school or year reads as
    // absent rather than forbidden.
    where: {
      id: schoolClassId,
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
    },
    select: {
      id: true,
      capacity: true,
      levelOfferingId: true,
      levelOffering: {
        select: {
          plannedCapacity: true,
          // The class's own year, which is what its programme is read against —
          // a class of 2024-2025 keeps the coefficients of 2024-2025.
          schoolYearId: true,
          levelId: true,
          trackId: true,
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
      _count: { select: { groups: true, timetableEntries: true } },
      enrollments: {
        where: { status: { in: [...LIVE_ENROLMENT_STATUSES] } },
        select: {
          isRepeating: true,
          student: { select: { gender: true, birthDate: true } },
        },
      },
      assignments: {
        select: {
          subjectId: true,
          isPrimary: true,
          teacher: {
            select: {
              username: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
  if (!schoolClass) return null;

  const offering = schoolClass.levelOffering;

  const [programmeRows, sisters] = await Promise.all([
    db.levelSubject.findMany({
      /*
        Assignable matières only — a `Subject` with a parent is a *component*
        (conjugaison inside français, إملاء inside اللغة العربية). It is marked
        inside its parent and never taught in its own hour, which is why the
        teaching grid filters it out too.

        Load-bearing for the tile above it, not tidiness: with the components in,
        3AP-A read "11 of 19 subjects covered" and the eight it was apparently
        short were four components nobody teaches separately and never will. The
        tab next door would have shown eleven of eleven at the same moment.
      */
      where: {
        // The class's own year, not the one in the header: a class opened last
        // year is read with last year's programme however the context has moved
        // on since. See LevelSubject.
        schoolYearId: offering.schoolYearId,
        levelId: offering.levelId,
        subject: { isActive: true, parentId: null },
      },
      orderBy: [{ position: "asc" }],
      select: {
        subjectId: true,
        trackId: true,
        weeklyMinutes: true,
        coefficient: true,
        subject: {
          select: { name: true, nameAr: true, shortName: true, code: true },
        },
      },
    }),
    /*
      Every class opened at this *niveau* this year, this one included — the
      comparison is the point, so it is drawn beside its siblings rather than
      apart from them.

      By niveau and not by offering: 2BAC streams into five filières, so scoping
      to the offering would show 2BAC-SM-A a table containing only itself. Which
      of them share this class's programme is marked per row instead — see
      `sharesProgramme`.
    */
    db.schoolClass.findMany({
      where: {
        isActive: true,
        levelOffering: {
          levelId: offering.levelId,
          // Still this year's, through the same clause every read here uses. A
          // niveau outlives a year; the classes at it do not.
          ...yearScope(context),
        },
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        capacity: true,
        levelOfferingId: true,
        levelOffering: { select: { track: { select: { code: true } } } },
        _count: { select: { ...seated().select } },
      },
    }),
  ]);

  /*
    The niveau's programme resolved for *this* class's filière.

    `resolveProgrammeRows` is the same helper the teaching grid and the generator
    use: a row naming a filière applies only to it, a row naming none applies to
    every filière, and the specific one wins. Resolving it here rather than
    filtering by hand is what stops this panel disagreeing with the tab next to
    it about what the class is even meant to be taught.
  */
  const programme = resolveProgrammeRows(programmeRows, offering.trackId);

  // Whoever answers for the marks, where the subject is co-taught — the primary
  // holder, matching the teaching grid.
  const holderBySubject = new Map<string, string>();
  for (const assignment of schoolClass.assignments) {
    if (!assignment.teacher) continue;
    const held = holderBySubject.get(assignment.subjectId);
    if (held && !assignment.isPrimary) continue;
    holderBySubject.set(assignment.subjectId, displayName(assignment.teacher));
  }

  const seatedRoll = schoolClass.enrollments;
  const birthDates = seatedRoll
    .map((entry) => entry.student.birthDate)
    .filter((date): date is Date => date !== null);

  return {
    enrolled: seatedRoll.length,
    capacity: schoolClass.capacity,
    girls: seatedRoll.filter((entry) => entry.student.gender === "FEMALE").length,
    boys: seatedRoll.filter((entry) => entry.student.gender === "MALE").length,
    repeating: seatedRoll.filter((entry) => entry.isRepeating).length,
    averageAge:
      birthDates.length === 0
        ? null
        : Math.round(
            (birthDates.reduce((total, date) => total + yearsSince(date), 0) /
              birthDates.length) *
              10,
          ) / 10,
    groupCount: schoolClass._count.groups,
    subjectCount: programme.length,
    staffedCount: programme.filter((row) => holderBySubject.has(row.subjectId))
      .length,
    placedPeriods: schoolClass._count.timetableEntries,
    programmeMinutes: programme.reduce(
      (total, row) => total + (row.weeklyMinutes ?? 0),
      0,
    ),
    periodMinutes: context.settings.periodMinutes,
    programme: programme.map((row) => ({
      subjectId: row.subjectId,
      subjectLabel: bilingual(row.subject.name, row.subject.nameAr),
      subjectShort: row.subject.shortName ?? row.subject.code,
      weeklyMinutes: row.weeklyMinutes,
      coefficient: row.coefficient,
      teacherName: holderBySubject.get(row.subjectId) ?? null,
    })),

    levelLabel: offering.track
      ? `${offering.level.code} ${offering.track.code}`
      : offering.level.code,
    levelNameLabel: levelNameLabel(offering.level, offering.track),
    cycleName: cycleChoiceLabel(offering.level.educationLevel),
    plannedCapacity: offering.plannedCapacity,
    sisters: sisters.map((sister) => ({
      id: sister.id,
      code: sister.code,
      trackLabel: sister.levelOffering.track?.code ?? null,
      enrolled: sister._count.enrollments,
      capacity: sister.capacity,
      isCurrent: sister.id === schoolClass.id,
      sharesProgramme: sister.levelOfferingId === schoolClass.levelOfferingId,
    })),
    levelEnrolled: sisters.reduce(
      (total, sister) => total + sister._count.enrollments,
      0,
    ),
    // Null when no class at the niveau states one: summing the ones that do
    // would print a ceiling lower than the roll it is compared against.
    levelCapacity: sisters.every((sister) => sister.capacity === null)
      ? null
      : sisters.reduce((total, sister) => total + (sister.capacity ?? 0), 0),
  };
}

/**
 * Whole years between a date and today.
 *
 * Written out rather than `(now - then) / 31_557_600_000`: that is wrong for
 * anybody whose birthday has not come round yet this year, which is half the
 * class, and an average age is exactly where the half-year drift shows.
 */
function yearsSince(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  return age;
}
