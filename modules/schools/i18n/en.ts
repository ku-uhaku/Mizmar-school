/**
 * Schools translations (en).
 *
 * Merged into the app dictionary by `lib/i18n/dictionaries/en.ts`. The
 * English file defines the shape; `fr` and `ar` are checked against it, so a
 * key added here is a compile error until every language supplies it.
 */
const en = {
  school: {
    title: "Schools",
    subtitle: "Every school run by the organisation.",
    newSchool: "New school",
    editSchool: "Edit school",
    createSchool: "Create school",
    code: "Code",
    codeHint: "Short unique identifier, e.g. AL-AMAL-CASA",
    name: "Name",
    level: "Level",
    director: "Director",
    capacity: "Capacity",
    email: "Email",
    phone: "Phone",
    website: "Website",
    logoUrl: "Crest",
    logoHint: "Shown in the sidebar while this school is selected.",
    addressLine: "Street address",
    city: "City",
    region: "Region",
    postalCode: "Postal code",
    country: "Country",
    status: "Status",
    statusDescription: "Inactive schools stay in the list but are flagged everywhere.",
    years: "Years",
    members: "Members",
    created: "School created.",
    updated: "School updated.",
    deleted: "School deleted.",
    deleteTitle: "Delete this school?",
    deleteBody: "“{name}” and all of its school years and role assignments will be permanently removed.",
    hasStudents:
      "{count} pupils are on this school's books. Deactivate it instead — deleting it would remove them and everything recorded about them.",
    codeTaken: "That code is already used by another school.",
    massarTaken: "Another school is already mapped to that MASSAR code.",
    noSchools: "No schools yet. Create the first one.",
    searchPlaceholder: "Search by name, code or city…",
    configure: "Configure",
    setupTitle: "Set up this school",
    setupBody:
      "Calendar, time slots, academic structure, cities — everything a new school needs before enrolling pupils.",
    setupGeneralAction: "General configuration",
    setupYearsAction: "School years",
    levels: {
      PRESCHOOL: "Preschool",
      PRIMARY: "Primary",
      MIDDLE: "Middle school",
      HIGH: "High school",
      GROUP: "School group",
    },
  },
} as const;

/** Sidebar labels this module contributes to the `nav` namespace. */
export const nav = {
  schools: "Schools",
} as const;

/** Permission matrix labels for this module's own codes. */
export const permissions = {
  groups: {
    school: "Schools",
  },
  codes: {
    "school.view": "View schools",
    "school.create": "Create schools",
    "school.update": "Update schools",
    "school.delete": "Delete schools",
  },
} as const;

export default en;
