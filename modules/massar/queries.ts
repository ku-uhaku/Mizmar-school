import "server-only";

import type { AuthContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentSchoolId, currentSchoolYearId } from "@/lib/scope";
import { readSheet, readWorkbook } from "@/lib/xlsx";
import {
  runChecks,
  type MassarCheckId,
  type MassarDbContext,
  type MassarReport,
  type RosterPupil,
} from "@/modules/massar/checks";
import {
  NotesFileShapeError,
  parseNotesFile,
  type MassarNotesFile,
} from "@/modules/massar/notes-file";

/**
 * Reading a MASSAR workbook and working out what, if anything, it is about.
 *
 * Everything here is scoped from the `AuthContext` and never from the file. The
 * establishment code in the workbook is *compared* with the school in context —
 * it is never used to choose one, because a code in an uploaded file is an id
 * from the request, and picking a school with it would let anybody holding a
 * spreadsheet read another tenant's class list. The same goes for the class: it
 * is looked up inside the school and year already in context, and a file about
 * some other school simply fails `SCHOOL_CODE`.
 */

/** The sheet MASSAR names its mark sheet. Matched loosely — see `pickSheet`. */
const NOTES_SHEET_HINT = "notes";

export type MassarFileRead =
  | { ok: true; file: MassarNotesFile }
  | { ok: false; reason: "NOT_XLSX" | "NO_SHEET" | "NO_MARKERS" | "NO_PUPILS" };

/**
 * The mark sheet, out of however many sheets the workbook carries.
 *
 * MASSAR's own is called `NotesCC`, but a school that opened the file on a phone
 * and saved it back can end up with a localised copy, so the visible sheet whose
 * name looks like the mark sheet is preferred and the first visible sheet is the
 * fallback. The hidden `Data` sheet is never it: it holds the absence dropdown.
 */
function pickSheet(names: { name: string; hidden: boolean }[]): string | null {
  const visible = names.filter((sheet) => !sheet.hidden);
  const named = visible.find((sheet) => sheet.name.toLowerCase().includes(NOTES_SHEET_HINT));
  return named?.name ?? visible[0]?.name ?? null;
}

export function readNotesFile(buffer: Buffer): MassarFileRead {
  let workbook;
  try {
    workbook = readWorkbook(buffer);
  } catch {
    // A .xls, a CSV renamed, a truncated upload — all the same to the school.
    return { ok: false, reason: "NOT_XLSX" };
  }

  const sheetName = pickSheet(workbook.sheets);
  if (sheetName === null) return { ok: false, reason: "NO_SHEET" };

  try {
    return { ok: true, file: parseNotesFile(sheetName, readSheet(workbook, sheetName)) };
  } catch (error) {
    if (error instanceof NotesFileShapeError) return { ok: false, reason: error.reason };
    throw error;
  }
}

/**
 * Everything the school holds that bears on this file.
 *
 * The class is the anchor: it is the one thing MASSAR names that this app also
 * names, and level, programme and roster all hang off it. Matched on
 * `massarCode` first and on the school's own `code` second, because a school
 * that has not been mapped yet still very often calls the class exactly what
 * MASSAR calls it.
 */
export async function loadMassarContext(
  context: AuthContext,
  file: MassarNotesFile,
  options: { assessmentTypeId?: string | null } = {},
): Promise<MassarDbContext> {
  const schoolId = currentSchoolId(context);
  const schoolYearId = currentSchoolYearId(context);

  const school = {
    id: schoolId,
    name: context.currentSchool?.name ?? "",
    massarCode: context.currentSchool?.massarCode ?? null,
  };
  const schoolYear = context.currentSchoolYear
    ? { id: context.currentSchoolYear.id, name: context.currentSchoolYear.name }
    : null;

  const classLabel = file.classLabel?.trim() ?? "";
  const schoolClass =
    classLabel === ""
      ? null
      : await db.schoolClass.findFirst({
          where: {
            schoolId,
            levelOffering: { schoolYearId },
            OR: [{ massarCode: classLabel }, { code: classLabel }],
          },
          select: {
            id: true,
            code: true,
            name: true,
            massarCode: true,
            mainTeacher: { select: { profile: { select: { firstName: true, lastName: true } } } },
            levelOffering: {
              select: {
                level: {
                  select: { id: true, code: true, name: true, nameAr: true, massarCode: true },
                },
              },
            },
          },
        });

  // The subject is matched on the ministry's key, never on the Arabic label: two
  // schools spell الرياضيات the same and code it differently, and the label is
  // what a human reads while the code is what the file is filed under.
  const subjectCode = file.subjectCode?.trim() ?? "";
  const subject =
    subjectCode === ""
      ? null
      : await db.subject.findFirst({
          where: { schoolId, massarCode: subjectCode },
          select: { id: true, code: true, name: true, nameAr: true, massarCode: true },
        });

  const term =
    file.termNumber === null
      ? null
      : await db.term.findFirst({
          where: { schoolYearId, number: file.termNumber },
          select: { id: true, number: true, name: true, massarCode: true },
        });

  // The contrôle is looked for by MASSAR's own id first — that is what makes a
  // second import of the same sheet update rather than duplicate — and by the
  // cohort second, which is how the *first* import finds a paper the school had
  // already planned.
  const assessment =
    schoolClass === null
      ? null
      : await db.assessment.findFirst({
          where: {
            schoolId,
            OR: [
              ...(file.exportId ? [{ massarCode: file.exportId }] : []),
              ...(subject && term && file.sequence !== null
                ? [
                    {
                      schoolClassId: schoolClass.id,
                      subjectId: subject.id,
                      termId: term.id,
                      sequence: file.sequence,
                      ...(options.assessmentTypeId
                        ? { assessmentTypeId: options.assessmentTypeId }
                        : {}),
                    },
                  ]
                : []),
            ],
          },
          select: { id: true, title: true, maxScore: true, massarCode: true, status: true },
          // A paper already carrying the ministry's id is the better match when
          // both clauses hit.
          orderBy: { massarCode: "desc" },
        });

  const roster: RosterPupil[] =
    schoolClass === null
      ? []
      : (
          await db.enrollment.findMany({
            where: {
              schoolYearId,
              schoolClassId: schoolClass.id,
              status: "ACTIVE",
              student: { schoolId },
            },
            select: {
              id: true,
              student: {
                select: {
                  id: true,
                  massarCode: true,
                  massarNumber: true,
                  firstName: true,
                  lastName: true,
                  firstNameAr: true,
                  lastNameAr: true,
                  birthDate: true,
                },
              },
            },
          })
        ).map((enrollment) => ({
          enrollmentId: enrollment.id,
          studentId: enrollment.student.id,
          massarCode: enrollment.student.massarCode,
          massarNumber: enrollment.student.massarNumber,
          firstName: enrollment.student.firstName,
          lastName: enrollment.student.lastName,
          firstNameAr: enrollment.student.firstNameAr,
          lastNameAr: enrollment.student.lastNameAr,
          birthDate: enrollment.student.birthDate,
        }));

  // Only the identifiers the file actually names, so this stays one small
  // lookup rather than a read of the whole school — and so a file can never be
  // used to enumerate a roster it has no business seeing.
  const fileCodes = file.pupils.map((pupil) => pupil.massarCode).filter((code) => code !== "");
  const fileNumbers = file.pupils
    .map((pupil) => pupil.massarNumber)
    .filter((number) => number !== "");
  const seated = new Set(roster.map((pupil) => pupil.studentId));

  const elsewhere = (
    fileCodes.length === 0 && fileNumbers.length === 0
      ? []
      : await db.student.findMany({
          where: {
            schoolId,
            OR: [{ massarCode: { in: fileCodes } }, { massarNumber: { in: fileNumbers } }],
          },
          select: {
            id: true,
            massarCode: true,
            massarNumber: true,
            firstName: true,
            lastName: true,
            firstNameAr: true,
            lastNameAr: true,
            enrollments: {
              where: { schoolYearId },
              select: { schoolClass: { select: { code: true } } },
              take: 1,
            },
          },
        })
  )
    .filter((student) => !seated.has(student.id))
    .map((student) => ({
      massarCode: student.massarCode,
      massarNumber: student.massarNumber,
      displayName:
        [student.lastNameAr, student.firstNameAr].filter(Boolean).join(" ").trim() ||
        `${student.lastName} ${student.firstName}`.trim(),
      className: student.enrollments[0]?.schoolClass?.code ?? null,
    }));

  const teacher = schoolClass?.mainTeacher?.profile;

  return {
    school,
    schoolYear,
    level: schoolClass?.levelOffering.level ?? null,
    schoolClass: schoolClass
      ? {
          id: schoolClass.id,
          code: schoolClass.code,
          name: schoolClass.name,
          massarCode: schoolClass.massarCode,
        }
      : null,
    subject,
    term,
    assessment,
    teacherName: teacher ? `${teacher.lastName} ${teacher.firstName}`.trim() : null,
    roster,
    elsewhere,
  };
}

export type MassarReconciliation = {
  file: MassarNotesFile;
  db: MassarDbContext;
  report: MassarReport;
};

/**
 * Read a workbook, resolve it, and check it — the one function both the preview
 * screen and every writer start from.
 *
 * The browser never sends the verdict back. `service.ts` re-runs this on the
 * bytes it was given and acts only on its own report, exactly as the pupil
 * importer re-plans its file: a posted "everything matched" would otherwise be
 * a way to skip the scoping and write marks into another class.
 */
export async function reconcileNotesFile(
  context: AuthContext,
  buffer: Buffer,
  options: { assessmentTypeId?: string | null } = {},
): Promise<MassarReconciliation | { error: MassarFileRead }> {
  const read = readNotesFile(buffer);
  if (!read.ok) return { error: read };

  const dbContext = await loadMassarContext(context, read.file, options);
  return { file: read.file, db: dbContext, report: runChecks(read.file, dbContext) };
}

/**
 * What the reconciliation screen is given.
 *
 * Shaped here rather than in the component so the preview and the writers can
 * never disagree about what a row said. The roster is deliberately *not* in it:
 * the browser has no use for two hundred children's birth dates, and a preview
 * that carried them would be a class list handed to anyone who can upload a
 * spreadsheet.
 */
export type MassarPreview = {
  header: MassarReport["header"];
  rows: MassarReport["rows"];
  blocking: MassarReport["blocking"];
  canProceed: boolean;
  /** One line per matched pupil, in sheet order. */
  matched: {
    line: number;
    sheetRow: number;
    massarCode: string;
    displayName: string;
    score: number | null;
    isAbsent: boolean;
    comment: string | null;
    /** The school holds no MASSAR number for this child; the file supplies one. */
    adoptsNumber: boolean;
  }[];
  missingFromFile: MassarReport["missingFromFile"];
  /** What the file says it is about, for the summary panel. */
  file: {
    sheetName: string;
    schoolCode: string | null;
    classLabel: string | null;
    levelLabel: string | null;
    subjectLabel: string | null;
    subjectCode: string | null;
    termLabel: string | null;
    termNumber: number | null;
    assessmentLabel: string | null;
    sequence: number | null;
    teacherLabel: string | null;
    schoolYearLabel: string | null;
    maxScore: number | null;
    exportId: string | null;
    unmappedKeys: readonly string[];
    pupilCount: number;
  };
  /** What the school resolved it to. */
  resolved: {
    className: string | null;
    levelName: string | null;
    subjectName: string | null;
    termName: string | null;
    assessmentId: string | null;
    assessmentTitle: string | null;
    assessmentMaxScore: number | null;
    rosterSize: number;
  };
  /** Fields the file could fill in that the school holds nothing for. */
  adoptable: MassarCheckId[];
};

export function toMassarPreview({ file, db: held, report }: MassarReconciliation): MassarPreview {
  return {
    header: report.header,
    rows: report.rows,
    blocking: report.blocking,
    canProceed: report.canProceed,
    matched: report.matched.map((row) => ({
      line: row.line,
      sheetRow: row.sheetRow,
      massarCode: row.massarCode,
      displayName: row.displayName,
      score: row.score,
      isAbsent: row.isAbsent,
      comment: row.comment,
      adoptsNumber: row.adoptMassarNumber !== null,
    })),
    missingFromFile: report.missingFromFile,
    file: {
      sheetName: file.sheetName,
      schoolCode: file.schoolCode,
      classLabel: file.classLabel,
      levelLabel: file.levelLabel,
      subjectLabel: file.subjectLabel,
      subjectCode: file.subjectCode,
      termLabel: file.termLabel,
      termNumber: file.termNumber,
      assessmentLabel: file.assessmentLabel,
      sequence: file.sequence,
      teacherLabel: file.teacherLabel,
      schoolYearLabel: file.schoolYearLabel,
      maxScore: file.maxScore,
      exportId: file.exportId,
      unmappedKeys: file.unmappedKeys,
      pupilCount: file.pupils.length,
    },
    resolved: {
      className: held.schoolClass?.code ?? null,
      levelName: held.level?.nameAr ?? held.level?.name ?? null,
      subjectName: held.subject?.nameAr ?? held.subject?.name ?? null,
      termName: held.term?.name ?? null,
      assessmentId: held.assessment?.id ?? null,
      assessmentTitle: held.assessment?.title ?? null,
      assessmentMaxScore: held.assessment?.maxScore ?? null,
      rosterSize: held.roster.length,
    },
    adoptable: report.header
      .filter((check) => check.severity === "ADOPTABLE")
      .map((check) => check.id),
  };
}

/** The assessment kinds a MASSAR sheet may be filed as, for the picker. */
export async function listMassarAssessmentTypes(
  context: AuthContext,
): Promise<{ id: string; code: string; name: string; maxScore: number }[]> {
  const types = await db.assessmentType.findMany({
    where: { schoolId: currentSchoolId(context), isActive: true },
    select: { id: true, code: true, name: true, defaultMaxScore: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return types.map((type) => ({
    id: type.id,
    code: type.code,
    name: type.name,
    maxScore: type.defaultMaxScore,
  }));
}
