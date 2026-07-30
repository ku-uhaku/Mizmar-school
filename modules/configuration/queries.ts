import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
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

    const schema = resourceSchema(field.referenceTo);
    if (!schema) return field.name;

    const record = await schema.table().findFirst({
      where: { ...schema.where(context), id: String(value) },
    });
    if (!record) return field.name;
  }

  return null;
}
