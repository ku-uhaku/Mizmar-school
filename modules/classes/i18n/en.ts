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
    searchPlaceholder: "Search by class code or level…",
    classColumn: "Class",
    level: "Level",
    mainTeacher: "Form teacher",
    room: "Room",
    capacity: "Capacity",
    enrolled: "Enrolled",
    fill: "{enrolled} / {capacity}",
    noCapacity: "No cap",
    overCapacity: "Over capacity",
    groups: "Groups",
    lessons: "Lessons",

    tabRoster: "Students",
    tabTeaching: "Teachers",
    tabTimetable: "Timetable",

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
