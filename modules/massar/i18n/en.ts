/**
 * MASSAR translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. English
 * defines the shape; `fr` and `ar` are checked against it, so a key added here
 * is a compile error until every language supplies it.
 *
 * `checks` is not decoration. Each key is a check id from
 * `modules/massar/checks.ts` and these are the names a school quotes when it
 * asks why a file was refused — keep them concrete ("Establishment code", not
 * "Identifier mismatch").
 */
const en = {
  massar: {
    title: "MASSAR marks",
    subtitle:
      "Check a NotesCC mark sheet against this school, then import its marks or fill it in from ours.",

    // ── The three steps ───────────────────────────────────────────────────────
    stepType: "1. Say which kind of paper this is",
    stepTypeHint:
      "The contrôle is filed under one of your assessment types. It decides the coefficient; the file decides the scale.",
    assessmentType: "Kind of paper",

    stepUpload: "2. Choose the MASSAR file",
    stepUploadHint:
      "The .xlsx exactly as it came out of MASSAR. Do not resave it from another program — the hidden keys it carries are what identify the class.",
    chooseFile: "Choose a file",
    reading: "Reading the workbook…",
    noFile: "No file chosen yet.",

    stepReview: "3. Check, then choose a direction",
    stepReviewHint: "Nothing is written until you pick one.",

    // ── The summary ───────────────────────────────────────────────────────────
    fileSays: "The file says",
    youHold: "You hold",
    schoolCode: "Establishment",
    className: "Class",
    level: "Level",
    subject: "Subject",
    term: "Term",
    controle: "Contrôle",
    schoolYear: "Year",
    teacher: "Teacher",
    scale: "Marked out of",
    pupilCount: "Pupils",
    massarId: "MASSAR sheet id",
    unmappedKeys: "Keys carried through, unmatched: {keys}",
    unmappedHint:
      "MASSAR puts these in the sheet without saying what they are. They are kept with the file and never compared.",
    notMapped: "not mapped",
    notOnFile: "nothing on file",

    // ── The checks ────────────────────────────────────────────────────────────
    checksTitle: "Checks",
    check: "Check",
    expected: "You hold",
    found: "The file says",
    severity: "Result",
    allChecksPassed: "Every check passed.",
    blockedBy: "Blocked by {count} failed check(s). Nothing can be written until they are fixed.",

    severities: {
      OK: "Matches",
      ADOPTABLE: "Not mapped yet",
      WARNING: "Worth knowing",
      ERROR: "Does not match",
    },

    checks: {
      FILE_SHAPE: "File shape",
      SCHOOL_CODE: "Establishment code",
      SCHOOL_YEAR: "School year",
      LEVEL: "Level",
      CLASS: "Class",
      SUBJECT: "Subject",
      TERM: "Term",
      SEQUENCE: "Contrôle number",
      MAX_SCORE: "Marking scale",
      TEACHER: "Teacher",
      ASSESSMENT_EXISTS: "Contrôle on file",
      ASSESSMENT_IDENTITY: "MASSAR sheet id",
      ROSTER_SIZE: "Class size",
      PUPIL_DUPLICATE: "Pupil listed twice",
      PUPIL_UNKNOWN: "Pupil not on your books",
      PUPIL_NOT_IN_CLASS: "Pupil is in another class",
      PUPIL_NUMBER: "MASSAR pupil number",
      PUPIL_NAME: "Pupil name",
      PUPIL_BIRTH_DATE: "Birth date",
      PUPIL_MISSING_FROM_FILE: "Missing from the file",
      SCORE_RANGE: "Mark outside the scale",
      SCORE_MISSING: "No mark yet",
    },

    // ── The rows ──────────────────────────────────────────────────────────────
    rowsTitle: "Pupils",
    line: "Line",
    cell: "Cell",
    pupil: "Pupil",
    massarCode: "MASSAR code",
    score: "Mark",
    absent: "Absent",
    comment: "Appréciation",
    problem: "Problem",
    matchedCount: "{count} matched",
    rejectedCount: "{count} rejected",
    missingCount: "{count} on the roster but not in the file",
    willAdoptNumber: "Its MASSAR number will be recorded",
    showingFirst: "Showing the first {count} of {total}.",

    // ── The directions ────────────────────────────────────────────────────────
    directionsTitle: "What would you like to do?",

    generateTitle: "Create the contrôle",
    generateHint:
      "Opens the paper this sheet is about and stamps MASSAR's id on it. No marks are written.",
    generate: "Create the contrôle",

    importTitle: "Bring the marks in",
    importHint:
      "Writes the marks and appréciations from the file onto the contrôle, creating it if it is not there yet.",
    import: "Import {count} marks",

    exportTitle: "Fill the sheet from here",
    exportHint:
      "Writes your marks into this same workbook and hands it back, ready to upload to MASSAR. The file keeps its protection and its hidden keys.",
    export: "Download the filled sheet",
    exported: "{count} marks written into the sheet.",

    adoptTitle: "Adopt MASSAR's codes",
    adoptHint:
      "Records the codes this file carries against your class, subject, term and pupils, so the next sheet matches straight away. Only fills what is empty.",
    adopt: "Adopt the codes",

    working: "Working…",

    // ── Results ───────────────────────────────────────────────────────────────
    controleCreated: "The contrôle has been created and carries MASSAR's id.",
    controleExisted: "That contrôle was already on file; MASSAR's id has been recorded on it.",
    imported: "{count} marks imported, {rejected} rows rejected.",
    adopted: "{fields} field(s) mapped, {pupils} MASSAR pupil number(s) recorded.",

    errors: {
      emptyFile: "No file, or the file is too large.",
      notXlsx:
        "That is not an .xlsx workbook. Download the sheet again from MASSAR and upload it without opening it in another program.",
      noSheet: "The workbook has no visible sheet to read.",
      noMarkers:
        "This workbook is not a NotesCC mark sheet — the hidden markers MASSAR writes are not in it.",
      noPupils: "The sheet carries no pupils.",
      blocked: "Some checks failed. Fix them, then upload the file again.",
      noRows: "No pupil in the file could be matched to this class.",
      noType: "That kind of paper does not exist in this school.",
      locked:
        "That contrôle does not accept marks — it is still a draft, or it has been cancelled.",
      outOfRange: "A mark in the file lies outside the paper's scale.",
      assessmentNotFound: "That contrôle is not on this school's books.",
      nothingToAdopt: "There was nothing left to adopt — everything is already mapped.",
    },
  },
} as const;

export const nav = {
  massar: "MASSAR",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    massar: "MASSAR",
  },
  codes: {
    "massar.reconcile": "Check a MASSAR file against the school",
    "massar.import": "Import marks from MASSAR",
    "massar.export": "Fill a MASSAR sheet from our marks",
    "massar.map": "Adopt MASSAR's codes onto classes and pupils",
  },
} as const;

export default en;
