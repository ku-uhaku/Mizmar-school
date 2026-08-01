import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { levelSubjectScopeKey } from "@/modules/academics/enums";
import { feeRateScopeKey } from "@/modules/billing/enums";
import { assignmentScopeKey, offeringScopeKey } from "@/modules/classes/enums";

/**
 * The database half of each configuration resource: which table it is, which
 * rows the current working context may see, and what has to be injected on
 * write.
 *
 * Kept apart from `resources.ts` because that file crosses to the client and
 * this one must not — it imports the Prisma client.
 *
 * ── Why `where` is the important bit ──────────────────────────────────────────
 * Every read and every write goes through the same `where(context)`. A SCHOOL
 * resource is confined to `context.currentSchool`, a YEAR resource to
 * `context.currentSchoolYear`, and neither is ever taken from the request. So
 * switching school in the header genuinely changes what the screen manages, and
 * a crafted id cannot reach another school's rows — the update and delete are
 * `updateMany`/`deleteMany` filtered by the same clause, which simply match
 * nothing when the row is out of reach.
 */

/**
 * The subset of a Prisma delegate the generic CRUD uses. Prisma's per-model
 * types cannot be unified, so this is the one place the app gives up on
 * model-specific typing — the safety comes back through the zod schema built
 * from the field descriptors, and through `where` being applied on every call.
 */
type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
};

type Values = Record<string, unknown>;

export type ResourceSchema = {
  /** The Prisma delegate for this resource's table. */
  table: () => Delegate;
  /** Rows this working context may read and write. */
  where: (context: AuthContext) => Record<string, unknown>;
  /** Columns injected on create — the scope ids the form never sends. */
  createData?: (context: AuthContext, values: Values) => Values;
  /**
   * Columns recomputed from the submitted values on both create and update,
   * such as the nullable-unique mirror keys. See lib/db-keys.ts.
   */
  derive?: (values: Values) => Values;
  orderBy: unknown;
};

const bySchool = (context: AuthContext) => ({
  schoolId: context.currentSchool?.id ?? "__none__",
});
const byYear = (context: AuthContext) => ({
  schoolYearId: context.currentSchoolYear?.id ?? "__none__",
});

export const RESOURCE_SCHEMAS: Record<string, ResourceSchema> = {
  // The singleton. `where` is the school itself rather than a scoping clause on
  // a list, which is what makes the upsert in `saveSettingsAction` safe: it can
  // only ever touch the row belonging to the school in context.
  "school-settings": {
    table: () => db.schoolSettings as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ createdAt: "asc" }],
  },

  "education-levels": {
    table: () => db.educationLevel as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  levels: {
    table: () => db.level as unknown as Delegate,
    where: bySchool,
    // `schoolId` is denormalised from the parent cycle — see the invariant note
    // on Level.schoolId. Taking it from the context rather than the form is what
    // keeps that invariant true.
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { gradeYear: "asc" }, { code: "asc" }],
  },

  tracks: {
    table: () => db.track as unknown as Delegate,
    // No own schoolId: reached through the level it belongs to.
    where: (context) => ({ level: bySchool(context) }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  subjects: {
    table: () => db.subject as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ code: "asc" }],
  },

  "assessment-types": {
    table: () => db.assessmentType as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  programme: {
    table: () => db.levelSubject as unknown as Delegate,
    where: (context) => ({ level: bySchool(context) }),
    derive: (values) => ({
      scopeKey: levelSubjectScopeKey(values.trackId as string | null),
    }),
    orderBy: [{ position: "asc" }],
  },

  rooms: {
    table: () => db.room as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ code: "asc" }],
  },

  cities: {
    table: () => db.city as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    // By name, not by code: the list is read to find a town, and a code is
    // only what the row is keyed on.
    orderBy: [{ name: "asc" }],
  },

  "transport-schedules": {
    table: () => db.transportSchedule as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    // The order the day runs in, which is the order anybody reads a timetable.
    orderBy: [{ direction: "asc" }, { departureTime: "asc" }],
  },

  neighbourhoods: {
    table: () => db.neighbourhood as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    // Grouped by town, then alphabetical — the order the list is searched in.
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
  },

  holidays: {
    table: () => db.schoolHoliday as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    orderBy: [{ startDate: "asc" }],
  },

  "teacher-absences": {
    table: () => db.teacherAbsence as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    // Most recent first: the list is read to answer "who is off now", and the
    // year's history is what you scroll for.
    orderBy: [{ startDate: "desc" }],
  },

  terms: {
    table: () => db.term as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    orderBy: [{ number: "asc" }],
  },

  "time-slots": {
    table: () => db.timeSlot as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  },

  "level-offerings": {
    table: () => db.levelOffering as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    derive: (values) => ({
      scopeKey: offeringScopeKey(values.trackId as string | null),
    }),
    orderBy: [{ level: { gradeYear: "asc" } }],
  },

  classes: {
    table: () => db.schoolClass as unknown as Delegate,
    where: (context) => ({ levelOffering: byYear(context) }),
    // `schoolId` is denormalised from the offering's year — see the invariant
    // note on SchoolClass.schoolId.
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ code: "asc" }],
  },

  "class-groups": {
    table: () => db.classGroup as unknown as Delegate,
    where: (context) => ({ schoolClass: { levelOffering: byYear(context) } }),
    orderBy: [{ code: "asc" }],
  },

  "fee-types": {
    table: () => db.feeType as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  "fee-rates": {
    table: () => db.feeRate as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    derive: (values) => ({
      scopeKey: feeRateScopeKey(values.levelId as string | null),
    }),
    orderBy: [{ feeType: { position: "asc" } }],
  },

  banks: {
    table: () => db.bank as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-categories": {
    table: () => db.operationCategory as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-subcategories": {
    table: () => db.operationSubcategory as unknown as Delegate,
    // No own schoolId: reached through the rubrique it belongs to, exactly as
    // `tracks` is reached through its level.
    where: (context) => ({ category: bySchool(context) }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-motifs": {
    table: () => db.operationMotif as unknown as Delegate,
    where: bySchool,
    createData: (context) => ({ schoolId: context.currentSchool?.id }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  discounts: {
    table: () => db.discount as unknown as Delegate,
    where: byYear,
    createData: (context) => ({ schoolYearId: context.currentSchoolYear?.id }),
    orderBy: [{ code: "asc" }],
  },
};

/** Referenced by TeachingAssignment when that screen is built. */
export { assignmentScopeKey };

export function resourceSchema(resourceId: string): ResourceSchema | undefined {
  return RESOURCE_SCHEMAS[resourceId];
}
