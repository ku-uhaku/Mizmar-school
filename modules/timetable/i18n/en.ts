/**
 * Timetable translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  timetable: {
    endedAtWeek: "Ended after week {week}. Earlier weeks are untouched.",
    savedFromWeek: "Changed from week {week}. Earlier weeks keep what was taught.",
    applyToFollowing: "Apply to the following weeks",
    applyToFollowingHint:
      "On: it runs from this week until further notice. Off: this week only — a one-off swap that leaves the pattern alone.",
    teacherUnavailable: "This teacher does not work in that period. {class}",
    weeksGenerated: "{count} weeks laid out for the year.",
    generateWeeks: "Lay out the year's weeks",
    generateWeeksHint:
      "Numbers every week the school teaches in, skipping the holidays, and alternates A and B. Safe to run again — it renumbers rather than duplicates.",
    weekParity: "Weeks",
    weekParityHint:
      "Which weeks of the rotation this lesson runs in. Leave it on every week unless it is fortnightly.",
    title: "Timetable",
    subtitle: "The week for one class. Click a slot to place a lesson.",
    pickClass: "Choose a class",
    pickClassHint: "Each class has its own grid.",
    noClasses: "No classes for this year yet.",
    noClassesHint: "Open a level and create its classes first.",
    noSlots: "No bell schedule for this year.",
    noSlotsHint: "Set the periods up in Configuration before drawing a grid.",
    scheduleKind: "Schedule",
    lessons: "{count} lessons",
    free: "Free",
    breakLabel: "Break",
    closed: "Closed",
    addLesson: "Place a lesson",
    editLesson: "Edit this lesson",
    subject: "Subject",
    subjectHint: "The class's own programme.",
    teacher: "Teacher",
    teacherHint: "Filled in from the teaching assignment when there is one.",
    room: "Room",
    roomHint: "Falls back to the class's home room.",
    group: "Group",
    groupHint: "Set when only one half of the class attends.",
    term: "Semester",
    termHint: "Leave empty for a lesson that runs all year.",
    allYear: "All year",
    wholeClass: "Whole class",
    saved: "Lesson placed.",
    duration: "Duration",
    durationHint: "A double period is one lesson across two consecutive slots.",
    periods: "{count} periods",
    repeatOn: "Repeat on other days",
    repeatOnHint:
      "Places the same lesson in this slot on the days you tick. The clicked day is always included.",
    savedMany: "Lesson placed in {count} slots.",
    classClash: "This class already has a lesson at {slot}.",
    cleared: "Slot cleared.",
    clearSlot: "Clear this slot",
    teacherClash: "That teacher is already teaching {class} at {slot}.",
    roomClash: "That room is already taken by {class} at {slot}.",
    slotUnavailable: "That period does not belong to this year.",
    slotIsBreak: "That period is a break — no lesson can be placed in it.",
    openClass: "Open the class",
    weekCoverage: "{filled} of {total} periods filled",
    day: "Day",
    weekNumber: "Week {number}",
    exceptionSaved: "This week's timetable updated.",
    exceptionCleared: "Back to the usual timetable.",
    weekOutsideYear: "That week is not part of the school year.",
    thisWeekOnly: "This week only",
    thisWeekOnlyHint:
      "Changes week {number} and nothing else. The usual timetable is untouched.",
    cancelLesson: "Cancel this lesson",
    reason: "Reason",
    reasonPlaceholder: "School trip, catch-up session…",
    replaceLesson: "Replace this lesson",
    backToUsual: "Back to the usual lesson",
    cancelledThisWeek: "Cancelled",
    teacherAway: "{name} is away",
    coveredBy: "Covered by {name}",
    notCovered: "Not covered",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    holidayWeek: "No lessons this week — {name}.",
    holidayDay: "{name}",
    generateGrid: "Generate the timetable",
    generateGridHint:
      "Lays out the week from the weekly hours in the programme, around what each teacher and room is already doing. Nothing is written until you keep it.",
    generateDraw: "Draw a timetable",
    reroll: "Draw another",
    applyGrid: "Keep this timetable",
    gridApplied:
      "{written} periods written across {classes} class(es); {cleared} replaced.",
    gridAppliedAssigned:
      "{written} periods written across {classes} class(es); {cleared} replaced, {assigned} teacher(s) assigned.",
    teachersAssigned: "{count} teacher(s) will be assigned",
    generateScope: "Lay out",
    scopeThisClass: "This class only",
    scopeAllClasses: "Every class ({count})",
    maxPerDay: "Same subject per day",
    periodsPerDay: "{count} period(s) at most",
    replaceExisting: "Start from an empty week",
    replaceExistingHint:
      "The class's current lessons are cleared and the whole week is drawn again.",
    fillGapsHint:
      "Current lessons are kept, and only the hours still missing from the programme are placed.",
    allowDoubles: "Allow double periods",
    allowDoublesHint:
      "Puts two consecutive hours of a subject together where the day allows it. Never across a break.",
    periodsPlaced: "{placed} of {requested} periods placed",
    classesCovered: "{count} classes",
    understaffed: "Not enough teachers for this programme",
    understaffedHint:
      "The programme asks for {demand}h of teaching a week and the available teachers can give {available}h. {missing}h cannot be staffed however the week is arranged — the grid below is what does fit.",
    shortfalls: "Could not be fitted",
    periodsMissing: "{count} period(s) short",
    noWeeklyHours: "No weekly hours declared, so left out",
    noTeacherAssigned: "Placed, but nobody is assigned to teach them",
    days: {
      "1": "Monday",
      "2": "Tuesday",
      "3": "Wednesday",
      "4": "Thursday",
      "5": "Friday",
      "6": "Saturday",
    },
    daysShort: {
      "1": "Mon",
      "2": "Tue",
      "3": "Wed",
      "4": "Thu",
      "5": "Fri",
      "6": "Sat",
    },
    weekParities: {
      ALL: "Every week",
      A: "Week A",
      B: "Week B",
    },
    scheduleKinds: {
      STANDARD: "Standard",
      RAMADAN: "Ramadan",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  timetable: "Timetable",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    timetable: "Timetable",
  },
  codes: {
    "timetable.view": "View timetables",
    "timetable.manage": "Place and clear lessons",
  },
} as const;

export default en;
