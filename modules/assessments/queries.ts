import "server-only";

import { displayName, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { gradingScaleOf } from "@/lib/school-settings";
import { toDateInputValue } from "@/lib/utils";
import { currentSchoolId, schoolScope, yearScope } from "@/lib/scope";
import { resolveProgrammeRows } from "@/modules/academics/enums";
import {
  bilingual,
  cycleChoiceLabel,
  levelChoiceLabel,
  levelNameLabel,
} from "@/modules/academics/labels";
import {
  ASSESSMENT_PAGE_SIZE,
  COUNTED_STATUSES,
  markStatistics,
  quartersToPoints,
  questionsTotal,
  statusesForStage,
  type AppreciationBandRow,
  type GradingRuleRow,
  type MarkStatistics,
} from "@/modules/assessments/enums";

/**
 * Reads for the assessments module.
 *
 * Confined to `context.currentSchool` and, through the term, to
 * `context.currentSchoolYear`. A mark belongs to a class in a year; reading
 * outside the selected year would put last year's contrôles in front of a
 * teacher entering this year's, which is the one mistake nobody would notice
 * until a report card came out wrong.
 */

export type AssessmentTypeOption = {
  id: string;
  code: string;
  name: string;
  /** The name in both languages, for anywhere the kind is read rather than
   *  matched — see modules/academics/labels.ts. */
  label: string;
  defaultCoefficient: number;
  defaultMaxScore: number;
  countsTowardAverage: boolean;
  /**
   * One paper for the whole matière rather than one per component — see
   * AssessmentType.gradesWholeSubject. Carried into the picker so switching the
   * kind switches which rows are ticked by default.
   */
  gradesWholeSubject: boolean;
  colorHex: string | null;
};

/**
 * The kinds of paper this school runs.
 *
 * `teacherCreatableOnly` is what separates the two surfaces: the vie scolaire
 * generator offers every kind, while a teacher's own workspace only offers the
 * ones the school has said a teacher may set — devoirs, typically, and not
 * contrôles. That policy is a column, not a hard-coded list.
 */
export async function listAssessmentTypes(
  context: AuthContext,
  options: { teacherCreatableOnly?: boolean } = {},
): Promise<AssessmentTypeOption[]> {
  const types = await db.assessmentType.findMany({
    where: {
      ...schoolScope(context),
      isActive: true,
      ...(options.teacherCreatableOnly ? { allowTeacherCreate: true } : {}),
    },
    orderBy: [{ position: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      defaultCoefficient: true,
      defaultMaxScore: true,
      countsTowardAverage: true,
      gradesWholeSubject: true,
      colorHex: true,
    },
  });

  return types.map(({ nameAr, ...type }) => ({
    ...type,
    label: bilingual(type.name, nameAr),
  }));
}

/**
 * This year's barèmes, for resolving a kind's scale client-side — see
 * `gradingDefaults`. The server re-resolves independently on write
 * (`generateAssessments`), so this is a display default only; a crafted post
 * cannot use it to set a barème the class's own niveau does not carry.
 */
export async function listGradingRules(
  context: AuthContext,
): Promise<GradingRuleRow[]> {
  return db.gradingRule.findMany({
    where: { ...yearScope(context), isActive: true },
    select: { assessmentTypeId: true, scopeKey: true, maxScore: true, coefficient: true },
  });
}

export type TermOption = {
  id: string;
  number: number;
  name: string;
  /** The name in both languages. */
  label: string;
  status: string;
};

/** The terms of the year in context — what a contrôle is filed under. */
export async function listTerms(context: AuthContext): Promise<TermOption[]> {
  const terms = await db.term.findMany({
    where: yearScope(context),
    orderBy: [{ number: "asc" }],
    select: { id: true, number: true, name: true, nameAr: true, status: true },
  });

  return terms.map(({ nameAr, ...term }) => ({
    ...term,
    label: bilingual(term.name, nameAr),
  }));
}

export type ClassOption = {
  id: string;
  code: string;
  name: string | null;
  /** The Ministry code alone — the badge beside a class in a list. */
  levelLabel: string;
  /** Both names and the code, for the pickers that choose a niveau outright. */
  levelOptionLabel: string;
  /** Both names without the code, for a picker that already shows the class
   *  code beside it — "1AP-A · 1ère année primaire (1AP)" repeats itself. */
  levelNameLabel: string;
  /** The cycle the level hangs under, for those pickers' headings. */
  cycleName: string;
  /** Which level offering it belongs to — what the "a level" scope groups on. */
  levelOfferingId: string;
  /** The niveau itself, for resolving the kind's barème — see `gradingDefaults`. */
  levelId: string;
};

/** The classes of the year, for the picker and the generator. */
export async function listAssessableClasses(
  context: AuthContext,
  /**
   * One niveau's classes only. What the class screen asks for: the generator
   * there offers "this class" or "its niveau", so the whole school's list would
   * be a picker for a decision that screen is not making.
   */
  options: { levelOfferingId?: string } = {},
): Promise<ClassOption[]> {
  const classes = await db.schoolClass.findMany({
    where: {
      levelOffering: yearScope(context),
      isActive: true,
      ...(options.levelOfferingId
        ? { levelOfferingId: options.levelOfferingId }
        : {}),
    },
    // Cycle first, then the class code: the levels the generator derives from
    // this list are headed by their cycle, and a heading only holds if the
    // rows under it are contiguous.
    orderBy: [
      { levelOffering: { level: { educationLevel: { position: "asc" } } } },
      { levelOffering: { level: { gradeYear: "asc" } } },
      { code: "asc" },
    ],
    select: {
      id: true,
      code: true,
      name: true,
      levelOfferingId: true,
      levelOffering: {
        select: {
          level: {
            select: {
              id: true,
              code: true,
              name: true,
              nameAr: true,
              educationLevel: { select: { name: true, nameAr: true } },
            },
          },
          track: { select: { name: true, nameAr: true } },
        },
      },
    },
  });

  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    code: schoolClass.code,
    name: schoolClass.name,
    levelLabel: schoolClass.levelOffering.level.code,
    levelOptionLabel: levelChoiceLabel(
      schoolClass.levelOffering.level,
      schoolClass.levelOffering.track,
    ),
    levelNameLabel: levelNameLabel(
      schoolClass.levelOffering.level,
      schoolClass.levelOffering.track,
    ),
    cycleName: cycleChoiceLabel(schoolClass.levelOffering.level.educationLevel),
    levelOfferingId: schoolClass.levelOfferingId,
    levelId: schoolClass.levelOffering.level.id,
  }));
}

export type DevoirTarget = {
  /** `schoolClassId:subjectId` — the pair travels as one value in the picker. */
  key: string;
  schoolClassId: string;
  classCode: string;
  cycleName: string;
  levelNameLabel: string;
  /** The niveau, for resolving the kind's barème — see `gradingDefaults`. */
  levelId: string;
  subjectId: string;
  /** The matière in both languages. */
  subjectLabel: string;
  /** Who holds the post, for the office to see whose class it is setting for. */
  teacherName: string;
};

/**
 * The class-and-subject pairs the reader may set a piece of work against.
 *
 * A pair rather than two pickers because a devoir is not "any subject in any
 * class": `createDevoir` re-derives the TeachingAssignment for the pair and
 * refuses anything that has none, so offering the two independently would build
 * combinations that can only come back as "you do not teach this class".
 *
 * Scoped the way the write is. A teacher sees their own assignments; whoever
 * holds ASSESSMENT_MANAGE sees the school's, because the office setting work
 * for an absent colleague is exactly the case `actsForSchool` exists for. The
 * two must agree — a row offered here and refused by the service, or the
 * reverse, is the picker and the rule disagreeing about who teaches what.
 */
export async function listDevoirTargets(
  context: AuthContext,
  /**
   * One class's pairs only, for the button on that class's own screen. Narrows
   * what is offered and nothing else — the scoping above still decides what the
   * reader may reach, so a class id here cannot widen it.
   */
  options: { schoolClassId?: string } = {},
): Promise<DevoirTarget[]> {
  const actsForSchool = context.can(PERMISSIONS.ASSESSMENT_MANAGE);

  const assignments = await db.teachingAssignment.findMany({
    where: {
      ...(actsForSchool ? {} : { teacherId: context.user.id }),
      ...(options.schoolClassId
        ? { schoolClassId: options.schoolClassId }
        : {}),
      schoolClass: {
        schoolId: currentSchoolId(context),
        levelOffering: yearScope(context),
        isActive: true,
      },
    },
    /*
      Cycle first, then the level, then the class and its subjects.

      The cycle leads because the picker heads its options by it, and
      `clusterByGroup` cuts the list by *walking* it rather than bucketing it —
      so a list ordered by class code alone interleaves the cycles, produces one
      heading per run instead of one per cycle, and React reports duplicate
      keys. The heading order has to be the row order; see components/form/
      option-groups.ts.

      `isPrimary` last, so a co-taught subject names the teacher who answers for
      its marks rather than whichever colleague sorted first.
    */
    orderBy: [
      { schoolClass: { levelOffering: { level: { educationLevel: { position: "asc" } } } } },
      { schoolClass: { levelOffering: { level: { gradeYear: "asc" } } } },
      { schoolClass: { code: "asc" } },
      { subject: { code: "asc" } },
      { isPrimary: "desc" },
    ],
    select: {
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      schoolClass: {
        select: {
          id: true,
          code: true,
          levelOffering: {
            select: {
              level: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  nameAr: true,
                  educationLevel: { select: { name: true, nameAr: true } },
                },
              },
              track: { select: { name: true, nameAr: true } },
            },
          },
        },
      },
      subject: { select: { id: true, name: true, nameAr: true } },
    },
  });

  // One entry per pair. A subject split across groups is several assignments
  // and one thing to set work on — which group the paper lands in is the
  // service's to read off the assignment, not a choice to put to the reader.
  const byPair = new Map<string, DevoirTarget>();
  for (const assignment of assignments) {
    const key = `${assignment.schoolClass.id}:${assignment.subject.id}`;
    if (byPair.has(key)) continue;

    const offering = assignment.schoolClass.levelOffering;
    byPair.set(key, {
      key,
      schoolClassId: assignment.schoolClass.id,
      classCode: assignment.schoolClass.code,
      cycleName: cycleChoiceLabel(offering.level.educationLevel),
      levelNameLabel: levelNameLabel(offering.level, offering.track),
      levelId: offering.level.id,
      subjectId: assignment.subject.id,
      subjectLabel: bilingual(
        assignment.subject.name,
        assignment.subject.nameAr,
      ),
      teacherName: displayName(assignment.teacher),
    });
  }

  return [...byPair.values()];
}

export type ProgrammeEntry = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** The matière in both languages, for the picker to print. */
  subjectLabel: string;
  coefficient: number;
  /**
   * The matière this row is a component of — القراءة under اللغة العربية — or
   * null when it is a subject in its own right.
   *
   * Carried so the picker can group the components under their parent. A flat
   * list of leaf names is unreadable on a primary programme: half a dozen rows
   * called "القراءة", "التعبير الكتابي", "الإملاء" with nothing saying which
   * matière they belong to is exactly how the wrong paper gets ticked.
   */
  parentSubjectId: string | null;
  parentSubjectName: string | null;
  /** The parent matière in both languages. */
  parentSubjectLabel: string | null;
  /**
   * How many components of this matière are on the same programme — 0 for a
   * component, and for a matière marked as one paper.
   *
   * What tells the picker whether this row *stands for* its components. A
   * contrôle is sat on اللغة العربية as a whole, so that row is the one ticked
   * and its four components sit under it as the exception; a devoir is sat on
   * الإملاء, so the components are the rows and the matière is not offered at
   * all. See AssessmentType.gradesWholeSubject.
   */
  componentCount: number;
  /**
   * Who would answer for the marks, resolved the same way the generator
   * resolves it — the primary TeachingAssignment for the subject, falling back
   * to the parent's for a component.
   *
   * Null means no post is filled, and the generator refuses the subject. Shown
   * in the picker so that refusal is visible *before* pressing Generate rather
   * than reported afterwards.
   */
  teacherName: string | null;
};

/**
 * Each class's marked subjects, keyed by class id.
 *
 * Loaded for every class of the year in one pass so the generator dialog can
 * show the subject list the moment a class is picked, without a round trip. The
 * dataset is one school's classes — dozens of rows — so shipping it whole is far
 * simpler than fetching per class, and makes the picker feel instant.
 */
export async function loadProgrammesByClass(
  context: AuthContext,
  /**
   * The classes to load for. Every one of the year's by default — the papers
   * screen picks a class from the whole school, so it needs them all.
   *
   * The class screen passes its own niveau's, which is the only scope its
   * generator offers: loading nineteen programmes to tick from one is work the
   * page then throws away.
   */
  schoolClassIds?: readonly string[],
): Promise<Record<string, ProgrammeEntry[]>> {
  // An explicit empty list means "none asked for", which is not the same as
  // "unfiltered" — dropping the clause there would load the whole school.
  if (schoolClassIds && schoolClassIds.length === 0) return {};

  const classes = await db.schoolClass.findMany({
    where: {
      levelOffering: yearScope(context),
      schoolId: currentSchoolId(context),
      isActive: true,
      ...(schoolClassIds ? { id: { in: [...schoolClassIds] } } : {}),
    },
    select: {
      id: true,
      levelOffering: { select: { levelId: true, trackId: true } },
    },
  });
  if (classes.length === 0) return {};

  // Who holds each subject in each class. Only the primary holder: a co-taught
  // subject still produces one paper, answerable to one person — the same rule
  // `generateAssessments` applies when it writes them.
  const assignments = await db.teachingAssignment.findMany({
    where: {
      schoolClassId: { in: classes.map((schoolClass) => schoolClass.id) },
      isPrimary: true,
    },
    select: {
      schoolClassId: true,
      subjectId: true,
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const teacherByClassSubject = new Map(
    assignments.map((assignment) => [
      `${assignment.schoolClassId}:${assignment.subjectId}`,
      displayName(assignment.teacher),
    ]),
  );

  const rows = await db.levelSubject.findMany({
    where: {
      // The classes above are the year's, so their programme is too — see
      // LevelSubject, which is written against one year.
      ...yearScope(context),
      levelId: {
        in: [...new Set(classes.map((c) => c.levelOffering.levelId))],
      },
      isGraded: true,
      subject: { isActive: true },
    },
    orderBy: [{ position: "asc" }],
    select: {
      levelId: true,
      trackId: true,
      coefficient: true,
      subject: {
        select: { id: true, code: true, name: true, nameAr: true, parentId: true },
      },
    },
  });

  const result: Record<string, ProgrammeEntry[]> = {};

  for (const schoolClass of classes) {
    const { levelId, trackId } = schoolClass.levelOffering;

    // Same rule 1 as `resolveProgramme` in the service — this one exists to
    // *show* the list, that one to write it, and they must agree. Which is why
    // the track override is resolved through the same helper: a subject the
    // level declares twice must be one line on the picker, not two.
    const forClass = resolveProgrammeRows(
      rows
        .filter((row) => row.levelId === levelId)
        .map((row) => ({ ...row, subjectId: row.subject.id })),
      trackId,
    );

    /*
      Both halves of a split matière are offered, unlike the service's rule 2,
      which resolves the programme for one kind of paper at a time.

      The picker does not know which kind is being generated until the operator
      picks it, and switching from a contrôle to a devoir must not cost a round
      trip. So the list carries the matière *and* its components, `componentCount`
      says which is which, and the dialog shows the half that kind is sat on.
    */
    const componentCounts = new Map<string, number>();
    for (const row of forClass) {
      const parentId = row.subject.parentId;
      if (parentId === null) continue;
      componentCounts.set(parentId, (componentCounts.get(parentId) ?? 0) + 1);
    }

    // Parent names, for the component rows to be grouped under. Read off the
    // programme itself rather than fetched: a component's parent is on it by
    // construction.
    const nameById = new Map(
      forClass.map((row) => [row.subject.id, row.subject.name]),
    );
    const labelById = new Map(
      forClass.map((row) => [
        row.subject.id,
        bilingual(row.subject.name, row.subject.nameAr),
      ]),
    );

    result[schoolClass.id] = forClass.map((row) => {
      const parentId = row.subject.parentId;
      return {
        subjectId: row.subject.id,
        subjectCode: row.subject.code,
        subjectName: row.subject.name,
        subjectLabel: bilingual(row.subject.name, row.subject.nameAr),
        coefficient: row.coefficient,
        parentSubjectId: parentId,
        parentSubjectName: parentId ? (nameById.get(parentId) ?? null) : null,
        parentSubjectLabel: parentId ? (labelById.get(parentId) ?? null) : null,
        componentCount: componentCounts.get(row.subject.id) ?? 0,
        // Same fallback as the generator's `teacherFor`: assignments are made
        // against the matière as taught, while the papers are per component.
        teacherName:
          teacherByClassSubject.get(`${schoolClass.id}:${row.subject.id}`) ??
          (parentId
            ? (teacherByClassSubject.get(`${schoolClass.id}:${parentId}`) ??
              null)
            : null),
      };
    });
  }

  return result;
}

export type AssessmentRow = {
  id: string;
  title: string;
  sequence: number;
  status: string;
  /** `YYYY-MM-DD` for `<input type="date">`, null while only planned. */
  scheduledOn: string | null;
  maxScore: number;
  coefficient: number;
  /** Whether these marks move the subject's average — see Assessment. */
  countsTowardAverage: boolean;
  subjectId: string;
  /** The raw name — what the subject facet matches on, so it must not change
   *  with the language. `subjectLabel` is what a reader sees. */
  subjectName: string;
  subjectLabel: string;
  subjectCode: string;
  subjectColorHex: string | null;
  typeId: string;
  typeName: string;
  typeLabel: string;
  typeCode: string;
  typeColorHex: string | null;
  classId: string;
  classCode: string;
  groupLabel: string | null;
  termId: string;
  termName: string;
  termLabel: string;
  teacherName: string | null;
  /** Roster size for this paper — the whole class, or the group that sits it. */
  rosterCount: number;
  markedCount: number;
  absentCount: number;
  average: number | null;
};

export type AssessmentFilters = {
  classId?: string;
  termId?: string;
  /** Confines the list to one teacher's own papers — the workspace uses it. */
  teacherId?: string;
  subjectId?: string;
  /** Matches the paper's title, or the subject or class it was set for. */
  search?: string;
  /**
   * "CONTROLE" keeps the kinds a teacher may not set; "DEVOIR" keeps the ones
   * they may. The split is `AssessmentType.allowTeacherCreate`, so the vie
   * scolaire screen and the teacher's own list never show each other's work.
   */
  kind?: "CONTROLE" | "DEVOIR";
  /**
   * Keeps only papers in these statuses.
   *
   * What the teacher's "to mark" list is: a paper is theirs to do something
   * about while it is PUBLISHED or SUBMITTED, and a GRADED one is finished.
   * Expressed as a filter rather than a second query so the row shape, the
   * roster counts and the scoping stay in one place.
   */
  statuses?: readonly string[];
  /**
   * Caps the list. Absent means the whole matching set, which is right for a
   * class-and-term screen and wrong for anything school-wide: this read pulls
   * every paper's grades to compute its statistics, so an uncapped
   * school-wide call is one query plus one class's marks per paper set all
   * year. Callers that only want the first few pass a limit and take the
   * remainder from `countAssessments`.
   */
  take?: number;
  /**
   * Orders by the date sat, most recent first, instead of by term and sequence.
   *
   * The class-and-term list is a syllabus and reads forwards — contrôle n°1 then
   * n°2. A school-wide list is a feed and reads backwards: what was set this
   * week is what somebody is asking about, and it is also what a capped read
   * must not be the part that gets cut off.
   */
  recentFirst?: boolean;
};

function assessmentWhere(context: AuthContext, filters: AssessmentFilters) {
  return {
    ...schoolScope(context),
    // Bound to the selected year through the term, never by an id from the
    // request alone.
    term: yearScope(context),
    ...(filters.classId ? { schoolClassId: filters.classId } : {}),
    ...(filters.termId ? { termId: filters.termId } : {}),
    ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    // Narrowing within the scope above, never widening it: the school and year
    // clauses still apply, so a search term can only ever shrink the set.
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { subject: { name: { contains: filters.search } } },
            { schoolClass: { code: { contains: filters.search } } },
          ],
        }
      : {}),
    ...(filters.statuses ? { status: { in: [...filters.statuses] } } : {}),
    ...(filters.kind
      ? {
          assessmentType: {
            allowTeacherCreate: filters.kind === "DEVOIR",
          },
        }
      : {}),
  };
}

/**
 * How many papers match, ignoring `take`.
 *
 * Shares `assessmentWhere` with the list rather than restating the clauses, so
 * a screen showing "8 of 47" cannot end up counting a different set from the
 * one it is showing.
 */
export async function countAssessments(
  context: AuthContext,
  filters: AssessmentFilters = {},
): Promise<number> {
  return db.assessment.count({ where: assessmentWhere(context, filters) });
}

export type AssessmentFilterChoices = {
  teachers: { id: string; label: string }[];
  /** `group` is the cycle the class's niveau belongs to. */
  classes: { id: string; label: string; group: string }[];
  subjects: { id: string; label: string }[];
  /** How many are handed in and waiting, before any filter is applied. */
  awaitingCount: number;
};

/**
 * What the devoirs review screen's pickers may offer, and how much is waiting.
 *
 * ── Read straight, not derived from the list ────────────────────────────────
 * The obvious implementation counts what `listAssessments` returned. That would
 * be wrong twice: the list is capped, so both the pickers and the "to validate"
 * badge would describe the newest page rather than the school — somebody working
 * through the queue would watch the count stop falling — and it would key the
 * pickers on names, which the filters cannot use, since they take ids.
 *
 * ── Only the people and subjects that have actually set one ─────────────────
 * A `distinct` over the papers themselves rather than a roll of the staff or of
 * the cursus. A picker of every employee would be mostly names that select
 * nothing, and the question this screen asks is "whose devoirs am I looking at",
 * which only has answers among the people who set one.
 *
 * `kind` is passed through so the same shape serves the devoirs screen it was
 * written for and any contrôles equivalent later, without either inheriting the
 * other's pickers.
 */
export async function listAssessmentFilterChoices(
  context: AuthContext,
  filters: AssessmentFilters = {},
): Promise<AssessmentFilterChoices> {
  // Only the scoping clauses, never the reader's own selections: pickers that
  // narrowed themselves as you used them would strand you on a filter you could
  // no longer clear.
  //
  // `classId` counts as scope rather than selection, and only because of where
  // it comes from: the class tabs pass the class in the route, where it cannot
  // be cleared and the pickers should describe that class alone. The school-wide
  // screens pass `kind` only, so nothing changes for them.
  const inScope = assessmentWhere(context, {
    kind: filters.kind,
    classId: filters.classId,
  });

  const [authored, taught, classes, awaitingCount] = await Promise.all([
    db.assessment.findMany({
      where: { ...inScope, teacherId: { not: null } },
      distinct: ["teacherId"],
      select: {
        teacherId: true,
        teacher: {
          select: {
            username: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.assessment.findMany({
      where: inScope,
      distinct: ["subjectId"],
      select: { subject: { select: { id: true, name: true, nameAr: true } } },
    }),
    db.schoolClass.findMany({
      where: { levelOffering: yearScope(context), ...schoolScope(context) },
      // Cycle first, so the picker's headings stay contiguous.
      orderBy: [
        { levelOffering: { level: { educationLevel: { position: "asc" } } } },
        { levelOffering: { level: { gradeYear: "asc" } } },
        { code: "asc" },
      ],
      select: {
        id: true,
        code: true,
        levelOffering: {
          select: {
            level: {
              select: {
                name: true,
                nameAr: true,
                educationLevel: { select: { name: true, nameAr: true } },
              },
            },
            track: { select: { name: true, nameAr: true } },
          },
        },
      },
    }),
    db.assessment.count({ where: { ...inScope, status: "SUBMITTED" } }),
  ]);

  return {
    teachers: authored
      .filter((row) => row.teacherId !== null && row.teacher !== null)
      .map((row) => ({
        id: row.teacherId as string,
        label: displayName(row.teacher!),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    subjects: taught
      .map((row) => ({
        id: row.subject.id,
        label: bilingual(row.subject.name, row.subject.nameAr),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    classes: classes.map((row) => ({
      id: row.id,
      label: `${row.code} · ${levelNameLabel(row.levelOffering.level, row.levelOffering.track)}`,
      group: cycleChoiceLabel(row.levelOffering.level.educationLevel),
    })),
    awaitingCount,
  };
}

/** One class tab's worth of papers: the list, its pickers, and the terms. */
export type ClassPapers = {
  assessments: AssessmentRow[];
  choices: AssessmentFilterChoices;
  terms: TermOption[];
  filters: ClassPaperFilters;
};

/** What a reader may narrow a class's papers by. The class itself is the route. */
export type ClassPaperFilters = {
  search: string;
  teacherId: string;
  schoolClassId: string;
  subjectId: string;
  termId: string;
  stage: string;
};

/**
 * Everything the contrôles or devoirs tab of one class needs, in one call.
 *
 * ── Why this composes rather than the page doing it ─────────────────────────
 * The class screen shows two of these side by side, and each is a list plus its
 * pickers plus the terms — three reads that have to agree about the same scope.
 * Composed here, the tab cannot be given a list of one class and pickers of
 * another; left to the page it would be six calls whose arguments have to be
 * kept in step by hand, in a file that is meant to hold no query logic at all.
 *
 * The list is capped like every school-wide read — see `AssessmentFilters.take`
 * — and ordered most recent first, which is how a feed of "what has been set"
 * reads. `stage` is turned into statuses here so the page does not have to know
 * that mapping either.
 */
export async function loadClassPapers(
  context: AuthContext,
  classId: string,
  kind: "CONTROLE" | "DEVOIR",
  filters: ClassPaperFilters,
): Promise<ClassPapers> {
  // An unrecognised stage leaves the list unfiltered rather than empty — see
  // `statusesForStage`.
  const statuses = filters.stage ? statusesForStage(filters.stage) : [];

  const [assessments, choices, terms] = await Promise.all([
    listAssessments(context, {
      kind,
      classId,
      search: filters.search || undefined,
      teacherId: filters.teacherId || undefined,
      subjectId: filters.subjectId || undefined,
      termId: filters.termId || undefined,
      statuses: statuses.length > 0 ? statuses : undefined,
      recentFirst: true,
      take: ASSESSMENT_PAGE_SIZE,
    }),
    listAssessmentFilterChoices(context, { kind, classId }),
    listTerms(context),
  ]);

  return { assessments, choices, terms, filters };
}

/**
 * The papers of a class and term, with how far along the marking is.
 *
 * The roster count is read per row rather than assumed from the class size,
 * because a paper set for one group is sat by that group only — reporting
 * "12/30 marked" for a half-class paper would look like a teacher was behind
 * when they had in fact finished.
 */
export async function listAssessments(
  context: AuthContext,
  filters: AssessmentFilters = {},
): Promise<AssessmentRow[]> {
  const assessments = await db.assessment.findMany({
    where: assessmentWhere(context, filters),
    ...(filters.take === undefined ? {} : { take: filters.take }),
    orderBy: filters.recentFirst
      ? [{ scheduledOn: "desc" as const }, { createdAt: "desc" as const }]
      : [
          { term: { number: "asc" as const } },
          { sequence: "asc" as const },
          { subject: { code: "asc" as const } },
        ],
    select: {
      id: true,
      title: true,
      sequence: true,
      status: true,
      scheduledOn: true,
      maxScore: true,
      coefficient: true,
      countsTowardAverage: true,
      classGroupId: true,
      subject: {
        select: { id: true, code: true, name: true, nameAr: true, colorHex: true },
      },
      assessmentType: {
        select: { id: true, code: true, name: true, nameAr: true, colorHex: true },
      },
      schoolClass: { select: { id: true, code: true } },
      classGroup: { select: { code: true, name: true } },
      term: { select: { id: true, name: true, nameAr: true } },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      grades: { select: { score: true, isAbsent: true } },
    },
  });

  // One count per class/group the papers actually target, rather than a query
  // per row.
  const rosterCounts = await rosterSizes(
    context,
    assessments.map((assessment) => ({
      schoolClassId: assessment.schoolClass.id,
      classGroupId: assessment.classGroupId,
    })),
  );

  return assessments.map((assessment) => {
    const stats = markStatistics(
      assessment.grades.map((grade) => ({
        score: grade.score,
        isAbsent: grade.isAbsent,
      })),
      assessment.maxScore,
    );

    return {
      id: assessment.id,
      title: assessment.title,
      sequence: assessment.sequence,
      status: assessment.status,
      scheduledOn: assessment.scheduledOn
        ? toDateInputValue(assessment.scheduledOn)
        : null,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      countsTowardAverage: assessment.countsTowardAverage,
      subjectId: assessment.subject.id,
      subjectName: assessment.subject.name,
      subjectLabel: bilingual(assessment.subject.name, assessment.subject.nameAr),
      subjectCode: assessment.subject.code,
      subjectColorHex: assessment.subject.colorHex,
      typeId: assessment.assessmentType.id,
      typeName: assessment.assessmentType.name,
      typeLabel: bilingual(
        assessment.assessmentType.name,
        assessment.assessmentType.nameAr,
      ),
      typeCode: assessment.assessmentType.code,
      typeColorHex: assessment.assessmentType.colorHex,
      classId: assessment.schoolClass.id,
      classCode: assessment.schoolClass.code,
      groupLabel: groupLabel(assessment.classGroup),
      termId: assessment.term.id,
      termName: assessment.term.name,
      termLabel: bilingual(assessment.term.name, assessment.term.nameAr),
      teacherName: assessment.teacher ? displayName(assessment.teacher) : null,
      rosterCount:
        rosterCounts.get(
          rosterKey(assessment.schoolClass.id, assessment.classGroupId),
        ) ?? 0,
      markedCount: stats.markedCount,
      absentCount: stats.absentCount,
      average: stats.average,
    };
  });
}

/** A group is named by its own name when it has one, else by its code. */
function groupLabel(
  group: { code: string; name: string | null } | null | undefined,
): string | null {
  if (!group) return null;
  return group.name ?? group.code;
}

function rosterKey(schoolClassId: string, classGroupId: string | null): string {
  return `${schoolClassId}:${classGroupId ?? ""}`;
}

/** How many pupils sit each (class, group) pair, in one pass. */
async function rosterSizes(
  context: AuthContext,
  targets: { schoolClassId: string; classGroupId: string | null }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (targets.length === 0) return counts;

  const enrollments = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      schoolClassId: {
        in: [...new Set(targets.map((target) => target.schoolClassId))],
      },
      student: schoolScope(context),
    },
    select: { schoolClassId: true, classGroupId: true },
  });

  for (const target of targets) {
    const key = rosterKey(target.schoolClassId, target.classGroupId);
    if (counts.has(key)) continue;
    counts.set(
      key,
      enrollments.filter(
        (enrollment) =>
          enrollment.schoolClassId === target.schoolClassId &&
          // A whole-class paper is sat by everyone, whichever group they are in.
          (target.classGroupId === null ||
            enrollment.classGroupId === target.classGroupId),
      ).length,
    );
  }

  return counts;
}

export type MarkRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  groupLabel: string | null;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
};

/** One numbered question of the paper, in points rather than quarters. */
export type PaperQuestion = {
  id: string;
  position: number;
  text: string;
  points: number;
};

export type MarkSheet = {
  assessment: AssessmentRow & {
    notes: string | null;
    /**
     * The ministry's own id for this paper, when it has one.
     *
     * Null for every contrôle the school set itself, which is most of them —
     * and null is what lets the first NotesCC export claim the paper. See
     * `massarCode` on Assessment and the ASSESSMENT_IDENTITY check.
     */
    massarCode: string | null;
    /**
     * The scale the class's own niveau reports on — see `Level.reportMaxScore`.
     * Distinct from `maxScore` above, which is this paper's own: the sheet
     * shows the school's pass threshold on the *reporting* scale beside the
     * pass rate for *this* paper.
     */
    reportMaxScore: number | null;
  };
  rows: MarkRow[];
  statistics: MarkStatistics;
  /** Whether the reader is the teacher answerable for these marks. */
  isMine: boolean;
  /**
   * A kind the teacher sets themselves — `AssessmentType.allowTeacherCreate`.
   *
   * Nobody validates a devoir: the teacher sets it, marks it and is done. So
   * the hand-in/accept pair is not offered on one, which would otherwise be a
   * button whose other half nobody can press.
   */
  isDevoir: boolean;
  /** The paper itself, in order. Empty when none was written. */
  questions: PaperQuestion[];
  /** What the questions add up to — see `questionsTotal`. */
  questionsTotal: number;
  /**
   * The school's appréciation scale, floors first, so the sheet can fill the
   * remark in as marks are typed. Carried on the sheet rather than fetched
   * separately because the phone reads the whole screen in one request.
   */
  appreciationBands: AppreciationBandRow[];
};

/**
 * The school's appréciation scale — the active rungs, highest floor first.
 *
 * Empty is a legitimate answer, not a missing row: a school that deleted every
 * rung has said it wants no suggested remark, and the mark sheet then leaves
 * the box blank rather than inventing one.
 */
export async function listAppreciationBands(
  context: AuthContext,
): Promise<AppreciationBandRow[]> {
  const bands = await db.appreciationBand.findMany({
    where: { ...schoolScope(context), isActive: true },
    orderBy: { minPercentBps: "desc" },
    select: {
      id: true,
      minPercentBps: true,
      label: true,
      labelAr: true,
      colorHex: true,
    },
  });

  return bands;
}

/**
 * The scale as the editing screen needs it — retired rungs included, since a
 * rung is retired *on this screen* and would otherwise vanish the moment it was
 * unticked.
 */
export async function listAppreciationScale(
  context: AuthContext,
): Promise<(AppreciationBandRow & { isActive: boolean })[]> {
  return db.appreciationBand.findMany({
    where: schoolScope(context),
    orderBy: { minPercentBps: "desc" },
    select: {
      id: true,
      minPercentBps: true,
      label: true,
      labelAr: true,
      colorHex: true,
      isActive: true,
    },
  });
}

/**
 * One paper with its roster and whatever has been entered so far.
 *
 * The roster is the source of the rows, not the existing grades: a pupil
 * enrolled after the paper was generated must appear on the sheet waiting to be
 * marked rather than be silently missing from it.
 *
 * ── Why a devoir is narrower than a contrôle ────────────────────────────────
 * A contrôle is the school's: the office plans it, a teacher marks it, and the
 * office accepts the marks, so anyone holding ASSESSMENT_VIEW in the school may
 * read it. A devoir is the teacher's own — they set it, they mark it, and
 * nobody validates it — so it is confined to them here, as a `where` rather
 * than a check afterwards. The caller turns the miss into `notFound()`, which
 * is also all a colleague is entitled to learn about it.
 *
 * The split is `AssessmentType.allowTeacherCreate`, exactly as it is in
 * `listAssessments` — the same column decides who may set a kind of paper and
 * who may read one.
 */
export async function findMarkSheet(
  context: AuthContext,
  assessmentId: string,
): Promise<MarkSheet | null> {
  const assessment = await db.assessment.findFirst({
    // Scoped by the school and the year in context, never by the id alone.
    where: {
      id: assessmentId,
      ...schoolScope(context),
      OR: [
        // Anybody's to read: the kinds only the office may set.
        { assessmentType: { allowTeacherCreate: false } },
        // A devoir: its own teacher, or whoever set it when the post is vacant.
        { teacherId: context.user.id },
        { createdById: context.user.id },
      ],
      term: yearScope(context),
    },
    select: {
      id: true,
      title: true,
      sequence: true,
      status: true,
      scheduledOn: true,
      maxScore: true,
      coefficient: true,
      countsTowardAverage: true,
      notes: true,
      massarCode: true,
      classGroupId: true,
      teacherId: true,
      subject: {
        select: { id: true, code: true, name: true, nameAr: true, colorHex: true },
      },
      assessmentType: {
        select: {
          id: true,
          code: true,
          name: true,
          nameAr: true,
          colorHex: true,
          allowTeacherCreate: true,
        },
      },
      schoolClass: {
        select: {
          id: true,
          code: true,
          levelOffering: { select: { level: { select: { reportMaxScore: true } } } },
        },
      },
      classGroup: { select: { code: true, name: true } },
      term: { select: { id: true, name: true, nameAr: true } },
      questions: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, text: true, pointsQuarters: true },
      },
      teacher: {
        select: {
          username: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      grades: {
        select: {
          enrollmentId: true,
          score: true,
          isAbsent: true,
          isExcused: true,
          comment: true,
        },
      },
    },
  });

  if (!assessment) return null;

  const roster = await db.enrollment.findMany({
    where: {
      ...yearScope(context),
      schoolClassId: assessment.schoolClass.id,
      student: schoolScope(context),
      ...(assessment.classGroupId
        ? { classGroupId: assessment.classGroupId }
        : {}),
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      classGroup: { select: { code: true, name: true } },
      student: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
        },
      },
    },
  });

  const byEnrollment = new Map(
    assessment.grades.map((grade) => [grade.enrollmentId, grade]),
  );

  const rows: MarkRow[] = roster.map((enrollment) => {
    const grade = byEnrollment.get(enrollment.id);
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.student.id,
      studentCode: enrollment.student.code,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      photoUrl: enrollment.student.photoUrl,
      groupLabel: groupLabel(enrollment.classGroup),
      score: grade?.score ?? null,
      isAbsent: grade?.isAbsent ?? false,
      isExcused: grade?.isExcused ?? false,
      comment: grade?.comment ?? null,
    };
  });

  const statistics = markStatistics(rows, assessment.maxScore);
  const appreciationBands = await listAppreciationBands(context);

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      sequence: assessment.sequence,
      status: assessment.status,
      scheduledOn: assessment.scheduledOn
        ? toDateInputValue(assessment.scheduledOn)
        : null,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      countsTowardAverage: assessment.countsTowardAverage,
      notes: assessment.notes,
      massarCode: assessment.massarCode,
      reportMaxScore: assessment.schoolClass.levelOffering.level.reportMaxScore,
      subjectId: assessment.subject.id,
      subjectName: assessment.subject.name,
      subjectLabel: bilingual(assessment.subject.name, assessment.subject.nameAr),
      subjectCode: assessment.subject.code,
      subjectColorHex: assessment.subject.colorHex,
      typeId: assessment.assessmentType.id,
      typeName: assessment.assessmentType.name,
      typeLabel: bilingual(
        assessment.assessmentType.name,
        assessment.assessmentType.nameAr,
      ),
      typeCode: assessment.assessmentType.code,
      typeColorHex: assessment.assessmentType.colorHex,
      classId: assessment.schoolClass.id,
      classCode: assessment.schoolClass.code,
      groupLabel: groupLabel(assessment.classGroup),
      termId: assessment.term.id,
      termName: assessment.term.name,
      termLabel: bilingual(assessment.term.name, assessment.term.nameAr),
      teacherName: assessment.teacher ? displayName(assessment.teacher) : null,
      rosterCount: rows.length,
      markedCount: statistics.markedCount,
      absentCount: statistics.absentCount,
      average: statistics.average,
    },
    rows,
    statistics,
    isMine: assessment.teacherId === context.user.id,
    isDevoir: assessment.assessmentType.allowTeacherCreate,
    // Converted out of quarter-points once, here, so no screen has to know the
    // column is stored that way — see modules/assessments/enums.ts.
    questions: assessment.questions.map((question) => ({
      id: question.id,
      position: question.position,
      text: question.text,
      points: quartersToPoints(question.pointsQuarters),
    })),
    questionsTotal: questionsTotal(assessment.questions),
    appreciationBands,
  };
}

export type AssessmentSummary = {
  total: number;
  /** Papers announced but not yet fully marked. */
  awaitingMarks: number;
  /** Papers still to be announced. */
  draft: number;
  /** Marks entered against the year so far. */
  gradesEntered: number;
};

/** The figures on the assessments screen and the vie scolaire dashboard. */
export async function assessmentSummary(
  context: AuthContext,
): Promise<AssessmentSummary> {
  const assessments = await db.assessment.findMany({
    where: { ...schoolScope(context), term: yearScope(context) },
    select: {
      status: true,
      classGroupId: true,
      schoolClassId: true,
      grades: { select: { score: true, isAbsent: true } },
    },
  });

  const rosterCounts = await rosterSizes(
    context,
    assessments.map((assessment) => ({
      schoolClassId: assessment.schoolClassId,
      classGroupId: assessment.classGroupId,
    })),
  );

  let awaitingMarks = 0;
  let draft = 0;
  let gradesEntered = 0;

  for (const assessment of assessments) {
    if (assessment.status === "DRAFT") draft += 1;

    const accounted = assessment.grades.filter(
      (grade) => grade.score !== null || grade.isAbsent,
    ).length;
    gradesEntered += accounted;

    const roster =
      rosterCounts.get(
        rosterKey(assessment.schoolClassId, assessment.classGroupId),
      ) ?? 0;

    if (assessment.status === "PUBLISHED" && accounted < roster) {
      awaitingMarks += 1;
    }
  }

  return {
    total: assessments.length,
    awaitingMarks,
    draft,
    gradesEntered,
  };
}

// ── One pupil's marks ────────────────────────────────────────────────────────

export type PupilMark = {
  id: string;
  title: string;
  /** Both names — the panel reads these, nothing matches on them. */
  typeName: string;
  termName: string;
  scheduledOn: string | null;
  score: number | null;
  maxScore: number;
  /** The paper's weight inside its subject. */
  coefficient: number;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
  /** Whether this paper's kind moves the subject's average at all. */
  counts: boolean;
};

export type PupilSubjectMarks = {
  subjectId: string;
  subjectName: string;
  /** The subject's weight in the overall average, from the programme. */
  coefficient: number;
  marks: PupilMark[];
  /**
   * Weighted mean of the counted marks, on the school's own scale. Null when
   * nothing counted has been marked yet.
   */
  average: number | null;
};

export type PupilMarks = {
  subjects: PupilSubjectMarks[];
  /** Weighted by each subject's programme coefficient. Null when empty. */
  overall: number | null;
  /** The scale everything above is expressed on — the niveau's, or the school's. */
  outOf: number;
  markedCount: number;
};

/**
 * A pupil's marks for the year, grouped by subject, with averages.
 *
 * ── What counts, and why ─────────────────────────────────────────────────────
 * Three filters, and each one is a decision a school actually makes:
 *
 *   * only papers in a `COUNTED_STATUSES` state — a draft nobody has sat is not
 *     a zero;
 *   * only papers whose own `countsTowardAverage` is on — a school marks work
 *     it shows the family but never averages, and that is per paper rather than
 *     per kind, so one piece of revision can be excluded without inventing a
 *     kind for it;
 *   * absences are excluded rather than averaged as zero, exactly as
 *     `markStatistics` does under a mark sheet. A child who was not there has
 *     not demonstrated a zero.
 *
 * Every mark is normalised onto the school's scale before it is averaged, so a
 * paper set out of 10 does not silently count half. See SchoolSettings.
 *
 * Computed, never stored. A published bulletin would have to be frozen — that
 * is a different thing, and it is not this.
 */
export async function loadPupilMarks(
  context: AuthContext,
  enrollmentId: string,
): Promise<PupilMarks> {
  const grades = await db.assessmentGrade.findMany({
    where: {
      enrollmentId,
      // The enrolment id comes from the URL; the school does not.
      enrollment: { schoolYear: schoolScope(context) },
      assessment: { status: { in: [...COUNTED_STATUSES] } },
    },
    orderBy: [{ assessment: { scheduledOn: "asc" } }],
    include: {
      assessment: {
        include: {
          subject: { select: { id: true, name: true, nameAr: true } },
          assessmentType: { select: { name: true, nameAr: true } },
          term: { select: { name: true, nameAr: true, number: true } },
        },
      },
    },
  });

  // The programme decides what each subject is worth overall. A subject with no
  // programme row still shows its marks — it just weighs 1, rather than
  // vanishing from a list the family expects to be complete.
  const enrolment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      levelOffering: {
        select: {
          levelId: true,
          trackId: true,
          level: {
            select: {
              reportMaxScore: true,
              subjects: {
                select: { subjectId: true, coefficient: true, trackId: true },
              },
            },
          },
        },
      },
    },
  });

  const outOf = gradingScaleOf(
    context.settings,
    enrolment?.levelOffering.level.reportMaxScore ?? null,
  ).outOf;

  // A track-specific weight wins over the level-wide one for that track. Read
  // through the same resolver the programme and the picker use — done inline
  // here it was a last-write-wins loop over an unordered query, so a subject
  // declared both ways took whichever coefficient the database happened to
  // return second, and a pupil's overall average was not reproducible.
  const weightOf = new Map(
    resolveProgrammeRows(
      enrolment?.levelOffering.level.subjects ?? [],
      enrolment?.levelOffering.trackId ?? null,
    ).map((row) => [row.subjectId, row.coefficient] as const),
  );

  const bySubject = new Map<string, PupilSubjectMarks>();

  for (const grade of grades) {
    const { assessment } = grade;
    const key = assessment.subject.id;

    let bucket = bySubject.get(key);
    if (!bucket) {
      bucket = {
        subjectId: key,
        subjectName: bilingual(
          assessment.subject.name,
          assessment.subject.nameAr,
        ),
        coefficient: weightOf.get(key) ?? 1,
        marks: [],
        average: null,
      };
      bySubject.set(key, bucket);
    }

    bucket.marks.push({
      id: grade.id,
      title: assessment.title,
      typeName: bilingual(
        assessment.assessmentType.name,
        assessment.assessmentType.nameAr,
      ),
      termName: bilingual(assessment.term.name, assessment.term.nameAr),
      scheduledOn: assessment.scheduledOn?.toISOString() ?? null,
      score: grade.score,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      isAbsent: grade.isAbsent,
      isExcused: grade.isExcused,
      comment: grade.comment,
      counts: assessment.countsTowardAverage,
    });
  }

  for (const bucket of bySubject.values()) {
    bucket.average = weightedAverage(
      bucket.marks
        .filter((mark) => mark.counts && !mark.isAbsent && mark.score !== null)
        .map((mark) => ({
          // Normalised onto the school's scale before weighting.
          value: ((mark.score as number) / mark.maxScore) * outOf,
          weight: mark.coefficient,
        })),
    );
  }

  const subjects = [...bySubject.values()].sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName),
  );

  return {
    subjects,
    overall: weightedAverage(
      subjects
        .filter((subject) => subject.average !== null)
        .map((subject) => ({
          value: subject.average as number,
          weight: subject.coefficient,
        })),
    ),
    outOf,
    markedCount: grades.filter(
      (grade) => grade.score !== null || grade.isAbsent,
    ).length,
  };
}

/** Rounded to two decimals, like every other mark in the app. */
function weightedAverage(
  entries: readonly { value: number; weight: number }[],
): number | null {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return null;

  const total = entries.reduce(
    (sum, entry) => sum + entry.value * entry.weight,
    0,
  );
  return Math.round((total / totalWeight) * 100) / 100;
}

// ── A whole class, one term ──────────────────────────────────────────────────

export type ClassTermMark = {
  enrollmentId: string;
  subjectId: string;
  /**
   * The mark, normalised onto the school's scale. A paper set out of 10 has
   * already been doubled here, so a caller may average these directly.
   */
  value: number;
  /** The paper's own weight inside its subject. */
  coefficient: number;
};

/**
 * Every mark that counts, for every pupil of one class, in one term.
 *
 * ── Why this lives here and not in the bulletins module ─────────────────────
 * Deciding *what counts* is this module's job and nobody else's. Three rules
 * settle it, and they are the same three `loadPupilMarks` applies:
 *
 *   * only papers in a `COUNTED_STATUSES` state — a draft nobody has sat is not
 *     a zero;
 *   * only papers whose own `countsTowardAverage` is on;
 *   * absences are excluded rather than averaged as zero.
 *
 * The bulletin then weights these by the *programme*, ranks them and freezes
 * them, which is its job. Two modules, one rule each, and no second opinion
 * about whether a cancelled contrôle drags an average down.
 *
 * One flat list rather than a nested shape on purpose: the caller groups it
 * twice, by pupil and by subject, and a pre-grouped return would force one of
 * those to be undone.
 */
export async function loadClassTermMarks(
  context: AuthContext,
  schoolClassId: string,
  termId: string,
): Promise<ClassTermMark[]> {
  // One query for the class's own niveau, run alongside the marks rather than
  // once per pupil — see `gradingScaleOf`.
  const [grades, schoolClass] = await Promise.all([
    db.assessmentGrade.findMany({
      where: {
        isAbsent: false,
        score: { not: null },
        // The term id comes from the request; the school does not.
        assessment: {
          ...schoolScope(context),
          termId,
          status: { in: [...COUNTED_STATUSES] },
          countsTowardAverage: true,
        },
        /*
          Scoped by the *roster*, not by whose class the paper belongs to.

          The two are the same thing for every pupil who has not moved. For one
          who has, they are not: `carryGradesToClass` re-points what it can onto
          the new class's equivalent papers, but a mark whose paper the new class
          never set stays behind, and reading by `assessment.schoolClassId` would
          drop it — the pupil would be ranked, and their report card computed, on
          a term that begins the day they arrived.

          The other direction falls out of the same rule: a pupil who has left
          stops counting toward this class's spread. Their bulletin is computed
          where they now sit, so counting them here as well would rank them
          twice, against two different cohorts.
        */
        enrollment: { schoolYear: schoolScope(context), schoolClassId },
      },
      select: {
        enrollmentId: true,
        score: true,
        assessment: {
          select: {
            subjectId: true,
            maxScore: true,
            coefficient: true,
            // Only to recognise one paper sat twice — see below.
            schoolClassId: true,
            assessmentTypeId: true,
            sequence: true,
          },
        },
      },
    }),
    db.schoolClass.findFirst({
      where: { id: schoolClassId, ...schoolScope(context) },
      select: { levelOffering: { select: { level: { select: { reportMaxScore: true } } } } },
    }),
  ]);

  const outOf = gradingScaleOf(
    context.settings,
    schoolClass?.levelOffering.level.reportMaxScore ?? null,
  ).outOf;

  /*
    One mark per paper per pupil.

    Reading by the roster is what lets a mark left behind by a move still
    count, and it is also what lets the same paper be counted twice: a pupil
    whose Contrôle n°1 de maths could not be carried — because they already
    held the new class's row for it — holds both, and averaging both would
    weigh that one contrôle double against every subject beside it.

    The mark on the class being computed wins, since that is the paper this
    class's teacher set and marked. `carryGradesToClass` makes this rare by
    moving what it can; it does not make it impossible, and a report card is
    not the place to find that out.
  */
  const oneEach = new Map<string, (typeof grades)[number]>();
  for (const grade of grades) {
    if (grade.assessment.maxScore <= 0) continue;

    const { subjectId, assessmentTypeId, sequence } = grade.assessment;
    const paper = `${grade.enrollmentId}:${subjectId}:${assessmentTypeId}:${sequence}`;
    const held = oneEach.get(paper);
    if (held === undefined || grade.assessment.schoolClassId === schoolClassId) {
      oneEach.set(paper, grade);
    }
  }

  return [...oneEach.values()].map((grade) => ({
    enrollmentId: grade.enrollmentId,
    subjectId: grade.assessment.subjectId,
    value: ((grade.score as number) / grade.assessment.maxScore) * outOf,
    coefficient: grade.assessment.coefficient,
  }));
}
