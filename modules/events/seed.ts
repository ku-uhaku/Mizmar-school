import { log, type SeedDb } from "@/prisma/seed/client";

import { endOfDay, startOfDay } from "@/modules/events/enums";

/**
 * A year's announcements, so the parent portal opens on something.
 *
 * Dated relative to the year's own start rather than to fixed calendar days:
 * the demonstration year runs March to February, and a seed that hardcoded
 * "5 September" would drop every event outside it. Offsets in days keep the
 * rentrée at the rentrée whatever shape the year is.
 */

type EventSeed = {
  /** Days after the year opens. */
  dayOffset: number;
  /** Days it runs for. 0 is a single day. */
  spanDays?: number;
  title: string;
  titleAr: string;
  description: string;
  kind: string;
  status: string;
  isAllDay: boolean;
  /** Minutes past midnight, for the ones that have a clock time. */
  startMinutes?: number;
  location: string;
};

export const SCHOOL_EVENTS: EventSeed[] = [
  {
    dayOffset: 0,
    title: "Rentrée scolaire",
    titleAr: "الدخول المدرسي",
    description:
      "Accueil des élèves et remise des emplois du temps. Les parents sont attendus dans la cour à 8h.",
    kind: "CEREMONY",
    status: "PUBLISHED",
    isAllDay: true,
    location: "Cour de l'école",
  },
  {
    dayOffset: 21,
    title: "Réunion des parents",
    titleAr: "اجتماع الآباء",
    description:
      "Présentation de l'équipe pédagogique et du programme de l'année. Un temps d'échange suivra par niveau.",
    kind: "MEETING",
    status: "PUBLISHED",
    isAllDay: false,
    startMinutes: 17 * 60,
    location: "Salle polyvalente",
  },
  {
    dayOffset: 48,
    spanDays: 1,
    title: "Sortie au musée d'Oujda",
    titleAr: "خرجة إلى متحف وجدة",
    description:
      "Sortie pédagogique. Prévoir un pique-nique et une autorisation signée.",
    kind: "OUTING",
    status: "PUBLISHED",
    isAllDay: true,
    location: "Musée archéologique d'Oujda",
  },
  {
    dayOffset: 96,
    spanDays: 4,
    title: "Examens du premier semestre",
    titleAr: "امتحانات الدورة الأولى",
    description: "Les convocations sont remises une semaine à l'avance.",
    kind: "EXAM",
    status: "PUBLISHED",
    isAllDay: true,
    location: "Salles de classe",
  },
  {
    // Kept in the demonstration on purpose: a called-off event has to stay
    // visible saying so, and the portal is the screen that proves it does.
    dayOffset: 130,
    title: "Journée portes ouvertes",
    titleAr: "يوم الأبواب المفتوحة",
    description: "Reportée — une nouvelle date sera communiquée.",
    kind: "CEREMONY",
    status: "CANCELLED",
    isAllDay: true,
    location: "Toute l'école",
  },
  {
    // The one draft, so the list has something in its Brouillons tab and the
    // portal can be checked for *not* showing it.
    dayOffset: 160,
    title: "Fête de fin d'année",
    titleAr: "حفل نهاية السنة",
    description:
      "Spectacle des élèves et remise des prix. Programme en préparation.",
    kind: "CEREMONY",
    status: "DRAFT",
    isAllDay: true,
    location: "Cour de l'école",
  },
];

function dateAt(yearStart: Date, dayOffset: number, minutes?: number): Date {
  const date = startOfDay(yearStart);
  date.setDate(date.getDate() + dayOffset);
  if (minutes !== undefined) date.setMinutes(minutes);
  return date;
}

export async function seedEvents(
  db: SeedDb,
  {
    schoolId,
    schoolYearId,
    yearStart,
    publishedById,
  }: {
    schoolId: string;
    schoolYearId: string;
    yearStart: Date;
    /** Who the announcements are made out to have come from. */
    publishedById: string | null;
  },
  events: EventSeed[] = SCHOOL_EVENTS,
): Promise<number> {
  let written = 0;

  for (const event of events) {
    const startsAt = dateAt(yearStart, event.dayOffset, event.startMinutes);
    const endsAt =
      event.spanDays && event.spanDays > 0
        ? endOfDay(dateAt(yearStart, event.dayOffset + event.spanDays))
        : null;

    const published = event.status !== "DRAFT";

    /*
      Upserted on (year, title): there is no natural code on an event, and the
      title is what a school would notice it had entered twice. Re-running
      therefore corrects the dates of an announcement rather than raising a
      second one — which is what makes this safe to run against a school that
      has already been seeded.
    */
    const existing = await db.event.findFirst({
      where: { schoolYearId, title: event.title },
      select: { id: true },
    });

    const data = {
      schoolId,
      schoolYearId,
      title: event.title,
      titleAr: event.titleAr,
      description: event.description,
      kind: event.kind,
      status: event.status,
      startsAt,
      endsAt,
      isAllDay: event.isAllDay,
      location: event.location,
      isSchoolWide: true,
      publishedAt: published ? startOfDay(yearStart) : null,
      publishedById: published ? publishedById : null,
      createdById: publishedById,
    };

    if (existing) {
      await db.event.update({ where: { id: existing.id }, data });
    } else {
      await db.event.create({ data });
    }
    written += 1;
  }

  log("events", written);
  return written;
}
