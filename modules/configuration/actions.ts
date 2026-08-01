"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import { findUnreachableReference } from "@/modules/configuration/queries";
import { findResource } from "@/modules/configuration/resources";
import { resourceSchema } from "@/modules/configuration/resource-schema";
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

    const parsed = resourceSchemaFor(resource, t).safeParse(
      coerceIntegerSelects(resource, readResourceForm(resource, formData)),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const values = parsed.data as Record<string, unknown>;

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

    await schema.table().create({
      data: {
        ...values,
        ...(schema.createData?.(context, values) ?? {}),
        ...(schema.derive?.(values) ?? {}),
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
      coerceIntegerSelects(resource, readResourceForm(resource, formData)),
    );
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const values = parsed.data as Record<string, unknown>;

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
    const updated = await schema.table().updateMany({
      where: { ...schema.where(context), id },
      data: { ...values, ...(schema.derive?.(values) ?? {}) },
    });
    if (updated.count === 0) return failure(t.errors.notFound);

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

    const values = parsed.data as Record<string, unknown>;

    await db.schoolSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...values },
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

    const deleted = await schema.table().deleteMany({
      where: { ...schema.where(context), id },
    });
    if (deleted.count === 0) return failure(t.errors.notFound);

    refresh();
    return success(t.configuration.deleted);
  });
}
