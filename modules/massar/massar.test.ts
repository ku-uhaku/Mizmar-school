import { describe, expect, it } from "vitest";

import { MASSAR_CHECKS, runChecks } from "@/modules/massar/checks";
import type {
  MassarDbContext,
  MassarCheckId,
  RosterPupil,
} from "@/modules/massar/checks";
import { normaliseArabic } from "@/modules/massar/notes-file";
import type {
  MassarNotesFile,
  MassarPupilRow,
} from "@/modules/massar/notes-file";

/**
 * Reconciling a MASSAR mark sheet against what the school holds.
 *
 * This is the one importer whose mistakes leave the building: marks filed here
 * go back to the ministry under a child's name. So the module's own rule is
 * that **the worst thing it could do is write marks on the basis of two
 * children being confused**, and every check below exists to make that
 * impossible rather than unlikely.
 *
 * Three shapes carry it:
 *
 *   * **strict on the header, forgiving on the rows.** Get the class or the
 *     term wrong and the whole sheet is filed against the wrong cohort, so any
 *     header failure stops everything. A pupil row is one child — an unmapped
 *     transfer-in must not hold up the twenty-five marks either side of it.
 *   * **ADOPTABLE is not a failure.** A school that has never been mapped holds
 *     null everywhere, and comparing null to `53747V` is the mapping not having
 *     been done yet. A *populated* field that disagrees is a real error.
 *   * **every failure has a name.** "The file does not match" is useless to a
 *     school with one file, twenty-six children and no idea which cell to look
 *     at.
 */

// ─────────────────────────────────────────────────────────────────────────────

const pupilRow = (extra: Partial<MassarPupilRow> = {}): MassarPupilRow => ({
  line: 1,
  sheetRow: 12,
  massarNumber: "1001",
  massarCode: "R185066146",
  fullNameAr: "بنعلي أمين",
  birthDate: new Date(Date.UTC(2012, 8, 15)),
  birthDateRaw: "15/09/2012",
  score: 14,
  scoreRaw: "14",
  isAbsent: false,
  isExcused: false,
  comment: null,
  ...extra,
});

const notesFile = (extra: Partial<MassarNotesFile> = {}): MassarNotesFile =>
  ({
    sheetName: "NotesCC",
    schoolCode: "53747V",
    exportId: "EXP-1",
    termNumber: 1,
    sequence: 1,
    subjectCode: "0019",
    maxScore: 20,
    levelLabel: "الثالث ابتدائي",
    classLabel: "3AP-A",
    subjectLabel: "الرياضيات",
    teacherLabel: "بنيس كريم",
    assessmentLabel: "المراقبة المستمرة 1",
    schoolYearLabel: "2025/2026",
    pupils: [pupilRow()],
    ...extra,
  }) as MassarNotesFile;

const rosterPupil = (extra: Partial<RosterPupil> = {}): RosterPupil => ({
  enrollmentId: "enrol-1",
  studentId: "student-1",
  massarCode: "R185066146",
  massarNumber: "1001",
  firstName: "Amine",
  lastName: "Benali",
  firstNameAr: "أمين",
  lastNameAr: "بنعلي",
  birthDate: new Date(Date.UTC(2012, 8, 15)),
  ...extra,
});

const held = (extra: Partial<MassarDbContext> = {}): MassarDbContext => ({
  school: { id: "school-1", name: "Groupe Scolaire", massarCode: "53747V" },
  schoolYear: { id: "year-1", name: "2025-2026" },
  level: {
    id: "level-1",
    code: "3AP",
    name: "3e année",
    nameAr: "الثالث ابتدائي",
    massarCode: null,
  },
  schoolClass: {
    id: "class-1",
    code: "3AP-A",
    name: null,
    massarCode: "3AP-A",
  },
  subject: {
    id: "subject-1",
    code: "MATH",
    name: "Mathématiques",
    nameAr: "الرياضيات",
    massarCode: "0019",
  },
  term: { id: "term-1", number: 1, name: "Semestre 1", massarCode: null },
  assessment: {
    id: "paper-1",
    title: "Contrôle n°1",
    maxScore: 20,
    massarCode: "EXP-1",
    status: "PUBLISHED",
  },
  teacherName: "بنيس كريم",
  roster: [rosterPupil()],
  elsewhere: [],
  ...extra,
});

/** The severity a named check came back with. */
const severityOf = (
  report: ReturnType<typeof runChecks>,
  id: MassarCheckId,
) => report.header.find((check) => check.id === id)?.severity;

const issueIds = (report: ReturnType<typeof runChecks>) =>
  report.rows.map((row) => row.id);

// ── A file that matches ──────────────────────────────────────────────────────

describe("a sheet that matches", () => {
  it("passes every header check", () => {
    const report = runChecks(notesFile(), held());
    expect(report.blocking).toEqual([]);
    expect(report.canProceed).toBe(true);
  });

  it("matches the pupil and carries their mark through", () => {
    const report = runChecks(notesFile(), held());
    expect(report.matched).toHaveLength(1);
    expect(report.matched[0]).toMatchObject({
      enrollmentId: "enrol-1",
      studentId: "student-1",
      score: 14,
      isAbsent: false,
    });
  });

  it("reports every check it declares, once", () => {
    // The ids are the user-facing name of a failure — renaming one breaks every
    // screenshot a school has filed.
    const report = runChecks(notesFile(), held());
    const ids = report.header.map((check) => check.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(MASSAR_CHECKS, id).toContain(id);
  });

  it("rejects nothing", () => {
    const report = runChecks(notesFile(), held());
    expect(report.rejectedLines).toEqual([]);
    expect(report.missingFromFile).toEqual([]);
  });
});

// ── Strict on the header ─────────────────────────────────────────────────────

describe("the header", () => {
  it("blocks a file from another school", () => {
    // Get this wrong and a whole sheet is filed against another établissement.
    const report = runChecks(notesFile({ schoolCode: "99999X" }), held());
    expect(severityOf(report, "SCHOOL_CODE")).toBe("ERROR");
    expect(report.blocking).toContain("SCHOOL_CODE");
    expect(report.canProceed).toBe(false);
  });

  it("blocks a file from another year", () => {
    const report = runChecks(
      notesFile({ schoolYearLabel: "2024/2025" }),
      held(),
    );
    expect(severityOf(report, "SCHOOL_YEAR")).toBe("ERROR");
    expect(report.canProceed).toBe(false);
  });

  it("reads the year off its four-digit halves, however the school writes it", () => {
    // A school calls it "2025-2026" or "Année 2025/2026"; MASSAR always writes
    // it one way.
    for (const name of ["2025-2026", "Année 2025/2026", "2025 / 2026"]) {
      const report = runChecks(
        notesFile({ schoolYearLabel: "2025/2026" }),
        held({ schoolYear: { id: "year-1", name } }),
      );
      expect(severityOf(report, "SCHOOL_YEAR"), name).toBe("OK");
    }
  });

  it("blocks a file for another semester", () => {
    const report = runChecks(notesFile({ termNumber: 2 }), held());
    expect(severityOf(report, "TERM")).toBe("ERROR");
    expect(report.canProceed).toBe(false);
  });

  it("blocks when the class, the subject or the term could not be resolved", () => {
    for (const missing of ["schoolClass", "subject", "term", "level"] as const) {
      const report = runChecks(notesFile(), held({ [missing]: null }));
      expect(report.blocking.length, missing).toBeGreaterThan(0);
      expect(report.canProceed, missing).toBe(false);
    }
  });

  it("blocks a second sheet claiming a paper that already has an identity", () => {
    // The one case where re-importing would overwrite marks that came from
    // somewhere else.
    const report = runChecks(notesFile({ exportId: "EXP-2" }), held());
    expect(severityOf(report, "ASSESSMENT_IDENTITY")).toBe("ERROR");
    expect(report.canProceed).toBe(false);
  });

  it("adopts an identity onto a paper that has none", () => {
    const report = runChecks(
      notesFile(),
      held({
        assessment: {
          id: "paper-1",
          title: "Contrôle n°1",
          maxScore: 20,
          massarCode: null,
          status: "PUBLISHED",
        },
      }),
    );
    expect(severityOf(report, "ASSESSMENT_IDENTITY")).toBe("ADOPTABLE");
    expect(report.canProceed).toBe(true);
  });

  it("offers to create the paper when the school has none", () => {
    const report = runChecks(notesFile(), held({ assessment: null }));
    expect(severityOf(report, "ASSESSMENT_EXISTS")).toBe("ADOPTABLE");
    expect(report.canProceed).toBe(true);
  });
});

// ── ADOPTABLE is not a failure ───────────────────────────────────────────────

describe("a school that has never been mapped", () => {
  const unmapped = () =>
    held({
      school: { id: "school-1", name: "Groupe Scolaire", massarCode: null },
      subject: {
        id: "subject-1",
        code: "MATH",
        name: "Mathématiques",
        nameAr: "الرياضيات",
        massarCode: null,
      },
      schoolClass: { id: "class-1", code: "3AP-A", name: null, massarCode: null },
    });

  it("reads a blank field as an invitation to adopt, never a mismatch", () => {
    const report = runChecks(notesFile(), unmapped());
    expect(severityOf(report, "SCHOOL_CODE")).toBe("ADOPTABLE");
    expect(severityOf(report, "SUBJECT")).toBe("ADOPTABLE");
  });

  it("proceeds anyway, because nothing is being confused", () => {
    const report = runChecks(notesFile(), unmapped());
    expect(report.blocking).toEqual([]);
    expect(report.canProceed).toBe(true);
  });

  it("accepts an unmapped class whose own code already matches the file", () => {
    // The school's `code` is the fallback to compare against: many schools
    // already name the class exactly as MASSAR does.
    const report = runChecks(notesFile({ classLabel: "3AP-A" }), unmapped());
    expect(severityOf(report, "CLASS")).toBe("OK");
  });

  it("still offers to adopt a class code that differs", () => {
    const report = runChecks(notesFile({ classLabel: "3APG-1" }), unmapped());
    expect(severityOf(report, "CLASS")).toBe("ADOPTABLE");
  });

  it("says nothing when the file itself carries no value", () => {
    // Blank on their side is not a mismatch either.
    const report = runChecks(notesFile({ schoolCode: null }), held());
    expect(severityOf(report, "SCHOOL_CODE")).toBe("OK");
  });

  it("compares codes without minding their case", () => {
    const report = runChecks(notesFile({ schoolCode: "53747v" }), held());
    expect(severityOf(report, "SCHOOL_CODE")).toBe("OK");
  });
});

// ── The scale, which would corrupt rather than misfile ───────────────────────

describe("the scale", () => {
  it("warns rather than blocks when the two disagree", () => {
    // MASSAR marks a contrôle continu in the primaire out of 10 while the
    // school's own paper is out of 20 — the normal case, not a mistake.
    // Blocking would leave the school with a correct file it can never import.
    const report = runChecks(
      notesFile({ maxScore: 10, pupils: [pupilRow({ score: 7 })] }),
      held(),
    );
    expect(severityOf(report, "MAX_SCORE")).toBe("WARNING");
    expect(report.canProceed).toBe(true);
  });

  it("shows both scales side by side, so the conversion is visible", () => {
    const report = runChecks(
      notesFile({ maxScore: 10, pupils: [pupilRow({ score: 7 })] }),
      held(),
    );
    const check = report.header.find((entry) => entry.id === "MAX_SCORE")!;
    expect(check.expected).toBe("20");
    expect(check.found).toBe("10");
  });

  it("says nothing when the two agree", () => {
    expect(severityOf(runChecks(notesFile(), held()), "MAX_SCORE")).toBe("OK");
  });

  it("judges a mark against the file's own scale, not the paper's", () => {
    // A sheet out of 10 carrying 9 is a fine mark; judged against 20 it would
    // pass, and judged against nothing at all it could be anything.
    const report = runChecks(
      notesFile({ maxScore: 10, pupils: [pupilRow({ score: 12 })] }),
      held(),
    );
    expect(issueIds(report)).toContain("SCORE_RANGE");
    expect(report.matched).toEqual([]);
  });

  it("accepts a mark on the boundary", () => {
    const report = runChecks(
      notesFile({ maxScore: 10, pupils: [pupilRow({ score: 10 })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("SCORE_RANGE");
  });

  it("refuses a negative mark", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ score: -1 })] }),
      held(),
    );
    expect(issueIds(report)).toContain("SCORE_RANGE");
  });

  it("falls back to the paper's scale when the file states none", () => {
    const report = runChecks(
      notesFile({ maxScore: null, pupils: [pupilRow({ score: 25 })] }),
      held(),
    );
    expect(issueIds(report)).toContain("SCORE_RANGE");
  });

  it("falls back to the ordinary /20 when neither the file nor an existing paper says", () => {
    // No file scale and no paper yet — the last-ditch fallback, DEFAULT_MAX_SCORE.
    const report = runChecks(
      notesFile({ maxScore: null, pupils: [pupilRow({ score: 25 })] }),
      held({ assessment: null }),
    );
    expect(issueIds(report)).toContain("SCORE_RANGE");
    const clean = runChecks(
      notesFile({ maxScore: null, pupils: [pupilRow({ score: 20 })] }),
      held({ assessment: null }),
    );
    expect(issueIds(clean)).not.toContain("SCORE_RANGE");
  });
});

// ── Forgiving on the rows ────────────────────────────────────────────────────

describe("one bad row does not stop the sheet", () => {
  it("rejects the row and keeps the rest", () => {
    // An unmapped transfer-in must not hold up the twenty-five marks either
    // side of it.
    const report = runChecks(
      notesFile({
        pupils: [
          pupilRow({ line: 1 }),
          pupilRow({
            line: 2,
            sheetRow: 13,
            massarCode: "R000000000",
            massarNumber: "9999",
          }),
        ],
      }),
      held(),
    );

    expect(report.rejectedLines).toEqual([2]);
    expect(report.matched).toHaveLength(1);
    expect(report.canProceed).toBe(true);
  });

  it("refuses a file whose every row was rejected", () => {
    // A failed import, not an import of nothing.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarCode: "R000000000", massarNumber: "" })] }),
      held(),
    );
    expect(report.matched).toEqual([]);
    expect(report.canProceed).toBe(false);
  });

  it("names the class a pupil is actually in, rather than calling them unknown", () => {
    // Without this every one of them reads as PUPIL_UNKNOWN, which sends a
    // secretary looking for a pupil who is not missing at all.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarCode: "R999", massarNumber: "" })] }),
      held({
        elsewhere: [
          {
            massarCode: "R999",
            massarNumber: null,
            displayName: "العلوي سلمى",
            className: "2APG-2",
          },
        ],
      }),
    );

    const issue = report.rows.find((row) => row.id === "PUPIL_NOT_IN_CLASS");
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe("2APG-2");
    expect(issueIds(report)).not.toContain("PUPIL_UNKNOWN");
  });

  it("calls a pupil nobody holds unknown", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarCode: "R999", massarNumber: "" })] }),
      held(),
    );
    expect(issueIds(report)).toContain("PUPIL_UNKNOWN");
  });

  it("points at the worksheet row, not at a position in a list", () => {
    // So the report can name a cell a secretary must actually go and fix.
    const report = runChecks(
      notesFile({
        pupils: [pupilRow({ line: 3, sheetRow: 42, massarCode: "R999", massarNumber: "" })],
      }),
      held(),
    );
    expect(report.rows[0]).toMatchObject({ line: 3, sheetRow: 42 });
  });
});

// ── Two children being confused ──────────────────────────────────────────────

describe("identity", () => {
  it("rejects the same code written twice", () => {
    const report = runChecks(
      notesFile({
        pupils: [pupilRow({ line: 1 }), pupilRow({ line: 2, sheetRow: 13 })],
      }),
      held(),
    );

    const duplicate = report.rows.find((row) => row.id === "PUPIL_DUPLICATE");
    expect(duplicate).toMatchObject({ line: 2, expected: "line 1" });
    expect(report.matched).toHaveLength(1);
  });

  it("rejects two rows that resolve to the same child by different routes", () => {
    // The bug this closes. One row matched on its printed code and a later row
    // matched on MASSAR's internal number can land on the same pupil while
    // carrying two different codes — so the code-level duplicate check never
    // fired. Both reached `matched`, `saveMarks` upserted on (assessment,
    // enrolment) twice, and the second silently overwrote the first: one child
    // kept whichever mark was lower down the sheet, and nothing said so.
    const report = runChecks(
      notesFile({
        pupils: [
          pupilRow({ line: 1, massarCode: "R185066146", massarNumber: "", score: 14 }),
          pupilRow({
            line: 2,
            sheetRow: 13,
            massarCode: "R999999999",
            massarNumber: "1001",
            score: 4,
          }),
        ],
      }),
      held(),
    );

    expect(report.matched).toHaveLength(1);
    expect(report.matched[0]!.score).toBe(14);
    expect(report.rows.find((row) => row.id === "PUPIL_DUPLICATE")).toMatchObject({
      line: 2,
      expected: "line 1",
    });
  });

  it("still reports the child as present in the file", () => {
    // The first row claimed them, so they are not missing — only the second row
    // is rejected.
    const report = runChecks(
      notesFile({
        pupils: [
          pupilRow({ line: 1, massarNumber: "" }),
          pupilRow({ line: 2, sheetRow: 13, massarCode: "R999999999" }),
        ],
      }),
      held(),
    );
    expect(report.missingFromFile).toEqual([]);
  });

  it("rejects a number that disagrees with the one already held", () => {
    // Not a mapping to fill in — two different children being confused, and
    // writing marks on that basis is the worst thing this importer could do.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarNumber: "2002" })] }),
      held(),
    );

    const issue = report.rows.find((row) => row.id === "PUPIL_NUMBER");
    expect(issue).toMatchObject({ expected: "1001", found: "2002" });
    expect(report.matched).toEqual([]);
  });

  it("adopts a number the school does not hold", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarNumber: "2002" })] }),
      held({ roster: [rosterPupil({ massarNumber: null })] }),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NUMBER");
    expect(report.matched[0]!.adoptMassarNumber).toBe("2002");
  });

  it("adopts nothing when the school already holds the same number", () => {
    const report = runChecks(notesFile(), held());
    expect(report.matched[0]!.adoptMassarNumber).toBeNull();
  });

  it("rejects a birth date that disagrees", () => {
    const report = runChecks(
      notesFile({
        pupils: [
          pupilRow({
            birthDate: new Date(Date.UTC(2012, 8, 14)),
            birthDateRaw: "14/09/2012",
          }),
        ],
      }),
      held(),
    );

    const issue = report.rows.find((row) => row.id === "PUPIL_BIRTH_DATE");
    expect(issue).toMatchObject({ expected: "2012-09-15", found: "14/09/2012" });
    expect(report.matched).toEqual([]);
  });

  it("accepts a row whose birth date the file leaves blank", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ birthDate: null, birthDateRaw: "" })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("PUPIL_BIRTH_DATE");
    expect(report.matched).toHaveLength(1);
  });
});

// ── The names ────────────────────────────────────────────────────────────────

describe("names", () => {
  it("accepts a class list written family-name-first", () => {
    // Which is how MASSAR writes one, while the app stores the halves apart.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "بنعلي أمين" })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NAME");
  });

  it("accepts the other order too", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "أمين بنعلي" })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NAME");
  });

  it("ignores the spacing between the halves", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "بنعلي   أمين" })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NAME");
  });

  it("rejects a name that is somebody else's", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "العلوي سلمى" })] }),
      held(),
    );
    expect(issueIds(report)).toContain("PUPIL_NAME");
    expect(report.matched).toEqual([]);
  });

  it("says nothing when the school holds no Arabic spelling", () => {
    // The Latin one is a transliteration; comparing it to Arabic would fail
    // every row.
    const report = runChecks(
      notesFile(),
      held({ roster: [rosterPupil({ firstNameAr: null, lastNameAr: null })] }),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NAME");
  });

  it("says nothing when the file carries no name", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "" })] }),
      held(),
    );
    expect(issueIds(report)).not.toContain("PUPIL_NAME");
  });

  it("normalises the Arabic before comparing", () => {
    // Diacritics and the alef variants differ between what a school typed and
    // what the ministry prints.
    expect(normaliseArabic("بَنعلي")).toBe(normaliseArabic("بنعلي"));
    expect(normaliseArabic("  بنعلي  ")).toBe(normaliseArabic("بنعلي"));
  });
});

// ── The roster the file does not mention ─────────────────────────────────────

describe("the class list", () => {
  it("reports a child the file leaves out, without blocking", () => {
    // A class genuinely gains and loses children mid-term, and a sheet exported
    // last week is allowed to be one pupil short of today's roster.
    const report = runChecks(
      notesFile(),
      held({
        roster: [
          rosterPupil(),
          rosterPupil({
            enrollmentId: "enrol-2",
            studentId: "student-2",
            massarCode: "R222",
            massarNumber: "1002",
          }),
        ],
      }),
    );

    expect(report.missingFromFile).toHaveLength(1);
    expect(report.missingFromFile[0]!.studentId).toBe("student-2");
    expect(severityOf(report, "ROSTER_SIZE")).toBe("WARNING");
    expect(report.canProceed).toBe(true);
  });

  it("says nothing about the size when everybody is accounted for", () => {
    expect(severityOf(runChecks(notesFile(), held()), "ROSTER_SIZE")).toBe("OK");
  });

  it("counts a child whose row was rejected as mentioned, not as missing", () => {
    // The file did name them; what it said about them was wrong. Reporting both
    // would send a secretary looking for a pupil the report has already
    // explained.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ fullNameAr: "العلوي سلمى" })] }),
      held(),
    );
    expect(issueIds(report)).toContain("PUPIL_NAME");
    expect(report.missingFromFile).toEqual([]);
  });
});

// ── An empty sheet ───────────────────────────────────────────────────────────

describe("a sheet with no marks on it", () => {
  it("warns per row rather than refusing", () => {
    // A sheet downloaded to be filled in here has no marks at all, which is the
    // whole point of the database → Excel direction.
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ score: null, scoreRaw: "" })] }),
      held(),
    );

    expect(issueIds(report)).toContain("SCORE_MISSING");
    expect(report.rejectedLines).toEqual([]);
    expect(report.matched).toHaveLength(1);
    expect(report.canProceed).toBe(true);
  });

  it("says nothing about a pupil recorded absent", () => {
    // "Not there" is an answer; "not marked" is not.
    const report = runChecks(
      notesFile({
        pupils: [pupilRow({ score: null, scoreRaw: "", isAbsent: true })],
      }),
      held(),
    );
    expect(issueIds(report)).not.toContain("SCORE_MISSING");
    expect(report.matched[0]).toMatchObject({ isAbsent: true, score: null });
  });

  it("carries a justified absence through as one", () => {
    const report = runChecks(
      notesFile({
        pupils: [
          pupilRow({ score: null, isAbsent: true, isExcused: true }),
        ],
      }),
      held(),
    );
    expect(report.matched[0]).toMatchObject({ isAbsent: true, isExcused: true });
  });

  it("refuses a file with no pupils at all", () => {
    const report = runChecks(notesFile({ pupils: [] }), held());
    expect(report.canProceed).toBe(false);
  });
});

// ── Only the header blocks ───────────────────────────────────────────────────

describe("what blocks and what does not", () => {
  it("blocks on nothing but a header error", () => {
    const report = runChecks(
      notesFile({ pupils: [pupilRow({ massarCode: "R999", massarNumber: "" })] }),
      held(),
    );
    // A row error is severe and still does not appear in `blocking`.
    expect(report.rows.some((row) => row.severity === "ERROR")).toBe(true);
    expect(report.blocking).toEqual([]);
  });

  it("lists exactly the header checks that failed", () => {
    const report = runChecks(
      notesFile({ schoolCode: "99999X", termNumber: 2 }),
      held(),
    );
    expect([...report.blocking].sort()).toEqual(["SCHOOL_CODE", "TERM"]);
  });

  it("never blocks on a warning", () => {
    const report = runChecks(
      notesFile({
        maxScore: 10,
        teacherLabel: "شخص آخر",
        sequence: null,
        pupils: [pupilRow({ score: 7 })],
      }),
      held(),
    );
    expect(report.blocking).toEqual([]);
    expect(report.canProceed).toBe(true);
  });

  it("shows a teacher who has changed without standing in the way", () => {
    // MASSAR prints whoever it holds, and a mid-year replacement is normal.
    const report = runChecks(notesFile({ teacherLabel: "شخص آخر" }), held());
    expect(severityOf(report, "TEACHER")).toBe("WARNING");
  });

  it("says nothing about a teacher either side leaves blank", () => {
    expect(
      severityOf(runChecks(notesFile({ teacherLabel: null }), held()), "TEACHER"),
    ).toBe("OK");
    expect(
      severityOf(runChecks(notesFile(), held({ teacherName: null })), "TEACHER"),
    ).toBe("OK");
  });
});
