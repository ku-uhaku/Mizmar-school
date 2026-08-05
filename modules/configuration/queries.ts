import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { currentSchoolYearId } from "@/lib/scope";
import { findResource } from "@/modules/configuration/resources";
import { resourceSchema } from "@/modules/configuration/resource-schema";
import type {
  Choice,
  FieldDef,
  ResourceDef,
  ResourceRow,
} from "@/modules/configuration/types";

/**
 * Reads for the configuration screens. One implementation for all fourteen
 * resources — the descriptor says which fields to project, the schema says
 * which rows the working context may see.
 */

/** Serialises one database row down to the primitives the client needs. */
function toRow(record: Record<string, unknown>, fields: FieldDef[]): ResourceRow {
  const row: ResourceRow = { id: String(record.id) };

  for (const field of fields) {
    const value = record[field.name];

    if (value === null || value === undefined) {
      row[field.name] = null;
    } else if (value instanceof Date) {
      // `<input type="date">` accepts no other format.
      row[field.name] = value.toISOString().slice(0, 10);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      row[field.name] = value;
    } else {
      row[field.name] = String(value);
    }
  }

  return row;
}

function labelOf(record: Record<string, unknown>, labelFields: string[]): string {
  const parts = labelFields
    .map((name) => record[name])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);
  return parts.length > 0 ? parts.join(" — ") : String(record.id);
}

/**
 * The options for one reference field.
 *
 * Choices are loaded through the target resource's own `where(context)`, so a
 * dropdown can only ever offer rows the current school or year actually owns —
 * and the action re-checks the submitted id against the same clause, so a
 * crafted value cannot get past a filtered dropdown.
 */
export async function loadChoices(
  context: AuthContext,
  referenceTo: string,
): Promise<Choice[]> {
  if (referenceTo === "@teachers") {
    const users = await db.user.findMany({
      where: { organizationId: context.organization.id, isActive: true },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
      orderBy: [{ profile: { lastName: "asc" } }, { email: "asc" }],
    });
    return users.map((user) => ({
      id: user.id,
      label: user.profile
        ? `${user.profile.firstName} ${user.profile.lastName}`.trim() || user.email
        : user.email,
    }));
  }

  /*
    The bell schedule, labelled with its day.
    `time-slots` alone would render every reference as "08:00 — 09:00", which is
    the same string six times over and unpickable. A loader rather than wider
    `labelFields` because the day is an integer that has to be looked up in the
    dictionary before it means anything to a reader.
  */
  if (referenceTo === "@slots") {
    const t = await getDictionary();
    const days = t.configOptions.days as Record<string, string>;

    const slots = await db.timeSlot.findMany({
      where: {
        schoolYearId: currentSchoolYearId(context),
        isActive: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        scheduleKind: true,
      },
    });

    return slots.map((slot) => ({
      id: slot.id,
      label: `${days[String(slot.dayOfWeek)] ?? slot.dayOfWeek} ${slot.startTime}–${slot.endTime}${
        slot.scheduleKind === "STANDARD" ? "" : ` (${slot.scheduleKind})`
      }`,
    }));
  }

  /*
    A niveau ouvert, named.

    `LevelOffering` carries no readable column of its own — it *is* a level plus,
    in the qualifying cycle, a filière — so the generic `labelFields` mechanism
    had nothing to point at and was set to `["id"]`. Every dropdown offering a
    niveau therefore listed raw cuids, which is unusable: picking the right one
    meant knowing which opaque string was 3AP.

    A loader rather than wider `labelFields` for the same reason `@slots` is one:
    the label lives across two joins, and `labelOf` only reads columns of the row
    it is given. Scoped through the resource's own `where`, so this offers
    exactly the rows the generic path would have.
  */
  if (referenceTo === "level-offerings") {
    const offeringSchema = resourceSchema("level-offerings");
    if (!offeringSchema) return [];

    const offerings = await db.levelOffering.findMany({
      where: offeringSchema.where(context),
      orderBy: [{ level: { gradeYear: "asc" } }, { track: { position: "asc" } }],
      select: {
        id: true,
        level: { select: { name: true, code: true } },
        track: { select: { name: true } },
      },
    });

    return offerings.map((offering) => ({
      id: offering.id,
      // The name leads, because that is what the reader is choosing between.
      // The code follows in brackets: a school talks in codes ("3AP"), and two
      // levels can share a name across cycles, so dropping it entirely would
      // make some lists ambiguous.
      label: [
        offering.track
          ? `${offering.level.name} — ${offering.track.name}`
          : offering.level.name,
        `(${offering.level.code})`,
      ].join(" "),
    }));
  }

  const target = findResource(referenceTo);
  const schema = resourceSchema(referenceTo);
  if (!target || !schema) return [];

  const records = await schema.table().findMany({
    where: schema.where(context),
    orderBy: schema.orderBy,
  });

  return records.map((record) => ({
    id: String(record.id),
    label: labelOf(record, target.labelFields),
  }));
}

/** Every reference field's options, keyed by field name. */
export async function loadAllChoices(
  context: AuthContext,
  resource: ResourceDef,
): Promise<Record<string, Choice[]>> {
  const references = resource.fields.filter(
    (field) => field.type === "reference" && field.referenceTo,
  );

  const loaded = await Promise.all(
    references.map(async (field) => ({
      name: field.name,
      choices: await loadChoices(context, field.referenceTo as string),
    })),
  );

  return Object.fromEntries(loaded.map((entry) => [entry.name, entry.choices]));
}

/** Rows plus the choices its reference columns and its dialog both need. */
export async function listResource(
  context: AuthContext,
  resource: ResourceDef,
): Promise<{ rows: ResourceRow[]; choices: Record<string, Choice[]> }> {
  const schema = resourceSchema(resource.id);
  if (!schema) return { rows: [], choices: {} };

  const [records, choices] = await Promise.all([
    schema.table().findMany({
      where: schema.where(context),
      orderBy: schema.orderBy,
    }),
    loadAllChoices(context, resource),
  ]);

  return {
    rows: records.map((record) => toRow(record, resource.fields)),
    choices,
  };
}

/**
 * The single row of a singleton resource, as the form's defaults.
 *
 * Returns nulls rather than an empty object when the row does not exist yet, so
 * the form falls back to each field's `defaultValue` — which is the same value
 * the column defaults to and the same value `DEFAULT_SETTINGS` carries. A
 * school that has never opened this screen and one that has saved the defaults
 * are therefore indistinguishable, which is what makes the row optional.
 */
export async function findSingleton(
  context: AuthContext,
  resource: ResourceDef,
): Promise<ResourceRow | null> {
  const schema = resourceSchema(resource.id);
  if (!schema) return null;

  const record = await schema.table().findFirst({ where: schema.where(context) });
  return record ? toRow(record, resource.fields) : null;
}

/**
 * Asserts every reference the form submitted points at a row the current
 * context owns.
 *
 * The dropdowns are already filtered, but a Server Function is reachable by
 * direct POST — without this, a crafted `levelId` would attach one school's
 * level to another school's class. Returns the name of the first bad field, or
 * null when everything checks out.
 */
export async function findUnreachableReference(
  context: AuthContext,
  resource: ResourceDef,
  values: Record<string, unknown>,
): Promise<string | null> {
  for (const field of resource.fields) {
    if (field.type !== "reference" || !field.referenceTo) continue;

    const value = values[field.name];
    if (value === null || value === undefined || value === "") continue;

    if (field.referenceTo === "@teachers") {
      const user = await db.user.findFirst({
        where: { id: String(value), organizationId: context.organization.id },
        select: { id: true },
      });
      if (!user) return field.name;
      continue;
    }

    /*
      The bell schedule.

      `@slots` is a loader id, not a resource id, so `resourceSchema` has nothing
      under it and the fall-through below treated the field as unreachable — on
      every save. That made `teacher-unavailability`, whose `timeSlotId` points
      here, impossible to create or update at all: the form came back refusing
      the one value the dropdown had just offered.

      Checked against the year in context, which is the same clause the loader
      builds its options from.
    */
    if (field.referenceTo === "@slots") {
      const slot = await db.timeSlot.findFirst({
        where: {
          id: String(value),
          schoolYearId: currentSchoolYearId(context),
        },
        select: { id: true },
      });
      if (!slot) return field.name;
      continue;
    }

    const schema = resourceSchema(field.referenceTo);
    if (!schema) return field.name;

    const record = await schema.table().findFirst({
      where: { ...schema.where(context), id: String(value) },
    });
    if (!record) return field.name;
  }

  return null;
}
