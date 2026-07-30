import * as z from "zod";

import type { Dictionary } from "@/lib/i18n/types";
import {
  countryField,
  dateField,
  enumField,
  optionalText,
  optionalUrl,
  requiredText,
} from "@/lib/validation";
import { GENDERS } from "@/modules/students/enums";

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
      birthPlace: optionalText(120),
      birthPlaceAr: optionalText(120),
      nationality: countryField(v),
      nationalId: optionalText(32),
      photoUrl: optionalUrl(v),
      familyId: optionalText(40),
      entryDate: optionalText(40),
      medicalNotes: optionalText(2000),
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
    });
}
