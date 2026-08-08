import { normaliseArabic, type MassarNotesFile, type MassarPupilRow } from "@/modules/massar/notes-file";

/**
 * Reconciling a MASSAR mark sheet against what the school already holds.
 *
 * Pure and isomorphic: the reconciliation screen renders exactly the report the
 * writer acted on, so what a director approved is what was saved.
 *
 * ── Every failure has a name ────────────────────────────────────────────────
 * A reconciliation that says "the file does not match" is useless — the school
 * has one file, twenty-six children and no idea which cell to look at. So every
 * comparison is a named check with a stable id, and each failure carries what
 * was expected, what was found, and the cell it was found in. `SCHOOL_CODE` and
 * `PUPIL_BIRTH_DATE` mean the same thing next term as they do today, which is
 * what makes them worth putting in a support ticket.
 *
 * ── Strict on the header, forgiving on the rows ─────────────────────────────
 * The header is what the marks *are*: get the class or the term wrong and the
 * whole sheet is filed against the wrong cohort, so any header failure stops
 * everything. A pupil row is one child — an unmapped transfer-in should not hold
 * up the twenty-five marks either side of it, so a bad row is rejected on its
 * own and named in the report.
 *
 * ── ADOPTABLE is not a failure ──────────────────────────────────────────────
 * A school that has never been mapped to MASSAR has `massarCode` null on every
 * row, and comparing null to `53747V` is not a mismatch — it is the mapping not
 * having been done yet. Those come back as ADOPTABLE, which is what the "adopt
 * from the file" direction acts on. A *populated* field that disagrees is a real
 * ERROR: something is being confused for something else.
 */

// ── The catalogue ────────────────────────────────────────────────────────────

/**
 * Every check this module can report, in the order a reader should read them:
 * what the file is, then which cohort it belongs to, then the marks themselves.
 * Ids are the user-facing name of a failure — renaming one is a breaking change
 * to every screenshot a school has filed.
 */
export const MASSAR_CHECKS = [
  // What the file is.
  "FILE_SHAPE",
  "SCHOOL_CODE",
  "SCHOOL_YEAR",
  // Which cohort it is about.
  "LEVEL",
  "CLASS",
  "SUBJECT",
  "TERM",
  "SEQUENCE",
  // What the marks mean.
  "MAX_SCORE",
  "TEACHER",
  "ASSESSMENT_EXISTS",
  "ASSESSMENT_IDENTITY",
  // The class list.
  "ROSTER_SIZE",
  "PUPIL_DUPLICATE",
  "PUPIL_UNKNOWN",
  "PUPIL_NOT_IN_CLASS",
  "PUPIL_NUMBER",
  "PUPIL_NAME",
  "PUPIL_BIRTH_DATE",
  "PUPIL_MISSING_FROM_FILE",
  // The marks.
  "SCORE_RANGE",
  "SCORE_MISSING",
] as const;

export type MassarCheckId = (typeof MASSAR_CHECKS)[number];

/**
 *   OK         nothing to say
 *   ADOPTABLE  the school holds nothing here; the file can fill it in
 *   WARNING    a difference that does not make the marks wrong
 *   ERROR      the marks would be filed against the wrong thing
 */
export type CheckSeverity = "OK" | "ADOPTABLE" | "WARNING" | "ERROR";

export type HeaderCheck = {
  id: MassarCheckId;
  severity: CheckSeverity;
  /** What the school holds. */
  expected: string | null;
  /** What the file says. */
  found: string | null;
};

export type RowIssue = {
  id: MassarCheckId;
  severity: CheckSeverity;
  line: number;
  /** The worksheet row, so the report can name a cell rather than a position. */
  sheetRow: number;
  massarCode: string;
  expected: string | null;
  found: string | null;
};

/** A file row that resolved to a child the school has in this class. */
export type MatchedRow = {
  line: number;
  sheetRow: number;
  enrollmentId: string;
  studentId: string;
  massarCode: string;
  /** Set when the school holds no number for this pupil and the file supplies one. */
  adoptMassarNumber: string | null;
  displayName: string;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  comment: string | null;
};

export type RosterPupil = {
  enrollmentId: string;
  studentId: string;
  massarCode: string | null;
  massarNumber: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  birthDate: Date;
};

/** What the school holds, as far as this file is concerned. */
export type MassarDbContext = {
  school: { id: string; name: string; massarCode: string | null };
  schoolYear: { id: string; name: string } | null;
  level: { id: string; code: string; name: string; nameAr: string | null; massarCode: string | null } | null;
  schoolClass: { id: string; code: string; name: string | null; massarCode: string | null } | null;
  subject: { id: string; code: string; name: string; nameAr: string | null; massarCode: string | null } | null;
  term: { id: string; number: number; name: string; massarCode: string | null } | null;
  /** The contrôle this sheet is about, when one already exists. */
  assessment: { id: string; title: string; maxScore: number; massarCode: string | null; status: string } | null;
  teacherName: string | null;
  roster: readonly RosterPupil[];
  /**
   * Children the file names who are on this school's books but seated somewhere
   * else this year.
   *
   * Without it every one of them reads as `PUPIL_UNKNOWN`, which sends a
   * secretary looking for a pupil who is not missing at all — they are in 2APG-2
   * and the file is for 2APG-1. Naming the class they are actually in turns a
   * dead end into the answer.
   */
  elsewhere: readonly {
    massarCode: string | null;
    massarNumber: string | null;
    displayName: string;
    className: string | null;
  }[];
};

export type MassarReport = {
  header: readonly HeaderCheck[];
  rows: readonly RowIssue[];
  matched: readonly MatchedRow[];
  /** Enrolled children the file does not mention. */
  missingFromFile: readonly { studentId: string; massarCode: string | null; displayName: string }[];
  /** Header checks that failed. Non-empty means nothing may be written. */
  blocking: readonly MassarCheckId[];
  /** Rows rejected on their own, keyed by line. */
  rejectedLines: readonly number[];
  canProceed: boolean;
};

// ── Comparison helpers ───────────────────────────────────────────────────────

/**
 * Compares a value the file carries with the one the school holds.
 *
 * Null on our side is "not mapped yet", which is the ordinary state of a school
 * that has just installed this — it is an invitation to adopt, never a mismatch.
 */
function compare(id: MassarCheckId, held: string | null, found: string | null): HeaderCheck {
  const left = held?.trim() ?? "";
  const right = found?.trim() ?? "";
  if (right === "") return { id, severity: "OK", expected: held, found };
  if (left === "") return { id, severity: "ADOPTABLE", expected: null, found };
  return {
    id,
    severity: left.toUpperCase() === right.toUpperCase() ? "OK" : "ERROR",
    expected: held,
    found,
  };
}

/** MASSAR writes a class list family-name-first; the app stores the halves apart. */
function namesAgree(row: MassarPupilRow, pupil: RosterPupil): boolean {
  const fromFile = normaliseArabic(row.fullNameAr);
  if (fromFile === "") return true;

  const first = normaliseArabic(pupil.firstNameAr ?? "");
  const last = normaliseArabic(pupil.lastNameAr ?? "");
  // No Arabic spelling on file to compare against — the Latin one is a
  // transliteration and comparing it to Arabic would fail every row.
  if (first === "" && last === "") return true;

  const collapse = (value: string) => value.replace(/\s+/g, "");
  return (
    collapse(fromFile) === collapse(`${last} ${first}`) ||
    collapse(fromFile) === collapse(`${first} ${last}`)
  );
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function displayNameOf(pupil: RosterPupil): string {
  const arabic = [pupil.lastNameAr, pupil.firstNameAr].filter(Boolean).join(" ").trim();
  return arabic !== "" ? arabic : `${pupil.lastName} ${pupil.firstName}`.trim();
}

/** The school year as MASSAR writes it: `2022/2023`, from whatever we call it. */
function yearsAgree(held: string, found: string): boolean {
  const digits = (value: string) => value.match(/\d{4}/g)?.join("/") ?? "";
  return digits(held) === digits(found) && digits(held) !== "";
}

// ── The reconciliation ───────────────────────────────────────────────────────

export function runChecks(file: MassarNotesFile, db: MassarDbContext): MassarReport {
  const header: HeaderCheck[] = [];

  header.push({ id: "FILE_SHAPE", severity: "OK", expected: null, found: file.sheetName });
  header.push(compare("SCHOOL_CODE", db.school.massarCode, file.schoolCode));

  // The year is compared on its four-digit halves: a school calls it "2022-2023"
  // or "Année 2022/2023" and MASSAR always writes it one way.
  if (db.schoolYear === null) {
    header.push({ id: "SCHOOL_YEAR", severity: "ERROR", expected: null, found: file.schoolYearLabel });
  } else if (file.schoolYearLabel === null) {
    header.push({ id: "SCHOOL_YEAR", severity: "OK", expected: db.schoolYear.name, found: null });
  } else {
    header.push({
      id: "SCHOOL_YEAR",
      severity: yearsAgree(db.schoolYear.name, file.schoolYearLabel) ? "OK" : "ERROR",
      expected: db.schoolYear.name,
      found: file.schoolYearLabel,
    });
  }

  // The level is reached *through* the class, not looked up from the file, so
  // there is nothing to disagree about once the class resolved — what is worth
  // reporting is the label MASSAR printed beside the level we landed on.
  header.push({
    id: "LEVEL",
    severity: db.level === null ? "ERROR" : "OK",
    expected: db.level === null ? null : (db.level.nameAr ?? db.level.name),
    found: file.levelLabel,
  });

  if (db.schoolClass === null) {
    header.push({ id: "CLASS", severity: "ERROR", expected: null, found: file.classLabel });
  } else {
    // MASSAR's class code is what the file names; ours may be the same string
    // already, which is why the school's own `code` is the fallback to compare.
    const held = db.schoolClass.massarCode ?? null;
    const check = compare("CLASS", held, file.classLabel);
    header.push(
      check.severity === "ADOPTABLE" &&
        file.classLabel !== null &&
        db.schoolClass.code.toUpperCase() === file.classLabel.toUpperCase()
        ? { id: "CLASS", severity: "OK", expected: db.schoolClass.code, found: file.classLabel }
        : check,
    );
  }

  if (db.subject === null) {
    header.push({ id: "SUBJECT", severity: "ERROR", expected: null, found: file.subjectLabel });
  } else {
    header.push(compare("SUBJECT", db.subject.massarCode, file.subjectCode));
  }

  if (db.term === null) {
    header.push({ id: "TERM", severity: "ERROR", expected: null, found: String(file.termNumber ?? "") });
  } else {
    header.push({
      id: "TERM",
      severity:
        file.termNumber === null || db.term.number === file.termNumber ? "OK" : "ERROR",
      expected: String(db.term.number),
      found: file.termNumber === null ? null : String(file.termNumber),
    });
  }

  header.push({
    id: "SEQUENCE",
    severity: file.sequence === null ? "WARNING" : "OK",
    expected: null,
    found: file.sequence === null ? null : String(file.sequence),
  });

  /*
    The scale is the one header difference that would silently corrupt marks
    rather than misfile them: 8/10 written raw into a paper marked out of 20 is a
    fail recorded as a pass, and nothing downstream could tell.

    It is still not a reason to refuse the file. MASSAR marks a contrôle continu
    in the primaire out of 10 while a school's own paper is out of 20, and that
    disagreement is the normal case, not a mistake — blocking on it would leave
    the school with a correct file it can never import and no way to proceed. So
    the marks are converted on the way in, against the two scales the report
    shows side by side, and this stays a WARNING: visible, deliberate, and
    written down. A newly generated paper takes the file's scale instead, so the
    conversion only ever arises for a contrôle the school had already planned.
  */
  const maxScore = file.maxScore;
  header.push({
    id: "MAX_SCORE",
    severity:
      maxScore === null
        ? "WARNING"
        : db.assessment === null || db.assessment.maxScore === maxScore
          ? "OK"
          : "WARNING",
    expected: db.assessment === null ? null : String(db.assessment.maxScore),
    found: maxScore === null ? null : String(maxScore),
  });

  // The teacher named on the sheet is worth showing and not worth blocking on:
  // MASSAR prints whoever it holds, and a mid-year replacement is normal.
  header.push({
    id: "TEACHER",
    severity:
      db.teacherName === null || file.teacherLabel === null
        ? "OK"
        : normaliseArabic(db.teacherName).replace(/\s+/g, "") ===
            normaliseArabic(file.teacherLabel).replace(/\s+/g, "")
          ? "OK"
          : "WARNING",
    expected: db.teacherName,
    found: file.teacherLabel,
  });

  header.push({
    id: "ASSESSMENT_EXISTS",
    severity: db.assessment === null ? "ADOPTABLE" : "OK",
    expected: db.assessment?.title ?? null,
    found: file.assessmentLabel,
  });

  // Once a contrôle carries a MASSAR id, a *different* id on the file means this
  // is a second sheet claiming the same paper — the one case where re-importing
  // would overwrite marks that came from somewhere else.
  header.push({
    id: "ASSESSMENT_IDENTITY",
    severity:
      db.assessment === null || db.assessment.massarCode === null
        ? "ADOPTABLE"
        : db.assessment.massarCode === file.exportId
          ? "OK"
          : "ERROR",
    expected: db.assessment?.massarCode ?? null,
    found: file.exportId,
  });

  // ── The class list ────────────────────────────────────────────────────────
  const byCode = new Map<string, RosterPupil>();
  const byNumber = new Map<string, RosterPupil>();
  for (const pupil of db.roster) {
    if (pupil.massarCode) byCode.set(pupil.massarCode.toUpperCase(), pupil);
    if (pupil.massarNumber) byNumber.set(pupil.massarNumber, pupil);
  }

  const rows: RowIssue[] = [];
  const matched: MatchedRow[] = [];
  const rejected = new Set<number>();
  const seen = new Map<string, number>();
  const claimed = new Set<string>();
  /** Which line first resolved to each child — see the duplicate check below. */
  const claimedBy = new Map<string, number>();

  const reject = (issue: RowIssue) => {
    rows.push(issue);
    rejected.add(issue.line);
  };

  for (const row of file.pupils) {
    const first = seen.get(row.massarCode);
    if (first !== undefined) {
      reject({
        id: "PUPIL_DUPLICATE",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: `line ${first}`,
        found: `line ${row.line}`,
      });
      continue;
    }
    seen.set(row.massarCode, row.line);

    // Matched on the printed code first, then on MASSAR's internal number —
    // a school part-way through mapping has some of each, and either identifies
    // the child unambiguously.
    const pupil =
      byCode.get(row.massarCode) ??
      (row.massarNumber !== "" ? byNumber.get(row.massarNumber) : undefined);

    if (!pupil) {
      const seatedElsewhere = db.elsewhere.find(
        (candidate) =>
          candidate.massarCode?.toUpperCase() === row.massarCode ||
          (row.massarNumber !== "" && candidate.massarNumber === row.massarNumber),
      );
      reject(
        seatedElsewhere
          ? {
              id: "PUPIL_NOT_IN_CLASS",
              severity: "ERROR",
              line: row.line,
              sheetRow: row.sheetRow,
              massarCode: row.massarCode,
              expected: seatedElsewhere.className,
              found: seatedElsewhere.displayName,
            }
          : {
              id: "PUPIL_UNKNOWN",
              severity: "ERROR",
              line: row.line,
              sheetRow: row.sheetRow,
              massarCode: row.massarCode,
              expected: null,
              found: row.fullNameAr,
            },
      );
      continue;
    }

    /*
      Two file rows that resolve to the same child.

      The duplicate check above is on the printed code, which catches the same
      code written twice. It cannot catch this: a row matched on its code and a
      later row matched on MASSAR's internal *number* can land on one pupil
      while carrying two different codes, so nothing above fires. Both rows then
      reached `matched`, `saveMarks` upserted on (assessment, enrolment) twice,
      and the second silently overwrote the first — one child ending up with
      whichever mark happened to be lower down the sheet, and no report saying
      so.

      Named against the line that got there first, exactly as PUPIL_DUPLICATE
      does, because that is the pair of rows somebody has to go and look at.
    */
    const claimedOn = claimedBy.get(pupil.studentId);
    if (claimedOn !== undefined) {
      reject({
        id: "PUPIL_DUPLICATE",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: `line ${claimedOn}`,
        found: `line ${row.line}`,
      });
      continue;
    }
    claimed.add(pupil.studentId);
    claimedBy.set(pupil.studentId, row.line);

    // A number already held that disagrees is not a mapping to fill in — it is
    // two different children being confused, and writing marks on that basis is
    // the worst thing this importer could do.
    if (
      row.massarNumber !== "" &&
      pupil.massarNumber !== null &&
      pupil.massarNumber !== row.massarNumber
    ) {
      reject({
        id: "PUPIL_NUMBER",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: pupil.massarNumber,
        found: row.massarNumber,
      });
      continue;
    }

    if (!namesAgree(row, pupil)) {
      reject({
        id: "PUPIL_NAME",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: displayNameOf(pupil),
        found: row.fullNameAr,
      });
      continue;
    }

    if (row.birthDate !== null && !sameDay(row.birthDate, pupil.birthDate)) {
      reject({
        id: "PUPIL_BIRTH_DATE",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: isoDay(pupil.birthDate),
        found: row.birthDateRaw,
      });
      continue;
    }

    const ceiling = maxScore ?? db.assessment?.maxScore ?? 20;
    if (row.score !== null && (row.score < 0 || row.score > ceiling)) {
      reject({
        id: "SCORE_RANGE",
        severity: "ERROR",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: `0–${ceiling}`,
        found: row.scoreRaw,
      });
      continue;
    }

    // Not an error: a sheet downloaded to be filled in here has no marks at all,
    // which is the whole point of the DB → Excel direction.
    if (row.score === null && !row.isAbsent) {
      rows.push({
        id: "SCORE_MISSING",
        severity: "WARNING",
        line: row.line,
        sheetRow: row.sheetRow,
        massarCode: row.massarCode,
        expected: null,
        found: null,
      });
    }

    matched.push({
      line: row.line,
      sheetRow: row.sheetRow,
      enrollmentId: pupil.enrollmentId,
      studentId: pupil.studentId,
      massarCode: row.massarCode,
      adoptMassarNumber:
        pupil.massarNumber === null && row.massarNumber !== "" ? row.massarNumber : null,
      displayName: displayNameOf(pupil),
      score: row.score,
      isAbsent: row.isAbsent,
      isExcused: row.isExcused,
      comment: row.comment,
    });
  }

  const missingFromFile = db.roster
    .filter((pupil) => !claimed.has(pupil.studentId))
    .map((pupil) => ({
      studentId: pupil.studentId,
      massarCode: pupil.massarCode,
      displayName: displayNameOf(pupil),
    }));

  // The count is reported rather than enforced. A class genuinely gains and
  // loses children mid-term, and a sheet exported last week is allowed to be one
  // pupil short of today's roster — the per-row checks already say which.
  header.push({
    id: "ROSTER_SIZE",
    severity: missingFromFile.length === 0 ? "OK" : "WARNING",
    expected: String(db.roster.length),
    found: String(file.pupils.length),
  });

  for (const pupil of missingFromFile) {
    rows.push({
      id: "PUPIL_MISSING_FROM_FILE",
      severity: "WARNING",
      line: 0,
      sheetRow: 0,
      massarCode: pupil.massarCode ?? "",
      expected: pupil.displayName,
      found: null,
    });
  }

  const blocking = header.filter((check) => check.severity === "ERROR").map((check) => check.id);

  return {
    header,
    rows,
    matched,
    missingFromFile,
    blocking,
    rejectedLines: [...rejected],
    // Header clean and at least one child to write about. A file whose every row
    // was rejected is a failed import, not an import of nothing.
    canProceed: blocking.length === 0 && matched.length > 0,
  };
}
