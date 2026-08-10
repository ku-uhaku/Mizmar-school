"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { failure, type ActionState } from "@/lib/action-state";
import { authorizeOrg, authorizeSchool, type AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { formValues } from "@/lib/form-values";
import { interpolate } from "@/lib/i18n/format";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/types";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, listField, withActionErrors } from "@/lib/server-action";
import { fieldErrors, prefixErrors } from "@/lib/validation";
import { MAD } from "@/modules/billing/presets";
import { schoolYearSchema } from "@/modules/school-years/validation";
import { schoolSchema } from "@/modules/schools/validation";
import { HOLIDAYS } from "@/modules/timetable/presets";
import {
  classCodesFor,
  cycleEntry,
  levelByCode,
  subjectByCode,
  trackByCode,
  SETUP_CYCLES,
} from "@/modules/setup/catalogue";
import type { BellPlan } from "@/modules/setup/bell";
import {
  applySetup,
  type CyclePlan,
  type DiscountPlan,
  type FeeRatePlan,
  type FeeTypePlan,
  type LevelPlan,
  type OfferingPlan,
  type ProgrammePlan,
  type RoomPlan,
  type SetupPlan,
  type SubjectPlan,
  type TermPlan,
  type TrackPlan,
} from "@/modules/setup/service";
import {
  bellScheduleSchema,
  classGroupsSchema,
  discountRowSchema,
  feeRateRowSchema,
  feeTypeRowSchema,
  offeringRowSchema,
  programmeRowSchema,
  roomRowSchema,
  setupCustomLevelSchema,
  setupSettingsSchema,
  setupTermSchema,
} from "@/modules/setup/validation";

/**
 * The setup wizard's single submit.
 *
 * ── Why the arrays are read before anything is authorized ───────────────────
 * Which permissions apply depends on what the plan actually writes: a wizard
 * run that skipped every configuration step is a `school.create` and nothing
 * more, and demanding `configuration.manage` for it would refuse a request that
 * touches no configuration. So the form is parsed first and the checks are
 * derived from the result — the same shape `enrolNewStudentAction` uses when it
 * only asks for `family.create` if a family is being created.
 *
 * ── Why the codes are never trusted ─────────────────────────────────────────
 * Every level, filière, subject, rubrique and réduction the form posts is a
 * *code*, resolved back through `modules/setup/catalogue.ts` for its name, its
 * Arabic name, its MASSAR code and its flags. A code the catalogue does not
 * know is dropped rather than refused — a stale form is not an attack — and the
 * only free text that reaches the database is the identity step and the rows a
 * school explicitly typed in, which are forced to `massarCode: null`.
 */

/** A row table whose parallel arrays did not all arrive the same length. */
const RAGGED = Symbol("ragged");
type Ragged = typeof RAGGED;

/**
 * Zips a row table's parallel arrays by index.
 *
 * Ragged arrays are refused rather than truncated: one row failing to emit one
 * of its columns would shift every later value onto the wrong row — a school
 * that looks configured and grades wrongly. The mark sheet and the liste de
 * fournitures refuse the same way and for the same reason.
 */
function zipRows(
  formData: FormData,
  names: readonly string[],
): Record<string, string>[] | Ragged {
  const columns = names.map((name) => listField(formData, name));
  const length = columns[0]?.length ?? 0;
  if (columns.some((column) => column.length !== length)) return RAGGED;

  return Array.from({ length }, (_, index) =>
    Object.fromEntries(names.map((name, column) => [name, columns[column][index]])),
  );
}

function rowError(
  t: Dictionary,
  step: string,
  index: number,
  label: string,
  reason: string,
): ActionState["fieldErrors"] {
  return {
    [step]: interpolate(t.setup.rowInvalid, { row: index + 1, label, reason }),
  };
}

const misaligned = (t: Dictionary, step: string) => ({ [step]: t.setup.rowsMisaligned });

// ── Readers ──────────────────────────────────────────────────────────────────

function readSchoolForm(formData: FormData) {
  return {
    code: field(formData, "code").toUpperCase(),
    name: field(formData, "name"),
    massarCode: field(formData, "massarCode"),
    level: field(formData, "level"),
    directorName: field(formData, "directorName"),
    capacity: field(formData, "capacity"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    website: field(formData, "website"),
    logoUrl: field(formData, "logoUrl"),
    addressLine: field(formData, "addressLine"),
    city: field(formData, "city"),
    region: field(formData, "region"),
    postalCode: field(formData, "postalCode"),
    country: field(formData, "country").toUpperCase() || "MA",
    isActive: boolField(formData, "isActive"),
  };
}

export async function runSetupAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const values = formValues(formData);
    const invalid = (errors: ActionState["fieldErrors"]) =>
      failure(t.errors.invalid, errors, values);

    const mode = field(formData, "mode") === "existing" ? "existing" : "new";

    // ── The cursus the school ticked ─────────────────────────────────────────
    const cycleCodes = listField(formData, "cycle").filter((code) =>
      (SETUP_CYCLES as string[]).includes(code),
    );
    const cycles: CyclePlan[] = cycleCodes.map((code) => {
      const entry = cycleEntry(code as (typeof SETUP_CYCLES)[number]);
      return {
        cycle: entry.cycle,
        name: entry.name,
        nameAr: entry.nameAr,
        position: entry.position,
      };
    });

    const levels: LevelPlan[] = [];
    for (const code of listField(formData, "levelCode")) {
      const preset = levelByCode(code);
      if (!preset || !cycleCodes.includes(preset.cycle)) continue;
      levels.push({
        cycle: preset.cycle,
        code: preset.code,
        name: preset.name,
        nameAr: preset.nameAr,
        gradeYear: preset.gradeYear,
        massarCode: preset.massarCode,
      });
    }

    const customLevelRows = zipRows(formData, [
      "customLevelCycle",
      "customLevelCode",
      "customLevelName",
      "customLevelNameAr",
      "customLevelGradeYear",
    ]);
    if (customLevelRows === RAGGED) return invalid(misaligned(t, "levels"));
    for (const [index, row] of customLevelRows.entries()) {
      if (!row.customLevelCode && !row.customLevelName) continue;
      const parsed = setupCustomLevelSchema(t).safeParse({
        cycle: row.customLevelCycle,
        code: row.customLevelCode.toUpperCase(),
        name: row.customLevelName,
        nameAr: row.customLevelNameAr,
        gradeYear: row.customLevelGradeYear,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "levels", index, row.customLevelCode, first));
      }
      if (!cycleCodes.includes(parsed.data.cycle)) continue;
      levels.push({
        cycle: parsed.data.cycle,
        code: parsed.data.code,
        name: parsed.data.name,
        nameAr: parsed.data.nameAr,
        gradeYear: parsed.data.gradeYear,
        // Nullable-unique on (school, massarCode): a hand-typed code is exactly
        // how two levels collide, so a level the school invented has none.
        massarCode: null,
      });
    }

    const levelCodes = levels.map((level) => level.code);

    const tracks: TrackPlan[] = [];
    for (const code of listField(formData, "trackCode")) {
      const preset = trackByCode(code);
      if (!preset || !levelCodes.includes(preset.levelCode)) continue;
      tracks.push({
        levelCode: preset.levelCode,
        code: preset.code,
        name: preset.name,
        nameAr: preset.nameAr,
        massarCode: preset.massarCode,
      });
    }
    const trackCodes = tracks.map((track) => track.code);

    const subjects: SubjectPlan[] = [];
    for (const code of listField(formData, "subjectCode")) {
      const preset = subjectByCode(code);
      if (!preset) continue;
      subjects.push({
        code: preset.code,
        name: preset.name,
        nameAr: preset.nameAr,
        shortName: preset.shortName ?? null,
        massarCode: preset.massarCode ?? null,
        parent: preset.parent ?? null,
        colorHex: preset.colorHex ?? null,
        isLanguage: preset.isLanguage ?? false,
        requiresLab: preset.requiresLab ?? false,
      });
    }
    const subjectCodes = subjects.map((subject) => subject.code);

    // ── The programme ────────────────────────────────────────────────────────
    const programmeRows = zipRows(formData, [
      "progLevelCode",
      "progTrackCode",
      "progSubjectCode",
      "progCoefficient",
      "progWeeklyMinutes",
      "progIncluded",
    ]);
    if (programmeRows === RAGGED) return invalid(misaligned(t, "programme"));

    const programme: ProgrammePlan[] = [];
    for (const [index, row] of programmeRows.entries()) {
      if (row.progIncluded !== "1") continue;
      const parsed = programmeRowSchema(t).safeParse({
        levelCode: row.progLevelCode,
        trackCode: row.progTrackCode,
        subjectCode: row.progSubjectCode,
        coefficient: row.progCoefficient,
        weeklyMinutes: row.progWeeklyMinutes,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        const label = `${row.progLevelCode} — ${row.progSubjectCode}`;
        return invalid(rowError(t, "programme", index, label, first));
      }
      if (!levelCodes.includes(parsed.data.levelCode)) continue;
      if (!subjectCodes.includes(parsed.data.subjectCode)) continue;
      const trackCode = parsed.data.trackCode;
      if (trackCode && !trackCodes.includes(trackCode)) continue;

      programme.push({
        levelCode: parsed.data.levelCode,
        trackCode: trackCode || null,
        subjectCode: parsed.data.subjectCode,
        coefficient: parsed.data.coefficient,
        weeklyMinutes: parsed.data.weeklyMinutes,
      });
    }

    // ── Rooms ────────────────────────────────────────────────────────────────
    const roomRows = zipRows(formData, [
      "roomCode",
      "roomName",
      "roomKind",
      "roomBuilding",
      "roomFloor",
      "roomCapacity",
    ]);
    if (roomRows === RAGGED) return invalid(misaligned(t, "rooms"));

    const rooms: RoomPlan[] = [];
    for (const [index, row] of roomRows.entries()) {
      // A blank row is a slot the user cleared, not an error.
      if (!row.roomCode.trim()) continue;
      const parsed = roomRowSchema(t).safeParse({
        code: row.roomCode.toUpperCase(),
        name: row.roomName,
        kind: row.roomKind,
        building: row.roomBuilding,
        floor: row.roomFloor,
        capacity: row.roomCapacity,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "rooms", index, row.roomCode, first));
      }
      rooms.push(parsed.data);
    }

    // ── The bell ─────────────────────────────────────────────────────────────
    const teachingDays = listField(formData, "teachingDay");
    let bell: BellPlan | null = null;
    if (teachingDays.length > 0) {
      const parsed = bellScheduleSchema(t).safeParse({
        teachingDays,
        dayStartsAt: field(formData, "dayStartsAt"),
        afternoonStartsAt: field(formData, "afternoonStartsAt"),
        periodMinutes: field(formData, "periodMinutes"),
        morningPeriods: field(formData, "morningPeriods"),
        afternoonPeriods: field(formData, "afternoonPeriods"),
        periodsBeforeBreak: field(formData, "periodsBeforeBreak"),
        breakMinutes: field(formData, "breakMinutes"),
        saturdayMorningOnly: boolField(formData, "saturdayMorningOnly"),
        withRamadan: boolField(formData, "withRamadan"),
        ramadanStartsAt: field(formData, "ramadanStartsAt") || "09:00",
        ramadanPeriods: field(formData, "ramadanPeriods") || "0",
      });
      if (!parsed.success) return invalid(fieldErrors(parsed.error));
      bell = { ...parsed.data, teachingDays: [...parsed.data.teachingDays].sort() };
    }

    // ── Classes ──────────────────────────────────────────────────────────────
    const offeringRows = zipRows(formData, [
      "offLevelCode",
      "offTrackCode",
      "offClassCount",
      "offCapacity",
    ]);
    if (offeringRows === RAGGED) return invalid(misaligned(t, "classes"));

    const offerings: OfferingPlan[] = [];
    for (const [index, row] of offeringRows.entries()) {
      const parsed = offeringRowSchema(t).safeParse({
        levelCode: row.offLevelCode,
        trackCode: row.offTrackCode,
        classCount: row.offClassCount || "0",
        capacity: row.offCapacity,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "classes", index, row.offLevelCode, first));
      }
      if (!levelCodes.includes(parsed.data.levelCode)) continue;
      const trackCode = parsed.data.trackCode;
      if (trackCode && !trackCodes.includes(trackCode)) continue;

      offerings.push({
        levelCode: parsed.data.levelCode,
        trackCode: trackCode || null,
        classCount: parsed.data.classCount,
        capacity: parsed.data.capacity,
        classCodes: classCodesFor(
          parsed.data.levelCode,
          trackCode || null,
          parsed.data.classCount,
        ),
      });
    }

    const groupsParsed = classGroupsSchema(t).safeParse({
      groupsPerClass: field(formData, "groupsPerClass") || "0",
      groupPurpose: field(formData, "groupPurpose") || "OTHER",
    });
    if (!groupsParsed.success) return invalid(fieldErrors(groupsParsed.error));

    // ── Billing ──────────────────────────────────────────────────────────────
    const feeRows = zipRows(formData, [
      "feeIncluded",
      "feeCode",
      "feeName",
      "feeNameAr",
      "feeKind",
      "feeBillingCycle",
      "feeMandatory",
      "feeAmount",
    ]);
    if (feeRows === RAGGED) return invalid(misaligned(t, "fees"));

    const feeTypes: FeeTypePlan[] = [];
    const feeRates: FeeRatePlan[] = [];
    for (const [index, row] of feeRows.entries()) {
      if (row.feeIncluded !== "1") continue;
      const parsed = feeTypeRowSchema(t).safeParse({
        code: row.feeCode.toUpperCase(),
        name: row.feeName,
        nameAr: row.feeNameAr,
        kind: row.feeKind,
        billingCycle: row.feeBillingCycle,
        isMandatory: row.feeMandatory === "1",
        dirhams: row.feeAmount,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "fees", index, row.feeCode, first));
      }

      const { dirhams, ...feeType } = parsed.data;
      feeTypes.push(feeType);
      // A rubrique with no price is a real answer: the catalogue entry exists
      // and the school prices it per level below, or not at all this year.
      if (dirhams !== null) {
        feeRates.push({ feeCode: feeType.code, levelCode: null, amountCentimes: MAD(dirhams) });
      }
    }
    const feeCodes = feeTypes.map((fee) => fee.code);

    const rateRows = zipRows(formData, ["rateFeeCode", "rateLevelCode", "rateAmount"]);
    if (rateRows === RAGGED) return invalid(misaligned(t, "fees"));
    for (const [index, row] of rateRows.entries()) {
      if (!row.rateFeeCode || !row.rateAmount) continue;
      const parsed = feeRateRowSchema(t).safeParse({
        feeCode: row.rateFeeCode,
        levelCode: row.rateLevelCode,
        dirhams: row.rateAmount,
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "fees", index, row.rateFeeCode, first));
      }
      if (!feeCodes.includes(parsed.data.feeCode)) continue;
      const levelCode = parsed.data.levelCode;
      if (levelCode && !levelCodes.includes(levelCode)) continue;

      feeRates.push({
        feeCode: parsed.data.feeCode,
        levelCode: levelCode || null,
        amountCentimes: MAD(parsed.data.dirhams),
      });
    }

    const discountRows = zipRows(formData, [
      "discountIncluded",
      "discountCode",
      "discountName",
      "discountNameAr",
      "discountKind",
      "discountPercent",
      "discountAmount",
      "discountReason",
      "discountFeeCode",
      "discountStackable",
    ]);
    if (discountRows === RAGGED) return invalid(misaligned(t, "fees"));

    const discounts: DiscountPlan[] = [];
    for (const [index, row] of discountRows.entries()) {
      if (row.discountIncluded !== "1") continue;
      const parsed = discountRowSchema(t).safeParse({
        code: row.discountCode.toUpperCase(),
        name: row.discountName,
        nameAr: row.discountNameAr,
        kind: row.discountKind,
        reason: row.discountReason,
        // Percentages are entered as whole percent and stored as basis points.
        percentBps: row.discountPercent ? String(Number(row.discountPercent) * 100) : "",
        dirhams: row.discountAmount,
        feeCode: row.discountFeeCode,
        isStackable: row.discountStackable === "1",
      });
      if (!parsed.success) {
        const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
        return invalid(rowError(t, "fees", index, row.discountCode, first));
      }
      const feeCode = parsed.data.feeCode;
      if (feeCode && !feeCodes.includes(feeCode)) continue;

      discounts.push({
        code: parsed.data.code,
        name: parsed.data.name,
        nameAr: parsed.data.nameAr,
        kind: parsed.data.kind,
        percentBps: parsed.data.kind === "PERCENTAGE" ? parsed.data.percentBps : null,
        amountCentimes:
          parsed.data.kind === "PERCENTAGE" || parsed.data.dirhams === null
            ? null
            : MAD(parsed.data.dirhams),
        reason: parsed.data.reason,
        feeCode: feeCode || null,
        isStackable: parsed.data.isStackable,
      });
    }

    // ── The year ─────────────────────────────────────────────────────────────
    const yearName = field(formData, "yearName");
    let year: SetupPlan["year"] = null;
    if (yearName) {
      const yearParsed = schoolYearSchema(t).safeParse({
        name: yearName,
        startDate: field(formData, "yearStartDate"),
        endDate: field(formData, "yearEndDate"),
        status: field(formData, "yearStatus") || "ACTIVE",
        isDefault: boolField(formData, "yearIsDefault"),
      });
      if (!yearParsed.success) {
        return invalid(prefixErrors(fieldErrors(yearParsed.error), "year"));
      }

      const termRows = zipRows(formData, [
        "termNumber",
        "termName",
        "termNameAr",
        "termStartDate",
        "termEndDate",
      ]);
      if (termRows === RAGGED) return invalid(misaligned(t, "terms"));

      const terms: TermPlan[] = [];
      for (const [index, row] of termRows.entries()) {
        const parsed = setupTermSchema(t).safeParse({
          number: row.termNumber,
          name: row.termName,
          nameAr: row.termNameAr,
          startDate: row.termStartDate,
          endDate: row.termEndDate,
        });
        if (!parsed.success) {
          const first = Object.values(fieldErrors(parsed.error))[0] ?? t.errors.invalid;
          return invalid(rowError(t, "terms", index, row.termName, first));
        }
        terms.push(parsed.data);
      }

      year = {
        ...yearParsed.data,
        terms,
        holidays: readHolidays(formData, yearParsed.data.startDate, yearParsed.data.endDate),
      };
    }

    const settingsParsed = setupSettingsSchema(t).safeParse({
      currencyCode: field(formData, "currencyCode") || "MAD",
      defaultLocale: field(formData, "defaultLocale") || "fr",
      defaultInstalmentCount: field(formData, "defaultInstalmentCount") || "0",
      feeDueDayOfMonth: field(formData, "feeDueDayOfMonth") || "5",
    });
    if (!settingsParsed.success) return invalid(fieldErrors(settingsParsed.error));

    const settings: SetupPlan["settings"] = { ...settingsParsed.data };
    if (bell) {
      settings.teachingDays = bell.teachingDays.join(",");
      settings.periodMinutes = bell.periodMinutes;
      settings.dayStartsAt = bell.dayStartsAt;
      settings.afternoonStartsAt = bell.afternoonStartsAt;
      settings.periodsBeforeBreak = bell.periodsBeforeBreak;
      settings.breakMinutes = bell.breakMinutes;
      settings.morningPeriods = bell.morningPeriods;
      settings.afternoonPeriods = bell.afternoonPeriods;
    }

    // ── Authorize what this run actually writes ──────────────────────────────
    const writesConfiguration =
      cycles.length > 0 ||
      levels.length > 0 ||
      subjects.length > 0 ||
      rooms.length > 0 ||
      feeTypes.length > 0 ||
      offerings.length > 0 ||
      bell !== null;

    let context: AuthContext;
    let schoolPlan: SetupPlan["school"];

    if (mode === "new") {
      /*
        Org-scoped, all three. A school that does not exist yet cannot be the
        subject of a school-scoped grant: `authorizeSchool` re-derives what the
        session may reach from `context.schools`, which was read before this
        request created anything. `school.create` is org-only by design anyway,
        so whoever may create a school is the only person who can meaningfully
        configure one that has no id.
      */
      context = await authorizeOrg(PERMISSIONS.SCHOOL_CREATE);
      if (year) await authorizeOrg(PERMISSIONS.SCHOOL_YEAR_CREATE);
      if (writesConfiguration) await authorizeOrg(PERMISSIONS.CONFIGURATION_MANAGE);

      const parsed = schoolSchema(t).safeParse(readSchoolForm(formData));
      if (!parsed.success) return invalid(fieldErrors(parsed.error));

      const clash = await db.school.findUnique({
        where: {
          organizationId_code: {
            organizationId: context.organization.id,
            code: parsed.data.code,
          },
        },
        select: { id: true },
      });
      if (clash) return invalid({ code: t.school.codeTaken });

      if (parsed.data.massarCode) {
        const massarClash = await db.school.findFirst({
          where: {
            organizationId: context.organization.id,
            massarCode: parsed.data.massarCode,
          },
          select: { id: true },
        });
        if (massarClash) return invalid({ massarCode: t.school.massarTaken });
      }

      schoolPlan = { mode: "new", data: parsed.data };
    } else {
      const schoolId = field(formData, "schoolId");
      // The school predates the request, so this is the ordinary school-scoped
      // check: a director configures their own.
      context = await authorizeSchool(schoolId, PERMISSIONS.CONFIGURATION_MANAGE);
      if (year) await authorizeSchool(schoolId, PERMISSIONS.SCHOOL_YEAR_CREATE);
      schoolPlan = { mode: "existing", id: schoolId };
    }

    const result = await applySetup(context.organization.id, {
      school: schoolPlan,
      settings,
      year,
      cycles,
      levels,
      tracks,
      subjects,
      programme,
      rooms,
      bell,
      offerings,
      groupsPerClass: groupsParsed.data.groupsPerClass,
      groupPurpose: groupsParsed.data.groupPurpose,
      feeTypes,
      feeRates,
      discounts,
    });
    if (!result) return failure(t.errors.notFound);

    /*
      Switched by hand rather than through `switchSchoolAction`: that action
      re-derives the school from `context.schools`, which cannot contain a
      school this same request created. This is the user's own row, and the
      school was written under a grant they were checked for a moment ago.
    */
    if (result.schoolId !== context.currentSchool?.id || result.schoolYearId) {
      await db.user.update({
        where: { id: context.user.id },
        data: {
          currentSchoolId: result.schoolId,
          currentSchoolYearId: result.schoolYearId,
        },
      });
    }

    refresh();
    // `/configuration` is where every row this just wrote is visible and
    // editable, and it is school-scoped — which is what the switch above buys.
    redirect("/configuration");
  });
}

/**
 * The announced public holidays, dated against the year they fall in.
 *
 * A school year straddles two calendar years: a November date belongs to the
 * first, a May date to the second. Deciding by month against the start is what
 * keeps that right without hard-coding either year — the same rule
 * `seedHolidays` follows.
 */
function readHolidays(
  formData: FormData,
  yearStart: Date,
  yearEnd: Date,
): { name: string; nameAr: string; kind: string; startDate: Date; endDate: Date }[] {
  if (!boolField(formData, "withHolidays")) return [];

  const written: { name: string; nameAr: string; kind: string; startDate: Date; endDate: Date }[] = [];
  for (const holiday of HOLIDAYS) {
    const calendarYear =
      holiday.month >= yearStart.getMonth() + 1
        ? yearStart.getFullYear()
        : yearStart.getFullYear() + 1;

    const startDate = new Date(calendarYear, holiday.month - 1, holiday.day);
    const endDate = new Date(
      calendarYear,
      holiday.month - 1,
      holiday.day + holiday.days - 1,
    );
    // A date the year does not cover is skipped rather than clamped: a school
    // whose year ends in June has no Fête du Trône to declare.
    if (startDate < yearStart || startDate > yearEnd) continue;

    written.push({
      name: holiday.name,
      nameAr: holiday.nameAr,
      kind: holiday.kind,
      startDate,
      endDate,
    });
  }
  return written;
}
