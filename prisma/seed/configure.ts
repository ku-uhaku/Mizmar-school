import { seedAcademics } from "@/modules/academics/seed";
import { MOROCCAN_CURSUS } from "@/modules/academics/presets";
import {
  seedAppreciationBands,
  seedAssessmentTypes,
} from "@/modules/assessments/seed";
import { seedFeeRatesAndDiscounts, seedFeeTypes } from "@/modules/billing/seed";
import { FEE_RATES, FEE_TYPES } from "@/modules/billing/presets";
import { seedDocumentTypes } from "@/modules/documents/seed";
import { seedRequestTypes } from "@/modules/requests/seed";
import { seedRooms } from "@/modules/facilities/seed";
import { SCHOOL_ROOMS } from "@/modules/facilities/presets";
import {
  cityCodeByName,
  seedCities,
  seedNeighbourhoods,
} from "@/modules/geography/seed";
import { seedSupplyArticles } from "@/modules/supplies/seed";
import { PRESET_TEACHING_DAYS_SETTING } from "@/modules/timetable/presets";
import {
  seedHolidays,
  seedSchoolWeeks,
  seedTimeSlots,
  type SeededSlot,
} from "@/modules/timetable/seed";
import { seedTreasury } from "@/modules/treasury/seed";
import type { SeedDb } from "@/prisma/seed/client";

/**
 * Everything a school has to declare before it can enrol anybody — and not one
 * row of anybody.
 *
 * ── Why this is shared and not copied ────────────────────────────────────────
 * Both orchestrators need exactly this, and only this, in common:
 * `prisma/seed-config.ts` is nothing but this step, and `prisma/seed.ts` runs it
 * for every school and then populates the ones that have a `SchoolPlan`. Written
 * out twice, the two drifted the moment a module was added — a fee catalogue in
 * one and not the other is a demo school that cannot be billed, which is
 * precisely the failure a configuration seed exists to rule out.
 *
 * It composes other modules' seeds rather than owning any table, so it lives
 * here with the orchestration rather than under `modules/`. The line it draws is
 * the same one `seed-config.ts` documents: configuration is what the school
 * decides *about itself*. People, and anything hanging off a person, are the
 * school's work rather than its settings.
 *
 * ── Order that matters ───────────────────────────────────────────────────────
 * Two things, and the rest is free. `seedTreasury` reads who holds
 * `treasury.collect` at this school to give each cashier their own till, so it
 * has to run after the staff exists — both callers seed users before the school
 * loop, which is what makes that true. And within a year, the holidays are laid
 * before the weeks, because which weeks are taught depends on them.
 */

export type ConfiguredSchool = {
  levelIdByCode: Record<string, string>;
  trackIdByCode: Record<string, string>;
  subjectIdByCode: Record<string, string>;
  roomIdByCode: Record<string, string>;
  cityIdByCode: Record<string, string>;
  neighbourhoodIdByCode: Record<string, string>;
  feeTypeIdByCode: Record<string, string>;
  assessmentTypeIdByCode: Map<string, string>;
  /** School year id → its bell schedule, standard and Ramadan grids alike. */
  slotsByYear: Record<string, SeededSlot[]>;
};

export async function configureSchool(
  db: SeedDb,
  {
    school,
    years,
    cityCode,
  }: {
    school: { id: string; city: string | null };
    years: { id: string; name: string; startDate: Date; endDate: Date }[];
    /**
     * Whose quartiers to lay down. Defaults to the school's own town, which is
     * the only address a school actually records — see `seedNeighbourhoods`.
     */
    cityCode?: string;
  },
): Promise<ConfiguredSchool> {
  // The cursus, and the rooms it is taught in.
  const { levelIdByCode, trackIdByCode, subjectIdByCode } = await seedAcademics(
    db,
    school.id,
    MOROCCAN_CURSUS,
  );
  const roomIdByCode = await seedRooms(db, school.id, SCHOOL_ROOMS);

  // Towns and quartiers: a birthplace and an address are references here, so
  // they have to exist before the first dossier is opened.
  const cityIdByCode = await seedCities(db, school.id);
  const neighbourhoodIdByCode = await seedNeighbourhoods(
    db,
    school.id,
    cityIdByCode,
    cityCode ?? cityCodeByName(school.city),
  );

  // What the school may charge. How much is a fact of each year — see below.
  const feeTypeIdByCode = await seedFeeTypes(db, school.id, FEE_TYPES);

  // The tills, the banks and the expense rubriques. Year-independent like the
  // fee catalogue above: how much is collected is a fact of each year, but where
  // it is collected is a fact of the school.
  await seedTreasury(db, school.id);

  // The school's own policies: what a contrôle weighs, what a family may be
  // asked to buy, what a dossier d'inscription must contain. All year-
  // independent for the same reason — they are the school's, not any rentrée's.
  const assessmentTypeIdByCode = await seedAssessmentTypes(db, school.id);
  // The wording beside a mark. Written only into a school that has none — see
  // the note on seedAppreciationBands.
  await seedAppreciationBands(db, school.id);
  await seedSupplyArticles(db, school.id);
  await seedDocumentTypes(db, school.id);
  // What families may ask the school to issue — the other direction from the
  // dossier above. See modules/requests.
  await seedRequestTypes(db, school.id);

  /*
    The week the school declares, made to agree with the bell schedule laid
    below it.

    Two separate facts that have to say the same thing: `standardSlots` lays
    periods Monday to Friday, and every grid in the app draws its columns from
    `teachingDaysOf(settings)`, which falls back to Monday–Saturday. Left alone,
    a seeded school showed a Saturday column with no periods in it on every
    timetable, register and emploi du temps — closed, but there.

    Written from the preset rather than typed out, so the two cannot drift, and
    written on every run rather than on create only: changing the demonstration's
    week is exactly the reason somebody edits `PRESET_TEACHING_DAYS`, and a
    settings row seeded by an earlier version would otherwise keep its Saturday
    for ever. Nothing else in the row is touched — see `seedSchools`.
  */
  await db.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: { teachingDays: PRESET_TEACHING_DAYS_SETTING },
    create: {
      schoolId: school.id,
      teachingDays: PRESET_TEACHING_DAYS_SETTING,
    },
  });

  const slotsByYear: Record<string, SeededSlot[]> = {};

  for (const year of years) {
    slotsByYear[year.id] = await seedTimeSlots(db, year.id);

    await seedHolidays(db, year.id, year.startDate, year.endDate);
    await seedSchoolWeeks(db, year.id, year.startDate, year.endDate);

    // The price list and the reductions offered — the year's half of billing,
    // against the catalogue declared above it.
    await seedFeeRatesAndDiscounts(db, {
      schoolYearId: year.id,
      rates: FEE_RATES,
      feeTypeIdByCode,
      levelIdByCode,
    });
  }

  return {
    levelIdByCode,
    trackIdByCode,
    subjectIdByCode,
    roomIdByCode,
    cityIdByCode,
    neighbourhoodIdByCode,
    feeTypeIdByCode,
    assessmentTypeIdByCode,
    slotsByYear,
  };
}
