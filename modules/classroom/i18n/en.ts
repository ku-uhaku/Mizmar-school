/**
 * Classroom translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  classroom: {
    title: "Teaching",
    subtitle: "Your classes, your registers and your marking.",

    // ── The workspace home ──────────────────────────────────────────────────
    myClasses: "My classes",
    myTimetable: "My timetable",
    myTimetableHint: "Where you are expected to be, week by week.",
    lessonsPerWeek: "Lessons a week",
    freePeriods: "Free periods",
    freePeriodsHint: "When you can be found.",
    noLessonsThisWeek: "Nothing on your timetable for this schedule.",
    noLessonsThisWeekHint:
      "Lessons appear here once the timetable is drawn for your classes.",
    myClassesHint: "Every class and subject you are assigned to this year.",
    noClasses: "You are not assigned to any class this year.",
    noClassesHint:
      "A class appears here once the head of studies assigns you to it.",
    classesCount: "{count} classes",
    pupilsTaught: "Pupils taught",
    lessonsToday: "Lessons today",
    registersLeft: "Registers to take",
    papersToMark: "Papers to mark",
    remarksThisMonth: "Remarks this month",
    today: "Today",
    noLessonsToday: "No lesson on your timetable today.",
    takeRegister: "Take the register",
    registerTaken: "Register taken",
    openMarkSheet: "Open the mark sheet",

    // ── The register ────────────────────────────────────────────────────────
    attendance: "Attendance",
    attendanceHint: "Who was in the room, and who arrived late.",
    register: "Register",
    lesson: "Lesson",
    wholeDay: "Whole day",
    pupil: "Pupil",
    status: "Status",
    minutesLate: "Minutes late",
    reason: "Reason",
    saveRegister: "Save the register",
    registerSaved: "{count} pupils recorded.",
    markAllPresent: "Everyone present",
    notYourClass: "You do not teach this class.",
    minutesOutOfRange: "Lateness must be between 0 and 120 minutes.",
    thisYear: "This year",
    absencesShort: "{count} abs.",
    latesShort: "{count} late",
    pickLesson: "Choose a class and a subject",
    pickLessonHint:
      "Pick one of your own classes, then the day and the period being marked.",
    justified: "Justified",
    justificationSaved: "Justification updated.",

    // ── Devoirs ─────────────────────────────────────────────────────────────
    devoirs: "Homework",
    devoirsHint: "The work you have set, and the marks on it.",
    newDevoir: "Set homework",
    newDevoirTitle: "Set a piece of homework",
    newDevoirHint:
      "For one of your own classes. It is published straight away, so you can enter marks as soon as it is handed in.",
    devoirCreated: "Homework set.",
    devoirTitle: "Title",
    dueOn: "Due on",
    noDevoirs: "You have not set any homework yet.",
    noDevoirsHint: "Set one and it appears here with its mark sheet.",
    kindNotAllowed: "Your school does not let teachers set that kind of work.",
    noTeacherKinds:
      "Your school has not made any kind of work teacher-settable. Ask for one under Configuration.",

    // ── Remarks ─────────────────────────────────────────────────────────────
    remarks: "Remarks",
    remarksHint: "What you have noted about your pupils.",
    newRemark: "Write a remark",
    newRemarkTitle: "Write a remark",
    remarkAbout: "About",
    remarkKind: "Kind",
    remarkTone: "Tone",
    remarkBody: "Remark",
    remarkBodyHint: "A sentence a colleague — or a parent — would understand.",
    occurredOn: "Observed on",
    visibleToFamily: "Share with the family",
    visibleToFamilyHint:
      "Off by default. An internal note stays between you and your colleagues.",
    internalOnly: "Internal",
    shared: "Shared with the family",
    remarkSaved: "Remark saved.",
    remarkDeleted: "Remark deleted.",
    deleteRemarkTitle: "Delete this remark?",
    deleteRemarkBody: "Your remark about {name} will be removed.",
    notYourRemark: "You can only delete your own remarks.",
    notYourPupil: "You do not teach this pupil.",
    noRemarks: "No remark written yet.",
    noRemarksHint:
      "A remark is the sentence you would otherwise keep in your own notebook.",
    mineOnly: "Only mine",
    searchRemarks: "Search remarks…",
  },
  classroomOptions: {
    attendanceStatuses: {
      PRESENT: "Present",
      LATE: "Late",
      ABSENT: "Absent",
      EXCUSED: "Excused",
    },
    remarkKinds: {
      BEHAVIOUR: "Behaviour",
      WORK: "Work",
      PROGRESS: "Progress",
      ATTENDANCE: "Attendance",
      OTHER: "Other",
    },
    remarkTones: {
      POSITIVE: "Positive",
      NEUTRAL: "Neutral",
      CONCERN: "Concern",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  classroomTimetable: "Timetable",
  classroomAttendance: "Attendance",
  classroomDevoirs: "Homework",
  classroomRemarks: "Remarks",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    classroom: "Teaching",
  },
  codes: {
    "classroom.workspace": "Open the teaching workspace",
    "classroom.attendanceView": "View the register",
    "classroom.attendanceMark": "Take the register",
    "classroom.attendanceJustify": "Accept a justification for an absence",
    "classroom.remarkView": "Read remarks",
    "classroom.remarkWrite": "Write remarks",
    "classroom.remarkPublish": "Share a remark with the family",
  },
} as const;

export default en;
