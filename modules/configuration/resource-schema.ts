import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";
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
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  createMany: (args: unknown) => Promise<{ count: number }>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
};

/**
 * The join table behind one `multireference` field.
 *
 * A `reference` is a column and needs nothing here — the generic write already
 * knows how to `connect` it. A `multireference` is rows in a table of their own,
 * and the generic write has no way to guess which table, or which of its two
 * foreign keys points back. So the resource says, once, and both the read (an
 * `include`) and the write (a wholesale replace) are driven from it.
 */
export type ChildCollection = {
  /** The relation field on the parent, for the read's `include`. */
  relation: string;
  /** The join table's own delegate, for replacing the set on update. */
  table: () => Delegate;
  /** The join table's foreign key back to the parent. */
  parentColumn: string;
  /** The join table's foreign key to the referenced row — what is stored. */
  column: string;
};

type Values = Record<string, unknown>;

export type ResourceSchema = {
  /** The Prisma delegate for this resource's table. */
  table: () => Delegate;
  /**
   * The delegate's own model name (`"City"`, `"DocumentType"`…) — the same
   * string Prisma's runtime schema keys its models by. Declared once here
   * rather than derived from `table`, so `findBlockingReference` can look up
   * the model's relations without needing a live delegate instance first.
   */
  model: string;
  /** Rows this working context may read and write. */
  where: (context: AuthContext) => Record<string, unknown>;
  /**
   * The join tables behind this resource's `multireference` fields, keyed by
   * field name. Absent for the resources that have none, which is most of them.
   */
  children?: Record<string, ChildCollection>;
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
  schoolId: currentSchoolId(context),
});
const byYear = (context: AuthContext) => ({
  schoolYearId: currentSchoolYearId(context),
});

export const RESOURCE_SCHEMAS: Record<string, ResourceSchema> = {
  /*
    The one singleton — the school's own billing policy.

    ── Why this entry is the whole reason Settings "did not work" ──────────────
    The resource used to exist in `resources.ts` with no row here. Saving went
    through, because `saveSingletonAction` upserts `schoolSettings` directly,
    but `findSingleton` resolves the table through `resourceSchema(id)` and got
    `undefined` — so it returned null and the form redrew its *defaults* every
    time. A school would set nine instalments, save, come back and read the
    default again, with the saved row sitting in the database unread. That is
    what "it did not work" meant, and it is fixed by being here.

    `createData` is deliberately absent: the singleton is upserted against
    `schoolId` taken from the authorized context, never assembled from a form.
  */
  "school-settings": {
    table: () => db.schoolSettings as unknown as Delegate,
    model: "SchoolSettings",
    where: bySchool,
    orderBy: [{ createdAt: "asc" }],
  },

  "education-levels": {
    table: () => db.educationLevel as unknown as Delegate,
    model: "EducationLevel",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  levels: {
    table: () => db.level as unknown as Delegate,
    model: "Level",
    where: bySchool,
    // `schoolId` is denormalised from the parent cycle — see the invariant note
    // on Level.schoolId. Taking it from the context rather than the form is what
    // keeps that invariant true.
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { gradeYear: "asc" }, { code: "asc" }],
  },

  tracks: {
    table: () => db.track as unknown as Delegate,
    model: "Track",
    // No own schoolId: reached through the level it belongs to.
    where: (context) => ({ level: bySchool(context) }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  subjects: {
    table: () => db.subject as unknown as Delegate,
    model: "Subject",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ code: "asc" }],
  },

  "assessment-types": {
    table: () => db.assessmentType as unknown as Delegate,
    model: "AssessmentType",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  programme: {
    table: () => db.levelSubject as unknown as Delegate,
    model: "LevelSubject",
    where: (context) => ({ level: bySchool(context) }),
    derive: (values) => ({
      scopeKey: levelSubjectScopeKey(values.trackId as string | null),
    }),
    orderBy: [{ position: "asc" }],
  },

  /*
    Who may take what, this year.

    Scoped by both the school and the year although the year already implies the
    school: the pair is what the table is indexed on, and stating it here means a
    header still showing last year's context cannot reach this year's plan
    through a stale `schoolId` alone.
  */
  "teacher-subjects": {
    table: () => db.teacherSubject as unknown as Delegate,
    model: "TeacherSubject",
    where: (context) => ({ ...bySchool(context), ...byYear(context) }),
    children: {
      levelIds: {
        relation: "levels",
        table: () => db.teacherSubjectLevel as unknown as Delegate,
        parentColumn: "teacherSubjectId",
        column: "levelId",
      },
    },
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ preferenceRank: "asc" }],
  },

  rooms: {
    table: () => db.room as unknown as Delegate,
    model: "Room",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ code: "asc" }],
  },

  cities: {
    table: () => db.city as unknown as Delegate,
    model: "City",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // By name, not by code: the list is read to find a town, and a code is
    // only what the row is keyed on.
    orderBy: [{ name: "asc" }],
  },

  "transport-schedules": {
    table: () => db.transportSchedule as unknown as Delegate,
    model: "TransportSchedule",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    // The order the day runs in, which is the order anybody reads a timetable.
    orderBy: [{ direction: "asc" }, { departureTime: "asc" }],
  },

  suppliers: {
    table: () => db.supplier as unknown as Delegate,
    model: "Supplier",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // Grouped by kind, then the school's own order — the order the two
    // simplified screens show them in.
    orderBy: [{ kind: "asc" }, { position: "asc" }, { name: "asc" }],
  },

  "document-types": {
    table: () => db.documentType as unknown as Delegate,
    model: "DocumentType",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // The order the pièces are asked for at the guichet, which is the order the
    // dossier checklist shows them in.
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "request-types": {
    table: () => db.documentRequestType as unknown as Delegate,
    model: "DocumentRequestType",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // The order the catalogue is offered in on a parent's phone.
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "supply-articles": {
    table: () => db.supplyArticle as unknown as Delegate,
    model: "SupplyArticle",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // Grouped by shelf, then by the school's own order within it — the same
    // order the picker shows, so the screen that manages the catalogue reads
    // like the screen that uses it.
    orderBy: [{ category: "asc" }, { position: "asc" }, { name: "asc" }],
  },

  "staff-functions": {
    table: () => db.staffFunction as unknown as Delegate,
    model: "StaffFunction",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // The order an organigramme reads in: a direction before an agent
    // d'entretien, which alphabetical order gets exactly backwards.
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "parent-jobs": {
    table: () => db.parentJob as unknown as Delegate,
    model: "ParentJob",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // The handful a school records most often go first; alphabetical order
    // buries them under the ones nobody picks.
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  neighbourhoods: {
    table: () => db.neighbourhood as unknown as Delegate,
    model: "Neighbourhood",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // Grouped by town, then alphabetical — the order the list is searched in.
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
  },

  holidays: {
    table: () => db.schoolHoliday as unknown as Delegate,
    model: "SchoolHoliday",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ startDate: "asc" }],
  },

  "teacher-absences": {
    table: () => db.teacherAbsence as unknown as Delegate,
    model: "TeacherAbsence",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    // Most recent first: the list is read to answer "who is off now", and the
    // year's history is what you scroll for.
    orderBy: [{ startDate: "desc" }],
  },

  terms: {
    table: () => db.term as unknown as Delegate,
    model: "Term",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ number: "asc" }],
  },

  "school-weeks": {
    table: () => db.schoolWeek as unknown as Delegate,
    model: "SchoolWeek",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ number: "asc" }],
  },

  "teacher-unavailability": {
    table: () => db.teacherUnavailability as unknown as Delegate,
    model: "TeacherUnavailability",
    // No schoolYearId of its own: reached through the slot, which has one.
    where: (context) => ({ timeSlot: byYear(context) }),
    // The order a week is read in, so one teacher's blocks sit together.
    orderBy: [
      { timeSlot: { dayOfWeek: "asc" } },
      { timeSlot: { startTime: "asc" } },
    ],
  },

  "time-slots": {
    table: () => db.timeSlot as unknown as Delegate,
    model: "TimeSlot",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  },

  "level-offerings": {
    table: () => db.levelOffering as unknown as Delegate,
    model: "LevelOffering",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    derive: (values) => ({
      scopeKey: offeringScopeKey(values.trackId as string | null),
    }),
    orderBy: [{ level: { gradeYear: "asc" } }],
  },

  classes: {
    table: () => db.schoolClass as unknown as Delegate,
    model: "SchoolClass",
    where: (context) => ({ levelOffering: byYear(context) }),
    // `schoolId` is denormalised from the offering's year — see the invariant
    // note on SchoolClass.schoolId.
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ code: "asc" }],
  },

  "class-groups": {
    table: () => db.classGroup as unknown as Delegate,
    model: "ClassGroup",
    where: (context) => ({ schoolClass: { levelOffering: byYear(context) } }),
    orderBy: [{ code: "asc" }],
  },

  "fee-types": {
    table: () => db.feeType as unknown as Delegate,
    model: "FeeType",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { code: "asc" }],
  },

  "fee-rates": {
    table: () => db.feeRate as unknown as Delegate,
    model: "FeeRate",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    derive: (values) => ({
      scopeKey: feeRateScopeKey(values.levelId as string | null),
    }),
    orderBy: [{ feeType: { position: "asc" } }],
  },

  banks: {
    table: () => db.bank as unknown as Delegate,
    model: "Bank",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-categories": {
    table: () => db.operationCategory as unknown as Delegate,
    model: "OperationCategory",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-subcategories": {
    table: () => db.operationSubcategory as unknown as Delegate,
    model: "OperationSubcategory",
    // No own schoolId: reached through the rubrique it belongs to, exactly as
    // `tracks` is reached through its level.
    where: (context) => ({ category: bySchool(context) }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  "operation-motifs": {
    table: () => db.operationMotif as unknown as Delegate,
    model: "OperationMotif",
    where: bySchool,
    createData: (context) => ({
      school: { connect: { id: context.currentSchool?.id } },
    }),
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },

  discounts: {
    table: () => db.discount as unknown as Delegate,
    model: "Discount",
    where: byYear,
    createData: (context) => ({
      schoolYear: { connect: { id: context.currentSchoolYear?.id } },
    }),
    orderBy: [{ code: "asc" }],
  },
};

/** Referenced by TeachingAssignment when that screen is built. */
export { assignmentScopeKey };

/**
 * The database half of a resource, or undefined when there is not one.
 *
 * `Object.hasOwn` rather than a bare index: the resource id arrives in a form
 * field, and a plain object answers `Object.prototype` for `"__proto__"` and a
 * function for `"constructor"`. Both are truthy, so a caller testing the result
 * for existence would sail past the check and then crash on `.table()`.
 *
 * `authorizeResource` happens to resolve the descriptor first — and that lookup
 * is an array scan, which has no such hole — so this is not reachable today.
 * It is written this way so it stays unreachable from whichever caller comes
 * next.
 */
export function resourceSchema(resourceId: string): ResourceSchema | undefined {
  return Object.hasOwn(RESOURCE_SCHEMAS, resourceId)
    ? RESOURCE_SCHEMAS[resourceId]
    : undefined;
}

// ── Guarding a delete against what still points at the row ───────────────────

/** One field of Prisma's own runtime schema — scalar column or relation. */
type RuntimeField = {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  relationName?: string;
};
type RuntimeModel = { fields: RuntimeField[] };
type RuntimeDataModel = { models: Record<string, RuntimeModel> };

/**
 * Prisma keeps the same relation graph the query engine reads from on the
 * client instance itself, as `_runtimeDataModel` — undocumented (no `Prisma.*`
 * export carries it in this generator), but it is exactly the "which model
 * points at which" map this needs, and reading it beats hand-maintaining a
 * second copy that silently goes stale the day a migration adds a relation.
 * If a future Prisma version renames or drops it, `findBlockingReference`
 * degrades to "found nothing" rather than throwing — see the empty-object
 * fallback below — so a delete stays possible; it just stops being guarded.
 */
function runtimeDataModel(): RuntimeDataModel {
  return (
    (db as unknown as { _runtimeDataModel?: RuntimeDataModel })
      ._runtimeDataModel ?? { models: {} }
  );
}

function delegateOf(modelName: string): Delegate | undefined {
  const key = modelName[0].toLowerCase() + modelName.slice(1);
  return (db as unknown as Record<string, Delegate>)[key];
}

/**
 * Whether some other row still points at the one about to be deleted — and if
 * so, which model and how many, so the refusal can say what is in the way.
 *
 * Walks the model's own relation fields rather than a resource-by-resource
 * list: a field the model holds the foreign key for (`school` beside its own
 * `schoolId`) is *this* row pointing outward and is not a dependent: only a
 * field with no matching scalar on this side — the reverse, collection end of
 * a relation — means some other table's row would be orphaned. `programme`
 * (LevelSubject) and the like, with no `id`-suffixed sibling for `subject`, is
 * exactly that: rows in `level_subjects` are what block deleting a `Subject`.
 *
 * One row deep only: what deleting *this* row would immediately orphan, not
 * the whole tree beneath it — same as the hand-written guards elsewhere in the
 * app (`deleteStudentAction`'s enrolment count, `hasChildren` on a family).
 */
export async function findBlockingReference(
  modelName: string,
  id: string,
): Promise<{ model: string; count: number } | null> {
  const models = runtimeDataModel().models;
  const model = models[modelName];
  if (!model) return null;

  const ownScalars = new Set(
    model.fields.filter((f) => f.kind === "scalar").map((f) => f.name),
  );

  for (const field of model.fields) {
    if (field.kind !== "object") continue;
    // This model holds the foreign key for this relation — it points
    // outward, so it can never be what blocks deleting this row.
    if (ownScalars.has(`${field.name}Id`)) continue;

    const relatedModel = models[field.type];
    if (!relatedModel) continue;

    // The field on the *other* model that carries this same relation, so its
    // foreign key column can be read off by the same `+ "Id"` convention.
    const backField = relatedModel.fields.find(
      (f) => f.kind === "object" && f.relationName === field.relationName,
    );
    if (!backField) continue;

    const delegate = delegateOf(field.type);
    if (!delegate) continue;

    const count = await delegate.count({
      where: { [`${backField.name}Id`]: id },
    });
    if (count > 0) return { model: field.type, count };
  }

  return null;
}
