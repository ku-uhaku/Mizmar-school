import "server-only";

import { db } from "@/lib/db";
import { copyFeeConfiguration } from "@/modules/billing/service";
import { copyClassStructure } from "@/modules/classes/service";
import {
  shiftInDays,
  type YearCopyPart,
} from "@/modules/school-years/enums";
import {
  copyHolidays,
  copyTimeSlots,
  generateSchoolWeeks,
} from "@/modules/timetable/service";
import { copyTransportConfiguration } from "@/modules/transport/service";

/**
 * Writes and invariants for the school-years module.
 *
 * `actions.ts` owns the request-shaped work — authorize, parse the form, return
 * an `ActionState`. Anything that is a *rule about the data* lives here, so the
 * rule holds no matter which action (or future import script) performs the
 * write.
 */

/**
 * Enforces "at most one default year per school".
 *
 * SQLite cannot express this as a partial unique index through Prisma, so it is
 * a service-layer invariant: every write that sets `isDefault` must clear the
 * others first. `keepId` is the row being promoted, which must survive.
 */
export async function clearOtherDefaultYears(
  schoolId: string,
  keepId?: string,
): Promise<void> {
  await db.schoolYear.updateMany({
    where: {
      schoolId,
      isDefault: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isDefault: false },
  });
}

/** Promotes one year to be its school's default, demoting whichever held it. */
export async function makeDefaultYear(
  schoolId: string,
  yearId: string,
): Promise<void> {
  await clearOtherDefaultYears(schoolId, yearId);
  await db.schoolYear.update({
    where: { id: yearId },
    data: { isDefault: true },
  });
}

// ── Starting a year from the last one ────────────────────────────────────────

/**
 * Copies a year's terms onto another, shifted by whole weeks.
 *
 * Idempotent on `(schoolYearId, number)`, and never overwrites: a year whose
 * semesters somebody has already dated keeps them.
 */
async function copyTerms(
  sourceYearId: string,
  targetYearId: string,
  shiftDays: number,
): Promise<number> {
  const terms = await db.term.findMany({
    where: { schoolYearId: sourceYearId },
    orderBy: { number: "asc" },
  });

  const shift = (date: Date) => {
    const moved = new Date(date);
    moved.setDate(moved.getDate() + shiftDays);
    return moved;
  };

  const before = await db.term.count({ where: { schoolYearId: targetYearId } });

  for (const term of terms) {
    await db.term.upsert({
      where: {
        schoolYearId_number: {
          schoolYearId: targetYearId,
          number: term.number,
        },
      },
      update: {},
      create: {
        schoolYearId: targetYearId,
        number: term.number,
        name: term.name,
        nameAr: term.nameAr,
        startDate: shift(term.startDate),
        endDate: shift(term.endDate),
        // Always PLANNED: a semester copied from a year that has finished is
        // not itself finished, and carrying CLOSED across would lock a term
        // nobody has taught yet.
        status: "PLANNED",
      },
      select: { id: true },
    });
  }

  return (
    (await db.term.count({ where: { schoolYearId: targetYearId } })) - before
  );
}

export type YearCopyResult = {
  terms: number;
  timeSlots: number;
  holidays: number;
  offerings: number;
  classes: number;
  groups: number;
  feeRates: number;
  discounts: number;
  transportSchedules: number;
  routes: number;
  stops: number;
  weeks: number;
};

/**
 * Starts a year from a previous one.
 *
 * ── Why this orchestrates rather than writes ────────────────────────────────
 * Each part is copied by the module that owns the tables — `classes` knows what
 * a class group is, `billing` knows what a rate means, `transport` knows that a
 * stop's quartier is not year-scoped. This decides only the order and passes
 * the ids along, exactly as `prisma/seed.ts` does. A copier that reached into
 * four modules' tables itself would be the one place every future column had to
 * be remembered.
 *
 * ── Order matters twice ─────────────────────────────────────────────────────
 * The holidays go in before the weeks are laid out, because which weeks are
 * taught depends on them. Everything else is independent.
 *
 * Idempotent throughout: every part upserts and none overwrites, so copying
 * onto a year somebody has already begun editing fills the gaps and leaves
 * their work alone.
 */
export async function copyYearConfiguration(
  sourceYearId: string,
  targetYearId: string,
  parts: readonly YearCopyPart[],
): Promise<YearCopyResult> {
  const result: YearCopyResult = {
    terms: 0, timeSlots: 0, holidays: 0,
    offerings: 0, classes: 0, groups: 0,
    feeRates: 0, discounts: 0,
    transportSchedules: 0, routes: 0, stops: 0,
    weeks: 0,
  };

  const [source, target] = await Promise.all([
    db.schoolYear.findUnique({
      where: { id: sourceYearId },
      select: { id: true, startDate: true, schoolId: true },
    }),
    db.schoolYear.findUnique({
      where: { id: targetYearId },
      select: { id: true, startDate: true, schoolId: true },
    }),
  ]);

  // Both years must belong to the same school. The action checks this too, but
  // the rule belongs to the data: a price list copied across schools would be
  // one tenant's figures landing in another's.
  if (!source || !target || source.schoolId !== target.schoolId) return result;

  const shiftDays = shiftInDays(source.startDate, target.startDate);

  if (parts.includes("CALENDAR")) {
    result.terms = await copyTerms(sourceYearId, targetYearId, shiftDays);
    result.timeSlots = await copyTimeSlots(sourceYearId, targetYearId);
    result.holidays = await copyHolidays(sourceYearId, targetYearId, shiftDays);

    // After the holidays: which weeks are taught depends on them.
    const weeks = await generateSchoolWeeks(targetYearId);
    result.weeks = weeks.written;
  }

  if (parts.includes("STRUCTURE")) {
    const structure = await copyClassStructure(sourceYearId, targetYearId);
    result.offerings = structure.offerings;
    result.classes = structure.classes;
    result.groups = structure.groups;
  }

  if (parts.includes("FEES")) {
    const fees = await copyFeeConfiguration(sourceYearId, targetYearId);
    result.feeRates = fees.rates;
    result.discounts = fees.discounts;
  }

  if (parts.includes("TRANSPORT")) {
    const transport = await copyTransportConfiguration(
      sourceYearId,
      targetYearId,
    );
    result.transportSchedules = transport.schedules;
    result.routes = transport.routes;
    result.stops = transport.stops;
  }

  return result;
}
