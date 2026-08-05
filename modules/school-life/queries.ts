import "server-only";

import type { AuthContext } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import {
  countAssessments,
  listAssessments,
} from "@/modules/assessments/queries";
import { loadClassFill } from "@/modules/classes/queries";
import {
  loadClassroomActivity,
  type ClassroomActivity,
} from "@/modules/classroom/queries";
import {
  countEnrolmentsByLevel,
  loadEnrolmentStats,
} from "@/modules/enrolment/queries";
import { countFamilies } from "@/modules/families/queries";
import { countStudentsByStanding } from "@/modules/students/queries";

/**
 * The school-life dashboard's figures.
 *
 * This module owns no scoping of its own: every number is a count another
 * module already knows how to take, confined to what this reader may see. That
 * is what keeps the dashboard consistent with the list screens — a director who
 * sees 214 pupils here sees the same 214 on `/students`, because it is the same
 * query.
 *
 * ── Why so much of this is nullable ──────────────────────────────────────────
 * `schoolLife.view` grants the *overview*, not the contents. Holding it does not
 * make somebody entitled to the household count or to what the school has
 * billed, and a zero is not a safe stand-in: "0 families" is a claim about the
 * school, and the reader has not earned it. So each piece is gated on the same
 * permission that opens the screen it summarises, and a piece the reader may not
 * have comes back `null` for the caller to omit — the rule
 * `loadSectionHeadlines` already follows one level up.
 */

/** A paper handed in and waiting on somebody at the office's desk. */
export type AwaitingValidationRow = {
  id: string;
  title: string;
  classCode: string;
  subjectName: string;
  teacherName: string | null;
};

/** How many papers are marked and awaiting acceptance. */
export type AwaitingValidation = {
  rows: AwaitingValidationRow[];
  /** Papers beyond the listed ones — the card shows "and N more". */
  more: number;
};

export type SchoolLifeStats = {
  /** The pupil body, split. Null without `student.view`. */
  standing: {
    enrolled: number;
    preRegistered: number;
    left: number;
    total: number;
  } | null;
  /** Null without `family.view`. */
  families: number | null;
  /** This year's inscriptions. Null without `enrolment.view`. */
  enrolment: { enrolled: number; pending: number; unplaced: number } | null;
  /**
   * What the year has been charged, net of reductions.
   *
   * Gated on `enrolment.fees` rather than `enrolment.view`, because that is the
   * split the module already makes: a secretary seats a child, and only the
   * bursar sees what the family is charged for it.
   */
  billing: { billedCentimes: number; discountedCentimes: number } | null;
  /** Empty without `enrolment.view`. */
  byLevel: { label: string; levelCode: string; value: number }[];
  /** Empty without `class.view`. */
  classFill: {
    id: string;
    code: string;
    enrolled: number;
    capacity: number | null;
  }[];
  /**
   * What the teachers have recorded today — the registers they took and the
   * remarks they wrote. Empty for a reader who holds neither classroom code.
   */
  classroom: ClassroomActivity;
  /**
   * Papers a teacher has handed in and nobody has accepted yet.
   *
   * The office's half of the handshake in ASSESSMENT_STATUSES: a paper sitting
   * in SUBMITTED is waiting on somebody at this desk, and until it appeared
   * here the only way to find one was to open every class's round in turn.
   */
  awaitingValidation: AwaitingValidation;
};

/** How many submitted papers the card lists before it starts counting. */
const AWAITING_LIMIT = 8;

const NO_AWAITING: AwaitingValidation = { rows: [], more: 0 };

export async function loadSchoolLifeStats(
  context: AuthContext,
): Promise<SchoolLifeStats> {
  const canSeeStudents = context.can(PERMISSIONS.STUDENT_VIEW);
  const canSeeFamilies = context.can(PERMISSIONS.FAMILY_VIEW);
  const canSeeEnrolment = context.can(PERMISSIONS.ENROLMENT_VIEW);
  const canSeeFees = context.can(PERMISSIONS.ENROLMENT_FEES);
  const canSeeClasses = context.can(PERMISSIONS.CLASS_VIEW);
  const canAcceptMarks = context.can(PERMISSIONS.ASSESSMENT_PUBLISH);

  const awaitingFilters = { statuses: ["SUBMITTED"] as const };

  const [
    standing,
    families,
    enrolmentStats,
    byLevel,
    classFill,
    classroom,
    awaitingRows,
    awaitingTotal,
  ] = await Promise.all([
    canSeeStudents ? countStudentsByStanding(context) : null,
    canSeeFamilies ? countFamilies(context) : null,
    // One read serves both halves; which halves survive is decided below.
    canSeeEnrolment || canSeeFees ? loadEnrolmentStats(context) : null,
    canSeeEnrolment ? countEnrolmentsByLevel(context) : [],
    canSeeClasses ? loadClassFill(context) : [],
    // Today's registers and the latest remarks, gated inside on the classroom
    // codes — see loadClassroomActivity.
    loadClassroomActivity(context, new Date()),
    canAcceptMarks
      ? listAssessments(context, { ...awaitingFilters, take: AWAITING_LIMIT })
      : [],
    canAcceptMarks ? countAssessments(context, awaitingFilters) : 0,
  ]);

  return {
    standing,
    families,
    enrolment:
      canSeeEnrolment && enrolmentStats
        ? {
            enrolled: enrolmentStats.enrolled,
            pending: enrolmentStats.pending,
            unplaced: enrolmentStats.unplaced,
          }
        : null,
    billing:
      canSeeFees && enrolmentStats
        ? {
            billedCentimes: enrolmentStats.billedCentimes,
            discountedCentimes: enrolmentStats.discountedCentimes,
          }
        : null,
    byLevel,
    classFill,
    classroom,
    awaitingValidation: canAcceptMarks
      ? {
          // Shaped here rather than passed whole: an AssessmentRow carries every
          // paper's average, mark counts, coefficient and colours, and the card
          // renders five fields. The rest was crossing to the client for nothing.
          rows: awaitingRows.map((paper) => ({
            id: paper.id,
            title: paper.title,
            classCode: paper.classCode,
            subjectName: paper.subjectName,
            teacherName: paper.teacherName,
          })),
          more: Math.max(0, awaitingTotal - awaitingRows.length),
        }
      : NO_AWAITING,
  };
}

/**
 * The three figures the main dashboard's vie scolaire card leads with.
 *
 * Separate from `loadSchoolLifeStats` because that one is the *page*: it takes
 * today's register, every class's fill, the levels and the submitted papers.
 * The card needs three numbers, and running the page's dozen queries to throw
 * eleven of them away was the single most expensive thing on `/`.
 *
 * Null when the reader may not see pupils — the card is omitted rather than
 * zeroed, for the reason given on `SectionHeadlines`.
 */
export type SchoolLifeSummary = {
  students: number;
  enrolled: number;
  unplaced: number;
};

export async function loadSchoolLifeSummary(
  context: AuthContext,
): Promise<SchoolLifeSummary | null> {
  if (!context.can(PERMISSIONS.STUDENT_VIEW)) return null;

  const [standing, enrolment] = await Promise.all([
    countStudentsByStanding(context),
    context.can(PERMISSIONS.ENROLMENT_VIEW)
      ? loadEnrolmentStats(context)
      : null,
  ]);

  return {
    students: standing.total,
    enrolled: enrolment?.enrolled ?? 0,
    unplaced: enrolment?.unplaced ?? 0,
  };
}
