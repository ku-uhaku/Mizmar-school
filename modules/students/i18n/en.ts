/**
 * Students translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The English
 * file defines the shape; `fr` and `ar` are checked against it, so a key added
 * here is a compile error until every language supplies it.
 */
const en = {
  student: {
    tabAttendance: "Attendance",
    tabMarks: "Marks",
    tabRemarks: "Remarks",
    title: "Students",
    subtitle: "Every child on the school's books, enrolled or not.",
    newStudent: "New student",
    editStudent: "Edit student",
    createStudent: "Create student",
    identity: "Identity",
    identityHint: "Who the child is. Where they sit is set by enrolment.",
    essentials: "The essentials",
    essentialsHint: "Just enough to open the file — the rest can wait.",
    moreDetails: "Add more details",
    moreDetailsHint:
      "All optional. You can fill these in later from the pupil's file.",
    createHint: "The rest of the file can be completed once it is created.",
    references: "Reference numbers",
    referencesHint: "How this pupil is identified on paper and in MASSAR.",
    code: "Student number",
    codeHint: "Leave blank to allocate the next one, e.g. E-2025-0431.",
    massarCode: "MASSAR code",
    massarCodeHint: "The pupil's code in the ministry's system.",
    firstName: "First name",
    lastName: "Last name",
    names: "Names and place of birth",
    firstNameAr: "First name (Arabic)",
    lastNameAr: "Last name (Arabic)",
    gender: "Sex",
    birthDate: "Date of birth",
    birthDateHint: "Decides which level the child may be admitted to.",
    birthPlace: "Place of birth",
    birthPlaceAr: "Place of birth (Arabic)",
    nationality: "Nationality",
    nationalId: "National ID (CNIE)",
    nationalIdHint: "For pupils old enough to hold one.",
    photoUrl: "Photo URL",
    age: "Age",
    entryDate: "First joined",
    exitDate: "Left on",
    medical: "Medical",
    medicalNotes: "Medical notes",
    medicalNotesHint: "Allergies and treatments the infirmary must know about.",
    notes: "Notes",
    family: "Family",
    familyHint: "The household file this child belongs to.",
    familyLater:
      "No family file yet? Create the pupil now and attach one later.",
    noFamily: "Not attached to a family yet.",
    attachHint: "Attach the child to a family file to record its guardians.",
    attachFamily: "Attach to a family",
    detachFamily: "Detach from family",
    viewFamily: "Open family file",
    created: "Student file opened.",
    updated: "Student updated.",
    deleted: "Student deleted.",
    codeTaken: "That student number is already in use.",
    massarTaken: "That MASSAR code is already mapped to another pupil.",
    hasEnrolments: "This pupil has enrolments — deactivate the file instead.",
    deleteTitle: "Delete this student file?",
    deleteBody: "“{name}” will be removed.",
    noStudents: "No students yet.",
    searchPlaceholder: "Search by name, student number or MASSAR code…",
    studentColumn: "Student",
    placement: "Placement",
    notPlaced: "Not placed",
    notEnrolled: "Not enrolled",
    tabInformation: "Information",
    tabFamily: "Family",
    tabEnrolment: "Enrolment",
    tabFees: "Fees",
    tabPayment: "Payment",
    tabTimetable: "Timetable",
    workflow: "Progress",
    workflowHint: "Where this file has got to.",
    nextStep: "Next: {step}",
    stepsDone: "{done} of {total}",
    workflowComplete: "This file is complete.",
    steps: {
      FILE: "File opened",
      FAMILY: "Family attached",
      ENROLMENT: "Enrolled",
      CLASS: "Class assigned",
      FEES: "Fees scheduled",
      PAYMENT: "Up to date",
    },
  },
  studentOptions: {
    genders: {
      MALE: "Male",
      FEMALE: "Female",
    },
    statuses: {
      PRE_REGISTERED: "Pre-registered",
      ENROLLED: "Enrolled",
      TRANSFERRED: "Transferred",
      WITHDRAWN: "Withdrawn",
      GRADUATED: "Graduated",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  students: "Students",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    student: "Students",
  },
  codes: {
    "student.view": "View students",
    "student.create": "Open student files",
    "student.update": "Update student files",
    "student.delete": "Delete student files",
  },
} as const;

export default en;
