/**
 * School-life translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  schoolLife: {
    title: "School life",
    subtitle: "{school} — {year}, as it stands today.",
    noYear: "Select a school year to see this year's figures.",
    students: "Students",
    studentsDetail: "{count} enrolled",
    families: "Family files",
    familiesDetail: "Households on the books",
    pending: "Pending enrolments",
    pendingDetail: "Applied, not confirmed",
    unplaced: "Awaiting a class",
    unplacedDetail: "Enrolled but not seated",
    billed: "Billed this year",
    billedDetail: "Net of reductions",
    discounted: "Reductions granted",
    byLevel: "Pupils by level",
    byLevelHint: "Across the levels this school opened this year.",
    classFill: "How full the classes are",
    classFillHint: "Enrolled against capacity.",
    noClasses: "No classes opened yet.",
    noLevels: "No levels opened for this year.",
    pipeline: "What needs doing",
    pipelineHint: "Files that have not finished their parcours.",
    allDone: "Nothing outstanding.",
    familiesHint: "The dossiers, who to call, and the children in each.",
    studentsHint: "Every child on the roll, their level and their class.",
    classesHint: "The cohorts of the year, and how full each one is running.",
    timetableHint: "The week each class follows, lesson by lesson.",
    unplacedCount: "{count} to place",
    openStudents: "Open the student list",
    openClasses: "Open the class list",

    search: "Search",
    searchPlaceholder: "Search students, families, classes…",
    searchHint: "Type at least two characters.",
    searchEmpty: "Nothing found.",
    searchStudents: "Students",
    searchFamilies: "Families",
    searchClasses: "Classes",
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    schoolLife: "School life",
  },
  codes: {
    "schoolLife.view": "View the school-life overview",
  },
} as const;

export default en;
