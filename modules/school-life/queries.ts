import "server-only";

import type { AuthContext } from "@/lib/dal";
import { PERMISSIONS } from "@/lib/permissions";
import { loadClassFill } from "@/modules/classes/queries";
import {
  countEnrolmentsByLevel,
  loadEnrolmentStats,
} from "@/modules/enrolment/queries";
import {
  loadClassroomActivity,
  type ClassroomActivity,
} from "@/modules/classroom/queries";
import { listAssessments, type AssessmentRow } from "@/modules/assessments/queries";
import { countFamilies } from "@/modules/families/queries";
import {
  countStudents,
  countStudentsByStanding,
} from "@/modules/students/queries";

/**
 * The school-life dashboard's figures.
 *
 * This module owns no scoping of its own: every number is a count another
 * module already knows how to take, confined to what this reader may see. That
 * is what keeps the dashboard consistent with the list screens — a director who
 * sees 214 pupils here sees the same 214 on `/students`, because it is the same
 * query.
 */
export type SchoolLifeStats = {
  students: { total: number; enrolled: number; preRegistered: number };
  families: number;
  enrolment: {
    enrolled: number;
    pending: number;
    unplaced: number;
    billedCentimes: number;
    discountedCentimes: number;
  };
  /** The pupil body split three ways, for the ring. */
  standing: { enrolled: number; preRegistered: number; left: number; total: number };
  byLevel: { label: string; levelCode: string; value: number }[];
  classFill: { id: string; code: string; enrolled: number; capacity: number | null }[];
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
  awaitingValidation: AssessmentRow[];
};

export async function loadSchoolLifeStats(
  context: AuthContext,
): Promise<SchoolLifeStats> {
  const [
    students,
    standing,
    families,
    enrolment,
    byLevel,
    classFill,
    classroom,
    awaitingValidation,
  ] = await Promise.all([
    countStudents(context),
    countStudentsByStanding(context),
    countFamilies(context),
    loadEnrolmentStats(context),
    countEnrolmentsByLevel(context),
    loadClassFill(context),
    // Today's registers and the latest remarks, gated inside on the classroom
    // codes — see loadClassroomActivity.
    loadClassroomActivity(context, new Date()),
    context.can(PERMISSIONS.ASSESSMENT_PUBLISH)
      ? listAssessments(context, { statuses: ["SUBMITTED"] })
      : [],
  ]);

  return {
    students,
    standing,
    families,
    enrolment,
    byLevel,
    classFill,
    classroom,
    awaitingValidation,
  };
}
