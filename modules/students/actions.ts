"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { failure, success, type ActionState } from "@/lib/action-state";
import { withCodeRetry } from "@/lib/allocation";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { formValues } from "@/lib/form-values";
import { fieldErrors, prefixErrors } from "@/lib/validation";
import { allocateFamilyCode } from "@/modules/families/service";
import { familySchema, guardianSchema } from "@/modules/families/validation";
import { enrolmentSchema } from "@/modules/enrolment/validation";
import { assignClass, generateFeeSchedule } from "@/modules/enrolment/service";
import {
  allocateStudentCode,
  attachToFamily,
  refreshStudentStatus,
} from "@/modules/students/service";
import { studentSchema } from "@/modules/students/validation";

/**
 * Actions for the students module.
 *
 * The school is taken from the working context and never from the form; a pupil
 * is authorized through the school the row turns out to belong to. `status` is
 * never read from the request — it is derived from the enrolments, in
 * `modules/students/service.ts`.
 */

/**
 * The sentinel a `<Select>` uses for "none" — Radix cannot hold an empty string
 * as an item value, so the blank choice needs one, and it is normalised away
 * here rather than being looked up as an id that will never exist.
 */
const NO_SELECTION = "__none__";

function optionalId(formData: FormData, name: string): string {
  const value = field(formData, name);
  return value === NO_SELECTION ? "" : value;
}

function readStudentForm(formData: FormData) {
  return {
    code: field(formData, "code"),
    massarCode: field(formData, "massarCode"),
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    firstNameAr: field(formData, "firstNameAr"),
    lastNameAr: field(formData, "lastNameAr"),
    gender: field(formData, "gender"),
    birthDate: field(formData, "birthDate"),
    birthCityId: optionalId(formData, "birthCityId"),
    neighbourhoodId: optionalId(formData, "neighbourhoodId"),
    nationality: field(formData, "nationality"),
    nationalId: field(formData, "nationalId"),
    photoUrl: field(formData, "photoUrl"),
    familyId: optionalId(formData, "familyId"),
    entryDate: field(formData, "entryDate"),

    // Santé. The selects carry the same "none" sentinel as familyId — Radix
    // cannot hold an empty string as an item value.
    bloodType: optionalId(formData, "bloodType"),
    allergies: field(formData, "allergies"),
    chronicCondition: field(formData, "chronicCondition"),
    medications: field(formData, "medications"),
    doctorName: field(formData, "doctorName"),
    doctorPhone: field(formData, "doctorPhone"),
    insurer: field(formData, "insurer"),
    hasDisability: boolField(formData, "hasDisability"),
    medicalNotes: field(formData, "medicalNotes"),

    // Scolarité antérieure.
    previousSchool: field(formData, "previousSchool"),
    previousSchoolCityId: optionalId(formData, "previousSchoolCityId"),
    previousLevel: field(formData, "previousLevel"),
    schoolingType: optionalId(formData, "schoolingType"),
    transferReason: field(formData, "transferReason"),

    // Fratrie et foyer.
    brotherCount: field(formData, "brotherCount"),
    sisterCount: field(formData, "sisterCount"),
    birthRank: field(formData, "birthRank"),
    livesWith: optionalId(formData, "livesWith"),
    isOrphan: boolField(formData, "isOrphan"),

    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

async function authorizeStudent(
  studentId: string,
  permission:
    typeof PERMISSIONS.STUDENT_UPDATE | typeof PERMISSIONS.STUDENT_DELETE,
) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, schoolId: true },
  });
  if (!student) return null;

  await authorizeSchool(student.schoolId, permission);
  return student;
}

/**
 * Turns the parsed form into columns.
 *
 * `familyId`, the two city ids, the quartier and `entryDate` arrive as strings
 * and mean "unset" when blank. Each reference is re-read against the school
 * before it is written, so an id belonging to another tenant is dropped rather
 * than linked across the boundary — the ids come from the request and are never
 * trusted.
 */
async function toColumns(
  parsed: ReturnType<ReturnType<typeof studentSchema>["parse"]>,
  schoolId: string,
) {
  const {
    familyId,
    birthCityId,
    previousSchoolCityId,
    neighbourhoodId,
    entryDate,
    ...rest
  } = parsed;

  const cityInSchool = async (cityId: string | null) =>
    cityId
      ? ((
          await db.city.findFirst({
            where: { id: cityId, schoolId },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

  const [family, birthCity, previousSchoolCity, neighbourhood] =
    await Promise.all([
      familyId
        ? db.family.findFirst({
            where: { id: familyId, schoolId },
            select: { id: true },
          })
        : null,
      cityInSchool(birthCityId),
      cityInSchool(previousSchoolCityId),
      neighbourhoodId
        ? db.neighbourhood.findFirst({
            where: { id: neighbourhoodId, schoolId },
            select: { id: true },
          })
        : null,
    ]);

  return {
    ...rest,
    familyId: family?.id ?? null,
    birthCityId: birthCity,
    previousSchoolCityId: previousSchoolCity,
    neighbourhoodId: neighbourhood?.id ?? null,
    entryDate: entryDate ? new Date(entryDate) : null,
  };
}

export async function createStudentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);

    await authorizeSchool(schoolId, PERMISSIONS.STUDENT_CREATE);

    const parsed = studentSchema(t).safeParse(readStudentForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // Only a matricule the secretary typed is checked here. A generated one is
    // retried instead, further down: losing the race to the other guichet is
    // not the same thing as asking for a number somebody already holds, and
    // reporting it as "code taken" sends her hunting for a pupil who does not
    // exist.
    if (parsed.data.code) {
      const duplicate = await db.student.findUnique({
        where: { schoolId_code: { schoolId, code: parsed.data.code } },
        select: { id: true },
      });
      if (duplicate) {
        return failure(t.student.codeTaken, { code: t.student.codeTaken });
      }
    }

    if (parsed.data.massarCode) {
      const massarTaken = await db.student.findFirst({
        where: { schoolId, massarCode: parsed.data.massarCode },
        select: { id: true },
      });
      if (massarTaken) {
        return failure(t.student.massarTaken, {
          massarCode: t.student.massarTaken,
        });
      }
    }

    const columns = await toColumns(parsed.data, schoolId);
    const create = (code: string) =>
      db.student.create({
        data: { ...columns, code, schoolId },
        select: { id: true },
      });

    // The allocation is inside the retry, not outside it: re-running the insert
    // with the number it already lost would fail identically five times over.
    const student = parsed.data.code
      ? await create(parsed.data.code)
      : await withCodeRetry(async () =>
          create(await allocateStudentCode(schoolId)),
        );

    refresh();
    // Straight to the new file rather than back to the list: the parcours
    // continues there — attach a family, enrol, seat, bill — and the id is only
    // known here. `redirect` throws, and `withActionErrors` lets it through.
    redirect(`/students/${student.id}`);
  });
}

/**
 * Registers a pupil in one sitting: the dossier familial (new or existing),
 * its first guardian, the pupil's identity, and the year's place — one submit
 * from the wizard at `/students/new` instead of four separate screens.
 *
 * Deliberately thin on fields: only what decides *whether* a place exists
 * (identity, level, class) is asked here. Santé, scolarité antérieure and the
 * rest of the dossier are exactly as optional as they are on the full fiche —
 * see student-form.tsx — and are filled in later from the pupil's own file,
 * which this redirects to.
 *
 * Each step reuses its owning module's own schema and service functions
 * (`familySchema`, `guardianSchema`, `assignClass`, `generateFeeSchedule`…)
 * rather than re-deriving their rules, exactly as `copyYearConfiguration`
 * orchestrates across modules for a new school year.
 */
export async function enrolNewStudentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const context = await requireAuth();

    const schoolId = context.currentSchool?.id;
    if (!schoolId) return failure(t.errors.noSchoolContext);
    const schoolYearId = context.currentSchoolYear?.id;
    if (!schoolYearId) return failure(t.errors.noSchoolYearContext);

    const familyMode =
      field(formData, "familyMode") === "existing" ? "existing" : "new";

    /*
      Three codes, because this one screen does three modules' work — and each
      asserted through `authorizeSchool` rather than read off the context.

      The answer to the caller is the same either way. What differs is the
      trail: `withActionErrors` records a DENIED event when a `ForbiddenError`
      is thrown, and its own note says every action gets that for free. This one
      did not, because it refused by returning. So the single action that
      creates a pupil, a family and an inscription in one go — the one a probe
      would be most interested in — was also the only one whose refusals left no
      trace.
    */
    await authorizeSchool(schoolId, PERMISSIONS.STUDENT_CREATE);
    if (familyMode === "new") {
      await authorizeSchool(schoolId, PERMISSIONS.FAMILY_CREATE);
    }
    await authorizeSchool(schoolId, PERMISSIONS.ENROLMENT_CREATE);

    // ── Famille ──────────────────────────────────────────────────────────────
    let familyId: string;

    if (familyMode === "existing") {
      const requestedId = optionalId(formData, "familyId");
      if (!requestedId) {
        return failure(
          t.errors.invalid,
          { familyId: t.validation.required },
          formValues(formData),
        );
      }
      const family = await db.family.findFirst({
        where: { id: requestedId, schoolId },
        select: { id: true },
      });
      if (!family) {
        return failure(
          t.errors.invalid,
          { familyId: t.errors.notFound },
          formValues(formData),
        );
      }
      familyId = family.id;
    } else {
      const familyParsed = familySchema(t).safeParse({
        code: "",
        name: field(formData, "familyName"),
        nameAr: "",
        // Fixed to the same default the full family form offers — a guess no
        // worse than asking a secretary mid-registration, and just as editable
        // afterwards from the dossier.
        situation: "MARRIED",
        addressLine: field(formData, "familyAddressLine"),
        city: field(formData, "familyCity"),
        postalCode: "",
        country: "",
        phone: field(formData, "familyPhone"),
        email: "",
        notes: "",
        isActive: true,
      });
      if (!familyParsed.success) {
        return failure(
          t.errors.invalid,
          prefixErrors(fieldErrors(familyParsed.error), "family"),
          formValues(formData),
        );
      }

      // The dossier's code is always generated here — the wizard never asks for
      // one — so a collision is only ever a lost race, and retrying is the whole
      // answer. Checking for a duplicate first would report "code taken" about a
      // number the secretary never chose.
      const family = await withCodeRetry(async () =>
        db.family.create({
          data: {
            ...familyParsed.data,
            code: await allocateFamilyCode(schoolId),
            schoolId,
          },
          select: { id: true },
        }),
      );
      familyId = family.id;

      // ── Tuteur ─────────────────────────────────────────────────────────────
      // Optional even for a new dossier: the file can be opened from a phone
      // call before anyone has taken the parent's details down.
      const guardianFirstName = field(formData, "guardianFirstName");
      const guardianLastName = field(formData, "guardianLastName");
      if (guardianFirstName || guardianLastName) {
        const guardianParsed = guardianSchema(t).safeParse({
          relationship: field(formData, "guardianRelationship") || "FATHER",
          firstName: guardianFirstName,
          lastName: guardianLastName,
          nameAr: "",
          nationalId: "",
          phone: field(formData, "guardianPhone"),
          phoneAlt: "",
          email: "",
          profession: "",
          employer: "",
          addressLine: "",
          city: "",
          isPrimaryContact: true,
          isEmergencyContact: true,
          canPickUp: true,
          notes: "",
          isActive: true,
        });
        if (!guardianParsed.success) {
          return failure(
            t.errors.invalid,
            prefixErrors(fieldErrors(guardianParsed.error), "guardian"),
            formValues(formData),
          );
        }
        await db.guardian.create({
          data: { ...guardianParsed.data, familyId },
        });
      }
    }

    // ── Élève ────────────────────────────────────────────────────────────────
    const studentParsed = studentSchema(t).safeParse({
      code: "",
      massarCode: "",
      firstName: field(formData, "studentFirstName"),
      lastName: field(formData, "studentLastName"),
      firstNameAr: "",
      lastNameAr: "",
      gender: field(formData, "studentGender") || "MALE",
      birthDate: field(formData, "studentBirthDate"),
      birthCityId: optionalId(formData, "studentBirthCityId"),
      neighbourhoodId: optionalId(formData, "studentNeighbourhoodId"),
      nationality: "",
      nationalId: "",
      photoUrl: "",
      familyId,
      entryDate: "",
      bloodType: "",
      allergies: "",
      chronicCondition: "",
      medications: "",
      doctorName: "",
      doctorPhone: "",
      insurer: "",
      hasDisability: false,
      medicalNotes: "",
      previousSchool: "",
      previousSchoolCityId: "",
      previousLevel: "",
      schoolingType: "",
      transferReason: "",
      brotherCount: "",
      sisterCount: "",
      birthRank: "",
      livesWith: "",
      isOrphan: false,
      notes: "",
      isActive: true,
    });
    if (!studentParsed.success) {
      return failure(
        t.errors.invalid,
        prefixErrors(fieldErrors(studentParsed.error), "student"),
        formValues(formData),
      );
    }

    // Generated, never typed — same as the dossier above, so a collision is a
    // lost race and not a matricule anybody chose.
    const columns = await toColumns(studentParsed.data, schoolId);
    const student = await withCodeRetry(async () =>
      db.student.create({
        data: {
          ...columns,
          code: await allocateStudentCode(schoolId),
          schoolId,
        },
        select: { id: true },
      }),
    );

    // ── Inscription ──────────────────────────────────────────────────────────
    const enrolmentParsed = enrolmentSchema(t).safeParse({
      studentId: student.id,
      levelOfferingId: field(formData, "levelOfferingId"),
      schoolClassId: optionalId(formData, "schoolClassId"),
      classGroupId: optionalId(formData, "classGroupId"),
      status: "ACTIVE",
      enrolledOn: "",
      isRepeating: false,
      notes: "",
    });
    if (!enrolmentParsed.success) {
      return failure(
        t.errors.invalid,
        prefixErrors(fieldErrors(enrolmentParsed.error), "enrolment"),
        formValues(formData),
      );
    }

    const offering = await db.levelOffering.findFirst({
      where: { id: enrolmentParsed.data.levelOfferingId, schoolYearId },
      select: { id: true },
    });
    if (!offering) {
      return failure(t.enrolment.offeringUnavailable, {
        levelOfferingId: t.enrolment.offeringUnavailable,
      });
    }

    const enrolment = await db.enrollment.create({
      data: {
        studentId: student.id,
        schoolYearId,
        levelOfferingId: offering.id,
        status: enrolmentParsed.data.status,
        enrolledOn: new Date(),
        // No opt-ins: the quick enrol grants a place, and which optional
        // charges the family takes is settled on the enrolment panel. An
        // enrolment with no subscriptions is billed the mandatory charges only.
        isRepeating: false,
      },
      select: { id: true },
    });

    if (enrolmentParsed.data.schoolClassId) {
      await assignClass(
        enrolment.id,
        enrolmentParsed.data.schoolClassId,
        enrolmentParsed.data.classGroupId || null,
      );
    }

    await generateFeeSchedule(enrolment.id);
    await refreshStudentStatus(student.id);

    refresh();
    redirect(`/students/${student.id}`);
  });
}

export async function updateStudentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();
    const studentId = field(formData, "id");

    const existing = await authorizeStudent(
      studentId,
      PERMISSIONS.STUDENT_UPDATE,
    );
    if (!existing) return failure(t.errors.notFound);

    const parsed = studentSchema(t).safeParse(readStudentForm(formData));
    if (!parsed.success) {
      return failure(
        t.errors.invalid,
        fieldErrors(parsed.error),
        formValues(formData),
      );
    }

    // As on create: a typed matricule is checked and refused, a generated one
    // is retried below.
    if (parsed.data.code) {
      const duplicate = await db.student.findFirst({
        where: {
          schoolId: existing.schoolId,
          code: parsed.data.code,
          NOT: { id: studentId },
        },
        select: { id: true },
      });
      if (duplicate) {
        return failure(t.student.codeTaken, { code: t.student.codeTaken });
      }
    }

    if (parsed.data.massarCode) {
      const massarTaken = await db.student.findFirst({
        where: {
          schoolId: existing.schoolId,
          massarCode: parsed.data.massarCode,
          NOT: { id: studentId },
        },
        select: { id: true },
      });
      if (massarTaken) {
        return failure(t.student.massarTaken, {
          massarCode: t.student.massarTaken,
        });
      }
    }

    const columns = await toColumns(parsed.data, existing.schoolId);
    const update = (code: string) =>
      db.student.update({ where: { id: studentId }, data: { ...columns, code } });

    await (parsed.data.code
      ? update(parsed.data.code)
      : withCodeRetry(async () =>
          update(await allocateStudentCode(existing.schoolId)),
        ));

    refresh();
    return success(t.student.updated);
  });
}

export async function deleteStudentAction(
  studentId: string,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeStudent(
      studentId,
      PERMISSIONS.STUDENT_DELETE,
    );
    if (!existing) return failure(t.errors.notFound);

    // Deleting a pupil cascades to its enrolments and their whole fee
    // schedule. That is right for a file opened in error and wrong for anyone
    // who has actually attended, so a pupil with a history is deactivated
    // instead — refuse rather than quietly destroy an accounting record.
    const enrolmentCount = await db.enrollment.count({ where: { studentId } });
    if (enrolmentCount > 0) return failure(t.student.hasEnrolments);

    await db.student.delete({ where: { id: studentId } });

    refresh();
    return success(t.student.deleted);
  });
}

/** Attaches a pupil to a dossier, or detaches when `familyId` is blank. */
export async function attachStudentToFamilyAction(
  studentId: string,
  familyId: string | null,
): Promise<ActionState> {
  return withActionErrors(async () => {
    const t = await getDictionary();

    const existing = await authorizeStudent(
      studentId,
      PERMISSIONS.STUDENT_UPDATE,
    );
    if (!existing) return failure(t.errors.notFound);

    const linked = await attachToFamily(
      studentId,
      existing.schoolId,
      familyId || null,
    );
    if (!linked) return failure(t.errors.notFound);

    refresh();
    return success(t.student.updated);
  });
}
