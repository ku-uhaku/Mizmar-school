import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { yearScope, currentSchoolId } from "@/lib/scope";
import { readSheet, readWorkbook } from "@/lib/xlsx";
import { buildWorkbook } from "@/lib/xlsx-build";
import { LIVE_ENROLMENT_STATUSES } from "@/modules/enrolment/enums";
import {
  parseRosterCells,
  rosterSheetRows,
  yearDigits,
  type RosterFile,
  type RosterFileRead,
} from "@/modules/massar/roster-file";

/**
 * The ListEleve round trip's two server halves: the workbook → a `RosterFile`,
 * and a class → a workbook.
 */

export type RosterRead =
  | { ok: true; file: RosterFile }
  | { ok: false; reason: "NOT_XLSX" | "NO_SHEET" | "NO_HEADER" | "NO_PUPILS" };

/**
 * The class list, out of however many sheets the workbook carries.
 *
 * Every visible sheet is tried in order and the first that holds a pupil table
 * wins: MASSAR names its sheets differently from one export to the next, and a
 * school that saved the file from a phone can end up with a renamed one.
 */
export function readRosterFile(buffer: Buffer): RosterRead {
  let workbook;
  try {
    workbook = readWorkbook(buffer);
  } catch {
    // A .xls, a CSV renamed, a truncated upload — all the same to the school.
    return { ok: false, reason: "NOT_XLSX" };
  }

  const visible = workbook.sheets.filter((sheet) => !sheet.hidden);
  if (visible.length === 0) return { ok: false, reason: "NO_SHEET" };

  let last: Extract<RosterFileRead, { ok: false }> = { ok: false, reason: "NO_HEADER" };
  for (const sheet of visible) {
    const result = parseRosterCells(readSheet(workbook, sheet.name), sheet.name);
    if (result.ok) return result;
    last = result;
  }
  return last;
}

/**
 * Whether the file is about the school year in context.
 *
 * A class list for last year imported into this one would enrol every child a
 * year late, so a disagreement stops the import; a file that names no year is
 * given the benefit of the doubt.
 */
export function yearMatches(file: RosterFile, currentYearName: string | null): boolean {
  if (!file.schoolYearLabel) return true;
  if (!currentYearName) return false;
  const wanted = yearDigits(file.schoolYearLabel);
  return wanted !== "" && wanted === yearDigits(currentYearName);
}

export type RosterClassOption = { id: string; label: string };

/** The classes of the year in context, for the export picker. */
export async function listRosterClasses(context: AuthContext): Promise<RosterClassOption[]> {
  const classes = await db.schoolClass.findMany({
    where: { schoolId: currentSchoolId(context), levelOffering: yearScope(context) },
    orderBy: [{ levelOffering: { level: { gradeYear: "asc" } } }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });
  return classes.map((schoolClass) => ({
    id: schoolClass.id,
    label: schoolClass.name ? `${schoolClass.code} — ${schoolClass.name}` : schoolClass.code,
  }));
}

export type RosterExport = { file: Buffer; filename: string; count: number };

/**
 * One class, as a ListEleve workbook.
 *
 * Read scoped by the school and the year in context, so an id from a request
 * that is not this school's class reaches nothing. Only pupils whose enrolment
 * is live are listed — a child who withdrew in October is not on the list MASSAR
 * would print in March.
 *
 * The class label is MASSAR's own when the class has been mapped and the school's
 * code otherwise, which is also what makes the file importable back: the
 * importer finds the class by either.
 */
export async function exportRoster(
  context: AuthContext,
  schoolClassId: string,
): Promise<RosterExport | null> {
  const schoolClass = await db.schoolClass.findFirst({
    where: {
      id: schoolClassId,
      schoolId: currentSchoolId(context),
      levelOffering: yearScope(context),
    },
    select: {
      code: true,
      massarCode: true,
      levelOffering: { select: { level: { select: { name: true, nameAr: true } } } },
      enrollments: {
        where: { status: { in: [...LIVE_ENROLMENT_STATUSES] } },
        select: {
          student: {
            select: {
              massarCode: true,
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
              gender: true,
              birthDate: true,
              birthCity: { select: { name: true, nameAr: true } },
            },
          },
        },
      },
    },
  });
  if (!schoolClass) return null;

  const pupils = schoolClass.enrollments
    .map((enrolment) => enrolment.student)
    // MASSAR orders a class list by code. A child with no code yet sorts last,
    // and among themselves by name, so the file is stable between downloads.
    .sort((left, right) => {
      const a = left.massarCode ?? "￿";
      const b = right.massarCode ?? "￿";
      return a === b
        ? `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`)
        : a.localeCompare(b);
    });

  const label = schoolClass.massarCode ?? schoolClass.code;
  const rows = rosterSheetRows({
    schoolName: context.currentSchool?.name ?? "",
    yearName: context.currentSchoolYear?.name ?? "",
    levelName: schoolClass.levelOffering.level.nameAr ?? schoolClass.levelOffering.level.name,
    classLabel: label,
    pupils: pupils.map((pupil) => ({
      ...pupil,
      birthPlace: pupil.birthCity?.nameAr ?? pupil.birthCity?.name ?? null,
    })),
  });

  return {
    file: buildWorkbook("ListEleve", rows, {
      rightToLeft: true,
      widths: [6, 16, 18, 18, 8, 16, 18, 4],
    }),
    // Named after the class, because a school ends up with a folder of these.
    filename: `ListEleve-${label.replace(/[^\w.-]+/g, "_")}.xlsx`,
    count: pupils.length,
  };
}
