import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Dictionary } from "@/lib/i18n/types";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";
import { IMPORT_COLUMNS } from "@/modules/imports/columns";

/**
 * Reads for the imports module — which is to say, the export.
 *
 * Scoped to `context.currentSchool` like every other read in the app, and to
 * the columns of the import file rather than to everything a pupil row holds.
 * That is deliberate: the export's job is to produce a file the importer will
 * take back, so the two share one column list and a round trip cannot drift.
 *
 * Notably absent: `photoUrl`. A portrait is a 20 KB data URI per pupil and a
 * spreadsheet has nowhere to put it — including it would turn a 400-row export
 * into an 8 MB download that Excel then renders as a wall of base64.
 */

/**
 * Every pupil on the school's books, in the import file's shape.
 *
 * One row per child, with the household and the parents repeated alongside —
 * the same flattening the importer undoes. A family of three children is three
 * rows sharing a dossier name, which is what re-importing needs to regroup them.
 */
export async function exportStudentRows(
  context: AuthContext,
  t: Dictionary,
): Promise<string[][]> {
  const students = await db.student.findMany({
    where: { schoolId: currentSchoolId(context) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      code: true,
      massarCode: true,
      firstName: true,
      lastName: true,
      firstNameAr: true,
      lastNameAr: true,
      gender: true,
      birthDate: true,
      nationality: true,
      neighbourhood: { select: { name: true } },
      /*
        The inscription for the year in context, so an exported file carries the
        level and class back in. One row at most — `Enrollment` is unique per
        pupil per year — and none at all for a pupil whose file is open but who
        is not seated, which exports with the inscription columns blank and
        re-imports as exactly that same state.
      */
      enrollments: {
        where: { schoolYearId: currentSchoolYearId(context) },
        take: 1,
        select: {
          isRepeating: true,
          enrolledOn: true,
          // The two the export template carries, read off the subscriptions —
          // see EnrollmentOption. Keyed on the kind, as the services report is.
          options: { select: { feeType: { select: { kind: true } } } },
          schoolClass: { select: { code: true } },
          levelOffering: {
            select: {
              level: { select: { code: true } },
              track: { select: { code: true } },
            },
          },
          transportSubscriptions: {
            take: 1,
            select: {
              route: { select: { name: true } },
              stop: { select: { name: true } },
            },
          },
        },
      },
      family: {
        select: {
          name: true,
          phone: true,
          email: true,
          addressLine: true,
          city: true,
          guardians: {
            select: {
              relationship: true,
              firstName: true,
              lastName: true,
              nationalId: true,
              phone: true,
              profession: true,
            },
          },
        },
      },
    },
  });

  const header = IMPORT_COLUMNS.map((column) => t.imports.columns[column.labelKey]);

  const body = students.map((student) => {
    const guardians = student.family?.guardians ?? [];
    const father = guardians.find((g) => g.relationship === "FATHER");
    const mother = guardians.find((g) => g.relationship === "MOTHER");
    const enrolment = student.enrollments[0];
    const subscription = enrolment?.transportSubscriptions[0];

    // "oui"/"non" rather than true/false: the file is read and edited in Excel
    // by somebody who is not a programmer, and `parseBoolean` reads it back.
    const yesNo = (value: boolean | undefined) => (value ? "oui" : "non");

    const cells: Record<string, string> = {
      code: student.code,
      massarCode: student.massarCode ?? "",
      lastName: student.lastName,
      firstName: student.firstName,
      lastNameAr: student.lastNameAr ?? "",
      firstNameAr: student.firstNameAr ?? "",
      // The single-letter form the importer and MASSAR both read.
      gender: student.gender === "FEMALE" ? "F" : "M",
      // ISO, not the local format: it is unambiguous, it sorts, and
      // `parseImportDate` recognises it on the way back in.
      birthDate: student.birthDate.toISOString().slice(0, 10),
      nationality: student.nationality,
      neighbourhood: student.neighbourhood?.name ?? "",
      familyName: student.family?.name ?? "",
      familyPhone: student.family?.phone ?? "",
      familyEmail: student.family?.email ?? "",
      addressLine: student.family?.addressLine ?? "",
      city: student.family?.city ?? "",
      fatherLastName: father?.lastName ?? "",
      fatherFirstName: father?.firstName ?? "",
      fatherNationalId: father?.nationalId ?? "",
      fatherPhone: father?.phone ?? "",
      fatherProfession: father?.profession ?? "",
      motherLastName: mother?.lastName ?? "",
      motherFirstName: mother?.firstName ?? "",
      motherNationalId: mother?.nationalId ?? "",
      motherPhone: mother?.phone ?? "",
      motherProfession: mother?.profession ?? "",

      levelCode: enrolment?.levelOffering.level.code ?? "",
      trackCode: enrolment?.levelOffering.track?.code ?? "",
      className: enrolment?.schoolClass?.code ?? "",
      enrolledOn: enrolment?.enrolledOn.toISOString().slice(0, 10) ?? "",
      isRepeating: enrolment ? yesNo(enrolment.isRepeating) : "",
      usesTransport: enrolment ? yesNo(takes(enrolment, "TRANSPORT")) : "",
      routeName: subscription?.route.name ?? "",
      stopName: subscription?.stop.name ?? "",
      usesCanteen: enrolment ? yesNo(takes(enrolment, "CANTEEN")) : "",
    };

    return IMPORT_COLUMNS.map((column) => cells[column.key] ?? "");
  });

  return [header, ...body];
}

/**
 * Whether the family took the school's charge of this kind.
 *
 * The template has a Transport column and a Cantine column, so the export reads
 * the subscriptions back through `FeeType.kind` — the same key the services
 * report uses, and what the kind is for. A club the school sells has no column
 * in the template and so does not appear; widening the template is a separate
 * decision from where the data lives.
 */
function takes(
  enrolment: { options: { feeType: { kind: string } }[] },
  kind: string,
): boolean {
  return enrolment.options.some((option) => option.feeType.kind === kind);
}
