"use server";

import { refresh } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import {
  boolField,
  field,
  listField,
  withActionErrors,
} from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors } from "@/lib/validation";
import {
  cancelEvent,
  createEvent,
  publishEvent,
  unpublishEvent,
  updateEvent,
} from "@/modules/events/service";
import { eventSchema } from "@/modules/events/validation";

/**
 * Actions for the events module.
 *
 * Every one of these authorizes first, and the school and the year both come
 * from the working context rather than from the form — an event is a fact of
 * one year at one school, and letting a request name either would let a crafted
 * POST announce something into a school the author cannot reach.
 *
 * Publishing is behind its own code. See modules/events/permissions.ts.
 */

function readEventForm(formData: FormData) {
  return {
    title: field(formData, "title"),
    titleAr: field(formData, "titleAr"),
    description: field(formData, "description"),
    kind: field(formData, "kind"),
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    isAllDay: boolField(formData, "isAllDay"),
    location: field(formData, "location"),
    isSchoolWide: boolField(formData, "isSchoolWide"),
    levelIds: listField(formData, "levelIds"),
    classIds: listField(formData, "classIds"),
  };
}

/** The school and year in context, or the failure that says which is missing. */
async function currentScope() {
  const t = await getDictionary();
  const context = await requireAuth();
  const schoolId = context.currentSchool?.id ?? null;
  const schoolYearId = context.currentSchoolYear?.id ?? null;
  return { t, context, schoolId, schoolYearId };
}

export async function saveEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId, schoolYearId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    await authorizeSchool(schoolId, PERMISSIONS.EVENT_MANAGE);

    const parsed = eventSchema(t).safeParse(readEventForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    const input = {
      schoolId,
      schoolYearId,
      title: parsed.data.title,
      titleAr: parsed.data.titleAr,
      description: parsed.data.description,
      kind: parsed.data.kind,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      isAllDay: parsed.data.isAllDay,
      location: parsed.data.location,
      isSchoolWide: parsed.data.isSchoolWide,
      audience: {
        levelIds: parsed.data.levelIds,
        classIds: parsed.data.classIds,
      },
    };

    const eventId = field(formData, "id");

    if (eventId) {
      // Re-derived against the context rather than trusted: an id from the
      // request must not reach another school's or another year's event.
      const existing = await db.event.findFirst({
        where: { id: eventId, schoolId, schoolYearId },
        select: { id: true },
      });
      if (!existing) return failure(t.errors.notFound);

      await updateEvent(existing.id, input);
    } else {
      await createEvent(input, context.user.id);
    }

    refresh();
    return success(t.event.saved);
  });
}

export async function publishEventAction(
  eventId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, context, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.EVENT_PUBLISH);

    const result = await publishEvent(eventId, schoolId, context.user.id);
    if (!result.ok) {
      switch (result.reason) {
        case "NOT_FOUND":
          return failure(t.errors.notFound);
        case "ALREADY_PUBLISHED":
          return failure(t.event.published);
        case "NO_AUDIENCE":
          return failure(t.event.audienceEmpty);
        case "CANCELLED":
          return failure(t.event.cannotPublishCancelled);
      }
    }

    refresh();
    return success(t.event.published);
  });
}

export async function unpublishEventAction(
  eventId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.EVENT_PUBLISH);

    const moved = await unpublishEvent(eventId, schoolId);
    if (!moved) return failure(t.errors.notFound);

    refresh();
    return success(t.event.unpublished);
  });
}

export async function cancelEventAction(eventId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.EVENT_PUBLISH);

    const cancelled = await cancelEvent(eventId, schoolId);
    if (!cancelled) return failure(t.errors.notFound);

    refresh();
    return success(t.event.cancelled);
  });
}

/**
 * Removes an event outright.
 *
 * Refused once it has been announced: families were told, so the honest move is
 * to call it off — which keeps the line on their screen saying so — rather than
 * make it vanish and send somebody to a locked gate.
 */
export async function deleteEventAction(eventId: string): Promise<ActionState> {
  return withActionErrors(async () => {
    const { t, schoolId } = await currentScope();
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.EVENT_DELETE);

    const existing = await db.event.findFirst({
      where: { id: eventId, schoolId },
      select: { id: true, status: true },
    });
    if (!existing) return failure(t.errors.notFound);
    if (existing.status !== "DRAFT") {
      return failure(t.event.deletePublished);
    }

    // The audience rows go with it — `onDelete: Cascade` on EventAudience.
    await db.event.delete({ where: { id: existing.id } });

    refresh();
    return success(t.event.deleted);
  });
}
