import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolYearId, schoolScope } from "@/lib/scope";
import {
  cycleChoiceLabel,
  levelChoiceLabel,
} from "@/modules/academics/labels";
import { isUpcoming } from "@/modules/events/enums";

/**
 * Reads for the events module.
 *
 * Everything is scoped to the school *and* the year in context, never to an id
 * from the request — switching year in the header changes what this returns,
 * which is the point of an event belonging to a year.
 *
 * Staff read every status here, drafts included. Families read through
 * `modules/portal/queries.ts` instead, which filters on the published statuses
 * and on the household — a phone never reaches this file.
 */

export type EventAudienceRow = {
  levelIds: string[];
  classIds: string[];
};

export type EventRow = {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  kind: string;
  status: string;
  /** ISO — formatted per-locale on the client. */
  startsAt: string;
  endsAt: string | null;
  isAllDay: boolean;
  location: string | null;
  isSchoolWide: boolean;
  audience: EventAudienceRow;
  /** How many levels and classes it is aimed at, for the list's badge. */
  audienceCount: number;
  publishedAt: string | null;
  publishedByName: string | null;
  /** Derived, never stored — see `isUpcoming`. */
  isUpcoming: boolean;
};

function displayName(user: {
  username: string;
  profile: { firstName: string; lastName: string } | null;
} | null): string | null {
  if (!user) return null;
  if (!user.profile) return user.username;
  return (
    `${user.profile.firstName} ${user.profile.lastName}`.trim() || user.username
  );
}

const EVENT_INCLUDE = {
  audiences: { select: { levelId: true, schoolClassId: true } },
  publishedBy: {
    select: {
      username: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

type EventRecord = Awaited<
  ReturnType<typeof db.event.findMany<{ include: typeof EVENT_INCLUDE }>>
>[number];

function toRow(event: EventRecord, now: Date): EventRow {
  const levelIds = event.audiences
    .map((row) => row.levelId)
    .filter((id): id is string => id !== null);
  const classIds = event.audiences
    .map((row) => row.schoolClassId)
    .filter((id): id is string => id !== null);

  return {
    id: event.id,
    title: event.title,
    titleAr: event.titleAr,
    description: event.description,
    kind: event.kind,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    isAllDay: event.isAllDay,
    location: event.location,
    isSchoolWide: event.isSchoolWide,
    audience: { levelIds, classIds },
    audienceCount: levelIds.length + classIds.length,
    publishedAt: event.publishedAt?.toISOString() ?? null,
    publishedByName: displayName(event.publishedBy),
    isUpcoming: isUpcoming(event, now),
  };
}

/** Every event of the year in context, soonest first. */
export async function listEvents(context: AuthContext): Promise<EventRow[]> {
  const events = await db.event.findMany({
    where: {
      ...schoolScope(context),
      schoolYearId: currentSchoolYearId(context),
    },
    orderBy: [{ startsAt: "asc" }],
    include: EVENT_INCLUDE,
  });

  const now = new Date();
  return events.map((event) => toRow(event, now));
}

/**
 * One event, scoped the same way.
 *
 * Returns null rather than throwing so the caller decides between "not found"
 * and "forbidden" — an id from another school reads as absent, which is what
 * stops its existence being probed.
 */
export async function findEvent(
  context: AuthContext,
  eventId: string,
): Promise<EventRow | null> {
  const event = await db.event.findFirst({
    where: {
      id: eventId,
      ...schoolScope(context),
      schoolYearId: currentSchoolYearId(context),
    },
    include: EVENT_INCLUDE,
  });

  return event ? toRow(event, new Date()) : null;
}

/** `group` is the cycle a level hangs under; classes carry none. */
export type AudienceChoice = { id: string; label: string; group?: string };

/**
 * The levels and classes an event may be aimed at.
 *
 * Both scoped through the year's own offerings rather than the school's whole
 * cursus: a level the school does not open this year has no pupils to announce
 * anything to, and offering it would let somebody publish to nobody.
 */
export async function listAudienceChoices(context: AuthContext): Promise<{
  levels: AudienceChoice[];
  classes: AudienceChoice[];
}> {
  const yearId = currentSchoolYearId(context);

  const [offerings, classes] = await Promise.all([
    db.levelOffering.findMany({
      where: { schoolYearId: yearId },
      // Cycle first, so the clusters below stay contiguous.
      orderBy: [
        { level: { educationLevel: { position: "asc" } } },
        { level: { gradeYear: "asc" } },
      ],
      select: {
        level: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            code: true,
            educationLevel: { select: { name: true, nameAr: true } },
          },
        },
      },
    }),
    db.schoolClass.findMany({
      where: { levelOffering: { schoolYearId: yearId } },
      orderBy: [{ levelOffering: { level: { gradeYear: "asc" } } }, { code: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  // One level can be offered twice in a qualifying cycle — once per filière —
  // so the same level would otherwise appear twice in the picker.
  const seen = new Set<string>();
  const levels: AudienceChoice[] = [];
  for (const offering of offerings) {
    if (seen.has(offering.level.id)) continue;
    seen.add(offering.level.id);
    levels.push({
      id: offering.level.id,
      label: levelChoiceLabel(offering.level),
      group: cycleChoiceLabel(offering.level.educationLevel),
    });
  }

  return {
    levels,
    classes: classes.map((row) => ({ id: row.id, label: row.name || row.code })),
  };
}
