import "server-only";

import { db } from "@/lib/db";
import {
  endOfDay,
  isPublishable,
  startOfDay,
} from "@/modules/events/enums";

/**
 * Writes and data invariants for the events module.
 *
 * Two things live here rather than in the action, because both are true of the
 * data whoever is writing it: an all-day event carries no clock time, and an
 * event aimed at levels or classes may only name ones this school actually has.
 */

export type EventAudienceInput = {
  levelIds: string[];
  classIds: string[];
};

export type EventInput = {
  schoolId: string;
  schoolYearId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  isAllDay: boolean;
  location: string | null;
  isSchoolWide: boolean;
  audience: EventAudienceInput;
};

/**
 * Normalises the two dates against the all-day flag.
 *
 * An all-day event is snapped to midnight and to the last instant of its
 * closing day, so "le 12 mars" sorts before "le 12 mars à 14h" and a parent's
 * screen never has to guess whether 00:00 means midnight or means nothing. The
 * columns stay `DateTime` either way — see the note on `isAllDay`.
 */
function normaliseDates(input: {
  startsAt: Date;
  endsAt: Date | null;
  isAllDay: boolean;
}): { startsAt: Date; endsAt: Date | null } {
  if (!input.isAllDay) {
    return { startsAt: input.startsAt, endsAt: input.endsAt };
  }
  return {
    startsAt: startOfDay(input.startsAt),
    endsAt: input.endsAt ? endOfDay(input.endsAt) : null,
  };
}

/**
 * The audience rows to write, filtered to what this school actually owns.
 *
 * ── Why the ids are re-derived and not trusted ───────────────────────────────
 * They arrive from a form, and a Server Function is reachable by direct POST.
 * Without this, a crafted `levelId` would attach another school's level to this
 * school's event — and the parent query joins on exactly these rows, so the
 * announcement would then be delivered against a level nobody here teaches.
 * Anything that does not survive the filter is dropped rather than refused: the
 * screen only ever offers reachable ids, so a dropped one is an attack and not
 * a typo worth explaining.
 */
async function reachableAudience(
  schoolId: string,
  schoolYearId: string,
  audience: EventAudienceInput,
): Promise<{ levelIds: string[]; classIds: string[] }> {
  const [levels, classes] = await Promise.all([
    audience.levelIds.length > 0
      ? db.level.findMany({
          where: { id: { in: audience.levelIds }, schoolId },
          select: { id: true },
        })
      : Promise.resolve([]),
    audience.classIds.length > 0
      ? db.schoolClass.findMany({
          where: {
            id: { in: audience.classIds },
            schoolId,
            levelOffering: { schoolYearId },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    levelIds: levels.map((row) => row.id),
    classIds: classes.map((row) => row.id),
  };
}

/** Creates an event. Always a draft — publishing is a separate decision. */
export async function createEvent(
  input: EventInput,
  createdById: string,
): Promise<string> {
  const dates = normaliseDates(input);
  const audience = input.isSchoolWide
    ? { levelIds: [], classIds: [] }
    : await reachableAudience(input.schoolId, input.schoolYearId, input.audience);

  const event = await db.event.create({
    data: {
      schoolId: input.schoolId,
      schoolYearId: input.schoolYearId,
      title: input.title,
      titleAr: input.titleAr,
      description: input.description,
      kind: input.kind,
      status: "DRAFT",
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      isAllDay: input.isAllDay,
      location: input.location,
      isSchoolWide: input.isSchoolWide,
      createdById,
      audiences: {
        create: [
          ...audience.levelIds.map((levelId) => ({ levelId })),
          ...audience.classIds.map((schoolClassId) => ({ schoolClassId })),
        ],
      },
    },
    select: { id: true },
  });

  return event.id;
}

/**
 * Edits an event, audience included.
 *
 * The audience is replaced wholesale rather than diffed: it is a set of at most
 * a few dozen rows with nothing hanging off them, and a delete-then-write in one
 * transaction cannot leave a half-applied audience the way a diff can.
 */
export async function updateEvent(
  eventId: string,
  input: EventInput,
): Promise<void> {
  const dates = normaliseDates(input);
  const audience = input.isSchoolWide
    ? { levelIds: [], classIds: [] }
    : await reachableAudience(input.schoolId, input.schoolYearId, input.audience);

  await db.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: {
        title: input.title,
        titleAr: input.titleAr,
        description: input.description,
        kind: input.kind,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        isAllDay: input.isAllDay,
        location: input.location,
        isSchoolWide: input.isSchoolWide,
      },
    });

    await tx.eventAudience.deleteMany({ where: { eventId } });

    if (!input.isSchoolWide) {
      await tx.eventAudience.createMany({
        data: [
          ...audience.levelIds.map((levelId) => ({ eventId, levelId })),
          ...audience.classIds.map((schoolClassId) => ({
            eventId,
            schoolClassId,
          })),
        ],
      });
    }
  });
}

export type PublishResult =
  | { ok: true }
  | {
      ok: false;
      reason: "NOT_FOUND" | "ALREADY_PUBLISHED" | "NO_AUDIENCE" | "CANCELLED";
    };

/**
 * Puts an event in front of families.
 *
 * The audience is re-checked here and not only at the form, because a draft may
 * legitimately be saved school-wide and narrowed afterwards — and a targeted
 * event whose last level was removed in between would otherwise be published to
 * nobody. A published event nobody can see is always a mistake, never a choice.
 *
 * `updateMany` naming the expected status rather than `update` by id: two people
 * pressing Publish at once means the second matches no rows instead of
 * overwriting the first one's stamp.
 */
export async function publishEvent(
  eventId: string,
  schoolId: string,
  publishedById: string,
): Promise<PublishResult> {
  const event = await db.event.findFirst({
    where: { id: eventId, schoolId },
    select: {
      id: true,
      status: true,
      isSchoolWide: true,
      _count: { select: { audiences: true } },
    },
  });

  if (!event) return { ok: false, reason: "NOT_FOUND" };
  if (event.status === "PUBLISHED") {
    return { ok: false, reason: "ALREADY_PUBLISHED" };
  }
  /*
    Only a draft may be announced — `isPublishable`, the same predicate the
    manager uses to decide whether to draw the button.

    It used to accept anything that was not already published, which let a
    *cancelled* event be announced again by a direct POST: the status went back
    to PUBLISHED and `publishedAt` was restamped, so the line a family had been
    shown saying the réunion was called off silently became a line saying it was
    on. CANCELLED is kept and shown rather than deleted for exactly that reason
    — and `deleteEventAction` refuses a published event on the same grounds —
    so this was the one door left open onto the record the rest of the module
    protects. Calling an event back on is a new announcement, not an undo.
  */
  if (!isPublishable(event.status)) {
    return { ok: false, reason: "CANCELLED" };
  }
  if (!event.isSchoolWide && event._count.audiences === 0) {
    return { ok: false, reason: "NO_AUDIENCE" };
  }

  const claimed = await db.event.updateMany({
    // The state this decision was made against, restated as a condition: two
    // people pressing Publish at once means the second matches no rows instead
    // of overwriting the first one's stamp.
    where: { id: eventId, schoolId, status: "DRAFT" },
    data: { status: "PUBLISHED", publishedAt: new Date(), publishedById },
  });

  if (claimed.count === 0) return { ok: false, reason: "ALREADY_PUBLISHED" };
  return { ok: true };
}

/**
 * Takes an event back out of families' hands.
 *
 * The publication stamp is cleared with it, so `publishedAt` never says an event
 * is announced while `status` says it is a draft — the two are one fact.
 */
export async function unpublishEvent(
  eventId: string,
  schoolId: string,
): Promise<boolean> {
  const updated = await db.event.updateMany({
    where: { id: eventId, schoolId, status: "PUBLISHED" },
    data: { status: "DRAFT", publishedAt: null, publishedById: null },
  });
  return updated.count > 0;
}

/**
 * Calls off an announced event.
 *
 * The publication stamp is deliberately *kept*: the event stays visible to the
 * families it was announced to, marked as called off, which is the whole reason
 * this is not a delete — see the note on the column.
 */
export async function cancelEvent(
  eventId: string,
  schoolId: string,
): Promise<boolean> {
  const updated = await db.event.updateMany({
    where: { id: eventId, schoolId, status: "PUBLISHED" },
    data: { status: "CANCELLED" },
  });
  return updated.count > 0;
}
