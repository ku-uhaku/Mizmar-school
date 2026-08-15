import "server-only";

import { db } from "@/lib/db";
import type { SchoolSettingsValues } from "@/lib/school-settings";
import { levelSubjectScopeKey } from "@/modules/academics/enums";
import { slotsForBell, type BellPlan } from "@/modules/setup/bell";
import {
  NO_REFERENCE_COUNTS,
  writeReferenceData,
  type ReferenceCounts,
} from "@/modules/setup/reference";
import { feeRateScopeKey } from "@/modules/billing/enums";
import { offeringScopeKey } from "@/modules/classes/enums";
import { termStatus } from "@/modules/school-years/presets";
import { planSchoolWeeks } from "@/modules/timetable/enums";
import type { TxClient } from "@/modules/treasury/service";

/**
 * Writes everything the setup wizard asked for, in one transaction.
 *
 * ── Why one transaction and not a call per module ───────────────────────────
 * Thirty-odd tables across a dozen modules is a lot of ways to get half a
 * school. A wizard that wrote the cursus and then failed on the fee list would
 * leave a school nobody can finish configuring and nobody can safely re-run, so
 * the whole plan lands or none of it does. The reference lists in
 * `reference.ts` are inside the same transaction for the same reason.
 *
 * ── Why it re-implements rather than calls the services ─────────────────────
 * `generateTimeSlots`, `generateSchoolWeeks` and the four `copy*` functions all
 * close over the module-level `db` and take no client, so calling them here
 * would issue statements on the outer connection while better-sqlite3 holds the
 * write lock. What could be shared has been: `layPeriodBlock` and
 * `planSchoolWeeks` are pure and are the same arithmetic the seed and the
 * timetable service use, and every derived key goes through its owning module's
 * helper rather than being spelled out again.
 *
 * ── Why every write is an upsert ────────────────────────────────────────────
 * The wizard is re-runnable on a school that is already half configured, which
 * is the case it is most wanted for. So it adds to what is there and never
 * removes anything: upsert on the table's own unique key, and leave out of the
 * `update` half anything a school may have decided for itself — `isActive`
 * everywhere, and a class's room and titulaire.
 */

export type SchoolColumns = {
  code: string;
  name: string;
  massarCode: string | null;
  level: string;
  directorName: string | null;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
  isActive: boolean;
};

export type TermPlan = {
  number: number;
  name: string;
  nameAr: string | null;
  startDate: Date;
  endDate: Date;
};

export type YearPlan = {
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  isDefault: boolean;
  terms: TermPlan[];
  holidays: { name: string; nameAr: string; kind: string; startDate: Date; endDate: Date }[];
};

export type CyclePlan = { cycle: string; name: string; nameAr: string; position: number };

export type LevelPlan = {
  cycle: string;
  code: string;
  name: string;
  nameAr: string | null;
  gradeYear: number;
  /** Null for anything a school typed in — the column is nullable-unique. */
  massarCode: string | null;
};

export type TrackPlan = {
  levelCode: string;
  code: string;
  name: string;
  nameAr: string | null;
  massarCode: string | null;
};

export type SubjectPlan = {
  code: string;
  name: string;
  nameAr: string | null;
  shortName: string | null;
  massarCode: string | null;
  parent: string | null;
  colorHex: string | null;
  isLanguage: boolean;
  requiresLab: boolean;
};

export type ProgrammePlan = {
  levelCode: string;
  trackCode: string | null;
  subjectCode: string;
  coefficient: number;
  weeklyMinutes: number | null;
};

export type RoomPlan = {
  code: string;
  name: string | null;
  kind: string;
  building: string | null;
  floor: number | null;
  capacity: number | null;
};

export type OfferingPlan = {
  levelCode: string;
  trackCode: string | null;
  classCount: number;
  capacity: number | null;
  classCodes: string[];
};

export type FeeTypePlan = {
  code: string;
  name: string;
  nameAr: string | null;
  kind: string;
  billingCycle: string;
  isMandatory: boolean;
};

export type FeeRatePlan = {
  feeCode: string;
  levelCode: string | null;
  amountCentimes: number;
};

export type DiscountPlan = {
  code: string;
  name: string;
  nameAr: string | null;
  kind: string;
  percentBps: number | null;
  amountCentimes: number | null;
  reason: string;
  feeCode: string | null;
  isStackable: boolean;
};

export type SetupPlan = {
  school: { mode: "new"; data: SchoolColumns } | { mode: "existing"; id: string };
  settings: Partial<SchoolSettingsValues>;
  year: YearPlan | null;
  cycles: CyclePlan[];
  levels: LevelPlan[];
  tracks: TrackPlan[];
  subjects: SubjectPlan[];
  programme: ProgrammePlan[];
  rooms: RoomPlan[];
  bell: BellPlan | null;
  offerings: OfferingPlan[];
  groupsPerClass: number;
  groupPurpose: string;
  feeTypes: FeeTypePlan[];
  feeRates: FeeRatePlan[];
  discounts: DiscountPlan[];
};

export type SetupCounts = {
  cycles: number;
  levels: number;
  tracks: number;
  subjects: number;
  programme: number;
  rooms: number;
  terms: number;
  slots: number;
  holidays: number;
  weeks: number;
  feeTypes: number;
  feeRates: number;
  discounts: number;
  offerings: number;
  classes: number;
  groups: number;
  /** The lists every school gets whatever it ticked — see `reference.ts`. */
  reference: ReferenceCounts;
};

export type SetupResult = {
  schoolId: string;
  schoolYearId: string | null;
  counts: SetupCounts;
};

const NO_COUNTS: SetupCounts = {
  cycles: 0, levels: 0, tracks: 0, subjects: 0, programme: 0, rooms: 0,
  terms: 0, slots: 0, holidays: 0, weeks: 0, feeTypes: 0, feeRates: 0,
  discounts: 0, offerings: 0, classes: 0, groups: 0,
  reference: NO_REFERENCE_COUNTS,
};

async function writeCursus(
  tx: TxClient,
  schoolId: string,
  plan: SetupPlan,
  counts: SetupCounts,
): Promise<{
  levelIdByCode: Record<string, string>;
  trackIdByCode: Record<string, string>;
  subjectIdByCode: Record<string, string>;
}> {
  const cycleIdByCode: Record<string, string> = {};
  for (const cycle of plan.cycles) {
    const row = await tx.educationLevel.upsert({
      where: { schoolId_cycle: { schoolId, cycle: cycle.cycle } },
      update: { name: cycle.name, nameAr: cycle.nameAr, position: cycle.position },
      create: { schoolId, ...cycle },
      select: { id: true },
    });
    cycleIdByCode[cycle.cycle] = row.id;
    counts.cycles += 1;
  }

  const levelIdByCode: Record<string, string> = {};
  for (const [index, level] of plan.levels.entries()) {
    const educationLevelId = cycleIdByCode[level.cycle];
    // A level whose cycle was not ticked has nowhere to hang.
    if (!educationLevelId) continue;

    const row = await tx.level.upsert({
      where: { schoolId_code: { schoolId, code: level.code } },
      update: {
        name: level.name,
        nameAr: level.nameAr,
        gradeYear: level.gradeYear,
        massarCode: level.massarCode,
        position: index,
      },
      create: {
        // Denormalised, and taken from the transaction rather than the form:
        // the invariant is that it equals the cycle's school.
        schoolId,
        educationLevelId,
        code: level.code,
        name: level.name,
        nameAr: level.nameAr,
        gradeYear: level.gradeYear,
        massarCode: level.massarCode,
        position: index,
      },
      select: { id: true },
    });
    levelIdByCode[level.code] = row.id;
    counts.levels += 1;
  }

  const trackIdByCode: Record<string, string> = {};
  for (const [index, track] of plan.tracks.entries()) {
    const levelId = levelIdByCode[track.levelCode];
    if (!levelId) continue;

    const row = await tx.track.upsert({
      where: { levelId_code: { levelId, code: track.code } },
      update: {
        name: track.name,
        nameAr: track.nameAr,
        massarCode: track.massarCode,
        position: index,
      },
      create: {
        levelId,
        code: track.code,
        name: track.name,
        nameAr: track.nameAr,
        massarCode: track.massarCode,
        position: index,
      },
      select: { id: true },
    });
    trackIdByCode[track.code] = row.id;
    counts.tracks += 1;
  }

  // Parents first, so a component always finds its parent id.
  const subjectIdByCode: Record<string, string> = {};
  const ordered = [
    ...plan.subjects.filter((subject) => !subject.parent),
    ...plan.subjects.filter((subject) => subject.parent),
  ];
  for (const subject of ordered) {
    const data = {
      name: subject.name,
      nameAr: subject.nameAr,
      shortName: subject.shortName,
      massarCode: subject.massarCode,
      parentId: subject.parent ? (subjectIdByCode[subject.parent] ?? null) : null,
      isLanguage: subject.isLanguage,
      requiresLab: subject.requiresLab,
      colorHex: subject.colorHex,
    };
    const row = await tx.subject.upsert({
      where: { schoolId_code: { schoolId, code: subject.code } },
      update: data,
      create: { schoolId, code: subject.code, ...data },
      select: { id: true },
    });
    subjectIdByCode[subject.code] = row.id;
    counts.subjects += 1;
  }

  for (const [index, entry] of plan.programme.entries()) {
    const levelId = levelIdByCode[entry.levelCode];
    const subjectId = subjectIdByCode[entry.subjectCode];
    if (!levelId || !subjectId) continue;
    const trackId = entry.trackCode ? (trackIdByCode[entry.trackCode] ?? null) : null;
    // A row naming a filière the school did not take is not this school's
    // programme — writing it against every track would be a different rule.
    if (entry.trackCode && !trackId) continue;

    const scopeKey = levelSubjectScopeKey(trackId);
    await tx.levelSubject.upsert({
      where: { levelId_subjectId_scopeKey: { levelId, subjectId, scopeKey } },
      update: {
        coefficient: entry.coefficient,
        weeklyMinutes: entry.weeklyMinutes,
        position: index,
      },
      create: {
        levelId,
        trackId,
        subjectId,
        scopeKey,
        coefficient: entry.coefficient,
        weeklyMinutes: entry.weeklyMinutes,
        position: index,
      },
    });
    counts.programme += 1;
  }

  return { levelIdByCode, trackIdByCode, subjectIdByCode };
}

export async function applySetup(
  organizationId: string,
  plan: SetupPlan,
): Promise<SetupResult | null> {
  return db.$transaction(
    async (tx) => {
      const counts: SetupCounts = { ...NO_COUNTS };

      // ── 1. The school ─────────────────────────────────────────────────────
      const school =
        plan.school.mode === "new"
          ? await tx.school.create({
              // organizationId comes from the session, never from the form.
              data: { ...plan.school.data, organizationId },
              // `city` for the quartiers — see the reference step below.
              select: { id: true, city: true },
            })
          : // Re-derived against the organisation even though the action already
            // authorized it, so a crafted id can only ever match zero rows.
            await tx.school.findFirst({
              where: { id: plan.school.id, organizationId },
              select: { id: true, city: true },
            });
      if (!school) return null;
      const schoolId = school.id;

      // ── 2. Its policies ───────────────────────────────────────────────────
      // `createSchoolAction` never wrote this row — only the seed did — and the
      // bell and fee steps both decide things that live in it, so the wizard is
      // the first thing in the app that has to create one.
      await tx.schoolSettings.upsert({
        where: { schoolId },
        update: plan.settings,
        create: { schoolId, ...plan.settings },
      });

      /*
        ── 2b. The lists it refers to ──────────────────────────────────────────
        Not a step and not ticked: towns, the dossier, the papers a family may
        ask for, the kinds of contrôle, the fournitures catalogue and the whole
        caisse — till, rubriques, sous-rubriques, motifs, fournisseurs and banks.
        A school cannot enter a pupil, ask for a paper, mark a contrôle or take a
        dirham without them, and none of it is a decision the school makes. See
        `reference.ts` for why this is unconditional and what it will not
        overwrite.
      */
      counts.reference = await writeReferenceData(tx, schoolId, school.city);

      // ── 3. The year and its terms ─────────────────────────────────────────
      let schoolYearId: string | null = null;
      if (plan.year) {
        if (plan.year.isDefault) {
          await tx.schoolYear.updateMany({
            where: { schoolId, isDefault: true, NOT: { name: plan.year.name } },
            data: { isDefault: false },
          });
        }

        const year = await tx.schoolYear.upsert({
          where: { schoolId_name: { schoolId, name: plan.year.name } },
          update: {
            startDate: plan.year.startDate,
            endDate: plan.year.endDate,
            status: plan.year.status,
            isDefault: plan.year.isDefault,
          },
          create: {
            schoolId,
            name: plan.year.name,
            startDate: plan.year.startDate,
            endDate: plan.year.endDate,
            status: plan.year.status,
            isDefault: plan.year.isDefault,
          },
          select: { id: true },
        });
        schoolYearId = year.id;

        const now = new Date();
        for (const [index, term] of plan.year.terms.entries()) {
          const status = termStatus(
            plan.year.status,
            { start: term.startDate, end: term.endDate },
            index === 0,
            now,
          );
          const data = {
            name: term.name,
            nameAr: term.nameAr,
            startDate: term.startDate,
            endDate: term.endDate,
            status,
          };
          await tx.term.upsert({
            where: { schoolYearId_number: { schoolYearId, number: term.number } },
            update: data,
            create: { schoolYearId, number: term.number, ...data },
          });
          counts.terms += 1;
        }
      }

      // ── 4–9. The cursus ───────────────────────────────────────────────────
      const { levelIdByCode, trackIdByCode } = await writeCursus(tx, schoolId, plan, counts);

      // ── 10. Rooms ─────────────────────────────────────────────────────────
      for (const room of plan.rooms) {
        await tx.room.upsert({
          where: { schoolId_code: { schoolId, code: room.code } },
          update: {
            name: room.name,
            kind: room.kind,
            building: room.building,
            floor: room.floor,
            capacity: room.capacity,
          },
          create: { schoolId, ...room },
        });
        counts.rooms += 1;
      }

      // ── 11. The fee catalogue ─────────────────────────────────────────────
      const feeTypeIdByCode: Record<string, string> = {};
      for (const [index, fee] of plan.feeTypes.entries()) {
        const row = await tx.feeType.upsert({
          where: { schoolId_code: { schoolId, code: fee.code } },
          update: {
            name: fee.name,
            nameAr: fee.nameAr,
            kind: fee.kind,
            billingCycle: fee.billingCycle,
            isMandatory: fee.isMandatory,
            position: index,
          },
          create: { schoolId, ...fee, position: index },
          select: { id: true },
        });
        feeTypeIdByCode[fee.code] = row.id;
        counts.feeTypes += 1;
      }

      // Everything past here is year-scoped and has nowhere to go without one.
      if (!schoolYearId || !plan.year) {
        return { schoolId, schoolYearId, counts };
      }

      // ── 12. The bell schedule ─────────────────────────────────────────────
      if (plan.bell) {
        for (const slot of slotsForBell(plan.bell)) {
          await tx.timeSlot.upsert({
            where: {
              schoolYearId_scheduleKind_dayOfWeek_startTime: {
                schoolYearId,
                scheduleKind: slot.scheduleKind,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
              },
            },
            update: {
              endTime: slot.endTime,
              session: slot.session,
              position: slot.position,
              isBreak: slot.isBreak ?? false,
            },
            create: {
              schoolYearId,
              dayOfWeek: slot.dayOfWeek,
              session: slot.session,
              startTime: slot.startTime,
              endTime: slot.endTime,
              scheduleKind: slot.scheduleKind,
              position: slot.position,
              isBreak: slot.isBreak ?? false,
            },
          });
          counts.slots += 1;
        }
      }

      // ── 13. Holidays, before the weeks that depend on them ────────────────
      for (const holiday of plan.year.holidays) {
        // No natural unique key — a school may legitimately declare two
        // closures with the same name — so idempotency is a find-then-write on
        // (year, name), exactly as `seedHolidays` does it.
        const existing = await tx.schoolHoliday.findFirst({
          where: { schoolYearId, name: holiday.name },
          select: { id: true },
        });
        const data = {
          nameAr: holiday.nameAr,
          kind: holiday.kind,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
        };
        if (existing) {
          await tx.schoolHoliday.update({ where: { id: existing.id }, data });
        } else {
          await tx.schoolHoliday.create({
            data: { schoolYearId, name: holiday.name, ...data },
          });
        }
        counts.holidays += 1;
      }

      // ── 14. The teaching weeks ────────────────────────────────────────────
      const holidays = await tx.schoolHoliday.findMany({
        where: { schoolYearId },
        select: { startDate: true, endDate: true },
      });
      for (const week of planSchoolWeeks({
        yearStart: plan.year.startDate,
        yearEnd: plan.year.endDate,
        holidays,
        firstParity: "A",
      })) {
        const data = {
          startsOn: week.startsOn,
          endsOn: week.endsOn,
          isTeaching: week.isTeaching,
          parity: week.parity,
        };
        await tx.schoolWeek.upsert({
          where: { schoolYearId_number: { schoolYearId, number: week.number } },
          update: data,
          create: { schoolYearId, number: week.number, ...data },
        });
        counts.weeks += 1;
      }

      // ── 15. The price list ────────────────────────────────────────────────
      for (const rate of plan.feeRates) {
        const feeTypeId = feeTypeIdByCode[rate.feeCode];
        if (!feeTypeId) continue;
        const levelId = rate.levelCode ? (levelIdByCode[rate.levelCode] ?? null) : null;
        // A level-specific price for a level this school does not run is skipped.
        if (rate.levelCode && !levelId) continue;

        const scopeKey = feeRateScopeKey(levelId);
        await tx.feeRate.upsert({
          where: { schoolYearId_feeTypeId_scopeKey: { schoolYearId, feeTypeId, scopeKey } },
          update: { amountCentimes: rate.amountCentimes },
          create: {
            schoolYearId,
            feeTypeId,
            levelId,
            scopeKey,
            amountCentimes: rate.amountCentimes,
          },
        });
        counts.feeRates += 1;
      }

      // ── 16. The réductions ────────────────────────────────────────────────
      for (const discount of plan.discounts) {
        const feeTypeId = discount.feeCode
          ? (feeTypeIdByCode[discount.feeCode] ?? null)
          : null;
        if (discount.feeCode && !feeTypeId) continue;

        const data = {
          name: discount.name,
          nameAr: discount.nameAr,
          kind: discount.kind,
          percentBps: discount.percentBps,
          amountCentimes: discount.amountCentimes,
          reason: discount.reason,
          feeTypeId,
          isStackable: discount.isStackable,
        };
        await tx.discount.upsert({
          where: { schoolYearId_code: { schoolYearId, code: discount.code } },
          update: data,
          create: { schoolYearId, code: discount.code, ...data },
        });
        counts.discounts += 1;
      }

      // ── 17–19. What the year actually opens ───────────────────────────────
      for (const offering of plan.offerings) {
        const levelId = levelIdByCode[offering.levelCode];
        if (!levelId) continue;
        const trackId = offering.trackCode
          ? (trackIdByCode[offering.trackCode] ?? null)
          : null;
        if (offering.trackCode && !trackId) continue;

        const scopeKey = offeringScopeKey(trackId);
        const row = await tx.levelOffering.upsert({
          where: { schoolYearId_levelId_scopeKey: { schoolYearId, levelId, scopeKey } },
          update: { plannedCapacity: offering.capacity },
          create: {
            schoolYearId,
            levelId,
            trackId,
            scopeKey,
            plannedCapacity: offering.capacity,
          },
          select: { id: true },
        });
        counts.offerings += 1;

        for (const code of offering.classCodes) {
          const schoolClass = await tx.schoolClass.upsert({
            where: { levelOfferingId_code: { levelOfferingId: row.id, code } },
            // Never the room or the titulaire: a class somebody has already
            // staffed and seated keeps both when the wizard is run again.
            update: { capacity: offering.capacity },
            create: {
              levelOfferingId: row.id,
              // Denormalised, and from the transaction rather than the form.
              schoolId,
              code,
              capacity: offering.capacity,
            },
            select: { id: true },
          });
          counts.classes += 1;

          for (let index = 1; index <= plan.groupsPerClass; index += 1) {
            await tx.classGroup.upsert({
              where: {
                schoolClassId_code: { schoolClassId: schoolClass.id, code: `G${index}` },
              },
              update: { purpose: plan.groupPurpose },
              create: {
                schoolClassId: schoolClass.id,
                code: `G${index}`,
                purpose: plan.groupPurpose,
              },
            });
            counts.groups += 1;
          }
        }
      }

      return { schoolId, schoolYearId, counts };
    },
    // A full cursus with classes and a fee grid is several hundred upserts. The
    // default five-second budget is not enough for the largest school.
    { timeout: 60_000, maxWait: 15_000 },
  );
}
