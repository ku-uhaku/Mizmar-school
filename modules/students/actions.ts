"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { failure, success, type ActionState } from "@/lib/action-state";
import { authorizeSchool, requireAuth } from "@/lib/dal";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/permissions";
import { boolField, field, withActionErrors } from "@/lib/server-action";
import { fieldErrors } from "@/lib/validation";
import { allocateStudentCode, attachToFamily } from "@/modules/students/service";
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
    birthPlace: field(formData, "birthPlace"),
    birthPlaceAr: field(formData, "birthPlaceAr"),
    nationality: field(formData, "nationality"),
    nationalId: field(formData, "nationalId"),
    photoUrl: field(formData, "photoUrl"),
    familyId: optionalId(formData, "familyId"),
    entryDate: field(formData, "entryDate"),
    medicalNotes: field(formData, "medicalNotes"),
    notes: field(formData, "notes"),
    isActive: boolField(formData, "isActive"),
  };
}

async function authorizeStudent(
  studentId: string,
  permission:
    | typeof PERMISSIONS.STUDENT_UPDATE
    | typeof PERMISSIONS.STUDENT_DELETE,
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
 * `familyId` and `entryDate` arrive as strings and mean "unset" when blank; the
 * family is re-checked against the school so a dossier id from elsewhere is
 * dropped rather than linked across the tenant boundary.
 */
async function toColumns(
  parsed: ReturnType<ReturnType<typeof studentSchema>["parse"]>,
  schoolId: string,
) {
  const { familyId, entryDate, ...rest } = parsed;

  const family = familyId
    ? await db.family.findFirst({
        where: { id: familyId, schoolId },
        select: { id: true },
      })
    : null;

  return {
    ...rest,
    familyId: family?.id ?? null,
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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const code = parsed.data.code ?? (await allocateStudentCode(schoolId));

    const duplicate = await db.student.findUnique({
      where: { schoolId_code: { schoolId, code } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.student.codeTaken, { code: t.student.codeTaken });
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
    const student = await db.student.create({
      data: { ...columns, code, schoolId },
      select: { id: true },
    });

    refresh();
    // Straight to the new file rather than back to the list: the parcours
    // continues there — attach a family, enrol, seat, bill — and the id is only
    // known here. `redirect` throws, and `withActionErrors` lets it through.
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
      return failure(t.errors.invalid, fieldErrors(parsed.error));
    }

    const code =
      parsed.data.code ?? (await allocateStudentCode(existing.schoolId));

    const duplicate = await db.student.findFirst({
      where: { schoolId: existing.schoolId, code, NOT: { id: studentId } },
      select: { id: true },
    });
    if (duplicate) {
      return failure(t.student.codeTaken, { code: t.student.codeTaken });
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
    await db.student.update({
      where: { id: studentId },
      data: { ...columns, code },
    });

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
