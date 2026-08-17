import "server-only";

import { recordEvent } from "@/lib/audit";
import { auditClient } from "@/lib/db";
import type { SchoolSettingsValues } from "@/lib/school-settings";
import { levelSubjectScopeKey } from "@/modules/academics/enums";
import { slotsForBell, type BellPlan } from "@/modules/setup/bell";
import { idFor, upsertMany, type IdsByKey } from "@/modules/setup/bulk";
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
 * would issue their statements on a second connection from the pool — outside
 * this transaction, and therefore not rolled back with it.
 * What could be shared has been: `layPeriodBlock` and
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
 *
 * ── Why the upserts are batched ─────────────────────────────────────────────
 * Those are the semantics; `upsertMany` in `bulk.ts` is how they are issued.
 * One statement per row is what expired this transaction twice over against a
 * managed database — the round trips, not the work — so each table is now read
 * once, created once, and updated only where the plan actually differs from
 * what is stored.
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
): Promise<{ levelIds: IdsByKey; trackIds: IdsByKey }> {
  const cycleIds = await upsertMany(tx.educationLevel, {
    where: { schoolId },
    key: ["cycle"],
    update: ["name", "nameAr", "position"],
    withIds: true,
    rows: plan.cycles.map((cycle) => ({ schoolId, ...cycle })),
  });
  counts.cycles = plan.cycles.length;

  const levelRows = plan.levels.flatMap((level, index) => {
    const educationLevelId = idFor(cycleIds, level.cycle);
    // A level whose cycle was not ticked has nowhere to hang.
    if (!educationLevelId) return [];
    return [
      {
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
    ];
  });
  const levelIds = await upsertMany(tx.level, {
    where: { schoolId },
    key: ["code"],
    update: ["name", "nameAr", "gradeYear", "massarCode", "position"],
    withIds: true,
    rows: levelRows,
  });
  counts.levels = levelRows.length;

  // Keyed on the track's code alone, as the plan refers to it — the read is
  // scoped through the level, since `Track` carries no `schoolId` of its own.
  const trackRows = plan.tracks.flatMap((track, index) => {
    const levelId = idFor(levelIds, track.levelCode);
    if (!levelId) return [];
    return [
      {
        levelId,
        code: track.code,
        name: track.name,
        nameAr: track.nameAr,
        massarCode: track.massarCode,
        position: index,
      },
    ];
  });
  const trackIdsByLevel = await upsertMany(tx.track, {
    where: { level: { schoolId } },
    key: ["levelId", "code"],
    update: ["name", "nameAr", "massarCode", "position"],
    withIds: true,
    rows: trackRows,
  });
  counts.tracks = trackRows.length;

  // The plan names a filière by its code alone, so flatten the composite key
  // back to what the programme and the offerings actually refer to.
  const trackIds: IdsByKey = new Map();
  for (const track of trackRows) {
    const id = idFor(trackIdsByLevel, track.levelId, track.code);
    if (id) trackIds.set(track.code, id);
  }

  // Parents in the first pass, so a component always finds its parent id.
  const subjectRow = (subject: SubjectPlan, parentId: string | null): Record<string, unknown> => ({
    schoolId,
    code: subject.code,
    name: subject.name,
    nameAr: subject.nameAr,
    shortName: subject.shortName,
    massarCode: subject.massarCode,
    parentId,
    isLanguage: subject.isLanguage,
    requiresLab: subject.requiresLab,
    colorHex: subject.colorHex,
  });
  const subjectColumns = [
    "name",
    "nameAr",
    "shortName",
    "massarCode",
    "parentId",
    "isLanguage",
    "requiresLab",
    "colorHex",
  ] as const;

  const parents = plan.subjects.filter((subject) => !subject.parent);
  const subjectIds = await upsertMany(tx.subject, {
    where: { schoolId },
    key: ["code"],
    update: subjectColumns,
    withIds: true,
    rows: parents.map((subject) => subjectRow(subject, null)),
  });

  const components = plan.subjects.filter((subject) => subject.parent);
  const componentIds = await upsertMany(tx.subject, {
    where: { schoolId },
    key: ["code"],
    update: subjectColumns,
    withIds: true,
    rows: components.map((subject) =>
      subjectRow(subject, subject.parent ? (idFor(subjectIds, subject.parent) ?? null) : null),
    ),
  });
  for (const [code, id] of componentIds) subjectIds.set(code, id);
  counts.subjects = plan.subjects.length;

  const programmeRows = plan.programme.flatMap((entry, index) => {
    const levelId = idFor(levelIds, entry.levelCode);
    const subjectId = idFor(subjectIds, entry.subjectCode);
    if (!levelId || !subjectId) return [];
    const trackId = entry.trackCode ? (idFor(trackIds, entry.trackCode) ?? null) : null;
    // A row naming a filière the school did not take is not this school's
    // programme — writing it against every track would be a different rule.
    if (entry.trackCode && !trackId) return [];

    return [
      {
        levelId,
        trackId,
        subjectId,
        scopeKey: levelSubjectScopeKey(trackId),
        coefficient: entry.coefficient,
        weeklyMinutes: entry.weeklyMinutes,
        position: index,
      },
    ];
  });
  await upsertMany(tx.levelSubject, {
    where: { level: { schoolId } },
    key: ["levelId", "subjectId", "scopeKey"],
    update: ["coefficient", "weeklyMinutes", "position"],
    rows: programmeRows,
  });
  counts.programme = programmeRows.length;

  return { levelIds, trackIds };
}

export async function applySetup(
  organizationId: string,
  plan: SetupPlan,
): Promise<SetupResult | null> {
  const result = await writeSetup(organizationId, plan);

  /*
    One entry for one act, because the transaction above ran unaudited.

    The wizard is a single decision — "configure this school" — that happens to
    touch a thousand rows, and the trail records the decision. Written after the
    commit rather than inside it: an entry about a setup that rolled back would
    be a line about rows that do not exist, and the trail is deliberately not
    part of the transaction it describes (see `auditClient`).
  */
  if (result) {
    await recordEvent({
      action: plan.school.mode === "new" ? "CREATE" : "UPDATE",
      entity: "School",
      entityId: result.schoolId,
      entityLabel: plan.school.mode === "new" ? plan.school.data.name : null,
      metadata: { setupWizard: true, ...result.counts },
    });
  }

  return result;
}

async function writeSetup(
  organizationId: string,
  plan: SetupPlan,
): Promise<SetupResult | null> {
  /*
    Deliberately the client *without* the audit extension — see `auditClient`.

    Through the extended one, every one of these upserts also issues a "before"
    read and an `activity_logs` insert that commits on its own connection, and a
    thousand of those do not finish inside any transaction budget worth setting:
    this write used to expire at 60 s, then at 120 s, always at whichever
    statement happened to be in flight. The entry the trail actually wants is
    written once, by the caller above.
  */
  return auditClient.$transaction(
    async (transaction) => {
      /*
        `TxClient` is the *extended* client's transaction type, and a dozen
        services take it. The extension wraps behaviour around the delegates
        rather than changing their shape, so the two are the same object at
        runtime and this bridges the declaration — narrowing `TxClient` to the
        base client instead would touch every service that takes one.
      */
      const tx = transaction as unknown as TxClient;
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
        const yearStatus = plan.year.status;
        await upsertMany(tx.term, {
          where: { schoolYearId },
          key: ["number"],
          update: ["name", "nameAr", "startDate", "endDate", "status"],
          rows: plan.year.terms.map((term, index) => ({
            schoolYearId,
            number: term.number,
            name: term.name,
            nameAr: term.nameAr,
            startDate: term.startDate,
            endDate: term.endDate,
            status: termStatus(
              yearStatus,
              { start: term.startDate, end: term.endDate },
              index === 0,
              now,
            ),
          })),
        });
        counts.terms = plan.year.terms.length;
      }

      // ── 4–9. The cursus ───────────────────────────────────────────────────
      const { levelIds, trackIds } = await writeCursus(tx, schoolId, plan, counts);

      // ── 10. Rooms ─────────────────────────────────────────────────────────
      await upsertMany(tx.room, {
        where: { schoolId },
        key: ["code"],
        update: ["name", "kind", "building", "floor", "capacity"],
        rows: plan.rooms.map((room) => ({ schoolId, ...room })),
      });
      counts.rooms = plan.rooms.length;

      // ── 11. The fee catalogue ─────────────────────────────────────────────
      const feeTypeIds = await upsertMany(tx.feeType, {
        where: { schoolId },
        key: ["code"],
        update: ["name", "nameAr", "kind", "billingCycle", "isMandatory", "position"],
        withIds: true,
        rows: plan.feeTypes.map((fee, index) => ({ schoolId, ...fee, position: index })),
      });
      counts.feeTypes = plan.feeTypes.length;

      // Everything past here is year-scoped and has nowhere to go without one.
      if (!schoolYearId || !plan.year) {
        return { schoolId, schoolYearId, counts };
      }

      // ── 12. The bell schedule ─────────────────────────────────────────────
      if (plan.bell) {
        const slots = slotsForBell(plan.bell);
        await upsertMany(tx.timeSlot, {
          where: { schoolYearId },
          key: ["scheduleKind", "dayOfWeek", "startTime"],
          update: ["endTime", "session", "position", "isBreak"],
          rows: slots.map((slot) => ({
            schoolYearId,
            dayOfWeek: slot.dayOfWeek,
            session: slot.session,
            startTime: slot.startTime,
            endTime: slot.endTime,
            scheduleKind: slot.scheduleKind,
            position: slot.position,
            isBreak: slot.isBreak ?? false,
          })),
        });
        counts.slots = slots.length;
      }

      // ── 13. Holidays, before the weeks that depend on them ────────────────
      // No natural unique key — a school may legitimately declare two closures
      // with the same name — so idempotency is a match on (year, name), exactly
      // as `seedHolidays` does it.
      await upsertMany(tx.schoolHoliday, {
        where: { schoolYearId },
        key: ["name"],
        update: ["nameAr", "kind", "startDate", "endDate"],
        rows: plan.year.holidays.map((holiday) => ({
          schoolYearId,
          name: holiday.name,
          nameAr: holiday.nameAr,
          kind: holiday.kind,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
        })),
      });
      counts.holidays = plan.year.holidays.length;

      // ── 14. The teaching weeks ────────────────────────────────────────────
      const holidays = await tx.schoolHoliday.findMany({
        where: { schoolYearId },
        select: { startDate: true, endDate: true },
      });
      const weeks = planSchoolWeeks({
        yearStart: plan.year.startDate,
        yearEnd: plan.year.endDate,
        holidays,
        firstParity: "A",
      });
      await upsertMany(tx.schoolWeek, {
        where: { schoolYearId },
        key: ["number"],
        update: ["startsOn", "endsOn", "isTeaching", "parity"],
        rows: weeks.map((week) => ({
          schoolYearId,
          number: week.number,
          startsOn: week.startsOn,
          endsOn: week.endsOn,
          isTeaching: week.isTeaching,
          parity: week.parity,
        })),
      });
      counts.weeks = weeks.length;

      // ── 15. The price list ────────────────────────────────────────────────
      const rateRows = plan.feeRates.flatMap((rate) => {
        const feeTypeId = idFor(feeTypeIds, rate.feeCode);
        if (!feeTypeId) return [];
        const levelId = rate.levelCode ? (idFor(levelIds, rate.levelCode) ?? null) : null;
        // A level-specific price for a level this school does not run is skipped.
        if (rate.levelCode && !levelId) return [];

        return [
          {
            schoolYearId,
            feeTypeId,
            levelId,
            scopeKey: feeRateScopeKey(levelId),
            amountCentimes: rate.amountCentimes,
          },
        ];
      });
      await upsertMany(tx.feeRate, {
        where: { schoolYearId },
        key: ["feeTypeId", "scopeKey"],
        update: ["amountCentimes"],
        rows: rateRows,
      });
      counts.feeRates = rateRows.length;

      // ── 16. The réductions ────────────────────────────────────────────────
      const discountRows = plan.discounts.flatMap((discount) => {
        const feeTypeId = discount.feeCode ? (idFor(feeTypeIds, discount.feeCode) ?? null) : null;
        if (discount.feeCode && !feeTypeId) return [];

        return [
          {
            schoolYearId,
            code: discount.code,
            name: discount.name,
            nameAr: discount.nameAr,
            kind: discount.kind,
            percentBps: discount.percentBps,
            amountCentimes: discount.amountCentimes,
            reason: discount.reason,
            feeTypeId,
            isStackable: discount.isStackable,
          },
        ];
      });
      await upsertMany(tx.discount, {
        where: { schoolYearId },
        key: ["code"],
        update: [
          "name",
          "nameAr",
          "kind",
          "percentBps",
          "amountCentimes",
          "reason",
          "feeTypeId",
          "isStackable",
        ],
        rows: discountRows,
      });
      counts.discounts = discountRows.length;

      // ── 17–19. What the year actually opens ───────────────────────────────
      const offerings = plan.offerings.flatMap((offering) => {
        const levelId = idFor(levelIds, offering.levelCode);
        if (!levelId) return [];
        const trackId = offering.trackCode ? (idFor(trackIds, offering.trackCode) ?? null) : null;
        if (offering.trackCode && !trackId) return [];

        return [{ offering, levelId, trackId, scopeKey: offeringScopeKey(trackId) }];
      });
      const offeringIds = await upsertMany(tx.levelOffering, {
        where: { schoolYearId },
        key: ["levelId", "scopeKey"],
        update: ["plannedCapacity"],
        withIds: true,
        rows: offerings.map(({ offering, levelId, trackId, scopeKey }) => ({
          schoolYearId,
          levelId,
          trackId,
          scopeKey,
          plannedCapacity: offering.capacity,
        })),
      });
      counts.offerings = offerings.length;

      const classRows = offerings.flatMap(({ offering, levelId, scopeKey }) => {
        const levelOfferingId = idFor(offeringIds, levelId, scopeKey);
        if (!levelOfferingId) return [];
        return offering.classCodes.map((code) => ({
          levelOfferingId,
          // Denormalised, and from the transaction rather than the form.
          schoolId,
          code,
          capacity: offering.capacity,
        }));
      });
      const classIds = await upsertMany(tx.schoolClass, {
        where: { schoolId, levelOffering: { schoolYearId } },
        key: ["levelOfferingId", "code"],
        // Never the room or the titulaire: a class somebody has already staffed
        // and seated keeps both when the wizard is run again.
        update: ["capacity"],
        withIds: true,
        rows: classRows,
      });
      counts.classes = classRows.length;

      const groupRows = classRows.flatMap((schoolClass) => {
        const schoolClassId = idFor(classIds, schoolClass.levelOfferingId, schoolClass.code);
        if (!schoolClassId) return [];
        return Array.from({ length: plan.groupsPerClass }, (_, index) => ({
          schoolClassId,
          code: `G${index + 1}`,
          purpose: plan.groupPurpose,
        }));
      });
      await upsertMany(tx.classGroup, {
        where: { schoolClass: { schoolId } },
        key: ["schoolClassId", "code"],
        update: ["purpose"],
        rows: groupRows,
      });
      counts.groups = groupRows.length;

      return { schoolId, schoolYearId, counts };
    },
    /*
      Raising this is what did *not* fix the timeout, twice: the default five
      seconds, then sixty, then a hundred and twenty, each expiring at whichever
      statement happened to be in flight — which is why the error named an
      innocent table (`tx.supplier.upsert`) rather than the slow part. The cost
      was never the work, it was a round trip per statement to a managed
      database and two statements per row. `upsertMany` writes the same rows in
      a fixed handful of statements per table, and the largest school now lands
      well inside this.

      Kept at two minutes rather than lowered to fit the new figure: a school
      whose lists a director has grown by hand still has more to read back, and
      the ceiling is only there so a transaction that hangs gives up rather than
      holding its locks until the process is killed.
    */
    { timeout: 120_000, maxWait: 30_000 },
  );
}
