import "server-only";

import type { AuthContext } from "@/lib/dal";
import { loadClassFill } from "@/modules/classes/queries";
import {
  countEnrolmentsByLevel,
  loadEnrolmentStats,
} from "@/modules/enrolment/queries";
import { countFamilies } from "@/modules/families/queries";
import { countStudents } from "@/modules/students/queries";

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
  byLevel: { label: string; value: number }[];
  classFill: { id: string; code: string; enrolled: number; capacity: number | null }[];
};

export async function loadSchoolLifeStats(
  context: AuthContext,
): Promise<SchoolLifeStats> {
  const [students, families, enrolment, byLevel, classFill] = await Promise.all([
    countStudents(context),
    countFamilies(context),
    loadEnrolmentStats(context),
    countEnrolmentsByLevel(context),
    loadClassFill(context),
  ]);

  return { students, families, enrolment, byLevel, classFill };
}
