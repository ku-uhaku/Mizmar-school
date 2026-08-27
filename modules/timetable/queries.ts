import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { displayName } from "@/lib/dal";
import { teachingDaysOf } from "@/lib/school-settings";
import {
  currentSchoolId,
  currentSchoolYearId,
  teacherOfSchool,
  yearScope,
} from "@/lib/scope";
import {
  bilingual,
  cycleChoiceLabel,
  levelNameLabel,
} from "@/modules/academics/labels";
import {
  addDays,
  atMidnight,
  isWithin,
  resolveWeek,
  schoolWeeks,
  toDateKey,
  type SchoolWeek,
} from "@/modules/timetable/weeks";
import { runsInWeekNumber } from "@/modules/timetable/enums";
import { periodsFromMinutes } from "@/modules/timetable/generator";

/**
 * Reads for the timetable module.
 *
 * Everything is confined to `context.currentSchoolYear`: the bell schedule is
 * renegotiated each year, and reading last year's slots against this year's
 * classes would draw a grid out of nothing.
 */

/** One column of the grid — a period, as it recurs across the week. */
export type SlotColumn = {
  key: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
};

export type TimetableEntryView = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectShort: string;
  colorHex: string | null;
  teacherId: string | null;
  teacherName: string | null;
  roomId: string | null;
  roomCode: string | null;
  classGroupId: string | null;
  groupLabel: string | null;
  termId: string | null;
  /** "ALL" | "A" | "B" — which weeks of the rotation the lesson runs in. */
  weekParity: string;
  /**
   * How many consecutive periods this lesson runs for — 2 for a double period.
   *
   * Each period is still its own row (see the note in service.ts); this is the
   * display span, worked out by merging the run below.
   */
  span: number;
  /** Every row the block is made of, first period first. */
  entryIds: string[];
};

export type TimetableCell = {
  /** The slot this cell sits in. Null when the school does not teach then. */
  timeSlotId: string | null;
  isBreak: boolean;
  entry: TimetableEntryView | null;
  /**
   * True when this period is the *continuation* of a block that began earlier
   * in the day. The grid skips these — the first cell of the block spans over
   * them — but they still have to exist so the columns line up.
   */
  covered: boolean;
};

export type TimetableGrid = {
  columns: SlotColumn[];
  /**
   * How long one period rings for, in minutes.
   *
   * Carried so the screens can talk in hours while the placer counts periods —
   * see `periodsForMinutes`. The commonest column length rather than the mean:
   * one short slot at the end of Friday must not re-scale the whole grid.
   */
  periodMinutes: number;
  /** Indexed by ISO day (1 = Monday), then by column key. */
  rows: { dayOfWeek: number; cells: Record<string, TimetableCell> }[];
  scheduleKind: string;
  entryCount: number;
};

const slotKey = (startTime: string, endTime: string) => `${startTime}-${endTime}`;

/** `"08:30"` → 510. */
function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * The commonest column length, which is what "a period" means for this grid.
 *
 * The mode rather than the mean, for the same reason `modalDuration` in
 * service.ts uses it: a school with one 15-minute récréation column must not
 * have every lesson re-scaled by it.
 */
function modalColumnMinutes(
  columns: { startTime: string; endTime: string; isBreak: boolean }[],
): number {
  const tally = new Map<number, number>();
  for (const column of columns) {
    if (column.isBreak) continue;
    const length = minutesOfDay(column.endTime) - minutesOfDay(column.startTime);
    if (length > 0) tally.set(length, (tally.get(length) ?? 0) + 1);
  }

  let best = 30;
  let bestCount = 0;
  for (const [length, count] of tally) {
    if (count > bestCount) {
      best = length;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The week for one class, as a grid.
 *
 * Columns are the *distinct periods* of the bell schedule rather than the
 * TimeSlot rows themselves: a slot row is per day, so 08:00–09:00 exists six
 * times over, and a column per row would draw thirty-odd columns for a
 * six-column week. Days that do not run a period get a cell with no slot, which
 * is what greys Saturday afternoon out without special-casing it.
 */
export async function loadClassTimetable(
  context: AuthContext,
  schoolClassId: string,
  scheduleKind = "STANDARD",
  /**
   * The week being looked at. Lessons whose window does not cover it are left
   * out, so a grid shows what was — or will be — actually taught that week
   * rather than everything the class has ever had.
   *
   * Null draws the whole template, which is what a class file or a pupil's page
   * wants: they ask "what does this class do", not "what happened in week 12".
   */
  weekNumber: number | null = null,
): Promise<TimetableGrid | null> {
  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
    },
    select: { id: true },
  });
  if (!schoolClass) return null;

  const [slots, entries] = await Promise.all([
    db.timeSlot.findMany({
      where: { ...yearScope(context), scheduleKind, isActive: true },
      orderBy: [{ startTime: "asc" }, { dayOfWeek: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isBreak: true,
      },
    }),
    db.timetableEntry.findMany({
      where: { schoolClassId },
      select: {
        id: true,
        timeSlotId: true,
        subjectId: true,
        teacherId: true,
        roomId: true,
        classGroupId: true,
        termId: true,
        weekParity: true,
        fromWeek: true,
        toWeek: true,
        subject: {
          select: { name: true, shortName: true, code: true, colorHex: true },
        },
        teacher: {
          select: { username: true, profile: { select: { firstName: true, lastName: true } } },
        },
        room: { select: { code: true } },
        classGroup: { select: { code: true, name: true } },
      },
    }),
  ]);

  // Narrowed here rather than in the query: the window is two nullable columns
  // and the open-ended cases do not express cleanly as a `where`, while the
  // rule itself is one pure function shared with the clash check.
  const inForce = entries.filter((entry) =>
    runsInWeekNumber(
      { fromWeek: entry.fromWeek, toWeek: entry.toWeek },
      weekNumber,
    ),
  );

  const columnByKey = new Map<string, SlotColumn>();
  for (const slot of slots) {
    const key = slotKey(slot.startTime, slot.endTime);
    const existing = columnByKey.get(key);
    if (existing) {
      // A period is a break only if it is one on every day that runs it.
      existing.isBreak = existing.isBreak && slot.isBreak;
      continue;
    }
    columnByKey.set(key, {
      key,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBreak: slot.isBreak,
    });
  }

  const columns = [...columnByKey.values()].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  const entryBySlot = new Map(inForce.map((entry) => [entry.timeSlotId, entry]));

  /** Two rows are the same lesson when everything but the period matches. */
  const sameLesson = (
    a: (typeof entries)[number],
    b: (typeof entries)[number],
  ) =>
    a.subjectId === b.subjectId &&
    a.teacherId === b.teacherId &&
    a.roomId === b.roomId &&
    a.classGroupId === b.classGroupId &&
    a.termId === b.termId;

  const rows = teachingDaysOf(context.settings).map((dayOfWeek) => {
    const cells: Record<string, TimetableCell> = {};

    // Built column by column, looking back at the cell just filled: a lesson
    // that continues the previous period is folded into it rather than drawn
    // again. Merging here, once, is what lets the grid stay a plain table.
    let running: { key: string; entry: (typeof entries)[number] } | null = null;

    for (const column of columns) {
      const slot = slots.find(
        (candidate) =>
          candidate.dayOfWeek === dayOfWeek &&
          slotKey(candidate.startTime, candidate.endTime) === column.key,
      );

      if (!slot) {
        cells[column.key] = {
          timeSlotId: null,
          isBreak: false,
          entry: null,
          covered: false,
        };
        running = null;
        continue;
      }

      const entry = entryBySlot.get(slot.id) ?? null;

      // A break interrupts a run: 2h either side of the récréation is two
      // lessons, and drawing them as one would span the break itself.
      if (entry === null || slot.isBreak) {
        cells[column.key] = {
          timeSlotId: slot.id,
          isBreak: slot.isBreak,
          entry: null,
          covered: false,
        };
        running = null;
        continue;
      }

      if (running && sameLesson(running.entry, entry)) {
        const head = cells[running.key].entry;
        if (head) {
          head.span += 1;
          head.entryIds.push(entry.id);
        }
        cells[column.key] = {
          timeSlotId: slot.id,
          isBreak: false,
          entry: null,
          covered: true,
        };
        continue;
      }

      cells[column.key] = {
        timeSlotId: slot.id,
        isBreak: false,
        covered: false,
        entry: {
          id: entry.id,
          subjectId: entry.subjectId,
          subjectName: entry.subject.name,
          subjectShort: entry.subject.shortName ?? entry.subject.code,
          colorHex: entry.subject.colorHex,
          teacherId: entry.teacherId,
          teacherName: entry.teacher ? displayName(entry.teacher) : null,
          roomId: entry.roomId,
          roomCode: entry.room?.code ?? null,
          classGroupId: entry.classGroupId,
          groupLabel: entry.classGroup
            ? (entry.classGroup.name ?? entry.classGroup.code)
            : null,
          termId: entry.termId,
          weekParity: entry.weekParity,
          span: 1,
          entryIds: [entry.id],
        },
      };
      running = { key: column.key, entry };
    }

    return { dayOfWeek, cells };
  });

  return {
    columns,
    periodMinutes: modalColumnMinutes(columns),
    rows,
    scheduleKind,
    entryCount: inForce.length,
  };
}

/**
 * What a cell may be filled with: the class's own programme, the staff, the
 * rooms, its groups and the year's semesters.
 *
 * Subjects are the class's *programme* — the LevelSubject rows for its level,
 * for its own track plus the ones that apply to every track — rather than every
 * subject the school teaches. Offering 2BAC philosophy in a 1AP grid is how a
 * timetable gets filled with lessons that do not exist.
 */
export async function loadTimetableChoices(
  context: AuthContext,
  schoolClassId: string,
) {
  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
    },
    select: {
      id: true,
      levelOffering: { select: { levelId: true, trackId: true } },
      groups: {
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      },
      assignments: {
        select: {
          subjectId: true,
          teacherId: true,
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

  const { levelId, trackId } = schoolClass.levelOffering;

  const [programme, teachers, rooms, terms] = await Promise.all([
    db.levelSubject.findMany({
      where: {
        // This year's programme — see LevelSubject.
        ...yearScope(context),
        levelId,
        // Rows for this class's stream, plus the ones declared for every stream.
        OR: [{ trackId: null }, ...(trackId ? [{ trackId }] : [])],
        subject: { isActive: true },
      },
      orderBy: [{ position: "asc" }],
      select: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            nameAr: true,
            shortName: true,
            colorHex: true,
            parentId: true,
          },
        },
      },
    }),
    db.user.findMany({
      // Teachers, not the payroll — see `teacherOfSchool`. The wider test put
      // the manager and the secretary on the timetable's teacher select.
      where: {
        organizationId: context.organization.id,
        ...teacherOfSchool(currentSchoolId(context)),
      },
      orderBy: [{ profile: { lastName: "asc" } }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    }),
    db.room.findMany({
      where: { schoolId: currentSchoolId(context), isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, capacity: true },
    }),
    db.term.findMany({
      where: yearScope(context),
      orderBy: { number: "asc" },
      select: { id: true, name: true, nameAr: true, number: true },
    }),
  ]);

  // Components are marked inside their parent, never taught in their own hour.
  const subjects = programme
    .map((row) => row.subject)
    .filter((subject) => subject.parentId === null)
    .filter(
      (subject, index, all) =>
        all.findIndex((other) => other.id === subject.id) === index,
    );

  /** Who is already assigned to teach each subject to this class. */
  const teacherBySubject: Record<string, string> = {};
  for (const assignment of schoolClass.assignments) {
    teacherBySubject[assignment.subjectId] ??= assignment.teacherId;
  }

  return {
    // Both names on each, since the dialog reads them rather than matches on
    // them — see modules/academics/labels.ts.
    subjects: subjects.map(({ nameAr, ...subject }) => ({
      ...subject,
      label: bilingual(subject.name, nameAr),
    })),
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      label: displayName(teacher),
    })),
    rooms,
    terms: terms.map(({ nameAr, ...term }) => ({
      ...term,
      label: bilingual(term.name, nameAr),
    })),
    groups: schoolClass.groups.map((group) => ({
      id: group.id,
      label: group.name ?? group.code,
    })),
    teacherBySubject,
  };
}

/** One subject of the programme the class's week does not yet hold in full. */
export type ProgrammeGap = {
  subjectId: string;
  /** Both names, since this is read rather than matched on. */
  subjectLabel: string;
  /** Periods the programme asks for, and the periods the grid actually holds. */
  wanted: number;
  placed: number;
  /** What is left to place, in minutes — the screen talks in hours. */
  missingMinutes: number;
  /** Nobody is affected to teach it to this class, so no draw could place it. */
  unstaffed: boolean;
};

export type ProgrammeCoverage = {
  gaps: ProgrammeGap[];
  /**
   * On the programme, but with no weekly volume anywhere — neither on the
   * niveau's row nor on the class's affectation. Nothing to place, and no
   * generator run will ever place it: the hours have to be declared first.
   */
  undeclared: { subjectId: string; subjectLabel: string }[];
};

/**
 * What the class's programme asks for, against what its week actually holds.
 *
 * ── Why this is derived and not remembered ──────────────────────────────────
 * The generator already knows what it could not fit — it says so on the preview
 * — but that answer dies with the dialog. The reader who needs it is the one
 * looking at the grid afterwards, wondering which two hours of physics they now
 * have to place by hand, and a toast that has faded is no help to them. Read
 * back from the programme, the same shortfall keeps being true after a refresh,
 * after a manual edit that undoes it, and for a week nobody generated at all.
 *
 * The arithmetic is `buildTimetableDraft`'s, deliberately: the volume comes from
 * the class's own affectation when it has one and from the niveau's row
 * otherwise, components are not counted (they are marked inside their matière,
 * never taught in their own hour), and a subject declared for one stream beats
 * the row declared for every stream.
 */
export async function loadProgrammeCoverage(
  context: AuthContext,
  schoolClassId: string,
  scheduleKind = "STANDARD",
): Promise<ProgrammeCoverage> {
  const empty: ProgrammeCoverage = { gaps: [], undeclared: [] };

  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
    },
    select: {
      id: true,
      levelOffering: { select: { levelId: true, trackId: true } },
      assignments: {
        select: {
          subjectId: true,
          weeklyMinutes: true,
          isPrimary: true,
        },
      },
    },
  });
  if (!schoolClass) return empty;

  const { levelId, trackId } = schoolClass.levelOffering;

  const [programme, slots, entries] = await Promise.all([
    db.levelSubject.findMany({
      where: {
        // This year's programme — see LevelSubject.
        ...yearScope(context),
        levelId,
        // This class's stream, plus the rows declared for every stream.
        OR: [{ trackId: null }, ...(trackId ? [{ trackId }] : [])],
        subject: { isActive: true },
      },
      orderBy: [{ position: "asc" }],
      select: {
        trackId: true,
        weeklyMinutes: true,
        subject: {
          select: { id: true, name: true, nameAr: true, parentId: true },
        },
      },
    }),
    db.timeSlot.findMany({
      where: { ...yearScope(context), scheduleKind, isActive: true },
      select: { startTime: true, endTime: true, isBreak: true },
    }),
    // Everything on this class's grid for the bell schedule in view. Counted
    // per subject and not per week: a lesson is on the template or it is not,
    // and a week's one-off cancellation is not a hole in the programme.
    db.timetableEntry.findMany({
      where: {
        schoolClassId,
        timeSlot: { ...yearScope(context), scheduleKind },
      },
      select: { subjectId: true },
    }),
  ]);

  if (slots.length === 0) return empty;
  const periodMinutes = modalColumnMinutes(slots);

  const placedBySubject = new Map<string, number>();
  for (const entry of entries) {
    placedBySubject.set(
      entry.subjectId,
      (placedBySubject.get(entry.subjectId) ?? 0) + 1,
    );
  }

  const declaredFor = new Map<string, { weeklyMinutes: number | null; assigned: boolean }>();
  for (const assignment of schoolClass.assignments) {
    const held = declaredFor.get(assignment.subjectId);
    // The primary affectation is the one that answers for the subject; a
    // second teacher on the same subject does not double its volume.
    if (!held || assignment.isPrimary) {
      declaredFor.set(assignment.subjectId, {
        weeklyMinutes: assignment.weeklyMinutes,
        assigned: true,
      });
    }
  }

  const rows = new Map<string, (typeof programme)[number]>();
  for (const row of programme) {
    if (row.subject.parentId !== null) continue;
    const held = rows.get(row.subject.id);
    if (!held || (held.trackId === null && row.trackId !== null)) {
      rows.set(row.subject.id, row);
    }
  }

  const gaps: ProgrammeGap[] = [];
  const undeclared: ProgrammeCoverage["undeclared"] = [];

  for (const row of rows.values()) {
    const subjectLabel = bilingual(row.subject.name, row.subject.nameAr);
    const affectation = declaredFor.get(row.subject.id);
    const weeklyMinutes = affectation?.weeklyMinutes ?? row.weeklyMinutes;

    if (!weeklyMinutes || weeklyMinutes <= 0) {
      undeclared.push({ subjectId: row.subject.id, subjectLabel });
      continue;
    }

    const wanted = periodsFromMinutes(weeklyMinutes, periodMinutes);
    const placed = placedBySubject.get(row.subject.id) ?? 0;
    if (placed >= wanted) continue;

    gaps.push({
      subjectId: row.subject.id,
      subjectLabel,
      wanted,
      placed,
      missingMinutes: (wanted - placed) * periodMinutes,
      unstaffed: !affectation,
    });
  }

  return { gaps, undeclared };
}

/** The classes a grid can be drawn for, grouped by the level that opened them. */
export async function listTimetableClasses(context: AuthContext): Promise<
  {
    id: string;
    code: string;
    name: string | null;
    levelLabel: string;
    /** The niveau in both languages, without the code — the picker already
     *  shows the class code beside it. See modules/academics/labels.ts. */
    levelNameLabel: string;
    /** The cycle it is listed under. */
    cycleName: string;
    entryCount: number;
    studentCount: number;
  }[]
> {
  const classes = await db.schoolClass.findMany({
    where: { levelOffering: yearScope(context), isActive: true },
    // Cycle first, so the picker's headings stay contiguous.
    orderBy: [
      { levelOffering: { level: { educationLevel: { position: "asc" } } } },
      { levelOffering: { level: { gradeYear: "asc" } } },
      { code: "asc" },
    ],
    select: {
      id: true,
      code: true,
      name: true,
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
      _count: { select: { timetableEntries: true, enrollments: true } },
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    levelLabel: schoolClass.levelOffering.track
      ? `${schoolClass.levelOffering.level.code} ${schoolClass.levelOffering.track.code}`
      : schoolClass.levelOffering.level.code,
    levelNameLabel: levelNameLabel(
      schoolClass.levelOffering.level,
      schoolClass.levelOffering.track,
    ),
    cycleName: cycleChoiceLabel(schoolClass.levelOffering.level.educationLevel),
    entryCount: schoolClass._count.timetableEntries,
    studentCount: schoolClass._count.enrollments,
  }));
}

// ── One teacher's own week ───────────────────────────────────────────────────

export type TeacherLesson = {
  timetableEntryId: string;
  timeSlotId: string;
  schoolClassId: string;
  classCode: string;
  groupLabel: string | null;
  subjectName: string;
  subjectShort: string;
  colorHex: string | null;
  roomCode: string | null;
};

export type TeacherWeek = {
  columns: SlotColumn[];
  /** Indexed by ISO day (1 = Monday), then by column key. Null = free period. */
  rows: { dayOfWeek: number; cells: Record<string, TeacherLesson | null> }[];
  scheduleKind: string;
  lessonCount: number;
  /** Distinct classes taught across the week — the headline figure. */
  classCount: number;
};

/**
 * The week as one teacher sees it.
 *
 * ── Why this is not `loadClassTimetable` with a filter ───────────────────────
 * A class grid answers "what does 3AP-A have on Tuesday" and names the teacher
 * in each cell. A teacher's grid answers "where am I on Tuesday" and names the
 * *class* — putting their own name in all thirty cells would be the one fact
 * they already know. The two also differ in what an empty cell means: for a
 * class it is a period the school does not teach, for a teacher it is a free
 * period, which is the thing they scan the grid for.
 *
 * Double periods are not merged here. A class grid merges them because the
 * lesson is one block; a teacher reading their own week wants to see each
 * period they are booked for, and a merged cell hides that the 10:00 is taken.
 */
export async function loadTeacherTimetable(
  context: AuthContext,
  teacherId: string,
  scheduleKind = "STANDARD",
): Promise<TeacherWeek> {
  const [slots, entries] = await Promise.all([
    db.timeSlot.findMany({
      where: { ...yearScope(context), scheduleKind, isActive: true },
      orderBy: [{ startTime: "asc" }, { dayOfWeek: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isBreak: true,
      },
    }),
    db.timetableEntry.findMany({
      where: {
        teacherId,
        // Bound to the year in context through the slot, and to the school
        // through the class — a teacher who moved schools does not carry last
        // year's grid with them.
        timeSlot: { ...yearScope(context), scheduleKind },
        schoolClass: { schoolId: currentSchoolId(context) },
      },
      select: {
        id: true,
        timeSlotId: true,
        subject: {
          select: { name: true, shortName: true, code: true, colorHex: true },
        },
        room: { select: { code: true } },
        schoolClass: { select: { id: true, code: true } },
        classGroup: { select: { code: true, name: true } },
      },
    }),
  ]);

  const columnByKey = new Map<string, SlotColumn>();
  for (const slot of slots) {
    const key = slotKey(slot.startTime, slot.endTime);
    const existing = columnByKey.get(key);
    if (existing) {
      // A period is a break only if it is one on every day that runs it.
      existing.isBreak = existing.isBreak && slot.isBreak;
      continue;
    }
    columnByKey.set(key, {
      key,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBreak: slot.isBreak,
    });
  }

  const columns = [...columnByKey.values()].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  const lessonBySlot = new Map(
    entries.map((entry) => [
      entry.timeSlotId,
      {
        timetableEntryId: entry.id,
        timeSlotId: entry.timeSlotId,
        schoolClassId: entry.schoolClass.id,
        classCode: entry.schoolClass.code,
        groupLabel: entry.classGroup
          ? (entry.classGroup.name ?? entry.classGroup.code)
          : null,
        subjectName: entry.subject.name,
        subjectShort: entry.subject.shortName ?? entry.subject.code,
        colorHex: entry.subject.colorHex,
        roomCode: entry.room?.code ?? null,
      } satisfies TeacherLesson,
    ]),
  );

  const rows = teachingDaysOf(context.settings).map((dayOfWeek) => {
    const cells: Record<string, TeacherLesson | null> = {};
    for (const column of columns) {
      const slot = slots.find(
        (candidate) =>
          candidate.dayOfWeek === dayOfWeek &&
          slotKey(candidate.startTime, candidate.endTime) === column.key,
      );
      cells[column.key] = slot
        ? (lessonBySlot.get(slot.id) ?? null)
        : null;
    }
    return { dayOfWeek, cells };
  });

  return {
    columns,
    rows,
    scheduleKind,
    lessonCount: entries.length,
    classCount: new Set(entries.map((entry) => entry.schoolClass.id)).size,
  };
}

/** A holiday as the grid and the picker read it. Primitives only. */
export type HolidayRow = {
  id: string;
  name: string;
  kind: string;
  /** `YYYY-MM-DD`, inclusive on both ends. */
  startDate: string;
  endDate: string;
};

/**
 * The year's weeks, the one to show, and the holidays that fall in it.
 *
 * One query rather than three because the three answers are one question — "what
 * am I looking at" — and the week cannot be resolved without the year's dates
 * anyway. The weeks themselves are computed by `weeks.ts`, which is pure, so the
 * picker in the browser and this agree by construction.
 */
export type WeekContext = {
  weeks: { index: number; start: string; end: string }[];
  /** Null only when the year has no dates worth drawing. */
  current: { index: number; start: string; end: string } | null;
  /** Every holiday of the year, so the picker can mark the weeks it covers. */
  holidays: HolidayRow[];
  yearName: string | null;
};

export async function loadWeekContext(
  context: AuthContext,
  weekParam?: string,
): Promise<WeekContext> {
  const yearId = context.currentSchoolYear?.id;
  if (!yearId) {
    return { weeks: [], current: null, holidays: [], yearName: null };
  }

  const [year, holidays] = await Promise.all([
    db.schoolYear.findUnique({
      where: { id: yearId },
      select: { name: true, startDate: true, endDate: true },
    }),
    db.schoolHoliday.findMany({
      where: { schoolYearId: yearId },
      orderBy: [{ startDate: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  if (!year) return { weeks: [], current: null, holidays: [], yearName: null };

  const weeks = schoolWeeks(year.startDate, year.endDate);
  const current = resolveWeek(weeks, weekParam);

  const serialise = (week: SchoolWeek) => ({
    index: week.index,
    start: toDateKey(week.start),
    end: toDateKey(week.end),
  });

  return {
    weeks: weeks.map(serialise),
    current: current ? serialise(current) : null,
    holidays: holidays.map((holiday) => ({
      id: holiday.id,
      name: holiday.name,
      kind: holiday.kind,
      startDate: toDateKey(holiday.startDate),
      endDate: toDateKey(holiday.endDate),
    })),
    yearName: year.name,
  };
}

/** What a one-off change says about one period of one week. */
export type ExceptionView = {
  id: string;
  kind: string;
  subjectName: string | null;
  teacherName: string | null;
  roomCode: string | null;
  note: string | null;
};

/** A teacher away on a given day, and who is covering if anyone is. */
export type AbsenceView = {
  teacherId: string;
  teacherName: string;
  substituteName: string | null;
  kind: string;
};

/**
 * What differs about one class's week: the one-off changes, and who is away.
 *
 * Kept apart from `loadClassTimetable` rather than folded into it, because the
 * recurring grid is read on screens that have no week at all — the pupil's file
 * shows "their class's week", not a dated one — and those must not pay for a
 * lookup they cannot use.
 *
 * Absences are returned per weekday rather than per lesson: one absence row
 * covers every lesson its teacher holds that day, and expanding it here would
 * be the duplication the table exists to avoid. The grid intersects it with
 * whichever cells name that teacher.
 */
export type WeekOverlay = {
  /** Keyed by `timeSlotId` — exactly what a cell knows about itself. */
  exceptions: Record<string, ExceptionView>;
  /** ISO weekday (1 = Monday) → the teachers away that day. */
  absencesByDay: Record<number, AbsenceView[]>;
};

export async function loadWeekOverlay(
  context: AuthContext,
  schoolClassId: string,
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStartKey: string | null,
): Promise<WeekOverlay> {
  const empty: WeekOverlay = { exceptions: {}, absencesByDay: {} };
  const schoolId = context.currentSchool?.id;
  if (!weekStartKey || !schoolId) return empty;

  const weekStart = new Date(`${weekStartKey}T00:00:00`);
  if (Number.isNaN(weekStart.getTime())) return empty;
  const weekEnd = addDays(weekStart, 6);

  const [exceptions, absences] = await Promise.all([
    db.timetableException.findMany({
      // Scoped through the class, which the caller has already resolved against
      // the school and year — an exception cannot be read for a class the
      // viewer could not have opened.
      where: {
        schoolClassId,
        weekStart,
        schoolClass: { schoolId },
      },
      select: {
        id: true,
        kind: true,
        timeSlotId: true,
        note: true,
        subject: { select: { name: true } },
        room: { select: { code: true } },
        teacher: {
          select: {
            username: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    // Any absence overlapping the week at all: one that started last Thursday
    // and runs to Tuesday still covers Monday of this one.
    db.teacherAbsence.findMany({
      where: {
        schoolId,
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
      select: {
        teacherId: true,
        kind: true,
        startDate: true,
        endDate: true,
        teacher: {
          select: {
            username: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        substitute: {
          select: {
            username: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  const bySlot: Record<string, ExceptionView> = {};
  for (const exception of exceptions) {
    bySlot[exception.timeSlotId] = {
      id: exception.id,
      kind: exception.kind,
      subjectName: exception.subject?.name ?? null,
      teacherName: exception.teacher ? displayName(exception.teacher) : null,
      roomCode: exception.room?.code ?? null,
      note: exception.note,
    };
  }

  const absencesByDay: Record<number, AbsenceView[]> = {};
  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(weekStart, offset);
    const away = absences.filter((absence) =>
      isWithin(day, absence.startDate, absence.endDate),
    );
    if (away.length === 0) continue;

    absencesByDay[offset + 1] = away.map((absence) => ({
      teacherId: absence.teacherId,
      teacherName: displayName(absence.teacher),
      substituteName: absence.substitute
        ? displayName(absence.substitute)
        : null,
      kind: absence.kind,
    }));
  }

  return { exceptions: bySlot, absencesByDay };
}

// ── When a teacher works ─────────────────────────────────────────────────────

export type TeacherOption = { id: string; label: string; blockedCount: number };

/**
 * The school's teachers, with how many periods each is unavailable for.
 *
 * The count is in the picker on purpose: it is the one thing somebody scanning
 * the list wants — who has a standing arrangement and who is open all week —
 * and without it every name has to be opened to find out.
 */
export async function listTeacherOptions(
  context: AuthContext,
  scheduleKind = "STANDARD",
): Promise<TeacherOption[]> {
  const schoolYearId = currentSchoolYearId(context);

  const teachers = await db.user.findMany({
    // Only the people who may actually be given a lesson — see
    // `teacherOfSchool`.
    where: {
      organizationId: context.organization.id,
      ...teacherOfSchool(currentSchoolId(context)),
    },
    orderBy: [{ profile: { lastName: "asc" } }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      profile: { select: { firstName: true, lastName: true } },
      unavailability: {
        where: { timeSlot: { schoolYearId, scheduleKind } },
        select: { id: true },
      },
    },
  });

  return teachers.map((teacher) => ({
    id: teacher.id,
    label: displayName(teacher),
    blockedCount: teacher.unavailability.length,
  }));
}

export type AvailabilityGrid = {
  columns: SlotColumn[];
  /** Indexed by ISO day, then column key. Null where the school does not teach. */
  rows: {
    dayOfWeek: number;
    cells: Record<string, { timeSlotId: string; blocked: boolean } | null>;
  }[];
  /** How many teaching periods the week holds, for the "works N of M" line. */
  totalPeriods: number;
  blockedPeriods: number;
};

/**
 * One teacher's week, as a grid of periods they do or do not work.
 *
 * Shaped exactly like `loadClassTimetable` — same columns, same days — because
 * the two are read side by side and a grid that transposed the axes would be
 * one more thing to translate in your head.
 *
 * Breaks are left out entirely rather than shown greyed: nobody is "available"
 * during the récréation, so offering it as a choice would be asking a question
 * with no meaning.
 */
export async function loadTeacherAvailability(
  context: AuthContext,
  teacherId: string,
  scheduleKind = "STANDARD",
): Promise<AvailabilityGrid | null> {
  const schoolId = currentSchoolId(context);
  const schoolYearId = currentSchoolYearId(context);

  // The teacher must belong to this school; one from elsewhere reads as absent.
  // And must be a teacher: an availability grid for the concierge is a week of
  // lessons nobody was ever going to give — see `teacherOfSchool`.
  const teacher = await db.user.findFirst({
    where: { id: teacherId, ...teacherOfSchool(schoolId) },
    select: { id: true },
  });
  if (!teacher) return null;

  const [slots, blocked] = await Promise.all([
    db.timeSlot.findMany({
      where: { schoolYearId, scheduleKind, isActive: true, isBreak: false },
      orderBy: [{ startTime: "asc" }, { dayOfWeek: "asc" }],
      select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
    }),
    db.teacherUnavailability.findMany({
      where: { teacherId, timeSlot: { schoolYearId, scheduleKind } },
      select: { timeSlotId: true },
    }),
  ]);

  const blockedIds = new Set(blocked.map((row) => row.timeSlotId));

  const columns: SlotColumn[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    columns.push({
      key,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBreak: false,
    });
  }

  const days = [...new Set(slots.map((slot) => slot.dayOfWeek))].sort(
    (a, b) => a - b,
  );

  const rows = days.map((dayOfWeek) => {
    const cells: Record<string, { timeSlotId: string; blocked: boolean } | null> =
      {};
    for (const column of columns) {
      const slot = slots.find(
        (candidate) =>
          candidate.dayOfWeek === dayOfWeek &&
          `${candidate.startTime}-${candidate.endTime}` === column.key,
      );
      cells[column.key] = slot
        ? { timeSlotId: slot.id, blocked: blockedIds.has(slot.id) }
        : null;
    }
    return { dayOfWeek, cells };
  });

  return {
    columns,
    rows,
    totalPeriods: slots.length,
    blockedPeriods: blockedIds.size,
  };
}

// ── One day of the calendar ──────────────────────────────────────────────────

/** What the calendar says about a single date. */
export type SchoolDay = {
  /** `YYYY-MM-DD`, at local midnight — the key registers are stored against. */
  date: string;
  /** ISO weekday, 1 = Monday, as the bell schedule numbers its slots. */
  dayOfWeek: number;
  /** The week the date falls in, or null when the year has none drawn yet. */
  weekNumber: number | null;
  /** "A" | "B" — which half of a fortnightly rotation runs. Null with no week. */
  parity: string | null;
  /** False when a holiday swallows the whole week — see SchoolWeek.isTeaching. */
  isTeaching: boolean;
  /** The holiday covering this day, when there is one. */
  holidayName: string | null;
};

/**
 * Which week a date belongs to, and whether the school is open on it.
 *
 * Read from the stored `SchoolWeek` rather than computed with `schoolWeeks()`,
 * because the parity and the teaching flag are the school's own decisions — a
 * term that resumed on the wrong foot is a flipped row, and recomputing would
 * quietly overrule it.
 *
 * A year with no weeks drawn yet answers "no week", which every caller must
 * read as "draw the whole template": a school that has not generated its
 * calendar still has a timetable, and hiding it would be worse than ignoring a
 * rotation it is not using.
 */
export async function findSchoolDay(
  context: AuthContext,
  date: Date,
): Promise<SchoolDay> {
  const day = atMidnight(date);
  const yearId = currentSchoolYearId(context);

  const [week, holiday] = await Promise.all([
    db.schoolWeek.findFirst({
      where: {
        schoolYearId: yearId,
        startsOn: { lte: day },
        endsOn: { gte: day },
      },
      select: { number: true, parity: true, isTeaching: true },
    }),
    db.schoolHoliday.findFirst({
      where: {
        schoolYearId: yearId,
        startDate: { lte: day },
        endDate: { gte: day },
      },
      orderBy: [{ startDate: "asc" }],
      select: { name: true },
    }),
  ]);

  return {
    date: toDateKey(day),
    // JavaScript numbers Sunday 0; the schema numbers Monday 1 through Sunday 7.
    dayOfWeek: day.getDay() === 0 ? 7 : day.getDay(),
    weekNumber: week?.number ?? null,
    parity: week?.parity ?? null,
    isTeaching: week?.isTeaching ?? true,
    holidayName: holiday?.name ?? null,
  };
}
