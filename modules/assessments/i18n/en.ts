/**
 * Assessments translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  assessment: {
    validationQueue: "Awaiting your validation",
    generatedAcross: "{count} papers written across {classes} classes.",
    willCover: "{classes} classes · {subjects} subjects each",
    scope: "Scope",
    scopeHint: "A round of contrôles is normally set for a whole level at once.",
    scopeClass: "One class",
    scopeLevel: "A level",
    scopeYear: "The whole year",
    pickLevel: "Level",
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
    /** The facet option for one round of contrôles, e.g. "No. 2". */
    sequenceLabel: "No. {sequence}",
    massarCode: "MASSAR code",
    massarCodeHint:
      "The id from the sheet's hidden E5. Leave blank so the next NotesCC import can claim this paper itself — a code that is not the sheet's own will block that import.",
    massarPaired: "Paired with a sheet",
    massarAdoptable: "Adoptable",
    massarCodeTaken: "« {title} » already answers for this sheet.",
    massarCodeCleared: "Unpaired — the next import may claim this paper.",
    generateNoClasses: "No class is open this year yet.",
    generateNoTypes:
      "No kind of assessment is configured — add one under Configuration.",
    generateNoOpenTerm:
      "Every term of this year is closed. Reopen one to set new papers under it.",
    scheduledOn: "Sat on",
    notScheduled: "Not dated",
    maxScore: "Out of",
    coefficient: "Weight",
    coefficientHint:
      "Weight within the subject's mark for the term — not the subject's own coefficient.",
    teacher: "Teacher",
    noTeacher: "No teacher assigned",
    notes: "Notes",
    covers: "What it covers",
    coversHint: "The lesson or the pages, as the class is told — \"leçon 3, p.42\".",
    coversPlaceholder: "Lesson, chapter, pages…",
    /** The per-paper date and note, folded away behind each row of the generator. */
    paperDetails: "Date and content",
    progress: "Marking",
    average: "Average",
    stage: "Stage",

    // ── The devoirs review ──────────────────────────────────────────────────
    devoirsReview: "Devoirs review",
    devoirsReviewHint:
      "The homework teachers have set across the school, and what is waiting to be accepted.",
    noDevoirs: "No teacher has set a devoir this year yet.",
    noDevoirsHint:
      "Devoirs are set by teachers from the espace enseignant, or here by the office, and appear in this list either way.",

    // ── Setting one from the office ─────────────────────────────────────────
    setDevoir: "Set a devoir",
    setDevoirTitle: "Set a devoir",
    setDevoirHint:
      "One piece of work for one class — for a colleague who is absent, or who has told the class without recording it.",
    setDevoirDraftHint:
      "Saved as a draft. Publishing it is what opens the mark sheet and tells the families.",
    setDevoirNoTeaching:
      "No class is staffed for this year yet — assign a teacher to a subject first.",
    setDevoirNoKinds:
      "No kind of work is teacher-settable. Make one so under Configuration.",
    classAndSubject: "Class and subject",
    classAndSubjectHint:
      "The pair a teacher is assigned to. The paper answers to whoever holds that post, not to whoever sets it.",
    paperTitle: "Title",
    devoirTitlePlaceholder: "Exercices p.42",

    // ── Whether it weighs on the term ───────────────────────────────────────
    countsTowardAverage: "Counts toward the average",
    countsTowardAverageHint:
      "Untick for revision, a mock or work marked only to show the family where they stand. It is still corrected and still visible — it just never moves the subject's average.",
    doesNotCount: "Not averaged",
    makeCount: "Count it",
    makeNotCount: "Do not average",
    nowCounts: "This paper now counts toward the average.",
    nowDoesNotCount: "This paper no longer counts toward the average.",
    uncountedNeedsNoMarks:
      "It does not weigh on the term, so it can be closed with no marks at all.",
    showingFirst: "Showing the most recent {count}. Narrow the filters to see the rest.",
    allTeachers: "All teachers",
    allClasses: "All classes",

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
    wholeSubjectHint:
      "This kind is sat on the matière as a whole — one paper for اللغة العربية, not one per component. Tick a component instead to set a paper on that alone.",
    orOneComponent: "or one of its components instead",
    allSubjects: "All",
    noneSubjects: "None",
    nothingToGenerate: "Every subject already has this paper.",
    noTeacherAssigned:
      "Nothing was set for {subjects} \u2014 no teacher is assigned to it in this class.",
    unstaffedSubjects:
      "{count} subject(s) cannot be generated until a teacher is assigned to them.",
    noProgramme:
      "This class has no marked subject in its programme — set one up under Configuration first.",
    termClosed: "This term is closed; no assessment can be added to it.",

    // ── One paper ───────────────────────────────────────────────────────────
    editAssessment: "Edit assessment",
    editAssessmentHint:
      "While it is still a draft. Publishing tells the class what it sits and when \u2014 after that, take it back to draft to change it.",
    editLocked:
      "This assessment has been published. Take it back to draft before changing it.",
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

    // ── Handing the marking back and forth ──────────────────────────────────
    submitMarks: "Hand in the marks",
    takeBack: "Take back",
    acceptMarks: "Accept the marks",
    reopen: "Reopen",
    awaitingValidation:
      "Handed in. The office has still to accept these marks.",
    awaitingYourValidation:
      "The teacher has handed in their marking — accept it to make the marks final.",
    cannotValidateIncomplete:
      "Some pupils have neither a mark nor an absence. Finish the sheet before accepting it.",

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

    // ── The appréciation scale ──────────────────────────────────────────────
    scaleTitle: "Remarks",
    scaleSubtitle: "The wording that goes beside a mark, and where each rung starts.",
    scaleHelp:
      "A rung runs from its own threshold up to the next one. Thresholds are a share of whatever the paper is marked out of, so the same scale serves an oral out of 10 and a paper out of 20.",
    scaleEmpty: "No scale. Marks are entered without a suggested remark.",
    scaleFrom: "From",
    scaleCovers: "Out of {max}",
    scaleLabel: "Remark",
    scaleLabelAr: "Remark (Arabic)",
    scaleColour: "Colour",
    scaleActive: "In use",
    scaleAdd: "Add a rung",
    scaleReset: "Restore the usual scale",
    scaleRemove: "Remove this rung",
    scaleSave: "Save the scale",
    scaleSaved: "Scale saved.",
    scaleDuplicateFloor: "Two rungs start at the same threshold.",
    scaleTooMany: "A scale holds at most {max} rungs.",
    scaleNoBottom:
      "No rung starts at 0%, so the lowest marks get no suggested remark.",
    scaleExample: "A mark of {mark}/{max} would read: {label}",

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
      SUBMITTED: "Handed in",
      GRADED: "Marked",
      CANCELLED: "Cancelled",
    },
    /** Whose move it is — see `ASSESSMENT_STAGES`. */
    stages: {
      ALL: "All",
      TO_PUBLISH: "To open",
      MARKING: "Being marked",
      TO_VALIDATE: "To validate",
      DONE: "Validated",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  assessments: "Assessments",
  devoirs: "Devoirs",
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
    "assessment.scale": "Edit the remarks scale",
  },
} as const;

export default en;
