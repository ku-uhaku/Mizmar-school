import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  dateField,
  enumField,
  optionalEnumField,
  optionalPositiveInt,
  optionalText,
  requiredText,
  optionalImage,
} from "@/lib/validation";
import {
  BLOOD_TYPES,
  GENDERS,
  LIVES_WITH,
  SCHOOLING_TYPES,
} from "@/modules/students/enums";

/**
 * Built per-request from the dictionary so messages are localised.
 *
 * `status` is deliberately absent: it is derived from the pupil's enrolments,
 * and accepting it from a form would let a POST claim a child is enrolled when
 * no enrolment row exists.
 */
export function studentSchema(t: Dictionary) {
  const v = t.validation;
  return z
    .object({
      code: optionalText(32).refine(
        (value) => value === null || /^[A-Za-z0-9-]+$/.test(value),
        { error: v.codeFormat },
      ),
      massarCode: optionalText(32),
      firstName: requiredText(v, { max: 80 }),
      lastName: requiredText(v, { max: 80 }),
      firstNameAr: optionalText(80),
      lastNameAr: optionalText(80),
      gender: enumField(GENDERS, v),
      // Required, unlike a staff member's: age is what decides which level a
      // child may be admitted to.
      birthDate: dateField(v),
      // Ids, not names: the town is picked from the school's own list — see
      // modules/geography. Blank means "not recorded", which is ordinary for a
      // file opened over the phone.
      birthCityId: optionalText(40),
      // Where the family lives, from the same lists. Asked of every child, bus
      // or no bus — see the note on `Student.neighbourhoodId`.
      neighbourhoodId: optionalText(40),
      nationality: countryField(v),
      nationalId: optionalText(32),
      photoUrl: optionalImage(v),
      familyId: optionalText(40),
      entryDate: optionalText(40),

      // Santé.
      bloodType: optionalEnumField(BLOOD_TYPES, v),
      allergies: optionalText(500),
      chronicCondition: optionalText(500),
      medications: optionalText(500),
      doctorName: optionalText(120),
      doctorPhone: optionalText(40),
      insurer: optionalText(120),
      hasDisability: z.boolean(),
      medicalNotes: optionalText(2000),

      // Scolarité antérieure.
      previousSchool: optionalText(160),
      previousSchoolCityId: optionalText(40),
      previousLevel: optionalText(80),
      schoolingType: optionalEnumField(SCHOOLING_TYPES, v),
      transferReason: optionalText(500),

      // Fratrie et foyer. The counts are bounded rather than merely positive:
      // a two-digit sibling count is a typo, and letting one through skews
      // every social-case report drawn from these columns.
      brotherCount: optionalPositiveInt(v),
      sisterCount: optionalPositiveInt(v),
      birthRank: optionalPositiveInt(v),
      livesWith: optionalEnumField(LIVES_WITH, v),
      isOrphan: z.boolean(),

      notes: optionalText(1000),
      isActive: z.boolean(),
    })
    .refine((data) => data.birthDate <= new Date(), {
      error: v.invalidDate,
      path: ["birthDate"],
    })
    .refine((data) => data.birthDate >= new Date("1950-01-01"), {
      error: v.invalidDate,
      path: ["birthDate"],
    })
    .refine((data) => data.brotherCount === null || data.brotherCount <= 20, {
      error: v.invalidNumber,
      path: ["brotherCount"],
    })
    .refine((data) => data.sisterCount === null || data.sisterCount <= 20, {
      error: v.invalidNumber,
      path: ["sisterCount"],
    })
    // 1 is the eldest, so 0 is not a rank; the upper bound matches the counts.
    .refine(
      (data) =>
        data.birthRank === null || (data.birthRank >= 1 && data.birthRank <= 21),
      { error: v.invalidNumber, path: ["birthRank"] },
    );
}
