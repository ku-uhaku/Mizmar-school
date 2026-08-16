"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { findUnreachableReference } from "@/modules/configuration/queries";
import { findResource } from "@/modules/configuration/resources";
import {
  findBlockingReference,
  resourceSchema,
  type ChildCollection,
} from "@/modules/configuration/resource-schema";
import type { ResourceDef } from "@/modules/configuration/types";
import {
  coerceIntegerSelects,
  readResourceForm,
  resourceSchemaFor,
} from "@/modules/configuration/validation";

/**
 * One create, one update and one delete for all fourteen configuration
 * resources. The resource id travels in the form (or the argument) and every
 * one of them re-resolves the descriptor and the scope server-side.
 *
 * The three things each action does before touching the database:
 *
 *   1. authorize CONFIGURATION_MANAGE **in the school that is in context**
 *   2. require the working context the resource is scoped to
 *   3. constrain the write by that context's `where`, so a crafted id matches
 *      no rows instead of reaching another school's
 */

/**
 * Turns every `type: "reference"` field's scalar id into Prisma's relation
 * form for a single-record `create` — `{ cityId: "x" }` becomes
 * `{ city: { connect: { id: "x" } } }`. This client's generated create input
 * only accepts the relation, never the plain foreign-key column (unlike
 * `updateMany`, which is flat scalars only and needs no such conversion — see
 * the note on `updateConfigItemAction`).
 *
 * The relation's own field name is always the scalar's name with a trailing
 * "Id" removed throughout this schema (`cityId` → `city`, `mainTeacherId` →
 * `mainTeacher`), so no per-resource mapping is needed here.
 */
function toRelationData(
  resource: ResourceDef,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...values };
  for (const field of resource.fields) {
    if (field.type !== "reference") continue;
    const id = data[field.name];
    delete data[field.name];
    if (id === null || id === undefined) continue;
    data[field.name.replace(/Id$/, "")] = { connect: { id } };
  }
  return data;
}

/**
 * Splits the `multireference` fields out of the parsed values.
 *
 * They are not columns — they are rows in a join table — so they must not reach
 * a `create` or an `updateMany` as data, where Prisma would reject them as
 * unknown arguments. Both writes deal with the two halves separately: the
 * scalars go to the row, the id lists go to `writeChildren`.
 */
function splitChildren(
  children: Record<string, ChildCollection> | undefined,
  values: Record<string, unknown>,
): { scalars: Record<string, unknown>; sets: Record<string, string[]> } {
  const scalars = { ...values };
  const sets: Record<string, string[]> = {};

  for (const name of Object.keys(children ?? {})) {
    if (!(name in scalars)) continue;
    sets[name] = String(scalars[name] ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    delete scalars[name];
  }

  return { scalars, sets };
}

/**
 * Replaces each join table's rows with what the form submitted.
 *
 * Wholesale rather than diffed, and in one transaction, for the same reason
 * `updateRoleAction` replaces a role's permissions that way: the form submits
 * the full desired state, so working out which rows changed would only add a
 * chance to get it wrong — and a delete that lands without its insert would
 * silently widen a qualification from "2AP and 3AP" to "every niveau".
 *
 * The parent row is looked up through the scoped `where` before this is called,
 * so `parentId` is already known to be reachable.
 */
async function writeChildren(
  children: Record<string, ChildCollection> | undefined,
  sets: Record<string, string[]>,
  parentId: string,
): Promise<void> {
  const operations = Object.entries(sets).flatMap(([name, ids]) => {
    const child = children?.[name];
    if (!child) return [];

    return [
      child.table().deleteMany({ where: { [child.parentColumn]: parentId } }),
      ...(ids.length > 0
        ? [
            child.table().createMany({
              data: ids.map((id) => ({
                [child.parentColumn]: parentId,
                [child.column]: id,
              })),
            }),
          ]
        : []),
    ];
  });

  if (operations.length === 0) return;
  await db.$transaction(operations as never);
}

/**
 * Resolves the resource and asserts the caller may manage configuration in the
 * school they currently have selected.
 */
async function authorizeResource(
  resourceId: string,
): Promise<
  | { ok: true; context: AuthContext; resource: ResourceDef }
  | { ok: false; state: ActionState }
> {
  const t = await getDictionary();

  const resource = findResource(resourceId);
  if (!resource || !resourceSchema(resourceId)) {
    return { ok: false, state: failure(t.errors.notFound) };
  }

  const base = await requireAuth();
  const schoolId = base.currentSchool?.id;
  if (!schoolId) {
    return { ok: false, state: failure(t.errors.noSchoolContext) };
  }

  // Scoped check: a director may configure their own school, not every school.
  const context = await authorizeSchool(
    schoolId,
    PERMISSIONS.CONFIGURATION_MANAGE,
  );

  // A year-scoped resource is meaningless without a year selected.
  if (resource.scope === "YEAR" && !context.currentSchoolYear) {
    return { ok: false, state: failure(t.errors.noSchoolYearContext) };
  }

  return { ok: true, context, resource };
}

export async function createConfigItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const resolved = await authorizeResource(field(formData, "__resource"));
    if (!resolved.ok) return resolved.state;

    const { context, resource } = resolved;
    const schema = resourceSchema(resource.id)!;

    // Validated against the select's own (string) options first — coercing to
    // a number before this would fail every one of them, since `Int` can never
    // equal a string in `options.includes`. Only once it has passed does the
    // value become what the column actually stores.
    const parsed = resourceSchemaFor(resource, t).safeParse(
      readResourceForm(resource, formData),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const values = coerceIntegerSelects(
      resource,
      parsed.data as Record<string, unknown>,
    );

    // Every reference must point inside the current context — the dropdown was
    // filtered, but a direct POST was not.
    const unreachable = await findUnreachableReference(
      context,
      resource,
      values,
    );
    if (unreachable) {
      return failure(t.errors.forbidden, {
        [unreachable]: t.configuration.outOfContext,
      });
    }

    const { scalars, sets } = splitChildren(schema.children, values);

    // Nested rather than a second write: the parent's id is not known until it
    // exists, and a create that half-succeeded would leave a qualification
    // claiming every niveau in the school.
    const nested = Object.entries(sets).flatMap(([name, ids]) => {
      const child = schema.children?.[name];
      if (!child || ids.length === 0) return [];
      return [
        [child.relation, { create: ids.map((id) => ({ [child.column]: id })) }],
      ] as const;
    });

    await schema.table().create({
      data: {
        ...toRelationData(resource, scalars),
        ...(schema.createData?.(context, scalars) ?? {}),
        ...(schema.derive?.(scalars) ?? {}),
        ...Object.fromEntries(nested),
      },
    });

    refresh();
    return success(t.configuration.created);
  });
}

export async function updateConfigItemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const resolved = await authorizeResource(field(formData, "__resource"));
    if (!resolved.ok) return resolved.state;

    const { context, resource } = resolved;
    const schema = resourceSchema(resource.id)!;
    const id = field(formData, "id");
    if (!id) return failure(t.errors.notFound);

    const parsed = resourceSchemaFor(resource, t).safeParse(
      readResourceForm(resource, formData),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const values = coerceIntegerSelects(
      resource,
      parsed.data as Record<string, unknown>,
    );

    const unreachable = await findUnreachableReference(
      context,
      resource,
      values,
    );
    if (unreachable) {
      return failure(t.errors.forbidden, {
        [unreachable]: t.configuration.outOfContext,
      });
    }

    // `updateMany` with the context clause rather than `update` by id: a row
    // outside the current school or year simply matches nothing, so a crafted
    // id is a "not found" instead of a cross-tenant write.
    //
    // `values` goes in as-is, reference fields included: `updateMany`'s input
    // is flat scalars only (it has no per-record nested writes to hang a
    // relation `connect` off), so the plain `cityId`-shaped value it already
    // has is exactly what it wants — unlike `create`, see `toRelationData`.
    const { scalars, sets } = splitChildren(schema.children, values);

    const updated = await schema.table().updateMany({
      where: { ...schema.where(context), id },
      data: { ...scalars, ...(schema.derive?.(scalars) ?? {}) },
    });
    if (updated.count === 0) return failure(t.errors.notFound);

    // Only after the scoped update matched: `updateMany` returning 0 is how a
    // row outside this school or year reads, and the join tables are keyed by
    // bare id, so rewriting them first would reach past the scope clause.
    await writeChildren(schema.children, sets, id);

    refresh();
    return success(t.configuration.updated);
  });
}

/**
 * Saves a singleton resource — today, the school's own settings.
 *
 * An upsert rather than a create-or-update pair, because the row is optional by
 * design: a school that has never opened this screen has no row, and the very
 * first save has to make one. It is keyed on `schoolId`, which is taken from
 * the authorized context and never from the form, so this cannot write another
 * school's settings however the request is crafted.
 */
export async function saveSingletonAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const resolved = await authorizeResource(field(formData, "__resource"));
    if (!resolved.ok) return resolved.state;

    const { context, resource } = resolved;
    if (resource.kind !== "singleton") return failure(t.errors.notFound);

    const schoolId = context.currentSchool!.id;

    const parsed = resourceSchemaFor(resource, t).safeParse(
      readResourceForm(resource, formData),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // Same coercion the list resources get: a singleton may hold an integer
    // select too, and this path did not call it.
    const values = coerceIntegerSelects(
      resource,
      parsed.data as Record<string, unknown>,
    );

    await db.schoolSettings.upsert({
      where: { schoolId },
      create: { ...values, school: { connect: { id: schoolId } } },
      update: values,
    });

    refresh();
    return success(t.configuration.updated);
  });
}

export async function deleteConfigItemAction(
  resourceId: string,
  id: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const resolved = await authorizeResource(resourceId);
    if (!resolved.ok) return resolved.state;

    const { context, resource } = resolved;
    const schema = resourceSchema(resource.id)!;

    /*
      Establish that the row is one this context may reach *before* asking
      anything else about it.

      `findBlockingReference` counts by bare id — it has to, since it walks the
      runtime data model rather than this resource's scope — so consulting it
      first answered "used by 12 records" for a room, a subject or a fee type
      belonging to another school in the same organisation. A director configures
      their own school and no other, and that reply confirmed both the existence
      of a neighbour's row and how heavily it is used, where the scoped
      `deleteMany` below correctly says nothing at all. This file's own header
      promises "a crafted id matches no rows instead of reaching another
      school's", and the guard was reading ahead of the promise.
    */
    const inScope = await schema.table().findFirst({
      where: { ...schema.where(context), id },
      select: { id: true },
    });
    if (!inScope) return failure(t.errors.notFound);

    // Refuse rather than let the database decide: a `Cascade` relation would
    // silently take a whole programme or price list down with one row, and a
    // `Restrict` one would surface as a raw constraint error instead of a
    // message anybody at the guichet can act on.
    const blocking = await findBlockingReference(schema.model, id);
    if (blocking) {
      return failure(interpolate(t.configuration.inUse, { count: blocking.count }));
    }

    const deleted = await schema.table().deleteMany({
      where: { ...schema.where(context), id },
    });
    if (deleted.count === 0) return failure(t.errors.notFound);

    refresh();
    return success(t.configuration.deleted);
  });
}
