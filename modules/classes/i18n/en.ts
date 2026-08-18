/**
 * Classes translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  schoolClass: {
    title: "Classes",
    subtitle: "The cohorts running this year — who sits in them, who teaches them.",
    noClasses: "No classes for this year yet.",
    noClassesHint: "Open a level in Configuration, then create its classes.",
    searchPlaceholder: "Search by class code, level or cycle…",
    classColumn: "Class",
    level: "Level",
    cycle: "Cycle",
    mainTeacher: "Form teacher",
    room: "Room",
    capacity: "Capacity",
    enrolled: "Enrolled",
    fill: "{enrolled} / {capacity}",
    noCapacity: "No cap",
    overCapacity: "Over capacity",
    groups: "Groups",
    lessons: "Lessons",

    tabOverview: "Overview",
    tabRoster: "Students",
    tabTeaching: "Teachers",
    tabTimetable: "Timetable",
    tabControls: "Assessments",
    tabDevoirs: "Devoirs",

    // ── The overview tab: this class, and the niveau it sits at ─────────────
    overviewStaffed: "Subjects covered",
    overviewOfSubjects: "of {count} on the programme",
    overviewProgrammeHours: "{hours} h a week on the programme",
    overviewGroups: "Groups",
    overviewAverageAge: "Average age {age}",
    overviewRepeating: "Repeating",
    overviewFill: "Occupancy",
    overviewProgramme: "The level's programme",
    overviewProgrammeHint:
      "What {level} is taught, and who answers for it in this class — {hours} h a week.",
    overviewWeeklyHours: "Hours",
    overviewUnstaffed: "No teacher",
    overviewNoProgramme:
      "This level has no programme yet. Declare its subjects under Configuration.",
    overviewSameProgramme: "same programme",
    overviewSisters: "Classes at this level",
    overviewSistersHint: "{classes} classes at {level}, {enrolled} pupils in all.",
    // ── Results and the carnet ─────────────────────────────────────────────
    overviewAverage: "Class average",
    overviewOutOf: "out of {outOf} — {term}",
    overviewHoursBySubject: "Hours per subject",
    overviewHoursHint: "{hours} h a week across {subjects} subjects.",
    overviewCoverage: "Coverage",
    overviewCoverageHint: "How much of what the level promises is actually in place.",
    overviewStaffedCaption: "{staffed} of {subjects} subjects have a teacher.",
    overviewCoverageCaption: "{placed} of {needed} periods placed.",
    overviewResults: "Results",
    overviewResultsHint:
      "{term}: {computed} reports computed, {published} issued.",
    overviewNoResults: "No reports yet",
    overviewNoResultsHint:
      "Nothing to average yet. Reports are computed for the class council, and this fills in from them.",
    overviewSpread: "lowest {lowest} · highest {highest}",
    overviewPassRate: "Pass rate",
    overviewPassMark: "At or above {mark} out of {outOf}.",
    overviewBySubject: "Class average by subject",
    overviewNoSubjectAverages: "No subject has been marked yet.",
    overviewRemarks: "Remarks",
    overviewRemarksHint: "{count} recent remarks, {concerns} of them concerns.",
    overviewNoRemarks: "Nothing has been written about this class yet.",
    // ── The week, the register and the terms, charted ──────────────────────
    overviewLoadByDay: "Periods per day",
    overviewLoadByDayHint: "How the {placed} placed periods fall across the week.",
    overviewPeriods: "Periods",
    overviewDay: "Day",
    overviewNoTimetable: "No timetable has been drawn for this class yet.",
    overviewAttendance: "Attendance",
    overviewAttendanceHint:
      "{marked} marks taken this year, {unjustified} absences still unjustified.",
    overviewAttendanceByMonth: "Attendance month by month",
    overviewNoAttendance: "No register has been taken for this class yet.",
    overviewAverageByTerm: "Average by term",
    overviewAverageByTermHint:
      "The class average as each term's reports were computed.",
    overviewSistersFill: "Pupils per class",
    newControl: "New assessment",
    newDevoir: "New devoir",

    roster: "Roster",
    rosterHint: "Pupils seated in this class for the year.",
    rosterAssignHint:
      "Move pupils between the two lists. The left holds everyone enrolled at this level with no class yet.",
    tabAssign: "Assign",
    tabList: "Class list",
    availableTitle: "Enrolled, no class",
    assignedTitle: "In {class}",
    studentsRemoved: "{count} students taken out of the class.",
    seatsLeftHint: "{count} seats left in this class.",
    emptyRoster: "Nobody in this class yet.",
    emptyRosterHint: "Add pupils enrolled at this level but not yet seated.",
    noCandidates: "Everyone enrolled at this level already has a class.",
    studentsAdded: "{count} students added.",
    group: "Group",
    noGroup: "No group",
    viewList: "List view",
    viewCards: "Card view",
    setGroup: "Move to group",

    teaching: "Teaching assignments",
    subjectColumn: "School unit",
    teacherColumn: "Teacher",
    pickTeacher: "Choose a teacher",
    unstaffedSubjects: "{count} subjects have no teacher yet.",
    teacherCleared: "Teacher removed.",
    teachingHint: "Who is answerable for each subject in this class.",
    emptyTeaching: "No subjects assigned yet.",
    emptyTeachingHint: "Assign a teacher to each subject on the programme.",
    assignTeacher: "Assign a teacher",
    editAssignment: "Edit assignment",
    subject: "Subject",
    teacher: "Teacher",
    weeklyMinutes: "Weekly minutes",
    weeklyMinutesHint: "Usually the programme's load. Leave blank to use it.",
    isPrimary: "Answerable for marks",
    isPrimaryHint: "Exactly one teacher per subject holds this.",
    primaryBadge: "Marks",
    wholeClass: "Whole class",
    assignmentSaved: "Assignment saved.",
    assignmentDeleted: "Assignment removed.",
    assignmentExists: "That teacher already covers this subject here.",
    teacherUnavailable: "That teacher has no access to this school.",
    deleteAssignmentTitle: "Remove this assignment?",
    deleteAssignmentBody: "“{name}” will no longer cover {subject} here.",
    openTimetable: "Open the full timetable",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  classes: "Classes",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    class: "Classes",
  },
  codes: {
    "class.view": "View classes",
    "class.roster": "Manage class rosters",
    "class.assignTeacher": "Assign teachers to subjects",
  },
} as const;

export default en;
