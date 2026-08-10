import { z } from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import { CURRENCY_CODES } from "@/lib/school-settings";
import {
  enumField,
  optionalPositiveInt,
  optionalText,
  requiredText,
  dateField,
} from "@/lib/validation";
import { COEFFICIENT_MAX, COEFFICIENT_MIN, EDUCATION_CYCLES } from "@/modules/academics/enums";
import { BILLING_CYCLES, DISCOUNT_KINDS, DISCOUNT_REASONS, FEE_KINDS } from "@/modules/billing/enums";
import { GROUP_PURPOSES } from "@/modules/classes/enums";
import { ROOM_KINDS } from "@/modules/facilities/enums";
import { TERM_NUMBER_MAX } from "@/modules/school-years/enums";
import { isTimeOfDay, LESSON_LENGTHS_MINUTES } from "@/modules/timetable/enums";

/**
 * What the setup wizard accepts.
 *
 * Every export is a factory taking the dictionary, so messages come back in the
 * user's language — the rule for every schema in the app. The two big steps
 * reuse their owning module's schema rather than restating it: identity goes
 * through `schoolSchema`, the year through `schoolYearSchema`, both imported by
 * the action. What is here is only the shapes no other module has, because no
 * other screen asks a school to describe its whole cursus at once.
 */

const timeOfDay = (v: Dictionary["validation"]) =>
  z
    .string()
    .trim()
    .refine((value) => isTimeOfDay(value), { error: v.invalidChoice });

// ── Terms ────────────────────────────────────────────────────────────────────

export function setupTermSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      number: z.coerce.number<number>().int().min(1).max(TERM_NUMBER_MAX),
      name: requiredText(v, { max: 60 }),
      nameAr: optionalText(60),
      startDate: dateField(v),
      endDate: dateField(v),
    })
    .refine((data) => data.endDate > data.startDate, {
      error: t.schoolYear.endBeforeStart,
      path: ["endDate"],
    });
}

// ── Cursus ───────────────────────────────────────────────────────────────────

/**
 * A level the catalogue does not know, typed in by a school with an unusual
 * cursus. `massarCode` is deliberately absent: `Level` carries a nullable-unique
 * index on it, and a hand-typed code is exactly the way two levels collide.
 */
export function setupCustomLevelSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    cycle: enumField(EDUCATION_CYCLES, v),
    code: requiredText(v, { max: 32 }).regex(/^[A-Za-z0-9-]+$/, { error: v.codeFormat }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    gradeYear: z.coerce.number<number>().int().min(1).max(12),
  });
}

export function programmeRowSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    levelCode: requiredText(v, { max: 32 }),
    trackCode: optionalText(32),
    subjectCode: requiredText(v, { max: 32 }),
    coefficient: z.coerce
      .number<number>()
      .int()
      .min(COEFFICIENT_MIN, { error: v.invalidNumber })
      .max(COEFFICIENT_MAX, { error: v.invalidNumber }),
    weeklyMinutes: optionalPositiveInt(v),
  });
}

// ── Facilities ───────────────────────────────────────────────────────────────

export function roomRowSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 32 }).regex(/^[A-Za-z0-9-]+$/, { error: v.codeFormat }),
    name: optionalText(120),
    kind: enumField(ROOM_KINDS, v),
    building: optionalText(120),
    floor: optionalPositiveInt(v),
    capacity: optionalPositiveInt(v),
  });
}

// ── The bell ─────────────────────────────────────────────────────────────────

/**
 * The shape of a teaching day, which is also most of what `SchoolSettings`
 * stores about one — the wizard writes both from these answers rather than
 * asking the same questions twice.
 */
export function bellScheduleSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      teachingDays: z.array(z.coerce.number<number>().int().min(1).max(7)).min(1, { error: v.required }),
      dayStartsAt: timeOfDay(v),
      afternoonStartsAt: timeOfDay(v),
      periodMinutes: z.coerce
        .number<number>()
        .int()
        .refine((value) => LESSON_LENGTHS_MINUTES.includes(value as 30 | 60 | 90 | 120), {
          error: v.invalidChoice,
        }),
      morningPeriods: z.coerce.number<number>().int().min(0).max(12),
      afternoonPeriods: z.coerce.number<number>().int().min(0).max(12),
      periodsBeforeBreak: z.coerce.number<number>().int().min(0).max(12),
      breakMinutes: z.coerce.number<number>().int().min(0).max(120),
      saturdayMorningOnly: z.boolean(),
      withRamadan: z.boolean(),
      ramadanStartsAt: timeOfDay(v),
      ramadanPeriods: z.coerce.number<number>().int().min(0).max(12),
    })
    .refine((data) => data.morningPeriods + data.afternoonPeriods > 0, {
      error: v.required,
      path: ["morningPeriods"],
    })
    // A break after the fifth of four periods is not a break, it is a typo that
    // would silently lay the run with none.
    .refine((data) => data.periodsBeforeBreak <= data.morningPeriods, {
      error: v.invalidNumber,
      path: ["periodsBeforeBreak"],
    });
}

// ── Classes ──────────────────────────────────────────────────────────────────

export function offeringRowSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    levelCode: requiredText(v, { max: 32 }),
    trackCode: optionalText(32),
    // Zero is a real answer: the level is configured but no class opens in it
    // this year. Twenty-six is how many sections A–Z can name.
    classCount: z.coerce.number<number>().int().min(0).max(26),
    capacity: optionalPositiveInt(v),
  });
}

export function classGroupsSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    groupsPerClass: z.coerce.number<number>().int().min(0).max(6),
    groupPurpose: enumField(GROUP_PURPOSES, v),
  });
}

// ── Billing ──────────────────────────────────────────────────────────────────

export function feeTypeRowSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    code: requiredText(v, { max: 32 }).regex(/^[A-Za-z0-9-]+$/, { error: v.codeFormat }),
    name: requiredText(v, { max: 120 }),
    nameAr: optionalText(120),
    kind: enumField(FEE_KINDS, v),
    billingCycle: enumField(BILLING_CYCLES, v),
    isMandatory: z.boolean(),
    /** Dirhams. Blank creates the rubrique with no price for this year. */
    dirhams: optionalPositiveInt(v),
  });
}

export function feeRateRowSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    feeCode: requiredText(v, { max: 32 }),
    /** Blank prices the fee the same at every level. */
    levelCode: optionalText(32),
    dirhams: z.coerce.number<number>().int().min(0),
  });
}

export function discountRowSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      code: requiredText(v, { max: 32 }).regex(/^[A-Za-z0-9-]+$/, { error: v.codeFormat }),
      name: requiredText(v, { max: 120 }),
      nameAr: optionalText(120),
      kind: enumField(DISCOUNT_KINDS, v),
      reason: enumField(DISCOUNT_REASONS, v),
      percentBps: optionalPositiveInt(v),
      dirhams: optionalPositiveInt(v),
      feeCode: optionalText(32),
      isStackable: z.boolean(),
    })
    // The schema's own invariant, spelled here rather than left to the service:
    // exactly the one field matching `kind` is set, so a PERCENTAGE row can
    // never carry an amount that nothing would ever read.
    .superRefine((data, ctx) => {
      if (data.kind === "PERCENTAGE") {
        if (data.percentBps === null || data.percentBps < 1 || data.percentBps > 10000) {
          ctx.addIssue({ code: "custom", path: ["percentBps"], message: v.invalidNumber });
        }
      } else if (data.dirhams === null || data.dirhams < 1) {
        ctx.addIssue({ code: "custom", path: ["dirhams"], message: v.invalidNumber });
      }
    });
}

// ── Settings ─────────────────────────────────────────────────────────────────

/** The policies the wizard's own answers imply, all of them defaulted columns. */
export function setupSettingsSchema(t: Dictionary) {
  const v = t.validation;
  return z.object({
    currencyCode: enumField(CURRENCY_CODES, v),
    defaultLocale: enumField(["fr", "en", "ar"] as const, v),
    // Zero means "as many months as the year has" — see the column's own note.
    defaultInstalmentCount: z.coerce.number<number>().int().min(0).max(12),
    feeDueDayOfMonth: z.coerce.number<number>().int().min(1).max(28),
  });
}
