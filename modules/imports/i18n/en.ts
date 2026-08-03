/**
 * Imports translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 *
 * `columns` is doing more than labelling a screen: these strings are written as
 * the header row of the model file and matched against the header row of an
 * upload, so changing one changes the file format. See modules/imports/columns.ts.
 */
const en = {
  imports: {
    title: "Import pupils",
    subtitle:
      "Load a list of pupils from a spreadsheet. Families and parents are created alongside them.",

    // ── The three steps ─────────────────────────────────────────────────────
    stepTemplate: "1. Take the model file",
    stepTemplateHint:
      "It carries the column headings the import expects, and one example row. Fill it in Excel, then delete the example.",
    downloadTemplate: "Download the model file",

    stepUpload: "2. Choose your file",
    stepUploadHint:
      "CSV, semicolons or commas — whichever your Excel saves. Extra columns are ignored, so a file with more in it is fine.",
    chooseFile: "Choose a file",
    reading: "Reading the file…",

    stepReview: "3. Check, then confirm",
    stepReviewHint: "Nothing is saved until you confirm.",

    // ── The preview ─────────────────────────────────────────────────────────
    willCreate: "{count} to create",
    willSkip: "{count} already on file",
    willReject: "{count} rejected",
    newFamilies: "{count} dossiers opened",
    ignoredColumns: "Columns ignored: {columns}",
    missingColumns:
      "The file is missing a required column: {columns}. Take the model file and copy your data into it.",
    line: "Line",
    outcome: "Outcome",
    pupil: "Pupil",
    outcomeCreate: "Create",
    outcomeSkip: "Skip",
    outcomeReject: "Rejected",
    problem: "Problem",
    attachedTo: "Joins dossier {code}",
    showingFirst: "Showing the first {count} lines of {total}.",
    allGood: "Every line can be imported.",

    confirm: "Import {count} pupils",
    importing: "Importing…",
    imported: "{count} pupils imported, {families} dossiers opened.",
    enrolled: "{count} pupils imported, {families} dossiers opened, {enrolled} inscriptions with their fee schedule.",
    willEnrol: "{count} inscriptions",

    // ── Export ──────────────────────────────────────────────────────────────
    exportTitle: "Export pupils",
    exportHint:
      "Every pupil with their dossier and parents, in the same format this screen imports — so a file taken out can be brought back in.",
    exportAction: "Export to Excel",
    exporting: "Preparing…",
    exported: "{count} rows exported.",
    exportEmpty: "There is no pupil to export yet.",

    errors: {
      emptyFile: "That file is empty.",
      fileTooLarge: "That file is too large. Split it and import in two goes.",
      notCsv: "Save the file as CSV from Excel, then choose it again.",
      nothingToImport: "Nothing in that file could be imported.",
      requiredColumn: "{column} is required.",
      badDate:
        "{column}: “{value}” is not a date the import reads. Write it as 15/09/2012.",
      badGender: "“{value}” is not a sex the import reads. Write F or M.",
      alreadyOnFile: "Already on file as {name} ({code}).",
      duplicateInFile: "Same pupil as line {line} of this file.",
      unknownLevel: "Level “{value}” is not open this year. Levels open: {available}.",
      unknownClass: "Class “{value}” does not exist in {level}. Classes: {available}.",
      unknownRoute: "Bus line “{value}” does not exist. Lines: {available}.",
      unknownStop: "Stop “{value}” is not on line {route}. Stops: {available}.",
      noSchoolYear: "Select a school year before importing inscriptions.",
      alreadyEnrolled: "Already enrolled this year.",
    },

    /**
     * Header row of the file. Changing one of these changes the format the
     * model file is written with — the old spelling stays readable because
     * `columns.ts` keeps it as an alias.
     */
    columns: {
      code: "Matricule",
      massarCode: "MASSAR",
      lastName: "Surname",
      firstName: "First name",
      lastNameAr: "النسب",
      firstNameAr: "الاسم",
      gender: "Sex",
      birthDate: "Date of birth",
      nationality: "Nationality",
      neighbourhood: "Neighbourhood",
      familyName: "Family",
      familyPhone: "Family phone",
      familyEmail: "Family email",
      addressLine: "Address",
      city: "Town",
      fatherLastName: "Father — surname",
      fatherFirstName: "Father — first name",
      fatherNationalId: "Father — CIN",
      fatherPhone: "Father — phone",
      fatherProfession: "Father — occupation",
      motherLastName: "Mother — surname",
      motherFirstName: "Mother — first name",
      motherNationalId: "Mother — CIN",
      motherPhone: "Mother — phone",
      motherProfession: "Mother — occupation",
      levelCode: "Level",
      trackCode: "Stream",
      className: "Class",
      enrolledOn: "Enrolment date",
      isRepeating: "Repeating",
      usesTransport: "Transport",
      routeName: "Bus line",
      stopName: "Stop",
      usesCanteen: "Canteen",
    },
  },
} as const;

export const permissions = {
  groups: {
    import: "Bulk loading",
  },
  codes: {
    "import.students": "Import pupils from a spreadsheet",
  },
} as const;

export default en;
