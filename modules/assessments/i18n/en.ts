/**
 * Assessments translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  assessment: {
    assessment: "Paper",
    noMarksYet: "No marks yet.",
    noMarksHint: "Marks appear here as teachers enter them.",
    overallAverage: "Overall average",
    marksCounted: "{count} marks entered",
    coefficientShort: "coeff. {value}",
    notCounted: "not averaged",
    title: "Assessments",
    subtitle: "The marked work of the term, and the marks on it.",

    // ── The list ────────────────────────────────────────────────────────────
    paper: "Assessment",
    papers: "Assessments",
    noAssessments: "No assessment has been set for this class and term yet.",
    noAssessmentsHint:
      "Generate a whole round in one go, or add a single paper by hand.",
    searchPlaceholder: "Search by title, subject or class…",
    subject: "Subject",
    class: "Class",
    term: "Term",
    kind: "Kind",
    sequence: "Number",
    sequenceHint: "Which one of its kind within the term — 1 for the first.",
    scheduledOn: "Sat on",
    notScheduled: "Not dated",
    maxScore: "Out of",
    coefficient: "Weight",
    coefficientHint:
      "Weight within the subject's mark for the term — not the subject's own coefficient.",
    teacher: "Teacher",
    noTeacher: "No teacher assigned",
    notes: "Notes",
    progress: "Marking",
    average: "Average",

    // ── The generator ───────────────────────────────────────────────────────
    generate: "Generate a round",
    generateTitle: "Generate a round of assessments",
    generateHint:
      "Writes one paper per marked subject of this class's programme. Running it twice changes nothing — subjects that already have this paper are left alone.",
    generated: "{count} assessments created, {skipped} already existed.",
    noSubjectsChosen: "Tick at least one subject.",
    subjectsToGenerate: "Subjects",
    subjectsToGenerateHint:
      "Untick what is not sat, and give each paper its own date — a round is spread over a week, not one morning.",
    allSubjects: "All",
    noneSubjects: "None",
    nothingToGenerate: "Every subject already has this paper.",
    noProgramme:
      "This class has no marked subject in its programme — set one up under Configuration first.",
    termClosed: "This term is closed; no assessment can be added to it.",

    // ── One paper ───────────────────────────────────────────────────────────
    editAssessment: "Edit assessment",
    saved: "Assessment saved.",
    deleted: "Assessment deleted.",
    deleteTitle: "Delete this assessment?",
    deleteBody: "“{name}” will be removed.",
    cannotDeleteMarked:
      "This assessment has marks against it — cancel it instead of deleting it.",
    maxScoreBelowMarks:
      "Some marks are already above that. Correct them before lowering the total.",
    statusChanged: "Status updated.",
    cannotUnpublish:
      "Marks have already been entered — this assessment cannot go back to draft.",
    publish: "Publish",
    unpublish: "Back to draft",

    // ── The mark sheet ──────────────────────────────────────────────────────
    markSheet: "Mark sheet",
    pupil: "Pupil",
    score: "Mark",
    absent: "Absent",
    excused: "Justified",
    comment: "Remark",
    saveMarks: "Save the marks",
    marksSaved: "{count} marks recorded.",
    notPublished:
      "This assessment is not published yet — publish it before entering marks.",
    scoreOutOfRange: "Marks must be between 0 and {max}.",
    emptyRoster: "Nobody is seated in this class yet.",
    markedOf: "{marked} of {total} marked",
    pending: "Still to mark",
    passMarkIs: "Pass at {mark}/{max}.",
    passRate: "Pass rate",
    lowest: "Lowest",
    highest: "Highest",
    absencesExcluded: "Absences are excluded from the average.",
    markAllAbsent: "Mark the rest absent",
    clearMarks: "Clear",

    // ── Summary ─────────────────────────────────────────────────────────────
    awaitingMarks: "Awaiting marks",
    awaitingMarksHint: "Published papers nobody has finished marking.",
    drafts: "Drafts",
    draftsHint: "Planned but not yet announced.",
    gradesEntered: "Marks entered",
  },
  assessmentOptions: {
    statuses: {
      DRAFT: "Draft",
      PUBLISHED: "Published",
      GRADED: "Marked",
      CANCELLED: "Cancelled",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "Assessments",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    assessment: "Assessments",
  },
  codes: {
    "assessment.view": "View assessments and marks",
    "assessment.manage": "Set and generate assessments",
    "assessment.grade": "Enter marks",
    "assessment.publish": "Publish and withdraw assessments",
    "assessment.delete": "Delete assessments",
  },
} as const;

export default en;
